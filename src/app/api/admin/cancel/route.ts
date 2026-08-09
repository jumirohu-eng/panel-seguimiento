import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import { cancelarInvitacion, getInvitacionByToken } from '@/lib/airtable'

export async function POST(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token) {
    return NextResponse.json({ error: 'Falta el token' }, { status: 400 })
  }

  try {
    const invitacion = await getInvitacionByToken(token)
    if (!invitacion || invitacion.fields.Estado !== 'Activo') {
      return NextResponse.json({ error: 'Sin invitación activa con ese token' }, { status: 404 })
    }

    await cancelarInvitacion(invitacion.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error al cancelar invitación', err)
    return NextResponse.json({ error: 'Error al cancelar invitación' }, { status: 500 })
  }
}
