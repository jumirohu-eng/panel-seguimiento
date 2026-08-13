import 'server-only'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-server'
import { getAdminByEmail, getClienteByEmail, AirtableRecord, ClienteFields } from './airtable'

export async function getAuthenticatedEmail(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice('Bearer '.length)
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user?.email) return null

  return data.user.email
}

export async function getAuthenticatedAdminEmail(request: NextRequest): Promise<string | null> {
  const email = await getAuthenticatedEmail(request)
  if (!email) return null
  const admin = await getAdminByEmail(email)
  if (!admin || !admin.fields.Activo) return null
  return email
}

export type ClienteGateResult =
  | { ok: true; cliente: AirtableRecord<ClienteFields> }
  | { ok: false; status: 401 | 403 | 404 }

// Gate real de "cliente activo/inactivo" (Parte 1.5): un cliente con Estado='Perdido' no
// debe tener acceso ni poder crear check-ins, aunque su sesión de Supabase siga siendo
// válida. Antes de esta función, ningún endpoint de cliente comprobaba `Estado` — ver
// DECISIONS.md. Devuelve un resultado discriminado (no solo null) para que cada ruta
// pueda seguir distinguiendo 401 (no autenticado) de 404 (sin ficha de cliente) de 403
// (cliente inactivo) igual que antes.
export async function getClienteActivoAutenticado(request: NextRequest): Promise<ClienteGateResult> {
  const email = await getAuthenticatedEmail(request)
  if (!email) return { ok: false, status: 401 }
  const cliente = await getClienteByEmail(email)
  if (!cliente) return { ok: false, status: 404 }
  if (cliente.fields.Estado !== 'Activo') return { ok: false, status: 403 }
  return { ok: true, cliente }
}
