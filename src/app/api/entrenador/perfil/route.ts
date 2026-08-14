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
    if (!entrenador) {
      // Distinto de "entrenador sin plan" (soluciones: []) — aquí no existe ninguna fila
      // de Entrenadores con este email exacto (cuenta no dada de alta, o email distinto
      // al que se registró en Airtable). Un 200 con soluciones:[] hacía indistinguibles
      // ambos casos para quien consume este endpoint.
      return NextResponse.json(
        { error: 'Esta cuenta no está registrada como entrenador' },
        { status: 404 }
      )
    }
    return NextResponse.json({ soluciones: entrenador.fields.Soluciones ?? [] })
  } catch (err) {
    console.error('Error al obtener el perfil del entrenador', err)
    return NextResponse.json({ error: 'Error al obtener el perfil' }, { status: 500 })
  }
}
