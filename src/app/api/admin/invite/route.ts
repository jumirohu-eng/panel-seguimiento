import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import { cancelarInvitacion, crearInvitacion, getInvitacionActivaByEmail } from '@/lib/airtable'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  try {
    const activa = await getInvitacionActivaByEmail(email)
    if (activa) {
      await cancelarInvitacion(activa.id)
    }

    const token = `inv_${crypto.randomUUID().slice(0, 32)}`
    const record = await crearInvitacion(email, token)
    const origin = new URL(request.url).origin

    return NextResponse.json({
      success: true,
      token: record.fields.Token,
      email: record.fields.Email_entrenador,
      inviteLink: `${origin}/signup?token=${record.fields.Token}`,
      expiresAt: record.fields.Expira,
    })
  } catch (err) {
    console.error('Error al generar invitación', err)
    return NextResponse.json({ error: 'Error al generar invitación' }, { status: 500 })
  }
}
