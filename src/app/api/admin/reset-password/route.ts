import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import { supabaseAdmin, findSupabaseUserByEmail } from '@/lib/supabase-server'

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function generateTempPassword(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('')
}

export async function POST(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  if (!email) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  try {
    const user = await findSupabaseUserByEmail(email)
    if (!user) {
      return NextResponse.json(
        { error: 'Este entrenador todavía no ha completado su registro' },
        { status: 404 }
      )
    }

    const newPassword = generateTempPassword()
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })
    if (error) throw error

    return NextResponse.json({ success: true, newPassword })
  } catch (err) {
    console.error('Error al resetear contraseña', err)
    return NextResponse.json({ error: 'Error al resetear la contraseña' }, { status: 500 })
  }
}
