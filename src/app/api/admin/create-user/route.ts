import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-server'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const DUPLICATE_CODES = new Set(['email_exists', 'user_already_exists'])

export async function POST(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password too weak' }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) {
      if (DUPLICATE_CODES.has(error.code ?? '')) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
      }
      if (error.code === 'weak_password') {
        return NextResponse.json({ error: 'Password too weak' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      user_id: data.user.id,
      email: data.user.email,
    })
  } catch (err) {
    console.error('Error al crear usuario en Supabase', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
