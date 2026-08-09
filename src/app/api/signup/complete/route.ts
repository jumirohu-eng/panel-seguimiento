import { NextRequest, NextResponse } from 'next/server'
import { getInvitacionByToken, marcarInvitacionUsada } from '@/lib/airtable'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token) {
    return NextResponse.json({ error: 'Falta el token' }, { status: 400 })
  }

  try {
    const invitacion = await getInvitacionByToken(token)
    if (!invitacion) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    }
    if (invitacion.fields.Estado !== 'Activo' || new Date(invitacion.fields.Expira).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Token expirado o usado' }, { status: 410 })
    }

    await marcarInvitacionUsada(invitacion.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error al completar el signup', err)
    return NextResponse.json({ error: 'Error al completar el registro' }, { status: 500 })
  }
}
