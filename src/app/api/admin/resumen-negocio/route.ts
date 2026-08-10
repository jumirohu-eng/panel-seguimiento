import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import {
  getAllEntrenadores,
  getClientesActivosPorEntrenador,
  getAllSnapshotsEntrenadores,
  SolucionEntrenador,
} from '@/lib/airtable'
import { ResumenNegocio } from '@/lib/types'

const SOLUCIONES: SolucionEntrenador[] = ['Seguimiento', 'Captación', 'Recuperación', 'Referidos']

export async function GET(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const [entrenadores, clientesActivosPorEntrenador, snapshotsEntrenadores] = await Promise.all([
      getAllEntrenadores(),
      getClientesActivosPorEntrenador(),
      getAllSnapshotsEntrenadores(),
    ])

    const activos = entrenadores.filter((e) => e.fields.Estado === 'Activo')
    const enPrueba = entrenadores.filter((e) => e.fields.Estado === 'Prueba')

    const total_entrenadores_activos = activos.length
    const total_clientes_gestionados = activos.reduce(
      (sum, e) => sum + (clientesActivosPorEntrenador[e.fields.Email] ?? 0),
      0
    )
    const mrr_estimado = activos.reduce((sum, e) => sum + (e.fields.Precio_mensual ?? 0), 0)
    const entrenadores_prueba = enPrueba.length

    const evolucion_entrenadores_mensual = snapshotsEntrenadores
      .map((s) => ({
        mes: s.fields.Fecha?.slice(0, 7) ?? '',
        total_entrenadores: s.fields.Total_entrenadores ?? 0,
        total_activos: s.fields.Total_activos ?? 0,
        total_prueba: s.fields.Total_prueba ?? 0,
      }))
      .filter((d) => d.mes !== '')

    const distribucion_soluciones = SOLUCIONES.map((solucion) => ({
      solucion,
      count: entrenadores.filter((e) => (e.fields.Soluciones ?? []).includes(solucion)).length,
    }))

    const resumen: ResumenNegocio = {
      total_entrenadores_activos,
      total_clientes_gestionados,
      mrr_estimado,
      entrenadores_prueba,
      evolucion_entrenadores_mensual,
      distribucion_soluciones,
    }

    return NextResponse.json(resumen)
  } catch (err) {
    console.error('Error al obtener resumen de negocio', err)
    return NextResponse.json({ error: 'Error al obtener resumen de negocio' }, { status: 500 })
  }
}
