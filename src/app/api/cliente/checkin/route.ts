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
  calcularProximaFecha,
  resolverProgramacionTipo,
  inicioDeHoyUTC,
  inicioDePeriodoSemanalUTC,
  campoDisponible,
  FrecuenciaCheckin,
  CampoCheckinResuelto,
} from '@/lib/checkinFields'
import { resolverObjetivo, PERIODICIDAD_A_TIPO_CHECKIN, ObjetivoResuelto } from '@/lib/objetivos'
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

    function estadoPara(
      tipo: FrecuenciaCheckin,
      campos: CampoCheckinResuelto[],
      inicioPeriodoActualMs: number | null
    ): CheckinFrecuenciaEstado {
      const programacion = resolverProgramacionTipo(filaPorTipo.get(tipo), entrenador?.fields.Checkin_disponible_desde)
      if (!programacion.lanzado) {
        return {
          lanzado: false,
          disponibleDesde: programacion.disponibleDesde,
          campos: [],
          yaEnviado: false,
          ultimosValores: {},
          proximaFecha: null,
          objetivos: [],
        }
      }

      const registrosDelTipo = registros.filter((r) => r.fields.Tipo_registro === tipo)
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
        lanzado: true,
        disponibleDesde: programacion.disponibleDesde,
        campos,
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
    const [entrenador, filasTipos, filasConfig] = await Promise.all([
      getEntrenadorByEmail(cliente.fields.Entrenador),
      getCheckinTiposByEntrenador(cliente.fields.Entrenador),
      getCamposCheckinByEntrenador(cliente.fields.Entrenador),
    ])

    const filaTipo = filasTipos.find((f) => f.fields.Tipo === tipo)
    const { lanzado } = resolverProgramacionTipo(filaTipo?.fields, entrenador?.fields.Checkin_disponible_desde)
    if (!lanzado) {
      return respuestaError('Tu entrenador todavía no ha activado este check-in', 403)
    }

    const camposResueltos = resolverCamposEfectivos(filasConfig)
    const grupos = agruparPorFrecuencia(camposResueltos)
    const camposActivosDelTipo = grupos[tipo]

    const fecha = new Date().toISOString()
    const filas = camposActivosDelTipo
      .map((campo) => {
        // Regla "No he entrenado": un campo dependiente se ignora silenciosamente si la
        // condición de la que depende no se cumple, aunque el cliente lo mande manipulando
        // la petición directamente — rechazo real en backend, no solo cosmético.
        if (!campoDisponible(campo, valores)) return null
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

    await crearRegistrosCheckin(filas)
    return NextResponse.json({ ok: true, fecha, campos: filas.length }, { status: 201 })
  } catch (err) {
    console.error('Error al guardar check-in del cliente', err)
    return respuestaError('Error al guardar el check-in', 500)
  }
}
