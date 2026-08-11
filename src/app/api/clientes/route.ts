import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClientesByEntrenador, getUltimosReportesPorClientes, crearCliente } from '@/lib/airtable'
import { calcularEstadoReporte } from '@/lib/estadoReporte'
import { truncateResumen } from '@/lib/format'

function linkTallyAlta(nombre: string, email: string, telefono: string, entrenador: string): string {
  const base = process.env.NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL
  if (!base) return ''
  const params = new URLSearchParams({ nombre, email, telefono, entrenador })
  return `${base}?${params.toString()}`
}

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
      const tieneAlerta = estadoReporte === 'alerta'
      const textoResumen = ultimo?.analisisIA?.trim() || ultimo?.mensajeSugerido?.trim() || ''
      return {
        id: r.id,
        nombre: r.fields.Nombre,
        email: r.fields.Email ?? '',
        telefono: r.fields['Teléfono'] ?? '',
        objetivo: r.fields.Objetivo,
        estado: r.fields.Estado ?? '',
        entrenamientos_objetivo: r.fields.Entrenamientos_objetivo ?? 0,
        linkRecordatorio: r.fields.Link_recordatorio ?? '',
        tieneAlerta,
        alertaResumen: tieneAlerta && textoResumen ? truncateResumen(textoResumen) : '',
        notasEntrenador: r.fields.Notas_entrenador ?? '',
        notasIniciales: r.fields.Notas_iniciales ?? '',
        linkTallyAlta: r.fields.Link_tally_alta ?? '',
        lastModified: r.fields.Last_modified ?? '',
      }
    })
    return NextResponse.json(clientes)
  } catch (err) {
    console.error('Error al obtener clientes de Airtable', err)
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const clienteEmail = typeof body?.email === 'string' ? body.email.trim() : ''
  const telefono = typeof body?.telefono === 'string' ? body.telefono.trim() : ''

  if (!nombre || !clienteEmail || !telefono) {
    return NextResponse.json({ error: 'Nombre, email y teléfono son obligatorios' }, { status: 400 })
  }

  try {
    const link = linkTallyAlta(nombre, clienteEmail, telefono, email)
    const record = await crearCliente({
      Nombre: nombre,
      Email: clienteEmail,
      'Teléfono': telefono,
      Entrenador: email,
      Estado: 'Activo',
      ...(link ? { Link_tally_alta: link } : {}),
    })
    return NextResponse.json({
      id: record.id,
      nombre: record.fields.Nombre,
      email: record.fields.Email ?? '',
      telefono: record.fields['Teléfono'] ?? '',
      entrenador: record.fields.Entrenador,
      linkTallyAlta: record.fields.Link_tally_alta ?? '',
      lastModified: record.fields.Last_modified ?? '',
    })
  } catch (err) {
    console.error('Error al crear cliente en Airtable', err)
    return NextResponse.json({ error: 'Error al crear el cliente' }, { status: 500 })
  }
}
