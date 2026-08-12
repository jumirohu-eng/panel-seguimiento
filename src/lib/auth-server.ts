import 'server-only'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-server'
import { getAdminByEmail } from './airtable'

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
