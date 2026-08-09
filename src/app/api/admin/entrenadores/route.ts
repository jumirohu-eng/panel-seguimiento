import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import {
  getAllEntrenadores,
  getClientesActivosPorEntrenador,
  getEntrenadorByEmail,
  crearEntrenador,
} from '@/lib/airtable'
import { Entrenador } from '@/lib/types'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function GET(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const [registros, clientesActivos] = await Promise.all([
      getAllEntrenadores(),
      getClientesActivosPorEntrenador(),
    ])

    const entrenadores: Entrenador[] = registros.map((r) => ({
      id: r.id,
      email: r.fields.Email,
      nombre: r.fields.Nombre,
      telefono: r.fields['Teléfono'] ?? '',
      soluciones: r.fields.Soluciones ?? [],
      estado: r.fields.Estado,
      fechaAlta: r.fields.Fecha_alta ?? '',
      precioMensual: r.fields.Precio_mensual ?? 0,
      notas: r.fields.Notas ?? '',
      clientesActivos: clientesActivos[r.fields.Email] ?? 0,
      linkWhatsapp: r.fields.Link_whatsapp ?? '',
      ultimoLogin: r.fields['Último_login'] ?? null,
    }))

    return NextResponse.json({ entrenadores })
  } catch (err) {
    console.error('Error al obtener entrenadores', err)
    return NextResponse.json({ error: 'Error al obtener entrenadores' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const telefono = typeof body?.telefono === 'string' ? body.telefono.trim() : ''
  const soluciones = Array.isArray(body?.soluciones) ? body.soluciones : []
  const estado = typeof body?.estado === 'string' ? body.estado : 'Prueba'
  const precioMensual = typeof body?.precioMensual === 'number' ? body.precioMensual : 0

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }
  if (!nombre) {
    return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
  }

  try {
    const existente = await getEntrenadorByEmail(email)
    if (existente) {
      return NextResponse.json(
        { error: 'Ya existe un entrenador con ese email' },
        { status: 400 }
      )
    }

    const record = await crearEntrenador({
      Email: email,
      Nombre: nombre,
      'Teléfono': telefono || undefined,
      Soluciones: soluciones,
      Estado: estado as 'Activo' | 'Prueba' | 'Inactivo',
      Fecha_alta: new Date().toISOString().slice(0, 10),
      Precio_mensual: precioMensual,
    })

    return NextResponse.json({ success: true, id: record.id, email: record.fields.Email })
  } catch (err) {
    console.error('Error al crear entrenador', err)
    return NextResponse.json({ error: 'Error al crear entrenador' }, { status: 500 })
  }
}
