import { NextRequest, NextResponse } from 'next/server'
import { getClienteActivoAutenticado } from '@/lib/auth-server'
import {
  getEntrenadorByEmail,
  getCamposCheckinByEntrenador,
  getRegistrosCheckinByClienteEmail,
  crearRegistrosCheckin,
  actualizarRegistroCheckin,
  getCheckinTiposByEntrenador,
  getObjetivosByClienteEmail,
  RegistroCheckinFields,
} from '@/lib/airtable'
import {
  resolverCamposEfectivos,
  agruparPorFrecuencia,
  serializarValor,
  validarValorCampo,
  resolverProgramacionTipo,
  inicioVentanaRegistro,
  finVentanaRegistro,
  campoDisponible,
  esCampoOcultoEnConfigAvanzada,
  FrecuenciaCheckin,
  CampoCheckinResuelto,
} from '@/lib/checkinFields'
import {
  resolverObjetivo,
  esVigenteHoy,
  PERIODICIDAD_A_TIPO_CHECKIN,
  ObjetivoResuelto,
  resolverEstadoCheckinTipo,
  VentanaActual,
} from '@/lib/objetivos'
import { ClienteCheckinResponse, ClienteCheckinTipoResponse, CheckinFrecuenciaEstado } from '@/lib/types'

const TIPOS_VALIDOS: FrecuenciaCheckin[] = ['diario', 'semanal', 'periodico']

function respuestaError(mensaje: string, status: number) {
  return NextResponse.json({ error: mensaje }, { status })
}

