import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import { getAllEntrenadores, getClientesActivosPorEntrenador, getAllInvitaciones } from '@/lib/airtable'
import { calcularAlertasNegocio } from '@/lib/alertas'
import { AtencionResponse } from '@/lib/types'

export async function GET(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const [entrenadores, clientesActivosPorEntrenador, invitaciones] = await Promise.all([
      getAllEntrenadores(),
      getClientesActivosPorEntrenador(),
      getAllInvitaciones(),
    ])

    const alertas = calcularAlertasNegocio({ entrenadores, invitaciones, clientesActivosPorEntrenador })
    const response: AtencionResponse = { alertas }
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error al calcular alertas de negocio', err)
    return NextResponse.json({ error: 'Error al calcular alertas de negocio' }, { status: 500 })
  }
}
