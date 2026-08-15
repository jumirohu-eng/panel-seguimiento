import { NextRequest, NextResponse } from 'next/server'
import { getClienteActivoAutenticado } from '@/lib/auth-server'
import {
  getEntrenadorByEmail,
  getCamposCheckinByEntrenador,
  getRegistrosCheckinByClienteEmail,
  crearRegistrosCheckin,
  getCheckinTiposByEntrenador,
  getObjetivosByClienteEmail,
} from '@/lib/airtable'
import {
  resolverCamposEfectivos,
  agruparPorFrecuencia,
  deserializarValor,
  serializarValor,
  validarValorCampo,
  esEnvioDuplicadoReciente,
  calcularProximaFecha,
  resolverProgramacionTipo,
  inicioDeHoyUTC,
  inicioDePeriodoSemanalUTC,
  campoDisponible,
  esCampoOcultoEnConfigAvanzada,
  FrecuenciaCheckin,
  CampoCheckinResuelto,
} from '@/lib/checkinFields'
import { resolverObjetivo, esVigenteHoy, PERIODICIDAD_A_TIPO_CHECKIN, ObjetivoResuelto } from '@/lib/objetivos'
import { ClienteCheckinResponse, CheckinFrecuenciaEstado } from '@/lib/types'

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

    // Campos que son la fuente de progreso de un objetivo activo y vigente — el registro de
    // un objetivo es independiente de que el entrenador haya "lanzado" el check-in de ese
    // tipo (ver DECISIONS.md, "Objetivos independientes de Revisiones"). Solo las revisiones
    // (campos que no alimentan ningún objetivo) siguen dependiendo del lanzamiento.
    // Calculado POR TIPO (según la periodicidad del objetivo, no según el `Tipos` legado del
    // campo en Campos_checkin): un campo "exclusivo de objetivo" (peso, entrenamiento_
    // realizado, "Pasos") con `Tipos` heredado de antes de ocultarse (p.ej. `['semanal',
    // 'periodico']`) solo debe considerarse "de objetivo" en el tipo que corresponde a la
    // periodicidad real del objetivo — si no, se colaba como revisión suelta en el otro tipo
    // en el que el campo seguía técnicamente asignado (ver DECISIONS.md, bug real detectado
    // en `Peso` con objetivo semanal apareciendo también en "periódico").
    const idsFuenteObjetivoPorTipo = new Map<FrecuenciaCheckin, Set<string>>([
      ['diario', new Set()],
      ['semanal', new Set()],
      ['periodico', new Set()],
    ])
    for (const o of objetivosResueltos) {
      if (!o.fuenteFieldId) continue
      idsFuenteObjetivoPorTipo.get(PERIODICIDAD_A_TIPO_CHECKIN[o.periodicidad])!.add(o.fuenteFieldId)
    }

    function estadoPara(
      tipo: FrecuenciaCheckin,
      campos: CampoCheckinResuelto[],
      inicioPeriodoActualMs: number | null
    ): CheckinFrecuenciaEstado {
      const programacion = resolverProgramacionTipo(filaPorTipo.get(tipo), entrenador?.fields.Checkin_disponible_desde)
      const idsFuenteObjetivo = idsFuenteObjetivoPorTipo.get(tipo)!
      // Campos "exclusivos de objetivo" (peso, entrenamiento_realizado, cualquier "Pasos"
      // personalizado — ver esCampoOcultoEnConfigAvanzada) nunca se muestran como revisión
      // suelta, aunque tengan Activo=true de una configuración anterior: solo aparecen si de
      // verdad son la fuente de un objetivo de ESTE cliente EN ESTE TIPO (según la
      // periodicidad del objetivo). "El objetivo activa la métrica" (ver DECISIONS.md) — si
      // no existe objetivo de peso semanal para este cliente, "periódico" no debe ver Peso
      // aunque exista un objetivo de peso semanal.
      const camposSinExclusivosSueltos = campos.filter(
        (c) => idsFuenteObjetivo.has(c.id) || !esCampoOcultoEnConfigAvanzada(c)
      )
      // Sin lanzar: solo se exponen los campos que alimentan un objetivo (el cliente siempre
      // puede registrar sus objetivos); los campos de revisión quedan ocultos hasta que el
      // entrenador lance ese tipo, igual que antes.
      const camposVisibles = programacion.lanzado
        ? camposSinExclusivosSueltos
        : camposSinExclusivosSueltos.filter((c) => idsFuenteObjetivo.has(c.id))

      const idsVisibles = new Set(camposVisibles.map((c) => c.id))
      const registrosDelTipo = registros.filter((r) => r.fields.Tipo_registro === tipo && idsVisibles.has(r.fields.Field_id))
      const registrosVigentes =
        inicioPeriodoActualMs === null
          ? registrosDelTipo
          : registrosDelTipo.filter((r) => new Date(r.fields.Fecha).getTime() >= inicioPeriodoActualMs)

      const ultimosValores: Record<string, unknown> = {}
      let yaEnviado = false
      // registros ya vienen ordenados desc por Fecha (ver getRegistrosCheckinByClienteEmail)
      for (const r of registrosVigentes) {
        yaEnviado = true
        const campo = camposPorId.get(r.fields.Field_id)
        if (campo && !(r.fields.Field_id in ultimosValores)) {
          ultimosValores[r.fields.Field_id] = deserializarValor(campo.tipo, r.fields.Valor)
        }
      }

      const proximaFecha = calcularProximaFecha(tipo, yaEnviado, inicioPeriodoActualMs, programacion)

      return {
        lanzado: programacion.lanzado,
        disponibleDesde: programacion.disponibleDesde,
        campos: camposVisibles,
        yaEnviado,
        ultimosValores,
        proximaFecha,
        objetivos: objetivosPorTipo.get(tipo) ?? [],
      }
    }

    const response: ClienteCheckinResponse = {
      diario: estadoPara('diario', grupos.diario, inicioDeHoyUTC()),
      semanal: estadoPara('semanal', grupos.semanal, inicioDePeriodoSemanalUTC(diaSemanaCheckin)),
      periodico: estadoPara('periodico', grupos.periodico, null),
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

    const filaTipo = filasTipos.find((f) => f.fields.Tipo === tipo)
    const { lanzado } = resolverProgramacionTipo(filaTipo?.fields, entrenador?.fields.Checkin_disponible_desde)

    // Campos que alimentan un objetivo propio, activo y vigente hoy del cliente autenticado
    // (derivado siempre de su propia ficha, nunca de un ID que mande el frontend — ver
    // DECISIONS.md, "Objetivos independientes de Revisiones"). Estos campos se pueden
    // registrar exista o no un check-in lanzado; el resto (revisiones) sigue exigiendo
    // `lanzado`, igual que antes. Filtrado también por periodicidad del objetivo → este
    // `tipo`: un objetivo semanal no habilita su campo fuente para un POST a "periodico",
    // aunque el campo tenga ese tipo en su `Tipos` legado de Campos_checkin (mismo criterio
    // que el GET, ver DECISIONS.md).
    const idsFuenteObjetivo = new Set(
      filasObjetivos
        .filter(
          (r) =>
            r.fields.Activo === true &&
            esVigenteHoy(r.fields.Fecha_inicio, r.fields.Fecha_fin) &&
            PERIODICIDAD_A_TIPO_CHECKIN[r.fields.Periodicidad] === tipo
        )
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

    const fecha = new Date().toISOString()
    const filas = camposAEnviar
      .map((campo) => {
        const valorSerializado = serializarValor(campo.tipo, valores[campo.id])
        if (valorSerializado === null) return null
        return {
          Fecha: fecha,
          Cliente: [cliente.id],
          Field_id: campo.id,
          Tipo_registro: tipo,
          Valor: valorSerializado,
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)

    if (filas.length === 0) {
      return respuestaError('No hay valores válidos para los campos activos de este tipo', 400)
    }

    // Doble envío (doble clic, reintento de red): si es idéntico al último lote de este
    // tipo y llegó hace segundos, no se inserta de nuevo — responde 200 idempotente en
    // vez de 201 y de multiplicar filas en Registros_checkin.
    if (esEnvioDuplicadoReciente(registros, tipo, filas, Date.now())) {
      return NextResponse.json({ ok: true, fecha, campos: filas.length, duplicado: true }, { status: 200 })
    }

    await crearRegistrosCheckin(filas)
    return NextResponse.json({ ok: true, fecha, campos: filas.length }, { status: 201 })
  } catch (err) {
    console.error('Error al guardar check-in del cliente', err)
    return respuestaError('Error al guardar el check-in', 500)
  }
}
