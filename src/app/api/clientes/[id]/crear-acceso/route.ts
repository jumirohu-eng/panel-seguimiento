import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClienteById } from '@/lib/airtable'
import { supabaseAdmin } from '@/lib/supabase-server'

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const DUPLICATE_CODES = new Set(['email_exists', 'user_already_exists'])

function generateTempPassword(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const cliente = await getClienteById(id)
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }
  if (cliente.fields.Entrenador !== email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (!cliente.fields.Email) {
    return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 })
  }

  try {
    const newPassword = generateTempPassword()
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: cliente.fields.Email,
      password: newPassword,
      email_confirm: true,
    })

    if (error) {
      if (DUPLICATE_CODES.has(error.code ?? '')) {
        return NextResponse.json(
          { error: 'Este cliente ya tiene una cuenta creada' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, email: data.user.email, password: newPassword })
  } catch (err) {
    console.error('Error al crear acceso de cliente', err)
    return NextResponse.json({ error: 'Error al crear el acceso' }, { status: 500 })
  }
}
