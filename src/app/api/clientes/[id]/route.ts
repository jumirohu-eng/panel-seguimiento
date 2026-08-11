import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClienteById, actualizarCliente, ClienteFields } from '@/lib/airtable'

const ESTADOS_VALIDOS = ['Activo', 'Pausado', 'Perdido']

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const cliente = await getClienteById(id)
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }
  if (cliente.fields.Entrenador !== email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const fields: Partial<ClienteFields> = {}

  if (typeof body?.notasEntrenador === 'string') {
    fields.Notas_entrenador = body.notasEntrenador
  }
  if (typeof body?.estado === 'string') {
    if (!ESTADOS_VALIDOS.includes(body.estado)) {
      return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
    }
    fields.Estado = body.estado
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  try {
    const actualizado = await actualizarCliente(id, fields)
    return NextResponse.json({
      id: actualizado.id,
      estado: actualizado.fields.Estado ?? '',
      notasEntrenador: actualizado.fields.Notas_entrenador ?? '',
    })
  } catch (err) {
    console.error('Error al actualizar cliente en Airtable', err)
    return NextResponse.json({ error: 'Error al actualizar el cliente' }, { status: 500 })
  }
}
