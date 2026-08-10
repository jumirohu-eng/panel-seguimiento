import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getEntrenadorByEmail } from '@/lib/airtable'

export async function GET(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const entrenador = await getEntrenadorByEmail(email)
    return NextResponse.json({ soluciones: entrenador?.fields.Soluciones ?? [] })
  } catch (err) {
    console.error('Error al obtener el perfil del entrenador', err)
    return NextResponse.json({ error: 'Error al obtener el perfil' }, { status: 500 })
  }
}
