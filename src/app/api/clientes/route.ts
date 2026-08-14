import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClientesByEntrenador, crearCliente, getEntrenadorByEmail } from '@/lib/airtable'

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
      telefono: r.fields['Teléfono'] ?? '',
      objetivo: r.fields.Objetivo,
      estado: r.fields.Estado ?? '',
      entrenamientos_objetivo: r.fields.Entrenamientos_objetivo ?? 0,
      linkRecordatorio: r.fields.Link_recordatorio ?? '',
      notasEntrenador: r.fields.Notas_entrenador ?? '',
      notasIniciales: r.fields.Notas_iniciales ?? '',
      lastModified: r.fields.Last_modified ?? '',
    }))
    return NextResponse.json(clientes)
  } catch (err) {
    console.error('Error al obtener clientes de Airtable', err)
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Crear clientes es una capacidad de entrenador, no de cualquier usuario autenticado.
  // Admins que además tengan rol de entrenador pasan este gate porque el modelo es multi-rol.
  const entrenador = await getEntrenadorByEmail(email)
  if (!entrenador) {
    return NextResponse.json({ error: 'Solo un entrenador puede crear clientes' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const clienteEmail = typeof body?.email === 'string' ? body.email.trim() : ''
  const telefono = typeof body?.telefono === 'string' ? body.telefono.trim() : ''

  if (!nombre || !clienteEmail || !telefono) {
    return NextResponse.json({ error: 'Nombre, email y teléfono son obligatorios' }, { status: 400 })
  }

  try {
    const record = await crearCliente({
      Nombre: nombre,
      Email: clienteEmail,
      'Teléfono': telefono,
      Entrenador: email,
      Estado: 'Activo',
    })
    return NextResponse.json({
      id: record.id,
      nombre: record.fields.Nombre,
      email: record.fields.Email ?? '',
      telefono: record.fields['Teléfono'] ?? '',
      entrenador: record.fields.Entrenador,
      lastModified: record.fields.Last_modified ?? '',
    })
  } catch (err) {
    console.error('Error al crear cliente en Airtable', err)
    return NextResponse.json({ error: 'Error al crear el cliente' }, { status: 500 })
  }
}
