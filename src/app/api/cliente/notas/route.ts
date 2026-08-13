import { NextRequest, NextResponse } from 'next/server'
import { getClienteActivoAutenticado } from '@/lib/auth-server'
import { createSupabaseUserClient } from '@/lib/supabase-server'

// "Mis notas" — libreta privada del cliente. Regla absoluta (ver DECISIONS.md): el
// entrenador nunca puede leerlas, ninguna IA las recibe, no pertenecen a
// Registros_checkin ni a ningún otro flujo de Airtable/n8n. Por eso esta ruta usa
// createSupabaseUserClient (JWT del propio usuario) en vez de supabaseAdmin — la RLS de
// `notas_privadas` (auth.uid() = user_id) aplica de verdad, no solo por convención.
function extraerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length)
}

function mensajeGate(status: 401 | 403 | 404) {
  if (status === 401) return 'No autorizado'
  if (status === 404) return 'No se encontró ningún cliente con este email'
  return 'Tu acceso está desactivado. Contacta con tu entrenador.'
}

export async function GET(request: NextRequest) {
  const gate = await getClienteActivoAutenticado(request)
  if (!gate.ok) {
    return NextResponse.json({ error: mensajeGate(gate.status) }, { status: gate.status })
  }
  const token = extraerToken(request)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createSupabaseUserClient(token)
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('notas_privadas')
    .select('contenido, updated_at')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (error) {
    console.error('Error al leer notas privadas', error)
    return NextResponse.json({ error: 'Error al leer las notas' }, { status: 500 })
  }

  return NextResponse.json({ contenido: data?.contenido ?? '', updatedAt: data?.updated_at ?? null })
}

export async function PUT(request: NextRequest) {
  const gate = await getClienteActivoAutenticado(request)
  if (!gate.ok) {
    return NextResponse.json({ error: mensajeGate(gate.status) }, { status: gate.status })
  }
  const token = extraerToken(request)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const contenido = typeof body?.contenido === 'string' ? body.contenido : null
  if (contenido === null) {
    return NextResponse.json({ error: 'Falta contenido' }, { status: 400 })
  }

  const supabase = createSupabaseUserClient(token)
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { error } = await supabase
    .from('notas_privadas')
    .upsert({ user_id: userData.user.id, contenido, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    console.error('Error al guardar notas privadas', error)
    return NextResponse.json({ error: 'Error al guardar las notas' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
