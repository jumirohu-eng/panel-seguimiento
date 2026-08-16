import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import {
  getClienteById,
  getEntrenadorByEmail,
  getCamposCheckinByEntrenador,
  getCheckinTiposByEntrenador,
  getRegistrosCheckinByClienteEmail,
  getObjetivosByClienteEmail,
  borrarRegistrosCheckin,
  AirtableRecord,
  CheckinTipoFields,
  RegistroCheckinFields,
  EntrenadorFields,
} from '@/lib/airtable'
import {
  resolverCamposEfectivos,
  resolverNombreTipoHistorico,
  deserializarValor,
  resolverProgramacionTipo,
  inicioVentanaRegistro,
  agruparPorFrecuencia,
  CampoCheckinResuelto,
  FrecuenciaCheckin,
} from '@/lib/checkinFields'
import {
  resolverObjetivo,
  resolverEstadoCheckinTipo,
  PERIODICIDAD_A_TIPO_CHECKIN,
  ObjetivoResuelto,
  VentanaActual,
} from '@/lib/objetivos'
import { CheckinEnvio, ChecklinsResponse, PendientesCheckin } from '@/lib/types'

const PAGE_SIZE = 7

// `Last_modified` es un campo formula de Airtable y llega SIN sufijo de zona horaria
// (p. ej. "2026-08-16T00:52:37.000", a diferencia de `Fecha`/`Ventana_inicio`, que sí
// incluyen "Z") — `new Date(...)` directo lo interpretaría como hora LOCAL del proceso que
// ejecuta el código, no UTC, desplazando el timestamp según la zona horaria del entorno.
// Todo el resto de este proyecto calcula fechas en UTC explícito a propósito (ver
// checkinFields.ts) — este helper mantiene esa misma garantía para `Last_modified`.
function comoInstanteUTCMs(fechaAirtable: string): number {
  const tieneZonaHoraria = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(fechaAirtable)
  return new Date(tieneZonaHoraria ? fechaAirtable : `${fechaAirtable}Z`).getTime()
}

// Mismo cálculo que la tarjeta "Revisión" del dashboard del cliente (estado.yaEnviado +
// exclusión de campos de objetivo, ver resolverEstadoCheckinTipo en objetivos.ts) — nunca se
// inventa una segunda noción de "pendiente" distinta de la que ya ve el propio cliente (ver
// DECISIONS.md, resiliencia: misma lógica en ficha y dashboard). Un cliente inactivo nunca
// tiene pendientes (no puede acceder a su propio check-in para completarlos).
function calcularPendientes(
  clienteEstado: string | undefined,
  entrenador: AirtableRecord<EntrenadorFields> | null,
  filasTipos: AirtableRecord<CheckinTipoFields>[],
  camposResueltos: CampoCheckinResuelto[],
  registros: AirtableRecord<RegistroCheckinFields>[],
  objetivosResueltos: ReturnType<typeof resolverObjetivo>[]
): PendientesCheckin {
  if (clienteEstado !== 'Activo') return { diario: false, semanal: false, periodico: false }

  const filaPorTipo = new Map(filasTipos.map((f) => [f.fields.Tipo, f.fields]))
  const grupos = agruparPorFrecuencia(camposResueltos)
  const camposPorId = new Map(camposResueltos.map((c) => [c.id, c]))
  const diaSemanaCheckin = filaPorTipo.get('semanal')?.Dia_semana ?? 'lunes'

  const objetivosVigentes = objetivosResueltos.filter((o) => o.activo && o.vigenteHoy && o.progreso !== null)
  const objetivosPorTipo = new Map<FrecuenciaCheckin, ObjetivoResuelto[]>([
    ['diario', []],
    ['semanal', []],
    ['periodico', []],
  ])
  for (const o of objetivosVigentes) {
    // Mismo criterio que GET /api/cliente/checkin: un objetivo sin frecuencia fija (solo
    // posible en modo valor_objetivo) no se agrupa por tipo de check-in.
    if (!o.periodicidad) continue
    objetivosPorTipo.get(PERIODICIDAD_A_TIPO_CHECKIN[o.periodicidad])!.push(o)
  }
  const idsFuenteObjetivo = new Set(objetivosVigentes.filter((o) => o.fuenteFieldId).map((o) => o.fuenteFieldId!))

  const ahoraMs = Date.now()
  function pendientePara(tipo: FrecuenciaCheckin, campos: CampoCheckinResuelto[]): boolean {
    const programacion = resolverProgramacionTipo(filaPorTipo.get(tipo), entrenador?.fields.Checkin_disponible_desde)
    const inicioMs = inicioVentanaRegistro(tipo, diaSemanaCheckin, programacion, ahoraMs)
    const ventanaActual: VentanaActual | null = inicioMs === null ? null : { inicioMs, inicioISO: new Date(inicioMs).toISOString() }
    const estado = resolverEstadoCheckinTipo({
      tipo,
      campos,
      programacion,
      registros,
      camposPorId,
      idsFuenteObjetivoGlobal: idsFuenteObjetivo,
      objetivosDelTipo: objetivosPorTipo.get(tipo) ?? [],
      ventanaActual,
      ahoraMs,
    })
    // Solo cuenta como pendiente si hay de verdad alguna pregunta de REVISIÓN (no solo
    // campos de objetivo) — los objetivos tienen su propia UI de progreso en la ficha,
    // independiente de esto (ver CLAUDE.md, "Objetivos independientes de Revisiones").
    const camposRevision = estado.campos.filter((c) => !idsFuenteObjetivo.has(c.id))
    return estado.lanzado && camposRevision.length > 0 && !estado.yaEnviado
  }

  return {
    diario: pendientePara('diario', grupos.diario),
    semanal: pendientePara('semanal', grupos.semanal),
    periodico: pendientePara('periodico', grupos.periodico),
  }
}

