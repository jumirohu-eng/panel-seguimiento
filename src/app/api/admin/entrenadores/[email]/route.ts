import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import {
  getEntrenadorByEmail,
  actualizarEntrenador,
  getClientesActivosPorEntrenador,
  getSnapshotsByEntrenador,
  getInvitacionMasRecienteByEmail,
  EntrenadorFields,
} from '@/lib/airtable'
import { EntrenadorDetalle, Invitacion } from '@/lib/types'

function serializeInvitacion(
  record: Awaited<ReturnType<typeof getInvitacionMasRecienteByEmail>>
): Invitacion | null {
  if (!record) return null
  const ahora = Date.now()
  const estado =
    record.fields.Estado === 'Activo' && new Date(record.fields.Expira).getTime() <= ahora
      ? 'Expirado'
      : record.fields.Estado
  return {
    token: record.fields.Token,
    tokenTruncado: `${record.fields.Token.slice(0, 10)}...`,
    email: record.fields.Email_entrenador,
    estado,
    creado: record.fields.Creado,
    expira: record.fields.Expira,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { email: rawEmail } = await params
  const email = decodeURIComponent(rawEmail)

  try {
    const entrenadorRecord = await getEntrenadorByEmail(email)
    if (!entrenadorRecord) {
      return NextResponse.json({ error: 'Entrenador no encontrado' }, { status: 404 })
    }

    const [clientesActivos, snapshots, invitacion] = await Promise.all([
      getClientesActivosPorEntrenador(),
      getSnapshotsByEntrenador(email),
      getInvitacionMasRecienteByEmail(email),
    ])

    const entrenador: EntrenadorDetalle = {
      id: entrenadorRecord.id,
      email: entrenadorRecord.fields.Email,
      nombre: entrenadorRecord.fields.Nombre,
      telefono: entrenadorRecord.fields['Teléfono'] ?? '',
      soluciones: entrenadorRecord.fields.Soluciones ?? [],
      estado: entrenadorRecord.fields.Estado,
      fechaAlta: entrenadorRecord.fields.Fecha_alta ?? '',
      precioMensual: entrenadorRecord.fields.Precio_mensual ?? 0,
      notas: entrenadorRecord.fields.Notas ?? '',
      clientesActivos: clientesActivos[email] ?? 0,
      snapshots: snapshots.map((s) => ({
        fecha: s.fields.Fecha,
        clientesActivos: s.fields.Clientes_activos,
      })),
      invitacion: serializeInvitacion(invitacion),
    }

    return NextResponse.json({ entrenador })
  } catch (err) {
    console.error('Error al obtener entrenador', err)
    return NextResponse.json({ error: 'Error al obtener entrenador' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { email: rawEmail } = await params
  const email = decodeURIComponent(rawEmail)

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  try {
    const entrenadorRecord = await getEntrenadorByEmail(email)
    if (!entrenadorRecord) {
      return NextResponse.json({ error: 'Entrenador no encontrado' }, { status: 404 })
    }

    const fields: Partial<EntrenadorFields> = {}
    if (Array.isArray(body.soluciones)) fields.Soluciones = body.soluciones
    if (typeof body.estado === 'string') fields.Estado = body.estado
    if (typeof body.precioMensual === 'number') fields.Precio_mensual = body.precioMensual
    if (typeof body.notas === 'string') fields.Notas = body.notas

    const updated = await actualizarEntrenador(entrenadorRecord.id, fields)

    return NextResponse.json({ success: true, id: updated.id })
  } catch (err) {
    console.error('Error al actualizar entrenador', err)
    return NextResponse.json({ error: 'Error al actualizar entrenador' }, { status: 500 })
  }
}
