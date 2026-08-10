import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClienteById, getReportesByClienteEmail } from '@/lib/airtable'

export async function GET(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const clienteId = request.nextUrl.searchParams.get('clienteId')
  if (!clienteId) {
    return NextResponse.json({ error: 'Falta el parámetro clienteId' }, { status: 400 })
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

    const records = await getReportesByClienteEmail(cliente.fields.Email, 8)
    const reportes = records.map((r) => ({
      id: r.id,
      fecha: r.fields.Fecha,
      peso: r.fields.Peso,
      entrenamientos: r.fields.Entrenamientos,
      energia: r.fields.Energía,
      notas: r.fields.Notas ?? '',
      analisisIA: r.fields['Análisis IA'] ?? '',
      mensajeSugerido: r.fields['Mensaje sugerido'] ?? '',
      linkAlerta: r.fields.Link_alerta ?? '',
    }))
    return NextResponse.json(reportes)
  } catch (err) {
    console.error('Error al obtener reportes de Airtable', err)
    return NextResponse.json({ error: 'Error al obtener reportes' }, { status: 500 })
  }
}
