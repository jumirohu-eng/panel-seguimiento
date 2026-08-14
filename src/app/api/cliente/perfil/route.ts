import { NextRequest, NextResponse } from 'next/server'
import { getClienteActivoAutenticado } from '@/lib/auth-server'
import { getEntrenadorByEmail } from '@/lib/airtable'
import { ClientePerfil } from '@/lib/types'

export async function GET(request: NextRequest) {
  const gate = await getClienteActivoAutenticado(request)
  if (!gate.ok) {
    const mensaje =
      gate.status === 401
        ? 'No autorizado'
        : gate.status === 404
          ? 'No se encontró ningún cliente con este email'
          : 'Tu acceso está desactivado. Contacta con tu entrenador.'
    return NextResponse.json({ error: mensaje }, { status: gate.status })
  }
  const cliente = gate.cliente

  try {
    const entrenador = await getEntrenadorByEmail(cliente.fields.Entrenador)

    const perfil: ClientePerfil = {
      nombre: cliente.fields.Nombre,
      objetivo: cliente.fields.Objetivo,
      entrenadorNombre: entrenador?.fields.Nombre || cliente.fields.Entrenador,
      onboardingCompletado: Boolean(cliente.fields.Objetivo),
    }

    return NextResponse.json(perfil)
  } catch (err) {
    console.error('Error al obtener perfil de cliente', err)
    return NextResponse.json({ error: 'Error al obtener el perfil' }, { status: 500 })
  }
}
