import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClientesByEntrenador, getUltimosReportesPorClientes } from '@/lib/airtable'
import { calcularEstadoReporte } from '@/lib/estadoReporte'

export async function GET(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const records = await getClientesByEntrenador(email)
    const emails = records.map((r) => r.fields.Email).filter((e): e is string => Boolean(e))
    const ultimosReportes = await getUltimosReportesPorClientes(emails)

    const clientes = records.map((r) => {
      const ultimo = r.fields.Email ? ultimosReportes[r.fields.Email] : undefined
      const estadoReporte = calcularEstadoReporte(ultimo?.fecha, ultimo?.mensajeSugerido)
      return {
        id: r.id,
        nombre: r.fields.Nombre,
        email: r.fields.Email ?? '',
        telefono: r.fields['Teléfono'] ?? '',
        objetivo: r.fields.Objetivo,
        estado: r.fields.Estado ?? '',
        entrenamientos_objetivo: r.fields.Entrenamientos_objetivo ?? 0,
        linkRecordatorio: r.fields.Link_recordatorio ?? '',
        tieneAlerta: estadoReporte === 'alerta',
      }
    })
    return NextResponse.json(clientes)
  } catch (err) {
    console.error('Error al obtener clientes de Airtable', err)
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
  }
}
