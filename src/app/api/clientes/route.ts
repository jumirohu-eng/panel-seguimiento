import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClientesByEntrenador } from '@/lib/airtable'

export async function GET(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const records = await getClientesByEntrenador(email)
    const clientes = records.map((r) => ({
      id: r.id,
      nombre: r.fields.Nombre,
      email: r.fields.Email ?? '',
      objetivo: r.fields.Objetivo,
      estado: r.fields.Estado ?? '',
      entrenamientos_objetivo: r.fields.Entrenamientos_objetivo ?? 0,
    }))
    return NextResponse.json(clientes)
  } catch (err) {
    console.error('Error al obtener clientes de Airtable', err)
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
  }
}
