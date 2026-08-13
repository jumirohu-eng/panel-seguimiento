import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getEntrenadorByEmail, getCheckinTiposByEntrenador, upsertCheckinTipo } from '@/lib/airtable'
import { resolverProgramacionTipo, FrecuenciaCheckin } from '@/lib/checkinFields'

const TIPOS: FrecuenciaCheckin[] = ['diario', 'semanal', 'periodico']

// Controla cuándo un tipo de check-in concreto (diario/semanal/periódico, cada uno
// independiente — Parte 1.5) se hace visible para los clientes de este entrenador.
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
  const tipo = body?.tipo as FrecuenciaCheckin
  const fecha = body && 'fecha' in body ? body.fecha : undefined
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: 'tipo debe ser diario, semanal o periodico' }, { status: 400 })
  }
  if (fecha !== null && (typeof fecha !== 'string' || Number.isNaN(new Date(fecha).getTime()))) {
    return NextResponse.json({ error: 'fecha debe ser una fecha ISO válida o null' }, { status: 400 })
  }

  try {
    // Airtable PATCH: `null` limpia el campo (vuelve a borrador); un string ISO lo fija.
    await upsertCheckinTipo(email, tipo, { Disponible_desde: fecha })
    const filasTipos = await getCheckinTiposByEntrenador(email)
    const filaTipo = filasTipos.find((f) => f.fields.Tipo === tipo)
    const { lanzado, disponibleDesde } = resolverProgramacionTipo(filaTipo?.fields, entrenador.fields.Checkin_disponible_desde)
    return NextResponse.json({ tipo, lanzado, disponibleDesde })
  } catch (err) {
    console.error('Error al actualizar el lanzamiento del check-in', err)
    return NextResponse.json({ error: 'Error al actualizar el lanzamiento' }, { status: 500 })
  }
}
