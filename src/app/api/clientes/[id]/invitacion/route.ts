import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import {
  getClienteById,
  getInvitacionClienteActivaByClienteId,
  getInvitacionClienteMasRecienteByClienteId,
  cancelarInvitacionCliente,
  crearInvitacionCliente,
} from '@/lib/airtable'
import { findSupabaseUserByEmail } from '@/lib/supabase-server'
import { InvitacionClienteEstado } from '@/lib/types'

async function cargarCliente(id: string, email: string) {
  const cliente = await getClienteById(id)
  if (!cliente) return { error: NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 }) }
  if (cliente.fields.Entrenador !== email) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { cliente }
}

// GET: estado actual (sin generar nada) — para pintar la ficha del cliente sin invalidar
// un token ya enviado cada vez que el entrenador abre la página.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAuthenticatedEmail(request)
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { cliente, error } = await cargarCliente(id, email)
  if (error) return error

  try {
    const ultima = await getInvitacionClienteMasRecienteByClienteId(id, email)
    const ahora = Date.now()
    const origin = new URL(request.url).origin
    let cuentaActiva = false
    if (cliente!.fields.Email) {
      const user = await findSupabaseUserByEmail(cliente!.fields.Email)
      cuentaActiva = Boolean(user?.email_confirmed_at)
    }

    let invitacion: InvitacionClienteEstado['invitacion'] = null
    if (ultima) {
      const estado =
        ultima.fields.Estado === 'Activo' && new Date(ultima.fields.Expira).getTime() <= ahora
          ? 'Expirado'
          : ultima.fields.Estado
      invitacion = {
        estado,
        creado: ultima.fields.Creado,
        expira: ultima.fields.Expira,
        inviteLink: estado === 'Activo' ? `${origin}/cliente/signup?token=${ultima.fields.Token}` : null,
      }
    }

    const respuesta: InvitacionClienteEstado = { invitacion, cuentaActiva }
    return NextResponse.json(respuesta)
  } catch (err) {
    console.error('Error al obtener estado de invitación de cliente', err)
    return NextResponse.json({ error: 'Error al obtener el estado de la invitación' }, { status: 500 })
  }
}

// POST: genera una invitación nueva. Si ya había una activa la invalida primero (mismo
// endpoint sirve para "generar" y "regenerar" — ver DECISIONS.md).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAuthenticatedEmail(request)
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { cliente, error } = await cargarCliente(id, email)
  if (error) return error
  if (!cliente!.fields.Email) {
    return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 })
  }

  try {
    const activa = await getInvitacionClienteActivaByClienteId(id, email)
    if (activa) {
      await cancelarInvitacionCliente(activa.id)
    }

    const token = `cli_${crypto.randomUUID().slice(0, 32)}`
    const record = await crearInvitacionCliente(id, email, cliente!.fields.Email, token)
    const origin = new URL(request.url).origin

    return NextResponse.json({
      success: true,
      token: record.fields.Token,
      email: record.fields.Email_cliente,
      inviteLink: `${origin}/cliente/signup?token=${record.fields.Token}`,
      expiresAt: record.fields.Expira,
    })
  } catch (err) {
    console.error('Error al generar invitación de cliente', err)
    return NextResponse.json({ error: 'Error al generar la invitación' }, { status: 500 })
  }
}