export async function GET(request: NextRequest) {
  const gate = await getClienteActivoAutenticado(request)
  if (!gate.ok) {
    return respuestaError(
      gate.status === 401
        ? 'No autorizado'
        : gate.status === 404
          ? 'No se encontró ningún cliente con este email'
          : 'Tu acceso está desactivado. Contacta con tu entrenador.',
      gate.status
    )
  }
  const cliente = gate.cliente

  // `?tipo=diario|semanal|periodico` (opcional): pantalla de "Registrar" de un tipo concreto
  // de revisión (ver DECISIONS.md, "Registrar revisión debe mostrar únicamente la periodicidad
  // seleccionada") — el servidor responde solo con los datos de ese tipo, no con los tres, para
  // que el scope de qué se está registrando no dependa de que el frontend filtre después de
  // recibir todo. Sin `tipo`, se mantiene la respuesta completa de siempre (usada por el
  // dashboard para el resumen de los tres tipos, y por el modo enfocado de objetivos, que
  // necesita poder buscar el objetivo en cualquiera de los tres — ver DEC-2026-047).
  const tipoParam = request.nextUrl.searchParams.get('tipo')
  if (tipoParam !== null && !TIPOS_VALIDOS.includes(tipoParam as FrecuenciaCheckin)) {
    return respuestaError('Tipo no válido', 400)
  }
  const tipoSolicitado = tipoParam as FrecuenciaCheckin | null

  try {
    const [entrenador, filasTipos, filasConfig, registros, filasObjetivos] = await Promise.all([
      getEntrenadorByEmail(cliente.fields.Entrenador),
      getCheckinTiposByEntrenador(cliente.fields.Entrenador),
      getCamposCheckinByEntrenador(cliente.fields.Entrenador),
      getRegistrosCheckinByClienteEmail(cliente.fields.Email ?? ''),
      getObjetivosByClienteEmail(cliente.fields.Email ?? ''),
    ])

    const filaPorTipo = new Map(filasTipos.map((f) => [f.fields.Tipo, f.fields]))
    const camposResueltos = resolverCamposEfectivos(filasConfig)
    const grupos = agruparPorFrecuencia(camposResueltos)
    const camposPorId = new Map(camposResueltos.map((c) => [c.id, c]))
    const diaSemanaCheckin = filaPorTipo.get('semanal')?.Dia_semana ?? 'lunes'

    // Solo objetivos activos, vigentes hoy y con una fuente que de verdad puede recibir
    // datos en ESTE tipo de check-in (progreso resuelto) — mostrar aquí un objetivo sin
    // forma de registrar su dato no ayudaría al cliente (ver DECISIONS.md, sección 3).
    const objetivosResueltos = filasObjetivos
      .map((r) => resolverObjetivo(r, camposPorId, registros, diaSemanaCheckin))
      .filter((o) => o.activo && o.vigenteHoy && o.progreso !== null)
    const objetivosPorTipo = new Map<FrecuenciaCheckin, ObjetivoResuelto[]>([
      ['diario', []],
      ['semanal', []],
      ['periodico', []],
    ])
    for (const o of objetivosResueltos) {
      objetivosPorTipo.get(PERIODICIDAD_A_TIPO_CHECKIN[o.periodicidad])!.push(o)
    }

    // Campos que son la fuente de progreso de un objetivo activo y vigente (de cualquier
    // periodicidad) — el registro de un objetivo es independiente de que el entrenador haya
    // "lanzado" el check-in de ese tipo (ver DECISIONS.md, "Objetivos independientes de
    // Revisiones"). Solo las revisiones (campos que no alimentan ningún objetivo) siguen
    // dependiendo del lanzamiento.
    // Deliberadamente GLOBAL (no por tipo): un campo puede vivir en un tipo distinto al de la
    // periodicidad del objetivo que lo usa — p.ej. un objetivo semanal alimentado por un
    // campo que solo se pregunta a diario, agregado en la ventana semanal (ver comentario en
    // resolverObjetivo, src/lib/objetivos.ts) — el progreso siempre se calcula sobre TODOS
    // los registros de ese Field_id sin filtrar por Tipo_registro (ver
    // calcularProgresoDesdeCheckins/calcularProgresoValorObjetivo), así que restringir esta
    // exclusión por tipo dejaba el campo sin ningún sitio donde registrarse (ver DECISIONS.md:
    // se probó una versión por tipo y rompió el caso "Pasos semanal" con campo diario). Qué
    // sección concreta lo muestra ya lo decide `agruparPorFrecuencia` (el campo solo aparece
    // en los tipos de su propio `Tipos`); esto solo decide si, estando ahí, cuenta como
    // objetivo o como revisión suelta — y esa decisión no depende del tipo.
    const idsFuenteObjetivo = new Set(
      objetivosResueltos.filter((o) => o.fuenteFieldId).map((o) => o.fuenteFieldId!)
    )

    // Cálculo real movido a resolverEstadoCheckinTipo (src/lib/objetivos.ts) — compartido con
    // el endpoint de check-ins pendientes de la ficha del entrenador, para no tener dos
    // implementaciones del mismo cálculo (ver DECISIONS.md, resiliencia). La ventana actual
    // (DEC-2026-052) se calcula aquí con la programación real de CADA tipo, una sola vez,
    // reutilizada tanto para diario/semanal como para periódico (antes sin ventana propia).
    const ahoraMs = Date.now()
    function estadoPara(tipo: FrecuenciaCheckin, campos: CampoCheckinResuelto[]): CheckinFrecuenciaEstado {
      const programacion = resolverProgramacionTipo(filaPorTipo.get(tipo), entrenador?.fields.Checkin_disponible_desde)
      const inicioMs = inicioVentanaRegistro(tipo, diaSemanaCheckin, programacion, ahoraMs)
      const ventanaActual: VentanaActual | null = inicioMs === null ? null : { inicioMs, inicioISO: new Date(inicioMs).toISOString() }
      return resolverEstadoCheckinTipo({
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
    }

    if (tipoSolicitado) {
      const respuestaTipo: ClienteCheckinTipoResponse = {
        ...estadoPara(tipoSolicitado, grupos[tipoSolicitado]),
        tipo: tipoSolicitado,
        idsFuenteObjetivoGlobal: [...idsFuenteObjetivo],
      }
      return NextResponse.json(respuestaTipo)
    }

    const response: ClienteCheckinResponse = {
      diario: estadoPara('diario', grupos.diario),
      semanal: estadoPara('semanal', grupos.semanal),
      periodico: estadoPara('periodico', grupos.periodico),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Error al obtener check-in del cliente', err)
    return respuestaError('Error al obtener el check-in', 500)
  }
}

export async function POST(request: NextRequest) {
  const gate = await getClienteActivoAutenticado(request)
  if (!gate.ok) {
    return respuestaError(
      gate.status === 401
        ? 'No autorizado'
        : gate.status === 404
          ? 'No se encontró ningún cliente con este email'
          : 'Tu acceso está desactivado. Contacta con tu entrenador.',
      gate.status
    )
  }
  const cliente = gate.cliente

  const body = await request.json().catch(() => null)
  const tipo = body?.tipo as FrecuenciaCheckin
  const valores = body?.valores && typeof body.valores === 'object' ? (body.valores as Record<string, unknown>) : null
  if (!['diario', 'semanal', 'periodico'].includes(tipo) || !valores) {
    return respuestaError('Falta tipo o valores', 400)
  }

  try {
    const [entrenador, filasTipos, filasConfig, registros, filasObjetivos] = await Promise.all([
      getEntrenadorByEmail(cliente.fields.Entrenador),
      getCheckinTiposByEntrenador(cliente.fields.Entrenador),
      getCamposCheckinByEntrenador(cliente.fields.Entrenador),
      getRegistrosCheckinByClienteEmail(cliente.fields.Email ?? ''),
      getObjetivosByClienteEmail(cliente.fields.Email ?? ''),
    ])

    const diaSemanaCheckin = filasTipos.find((f) => f.fields.Tipo === 'semanal')?.fields.Dia_semana ?? 'lunes'
    const filaTipo = filasTipos.find((f) => f.fields.Tipo === tipo)
    const programacionTipo = resolverProgramacionTipo(filaTipo?.fields, entrenador?.fields.Checkin_disponible_desde)
    const { lanzado } = programacionTipo

    // Campos que alimentan un objetivo propio, activo y vigente hoy del cliente autenticado
    // (derivado siempre de su propia ficha, nunca de un ID que mande el frontend — ver
    // DECISIONS.md, "Objetivos independientes de Revisiones"). Estos campos se pueden
    // registrar exista o no un check-in lanzado; el resto (revisiones) sigue exigiendo
    // `lanzado`, igual que antes. Deliberadamente GLOBAL, no filtrado por periodicidad del
    // objetivo → este `tipo`: el progreso se calcula sobre todos los registros del Field_id
    // sin filtrar por Tipo_registro (mismo motivo que en el GET, ver comentario ahí) — un
    // objetivo semanal puede alimentarse legítimamente de un campo que solo se pregunta a
    // diario, y el POST real llega tageado con el tipo donde el campo vive, no con el de la
    // periodicidad del objetivo.
    const idsFuenteObjetivo = new Set(
      filasObjetivos
        .filter((r) => r.fields.Activo === true && esVigenteHoy(r.fields.Fecha_inicio, r.fields.Fecha_fin))
        .map((r) => r.fields.Fuente_field_id)
        .filter((id): id is string => Boolean(id))
    )

    const camposResueltos = resolverCamposEfectivos(filasConfig)
    const grupos = agruparPorFrecuencia(camposResueltos)
    // Regla "No he entrenado": un campo dependiente no disponible se ignora del todo
    // (ni se valida ni se guarda), aunque el cliente lo mande manipulando la petición
    // directamente — rechazo real en backend, no solo cosmético. Igual criterio para
    // campos de revisión cuando el tipo no está lanzado: se ignoran en vez de rechazar
    // toda la petición, para no bloquear los campos de objetivo enviados en el mismo envío.
    // Campos "exclusivos de objetivo" (peso, entrenamiento_realizado, "Pasos" personalizado)
    // nunca se aceptan salvo que sean de verdad la fuente de un objetivo de este cliente —
    // "el objetivo activa la métrica", ni siquiera con el tipo lanzado y Activo=true de una
    // config anterior (no basta con ocultarlo en el frontend, ver DECISIONS.md).
    const camposAEnviar = grupos[tipo].filter(
      (campo) =>
        campoDisponible(campo, valores) &&
        (idsFuenteObjetivo.has(campo.id) || (lanzado && !esCampoOcultoEnConfigAvanzada(campo)))
    )

    // Validación estricta de tipo/rango ANTES de serializar (ver DECISIONS.md): un valor
    // presente pero incompatible con el tipo del campo se rechaza con un 400 explícito —
    // nunca se convierte ni se descarta en silencio. Un campo simplemente no incluido en
    // `valores` es válido (no respondido) y se omite del envío sin error.
    const erroresValidacion = camposAEnviar
      .filter((campo) => campo.id in valores)
      .map((campo) => validarValorCampo(campo, valores[campo.id]))
      .filter((e): e is string => e !== null)
    if (erroresValidacion.length > 0) {
      return respuestaError(erroresValidacion.join(' '), 400)
    }

    const ahoraMs = Date.now()
    const fecha = new Date(ahoraMs).toISOString()

    // Ventana de registro actual (DEC-2026-052) — identidad estable de "mismo período" para
    // este tipo, calculada con la programación vigente. `null` solo si no se puede calcular
    // (p. ej. periódico sin programación configurada todavía): en ese caso se mantiene el
    // comportamiento insert-only puro de siempre, sin ningún upsert.
    const inicioVentanaMs = inicioVentanaRegistro(tipo, diaSemanaCheckin, programacionTipo, ahoraMs)
    const ventanaISO = inicioVentanaMs === null ? null : new Date(inicioVentanaMs).toISOString()

    const valoresAEnviar = camposAEnviar
      .map((campo) => {
        const valorSerializado = serializarValor(campo.tipo, valores[campo.id])
        if (valorSerializado === null) return null
        return { campo, valorSerializado }
      })
      .filter((f): f is { campo: CampoCheckinResuelto; valorSerializado: string } => f !== null)

    if (valoresAEnviar.length === 0) {
      return respuestaError('No hay valores válidos para los campos activos de este tipo', 400)
    }

    // Upsert por campo dentro de la ventana actual (DEC-2026-052/053): "editar y volver a
    // guardar" dentro del mismo día/semana/apertura actualiza el registro existente en vez
    // de crear uno nuevo — historial entre períodos distintos, último valor dentro del
    // período. El lookup busca, entre las filas NUEVAS (con `Ventana_inicio` propio) de este
    // campo/tipo, la que siga VIGENTE anclada a su propio `Ventana_inicio`
    // (`finVentanaRegistro`) — nunca por igualdad exacta contra `ventanaISO` recalculado con
    // la programación de HOY: si el entrenador reprograma a mitad de ventana, esa igualdad
    // podía dejar de cumplirse aunque la fila siguiera siendo la vigente, causando un
    // duplicado (ver DECISIONS.md). Una fila legacy sin `Ventana_inicio` (anterior a este
    // cambio) nunca es candidata a `PATCH`, evitando que el nuevo mecanismo sobrescriba
    // accidentalmente una fila histórica.
    const nuevasFilas: Partial<RegistroCheckinFields>[] = []
    let actualizados = 0
    let sinCambios = 0
    for (const { campo, valorSerializado } of valoresAEnviar) {
      const filaExistente = ventanaISO
        ? registros
            .filter((r) => r.fields.Field_id === campo.id && r.fields.Tipo_registro === tipo && r.fields.Ventana_inicio)
            .filter((r) => {
              const inicioMs = new Date(r.fields.Ventana_inicio!).getTime()
              if (!Number.isFinite(inicioMs)) return false
              const finMs = finVentanaRegistro(tipo, inicioMs, programacionTipo)
              return finMs === null ? r.fields.Ventana_inicio === ventanaISO : ahoraMs < finMs
            })
            .sort((a, b) => new Date(b.fields.Fecha).getTime() - new Date(a.fields.Fecha).getTime())[0]
        : undefined

      if (filaExistente) {
        if (filaExistente.fields.Valor === valorSerializado) {
          sinCambios++
          continue
        }
        await actualizarRegistroCheckin(filaExistente.id, valorSerializado)
        actualizados++
      } else {
        nuevasFilas.push({
          Fecha: fecha,
          Cliente: [cliente.id],
          Field_id: campo.id,
          Tipo_registro: tipo,
          Valor: valorSerializado,
          ...(ventanaISO ? { Ventana_inicio: ventanaISO } : {}),
        })
      }
    }

    if (nuevasFilas.length > 0) {
      await crearRegistrosCheckin(nuevasFilas)
    }

    const creados = nuevasFilas.length
    const status = creados > 0 ? 201 : 200
    return NextResponse.json({ ok: true, fecha, creados, actualizados, sinCambios }, { status })
  } catch (err) {
    console.error('Error al guardar check-in del cliente', err)
    return respuestaError('Error al guardar el check-in', 500)
  }
}
