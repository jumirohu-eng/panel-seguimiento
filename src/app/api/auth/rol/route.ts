import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getAdminByEmail, getEntrenadorByEmail, getClienteByEmail } from '@/lib/airtable'

export async function GET(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const admin = await getAdminByEmail(email)
    if (admin && admin.fields.Activo) {
      return NextResponse.json({ rol: 'admin' })
    }

    const entrenador = await getEntrenadorByEmail(email)
    if (entrenador) {
      return NextResponse.json({ rol: 'entrenador' })
    }

    const cliente = await getClienteByEmail(email)
    if (cliente) {
      return NextResponse.json({ rol: 'cliente' })
    }

    return NextResponse.json({ error: 'No se encontró una cuenta asociada a este email' }, { status: 403 })
  } catch (err) {
    console.error('Error al resolver rol de usuario', err)
    return NextResponse.json({ error: 'Error al resolver el rol del usuario' }, { status: 500 })
  }
}
