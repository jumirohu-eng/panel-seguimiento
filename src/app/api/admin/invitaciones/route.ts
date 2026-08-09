import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import { getAllInvitaciones } from '@/lib/airtable'
import { Invitacion } from '@/lib/types'

export async function GET(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const records = await getAllInvitaciones()
    const ahora = Date.now()
    const invitaciones: Invitacion[] = records.map((r) => {
      const estado =
        r.fields.Estado === 'Activo' && new Date(r.fields.Expira).getTime() <= ahora
          ? 'Expirado'
          : r.fields.Estado
      return {
        token: r.fields.Token,
        tokenTruncado: `${r.fields.Token.slice(0, 10)}...`,
        email: r.fields.Email_entrenador,
        estado,
        creado: r.fields.Creado,
        expira: r.fields.Expira,
      }
    })
    return NextResponse.json({ invitaciones })
  } catch (err) {
    console.error('Error al obtener invitaciones de Airtable', err)
    return NextResponse.json({ error: 'Error al obtener invitaciones' }, { status: 500 })
  }
}
