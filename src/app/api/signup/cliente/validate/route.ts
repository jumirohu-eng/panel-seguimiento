import { NextRequest, NextResponse } from 'next/server'
import { getInvitacionClienteByToken } from '@/lib/airtable'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Falta el token' }, { status: 400 })
  }

  try {
    const invitacion = await getInvitacionClienteByToken(token)
    if (!invitacion) {
      return NextResponse.json({ valid: false, error: 'Token inválido' }, { status: 404 })
    }
    if (invitacion.fields.Estado !== 'Activo') {
      return NextResponse.json({ valid: false, error: 'Token expirado o usado' }, { status: 410 })
    }
    if (new Date(invitacion.fields.Expira).getTime() <= Date.now()) {
      return NextResponse.json({ valid: false, error: 'Token expirado' }, { status: 410 })
    }

    return NextResponse.json({ valid: true, email: invitacion.fields.Email_cliente })
  } catch (err) {
    console.error('Error al validar token de invitación de cliente', err)
    return NextResponse.json({ valid: false, error: 'Error al validar el token' }, { status: 500 })
  }
}
