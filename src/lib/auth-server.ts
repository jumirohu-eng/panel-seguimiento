import 'server-only'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-server'

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
  if (!email || email !== process.env.ADMIN_EMAIL) return null
  return email
}