export async function GET(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const clienteId = request.nextUrl.searchParams.get('clienteId')
  if (!clienteId) {
    return NextResponse.json({ error: 'Falta el parámetro clienteId' }, { status: 400 })
  }
  const page = Number(request.nextUrl.searchParams.get('page') ?? '0') || 0

  try {
    const cliente = await getClienteById(clienteId)
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }
    if (cliente.fields.Entrenador !== email) {
      return NextResponse.json({ error: 'No tienes acceso a este cliente' }, { status: 403 })
    }
    if (!cliente.fields.Email) {
      return NextResponse.json({ error: 'El cliente no tiene email configurado en Airtable' }, { status: 400 })
    }

    const [entrenador, filasTipos, filasConfig, registros, filasObjetivos] = await Promise.all([
      getEntrenadorByEmail(email),
      getCheckinTiposByEntrenador(email),
      getCamposCheckinByEntrenador(email),
      getRegistrosCheckinByClienteEmail(cliente.fields.Email),
      getObjetivosByClienteEmail(cliente.fields.Email),
    ])
    const camposResueltos = resolverCamposEfectivos(filasConfig)
    const camposPorId = new Map(camposResueltos.map((c) => [c.id, c]))
    const filaPorTipoHist = new Map(filasTipos.map((f) => [f.fields.Tipo, f.fields]))
    const diaSemanaHist = filaPorTipoHist.get('semanal')?.Dia_semana ?? 'lunes'

    // Identidad de agrupación de una fila para el historial (DEC-2026-052): "un guardado
    // dentro de la misma ventana de check-in es una única revisión". Filas nuevas (con
    // `Ventana_inicio` persistido) agrupan por ese valor exacto. Filas legacy (sin
    // `Ventana_inicio`, anteriores a este cambio) agrupan por una ventana RECONSTRUIDA en
    // vivo con la programación vigente — con el riesgo ya documentado de reprogramación
    // retroactiva, acotado exclusivamente a estos datos antiguos. Los namespaces `n:`/`l:`
    // impiden que una fila nueva y una legacy se fusionen aunque su timestamp de inicio de
    // ventana coincida numéricamente — nunca se mezclan los dos mecanismos.
    function identidadVentana(r: AirtableRecord<RegistroCheckinFields>): { key: string; inicioISO: string; reconstruida: boolean } {
      const tipo = r.fields.Tipo_registro as FrecuenciaCheckin
      if (r.fields.Ventana_inicio) {
        return { key: `n:${tipo}:${r.fields.Ventana_inicio}`, inicioISO: r.fields.Ventana_inicio, reconstruida: false }
      }
      const programacion = resolverProgramacionTipo(filaPorTipoHist.get(tipo), entrenador?.fields.Checkin_disponible_desde)
      const inicioMs = inicioVentanaRegistro(tipo, diaSemanaHist, programacion, new Date(r.fields.Fecha).getTime())
      // Sin programación calculable: cada fila legacy agrupa por su propia Fecha exacta,
      // mismo comportamiento que existía antes de introducir ventanas.
      const inicioISO = inicioMs === null ? r.fields.Fecha : new Date(inicioMs).toISOString()
      return { key: `l:${tipo}:${inicioISO}`, inicioISO, reconstruida: true }
    }

    interface GrupoHistorial {
      ventanaInicio: string
      ventanaReconstruida: boolean
      tipo: FrecuenciaCheckin
      ultimaActualizacionMs: number
      porCampo: Map<string, { fieldId: string; nombre: string; valor: unknown; fechaMs: number }>
    }

    const grupos = new Map<string, GrupoHistorial>()
    for (const r of registros) {
      const { key, inicioISO, reconstruida } = identidadVentana(r)
      const fechaMs = new Date(r.fields.Fecha).getTime()
      // `Fecha` es inmutable (origen del registro); `Last_modified` (formula de Airtable,
      // se actualiza en cada PATCH) sí refleja una edición real dentro de la misma ventana
      // — "Última actualización" debe basarse en este último, nunca en `Fecha` (ver
      // DECISIONS.md DEC-2026-053). Fallback a `Fecha` si faltara (no debería, es formula).
      const lastModMs = r.fields.Last_modified ? comoInstanteUTCMs(r.fields.Last_modified) : fechaMs
      const ultimaActualizacionCandidataMs = Number.isFinite(lastModMs) ? lastModMs : fechaMs
      let grupo = grupos.get(key)
      if (!grupo) {
        grupo = {
          ventanaInicio: inicioISO,
          ventanaReconstruida: reconstruida,
          tipo: r.fields.Tipo_registro as FrecuenciaCheckin,
          ultimaActualizacionMs: ultimaActualizacionCandidataMs,
          porCampo: new Map(),
        }
        grupos.set(key, grupo)
      } else if (ultimaActualizacionCandidataMs > grupo.ultimaActualizacionMs) {
        grupo.ultimaActualizacionMs = ultimaActualizacionCandidataMs
      }

      // resolverNombreTipoHistorico cubre tanto campos activos como retirados
      // (dolor_nivel/dolor_zona/reflexion_semanal, ver DECISIONS.md) — el historial de
      // envíos antiguos sigue resolviendo nombre/valor legible aunque ya no se ofrezcan.
      // Dedup por Field_id dentro de la ventana (posible con datos legacy agrupados
      // retroactivamente, ver DECISIONS.md DEC-2026-052): se queda con el valor de la fila
      // de Fecha más reciente.
      const actual = grupo.porCampo.get(r.fields.Field_id)
      if (!actual || fechaMs > actual.fechaMs) {
        const historico = resolverNombreTipoHistorico(r.fields.Field_id, camposPorId)
        grupo.porCampo.set(r.fields.Field_id, {
          fieldId: r.fields.Field_id,
          nombre: historico?.nombre ?? r.fields.Field_id,
          valor: historico ? deserializarValor(historico.tipo, r.fields.Valor) : r.fields.Valor,
          fechaMs,
        })
      }
    }

    const envios: CheckinEnvio[] = [...grupos.values()]
      .map((g) => ({
        ventanaInicio: g.ventanaInicio,
        ventanaReconstruida: g.ventanaReconstruida,
        ultimaActualizacion: new Date(g.ultimaActualizacionMs).toISOString(),
        tipo: g.tipo,
        valores: [...g.porCampo.values()].map(({ fieldId, nombre, valor }) => ({ fieldId, nombre, valor })),
      }))
      .sort((a, b) => new Date(b.ultimaActualizacion).getTime() - new Date(a.ultimaActualizacion).getTime())

    const inicio = page * PAGE_SIZE
    const checkins = envios.slice(inicio, inicio + PAGE_SIZE)
    const hasMore = inicio + PAGE_SIZE < envios.length

    const diaSemanaCheckin =
      filasTipos.find((f) => f.fields.Tipo === 'semanal')?.fields.Dia_semana ?? 'lunes'
    const objetivosResueltos = filasObjetivos.map((r) => resolverObjetivo(r, camposPorId, registros, diaSemanaCheckin))
    const pendientes = calcularPendientes(cliente.fields.Estado, entrenador, filasTipos, camposResueltos, registros, objetivosResueltos)

    const response: ChecklinsResponse = { checkins, hasMore, pendientes }
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error al obtener check-ins de Airtable', err)
    return NextResponse.json({ error: 'Error al obtener check-ins' }, { status: 500 })
  }
}

