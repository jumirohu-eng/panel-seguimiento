import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getEntrenadorByEmail, actualizarEntrenador } from '@/lib/airtable'
import { resolverLanzamiento } from '@/lib/checkinFields'

// Controla cuándo el check-in de este entrenador se hace visible para sus clientes.
// body.fecha: null = volver a borrador (oculto); ISO string = lanzar (si es
// pasada/ahora, visible de inmediato; si es futura, programado — se abre solo
// cuando esa fecha llega, recalculado en cada request del cliente, sin cron).
export async function PUT(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const entrenador = await getEntrenadorByEmail(email)
  if (!entrenador) {
    return NextResponse.json({ error: 'Solo un entrenador puede lanzar su check-in' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const fecha = body && 'fecha' in body ? body.fecha : undefined
  if (fecha !== null && (typeof fecha !== 'string' || Number.isNaN(new Date(fecha).getTime()))) {
    return NextResponse.json({ error: 'fecha debe ser una fecha ISO válida o null' }, { status: 400 })
  }

  try {
    // Airtable PATCH: `null` limpia el campo (vuelve a borrador); un string ISO lo fija.
    await actualizarEntrenador(entrenador.id, { Checkin_disponible_desde: fecha })
    const response = resolverLanzamiento(fecha)
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error al actualizar el lanzamiento del check-in', err)
    return NextResponse.json({ error: 'Error al actualizar el lanzamiento' }, { status: 500 })
  }
}
