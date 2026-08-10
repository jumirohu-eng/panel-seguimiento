import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getEntrenadorByEmail, actualizarEntrenador } from '@/lib/airtable'

export async function POST(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const entrenador = await getEntrenadorByEmail(email)
    if (!entrenador) {
      return NextResponse.json({ error: 'Entrenador no encontrado' }, { status: 404 })
    }
    await actualizarEntrenador(entrenador.id, {
      Consentimiento_IA: true,
      Consentimiento_IA_fecha: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error al guardar el consentimiento de IA', err)
    return NextResponse.json({ error: 'Error al guardar el consentimiento' }, { status: 500 })
  }
}