// Elimina un "envío" completo de check-in — todas las filas EAV de Registros_checkin que
// pertenecen a la misma ventana de registro (DEC-2026-052), borrado real, no soft-delete
// (ver borrarRegistrosCheckin). Identificado por `ventanaInicio` + `tipo` + `ventanaReconstruida`
// (los mismos datos que ya devuelve GET en cada CheckinEnvio), NUNCA por un id de Airtable
// enviado desde el frontend (ver DECISIONS.md, "No confiar únicamente en IDs enviados por
// frontend"). Ownership completo: el entrenador autenticado debe ser dueño del cliente del
// path, y las filas a borrar se derivan siempre de una consulta ya scoped a
// `cliente.fields.Email`, con comprobación adicional contra el link real `Cliente`.
//
// `ventanaReconstruida` distingue explícitamente el mecanismo de selección (DEC-2026-052):
// - `false` (ventana nueva, persistida): solo filas con `Ventana_inicio` EXACTAMENTE igual.
// - `true` (ventana legacy, reconstruida): solo filas SIN `Ventana_inicio` (defensa en
//   profundidad — nunca puede tocar una fila nueva) cuya ventana recalculada coincida.
// Los dos caminos son mutuamente excluyentes; nunca se mezclan.
export async function DELETE(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const clienteId = typeof body?.clienteId === 'string' ? body.clienteId : null
  const ventanaInicio = typeof body?.ventanaInicio === 'string' ? body.ventanaInicio : null
  const ventanaReconstruida = body?.ventanaReconstruida === true
  const tipo = body?.tipo
  if (!clienteId || !ventanaInicio || !['diario', 'semanal', 'periodico'].includes(tipo)) {
    return NextResponse.json({ error: 'Faltan datos para eliminar el check-in' }, { status: 400 })
  }

  try {
    const cliente = await getClienteById(clienteId)
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }
    if (cliente.fields.Entrenador !== email) {
      return NextResponse.json({ error: 'No tienes acceso a este cliente' }, { status: 403 })
    }
    if (!cliente.fields.Email) {
      return NextResponse.json({ error: 'El cliente no tiene email configurado en Airtable' }, { status: 400 })
    }

    const [entrenador, filasTipos, registros] = await Promise.all([
      getEntrenadorByEmail(email),
      getCheckinTiposByEntrenador(email),
      getRegistrosCheckinByClienteEmail(cliente.fields.Email),
    ])
    const filaPorTipo = new Map(filasTipos.map((f) => [f.fields.Tipo, f.fields]))
    const diaSemanaCheckin = filaPorTipo.get('semanal')?.Dia_semana ?? 'lunes'
    const programacion = resolverProgramacionTipo(filaPorTipo.get(tipo), entrenador?.fields.Checkin_disponible_desde)

    const aBorrar = registros.filter((r) => {
      if (r.fields.Tipo_registro !== tipo || !r.fields.Cliente?.includes(cliente.id)) return false
      if (ventanaReconstruida) {
        if (r.fields.Ventana_inicio) return false
        const inicioMs = inicioVentanaRegistro(tipo, diaSemanaCheckin, programacion, new Date(r.fields.Fecha).getTime())
        const inicioISO = inicioMs === null ? r.fields.Fecha : new Date(inicioMs).toISOString()
        return inicioISO === ventanaInicio
      }
      return r.fields.Ventana_inicio === ventanaInicio
    })
    if (aBorrar.length === 0) {
      return NextResponse.json({ error: 'No se encontró ese check-in' }, { status: 404 })
    }

    await borrarRegistrosCheckin(aBorrar.map((r) => r.id))
    return NextResponse.json({ ok: true, eliminados: aBorrar.length })
  } catch (err) {
    console.error('Error al eliminar el check-in', err)
    return NextResponse.json({ error: 'Error al eliminar el check-in' }, { status: 500 })
  }
}
