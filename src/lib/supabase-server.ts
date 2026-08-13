import 'server-only'
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cliente Supabase con la clave anónima + el JWT del propio usuario (no el service role).
// Usado exclusivamente por /api/cliente/notas: así la Row Level Security de
// `notas_privadas` aplica de verdad contra auth.uid() en vez de depender de que el
// código de la API recuerde siempre filtrar por usuario. Ver DECISIONS.md.
export function createSupabaseUserClient(accessToken: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  })
}

export async function findSupabaseUserByEmail(email: string) {
  const target = email.toLowerCase()
  const perPage = 200
  let page = 1
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === target)
    if (match) return match
    if (data.users.length < perPage) return null
    page += 1
  }
}
