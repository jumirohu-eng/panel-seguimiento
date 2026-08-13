import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import {
  getClienteByEmail,
  getEntrenadorByEmail,
  getCamposCheckinByEntrenador,
  getRegistrosCheckinByClienteEmail,
  crearRegistrosCheckin,
} from '@/lib/airtable'
import {
  resolverCamposEfectivos,
  agruparPorFrecuencia,
  deserializarValor,
  serializarValor,
  calcularProximaDisponibilidad,
  resolverLanzamiento,
  FrecuenciaCheckin,
  CampoCheckinResuelto,
} from '@/lib/checkinFields'
import { ClienteCheckinResponse, CheckinFrecuenciaEstado } from '@/lib/types'

function inicioDeHoyUTC(): number {
  const ahora = new Date()
  return Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
}

function inicioDeSemanaUTC(): number {
  const ahora = new Date()
  const hoy = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
  const diaSemana = ahora.getUTCDay() === 0 ? 7 : ahora.getUTCDay() // lunes=1..domingo=7
  return hoy - (diaSemana - 1) * 24 * 60 * 60 * 1000
}

export async function GET(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const cliente = await getClienteByEmail(email)
    if (!cliente) {
      return NextResponse.json({ error: 'No se encontró ningún cliente con este email' }, { status: 404 })
    }

    const entrenador = await getEntrenadorByEmail(cliente.fields.Entrenador)
    const { lanzado, disponibleDesde } = resolverLanzamiento(entrenador?.fields.Checkin_disponible_desde)
    if (!lanzado) {
      const vacio: CheckinFrecuenciaEstado = { campos: [], yaEnviado: false, ultimosValores: {}, proximaDisponibilidad: null }
      const response: ClienteCheckinResponse = {
        lanzado: false,
        disponibleDesde,
        diario: vacio,
        semanal: vacio,
        periodico: vacio,
      }
      return NextResponse.json(response)
    }

    const filasConfig = await getCamposCheckinByEntrenador(cliente.fields.Entrenador)
    const camposResueltos = resolverCamposEfectivos(filasConfig)
    const { diario, semanal, periodico } = agruparPorFrecuencia(camposResueltos)

    const registros = await getRegistrosCheckinByClienteEmail(email)
    const camposPorId = new Map(camposResueltos.map((c) => [c.id, c]))

    function estadoPara(campos: CampoCheckinResuelto[], tipo: FrecuenciaCheckin, desdeMs: number | null): CheckinFrecuenciaEstado {
      const registrosDelTipo = registros.filter((r) => r.fields.Tipo_registro === tipo)
      const registrosVigentes =
        desdeMs === null ? registrosDelTipo : registrosDelTipo.filter((r) => new Date(r.fields.Fecha).getTime() >= desdeMs)

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
      return { campos, yaEnviado, ultimosValores, proximaDisponibilidad: calcularProximaDisponibilidad(tipo, yaEnviado, desdeMs) }
    }

    const response: ClienteCheckinResponse = {
      lanzado: true,
      disponibleDesde,
      diario: estadoPara(diario, 'diario', inicioDeHoyUTC()),
      semanal: estadoPara(semanal, 'semanal', inicioDeSemanaUTC()),
      periodico: estadoPara(periodico, 'periodico', null),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Error al obtener check-in del cliente', err)
    return NextResponse.json({ error: 'Error al obtener el check-in' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const tipo = body?.tipo as FrecuenciaCheckin
  const valores = body?.valores && typeof body.valores === 'object' ? (body.valores as Record<string, unknown>) : null
  if (!['diario', 'semanal', 'periodico'].includes(tipo) || !valores) {
    return NextResponse.json({ error: 'Falta tipo o valores' }, { status: 400 })
  }

  try {
    const cliente = await getClienteByEmail(email)
    if (!cliente) {
      return NextResponse.json({ error: 'No se encontró ningún cliente con este email' }, { status: 404 })
    }

    const entrenador = await getEntrenadorByEmail(cliente.fields.Entrenador)
    const { lanzado } = resolverLanzamiento(entrenador?.fields.Checkin_disponible_desde)
    if (!lanzado) {
      return NextResponse.json({ error: 'Tu entrenador todavía no ha activado el check-in' }, { status: 403 })
    }

    const filasConfig = await getCamposCheckinByEntrenador(cliente.fields.Entrenador)
    const camposResueltos = resolverCamposEfectivos(filasConfig)
    const grupos = agruparPorFrecuencia(camposResueltos)
    const camposActivosDelTipo = grupos[tipo]

    const fecha = new Date().toISOString()
    const filas = camposActivosDelTipo
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
      return NextResponse.json({ error: 'No hay valores válidos para los campos activos de este tipo' }, { status: 400 })
    }

    await crearRegistrosCheckin(filas)
    return NextResponse.json({ ok: true, fecha, campos: filas.length }, { status: 201 })
  } catch (err) {
    console.error('Error al guardar check-in del cliente', err)
    return NextResponse.json({ error: 'Error al guardar el check-in' }, { status: 500 })
  }
}
