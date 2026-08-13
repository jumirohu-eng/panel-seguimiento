import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClienteById, getCamposCheckinByEntrenador, getRegistrosCheckinByClienteEmail } from '@/lib/airtable'
import { resolverCamposEfectivos, deserializarValor, FrecuenciaCheckin } from '@/lib/checkinFields'
import { CheckinEnvio, ChecklinsResponse } from '@/lib/types'

const PAGE_SIZE = 7

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

    const [filasConfig, registros] = await Promise.all([
      getCamposCheckinByEntrenador(email),
      getRegistrosCheckinByClienteEmail(cliente.fields.Email),
    ])
    const camposPorId = new Map(resolverCamposEfectivos(filasConfig).map((c) => [c.id, c]))

    // Agrupa filas EAV por Fecha exacta (todas las filas de un mismo envío comparten timestamp).
    const envioPorFecha = new Map<string, CheckinEnvio>()
    for (const r of registros) {
      const fecha = r.fields.Fecha
      let envio = envioPorFecha.get(fecha)
      if (!envio) {
        envio = { fecha, tipo: r.fields.Tipo_registro as FrecuenciaCheckin, valores: [] }
        envioPorFecha.set(fecha, envio)
      }
      const campo = camposPorId.get(r.fields.Field_id)
      envio.valores.push({
        fieldId: r.fields.Field_id,
        nombre: campo?.nombre ?? r.fields.Field_id,
        valor: campo ? deserializarValor(campo.tipo, r.fields.Valor) : r.fields.Valor,
      })
    }

    const envios = [...envioPorFecha.values()].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    const inicio = page * PAGE_SIZE
    const checkins = envios.slice(inicio, inicio + PAGE_SIZE)
    const hasMore = inicio + PAGE_SIZE < envios.length

    const response: ChecklinsResponse = { checkins, hasMore }
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error al obtener check-ins de Airtable', err)
    return NextResponse.json({ error: 'Error al obtener check-ins' }, { status: 500 })
  }
}
