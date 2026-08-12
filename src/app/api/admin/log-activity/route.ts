import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getAdminByEmail, getEntrenadorByEmail, actualizarEntrenador } from '@/lib/airtable'

export async function POST(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const admin = await getAdminByEmail(email)
    if (admin && admin.fields.Activo) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const entrenador = await getEntrenadorByEmail(email)
    if (entrenador) {
      await actualizarEntrenador(entrenador.id, { 'Último_login': new Date().toISOString() })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error al registrar último login', err)
    return NextResponse.json({ error: 'Error al registrar actividad' }, { status: 500 })
  }
}
