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
  agruparPorFrecuencia,
  inicioDeHoyUTC,
  inicioDePeriodoSemanalUTC,
  CampoCheckinResuelto,
  FrecuenciaCheckin,
} from '@/lib/checkinFields'
import { resolverObjetivo, resolverEstadoCheckinTipo, PERIODICIDAD_A_TIPO_CHECKIN, ObjetivoResuelto } from '@/lib/objetivos'
import { CheckinEnvio, ChecklinsResponse, PendientesCheckin } from '@/lib/types'

const PAGE_SIZE = 7

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
    objetivosPorTipo.get(PERIODICIDAD_A_TIPO_CHECKIN[o.periodicidad])!.push(o)
  }
  const idsFuenteObjetivo = new Set(objetivosVigentes.filter((o) => o.fuenteFieldId).map((o) => o.fuenteFieldId!))

  function pendientePara(tipo: FrecuenciaCheckin, campos: CampoCheckinResuelto[], inicioPeriodoActualMs: number | null): boolean {
    const programacion = resolverProgramacionTipo(filaPorTipo.get(tipo), entrenador?.fields.Checkin_disponible_desde)
    const estado = resolverEstadoCheckinTipo({
      tipo,
      campos,
      programacion,
      registros,
      camposPorId,
      idsFuenteObjetivoGlobal: idsFuenteObjetivo,
      objetivosDelTipo: objetivosPorTipo.get(tipo) ?? [],
      inicioPeriodoActualMs,
    })
    // Solo cuenta como pendiente si hay de verdad alguna pregunta de REVISIÓN (no solo
    // campos de objetivo) — los objetivos tienen su propia UI de progreso en la ficha,
    // independiente de esto (ver CLAUDE.md, "Objetivos independientes de Revisiones").
    const camposRevision = estado.campos.filter((c) => !idsFuenteObjetivo.has(c.id))
    return estado.lanzado && camposRevision.length > 0 && !estado.yaEnviado
  }

  return {
    diario: pendientePara('diario', grupos.diario, inicioDeHoyUTC()),
    semanal: pendientePara('semanal', grupos.semanal, inicioDePeriodoSemanalUTC(diaSemanaCheckin)),
    periodico: pendientePara('periodico', grupos.periodico, null),
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

    // Agrupa filas EAV por Fecha exacta (todas las filas de un mismo envío comparten timestamp).
    const envioPorFecha = new Map<string, CheckinEnvio>()
    for (const r of registros) {
      const fecha = r.fields.Fecha
      let envio = envioPorFecha.get(fecha)
      if (!envio) {
        envio = { fecha, tipo: r.fields.Tipo_registro as FrecuenciaCheckin, valores: [] }
        envioPorFecha.set(fecha, envio)
      }
      // resolverNombreTipoHistorico cubre tanto campos activos como retirados
      // (dolor_nivel/dolor_zona/reflexion_semanal, ver DECISIONS.md) — el historial de
      // envíos antiguos sigue resolviendo nombre/valor legible aunque ya no se ofrezcan.
      const historico = resolverNombreTipoHistorico(r.fields.Field_id, camposPorId)
      envio.valores.push({
        fieldId: r.fields.Field_id,
        nombre: historico?.nombre ?? r.fields.Field_id,
        valor: historico ? deserializarValor(historico.tipo, r.fields.Valor) : r.fields.Valor,
      })
    }

    const envios = [...envioPorFecha.values()].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
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

// Elimina un "envío" completo de check-in (todas las filas EAV de Registros_checkin que
// comparten Cliente + Fecha exacta, ver agrupación en GET) — borrado real, no soft-delete
// (ver borrarRegistrosCheckin). Identificado por `fecha` + `tipo` (los mismos datos que ya
// devuelve GET en cada CheckinEnvio), NUNCA por un id de Airtable enviado desde el frontend
// (ver DECISIONS.md, "No confiar únicamente en IDs enviados por frontend" — y la ficha del
// cliente tampoco expone ningún id de Registros_checkin, ver ClienteFicha.tsx). Ownership
// completo: el entrenador autenticado debe ser dueño del cliente del path, y las filas a
// borrar se derivan siempre de una consulta ya scoped a `cliente.fields.Email` (nunca de un
// id adivinado), con una comprobación adicional contra el link real `Cliente` como defensa
// en profundidad.
export async function DELETE(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const clienteId = typeof body?.clienteId === 'string' ? body.clienteId : null
  const fecha = typeof body?.fecha === 'string' ? body.fecha : null
  const tipo = body?.tipo
  if (!clienteId || !fecha || !['diario', 'semanal', 'periodico'].includes(tipo)) {
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

    const registros = await getRegistrosCheckinByClienteEmail(cliente.fields.Email)
    const aBorrar = registros.filter(
      (r) => r.fields.Fecha === fecha && r.fields.Tipo_registro === tipo && r.fields.Cliente?.includes(cliente.id)
    )
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
