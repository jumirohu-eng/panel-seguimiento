import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClienteByEmail, getEntrenadorByEmail, getReportesByClienteEmail } from '@/lib/airtable'
import { calcularEstadoReporte } from '@/lib/estadoReporte'
import { ClientePerfil } from '@/lib/types'

const TRES_MESES_DIAS = 92
const TREINTA_DIAS = 30

export async function GET(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const cliente = await getClienteByEmail(email)
    if (!cliente) {
      return NextResponse.json({ error: 'No se encontró ningún cliente con este email' }, { status: 404 })
    }

    const entrenador = await getEntrenadorByEmail(cliente.fields.Entrenador)

    // pageSize amplio para cubrir ~3 meses de check-ins semanales con margen, sin paginar.
    const { records: reportes } = await getReportesByClienteEmail(email, 60)
    const reportesOrdenados = [...reportes].sort(
      (a, b) => new Date(b.fields.Fecha).getTime() - new Date(a.fields.Fecha).getTime()
    )

    const ahora = Date.now()
    const limiteTresMeses = ahora - TRES_MESES_DIAS * 24 * 60 * 60 * 1000
    const limiteTreintaDias = ahora - TREINTA_DIAS * 24 * 60 * 60 * 1000

    const dentroDeTresMeses = reportesOrdenados.filter(
      (r) => new Date(r.fields.Fecha).getTime() >= limiteTresMeses
    )

    const pesoHistorico = dentroDeTresMeses
      .filter((r) => typeof r.fields.Peso === 'number')
      .map((r) => ({ fecha: r.fields.Fecha, peso: r.fields.Peso }))
      .reverse()

    const entrenamientosRecientes = reportesOrdenados
      .slice(0, 4)
      .filter((r) => typeof r.fields.Entrenamientos === 'number')
      .map((r) => ({ fecha: r.fields.Fecha, entrenamientos: r.fields.Entrenamientos }))
      .reverse()

    const dentroDeTreintaDias = reportesOrdenados.filter(
      (r) => new Date(r.fields.Fecha).getTime() >= limiteTreintaDias
    )
    const energiaPromedio30dias = {
      cansado: dentroDeTreintaDias.filter((r) => r.fields['Energía'] === 'Cansado').length,
      normal: dentroDeTreintaDias.filter((r) => r.fields['Energía'] === 'Normal').length,
      conEnergia: dentroDeTreintaDias.filter((r) => r.fields['Energía'] === 'Con energía').length,
      total: dentroDeTreintaDias.length,
    }

    const ultimo = reportesOrdenados[0]
    const proximoCheckinDias = ultimo
      ? 7 - Math.floor((ahora - new Date(ultimo.fields.Fecha).getTime()) / (1000 * 60 * 60 * 24))
      : null

    const estadoUltimo = calcularEstadoReporte(ultimo?.fields.Fecha, ultimo?.fields['Mensaje sugerido'])
    const alertaReciente =
      estadoUltimo === 'alerta' ? ultimo?.fields['Mensaje sugerido']?.trim() || null : null

    const perfil: ClientePerfil = {
      nombre: cliente.fields.Nombre,
      objetivo: cliente.fields.Objetivo,
      entrenadorNombre: entrenador?.fields.Nombre || cliente.fields.Entrenador,
      entrenamientosObjetivo: cliente.fields.Entrenamientos_objetivo,
      pesoHistorico,
      entrenamientosRecientes,
      energiaPromedio30dias,
      proximoCheckinDias,
      alertaReciente,
    }

    return NextResponse.json(perfil)
  } catch (err) {
    console.error('Error al obtener perfil de cliente', err)
    return NextResponse.json({ error: 'Error al obtener el perfil' }, { status: 500 })
  }
}
