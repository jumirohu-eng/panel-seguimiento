import { NextRequest, NextResponse } from 'next/server'
import { getClienteActivoAutenticado } from '@/lib/auth-server'
import { getEntrenadorByEmail, getReportesByClienteEmail, getRegistrosCheckinByClienteEmail } from '@/lib/airtable'
import { contarEntrenamientosSemana, inicioDePeriodoSemanalUTC } from '@/lib/checkinFields'
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

    // pageSize amplio para cubrir varios meses de reportes Tally con margen, sin paginar.
    const { records: reportes } = await getReportesByClienteEmail(cliente.fields.Email ?? '', 60)
    const reportesOrdenados = [...reportes].sort(
      (a, b) => new Date(b.fields.Fecha).getTime() - new Date(a.fields.Fecha).getTime()
    )
    const ultimo = reportesOrdenados[0]
    const ahora = Date.now()
    const proximoCheckinDias = ultimo
      ? 7 - Math.floor((ahora - new Date(ultimo.fields.Fecha).getTime()) / (1000 * 60 * 60 * 24))
      : null

    const registrosCheckin = await getRegistrosCheckinByClienteEmail(cliente.fields.Email ?? '')
    const realizados = contarEntrenamientosSemana(registrosCheckin, inicioDePeriodoSemanalUTC('lunes', ahora))

    const perfil: ClientePerfil = {
      nombre: cliente.fields.Nombre,
      objetivo: cliente.fields.Objetivo,
      entrenadorNombre: entrenador?.fields.Nombre || cliente.fields.Entrenador,
      entrenamientosObjetivo: cliente.fields.Entrenamientos_objetivo,
      entrenamientosSemana: { realizados, asignados: cliente.fields.Entrenamientos_objetivo },
      proximoCheckinDias,
    }

    return NextResponse.json(perfil)
  } catch (err) {
    console.error('Error al obtener perfil de cliente', err)
    return NextResponse.json({ error: 'Error al obtener el perfil' }, { status: 500 })
  }
}
