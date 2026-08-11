import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import {
  getAllSnapshots,
  getAllClientes,
  getAllEntrenadores,
  getClientesActivosPorEntrenador,
  getReportesConMensajeSugerido,
  getAllSnapshotsEntrenadores,
  SolucionEntrenador,
} from '@/lib/airtable'
import { MetricasEntrenadores, MetricasImpacto, MetricasNegocio } from '@/lib/types'

const PLANES: SolucionEntrenador[] = ['Seguimiento', 'Captación', 'Recuperación', 'Referidos', 'Metricas']
const ESTADOS_ENTRENADOR = ['Activo', 'Prueba', 'Inactivo'] as const

export async function GET(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const [snapshots, clientes, entrenadores, clientesActivosPorEntrenador, reportesConMensaje, snapshotsEntrenadores] =
      await Promise.all([
        getAllSnapshots(),
        getAllClientes(),
        getAllEntrenadores(),
        getClientesActivosPorEntrenador(),
        getReportesConMensajeSugerido(),
        getAllSnapshotsEntrenadores(),
      ])

    const total_clientes_historicos = clientes.length
    const total_clientes_actuales = clientes.filter((c) => c.fields.Estado === 'Activo').length

    const porMes: Record<string, number> = {}
    for (const s of snapshots) {
      const mes = s.fields.Fecha?.slice(0, 7)
      if (!mes) continue
      porMes[mes] = (porMes[mes] ?? 0) + (s.fields.Clientes_activos ?? 0)
    }
    const evolucion_clientes_mensual = Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, total_clientes]) => ({ mes, total_clientes }))

    const consentidos = entrenadores.filter((e) => e.fields.Permite_marketing === true)
    let metricas_impacto: MetricasImpacto | null = null

    if (consentidos.length >= 3) {
      const consentidosEmails = new Set(consentidos.map((e) => e.fields.Email))
      const clientesDeConsentidos = clientes.filter((c) => consentidosEmails.has(c.fields.Entrenador))
      const sumaActivos = consentidos.reduce(
        (sum, e) => sum + (clientesActivosPorEntrenador[e.fields.Email] ?? 0),
        0
      )
      const emailsClientesConsentidos = new Set(
        clientesDeConsentidos.map((c) => c.fields.Email).filter((email): email is string => Boolean(email))
      )
      const alertasRiesgo = reportesConMensaje.filter((r) => {
        const email = r.fields.Cliente_Email?.[0]
        return email ? emailsClientesConsentidos.has(email) : false
      }).length

      metricas_impacto = {
        total_clientes_seguidos: clientesDeConsentidos.length,
        promedio_clientes_activos: Math.round((sumaActivos / consentidos.length) * 10) / 10,
        alertas_riesgo_historicas: alertasRiesgo,
      }
    }

    const evolucion_entrenadores_mensual = snapshotsEntrenadores
      .map((s) => ({
        mes: s.fields.Fecha?.slice(0, 7) ?? '',
        total_entrenadores: s.fields.Total_entrenadores ?? 0,
        total_activos: s.fields.Total_activos ?? 0,
        total_prueba: s.fields.Total_prueba ?? 0,
      }))
      .filter((d) => d.mes !== '')

    const entrenadores_por_estado = ESTADOS_ENTRENADOR.map((estado) => ({
      estado,
      count: entrenadores.filter((e) => e.fields.Estado === estado).length,
    }))

    const entrenadores_por_plan = PLANES.map((solucion) => ({
      solucion,
      count: entrenadores.filter((e) => (e.fields.Soluciones ?? []).includes(solucion)).length,
    }))

    const metricas_entrenadores: MetricasEntrenadores = {
      total_entrenadores_historico: entrenadores.length,
      total_entrenadores_actuales: entrenadores.length,
      evolucion_entrenadores_mensual,
      entrenadores_por_estado,
      entrenadores_por_plan,
    }

    const metricas: MetricasNegocio = {
      total_clientes_historicos,
      total_clientes_actuales,
      evolucion_clientes_mensual,
      metricas_impacto,
      metricas_entrenadores,
    }

    return NextResponse.json(metricas)
  } catch (err) {
    console.error('Error al obtener métricas de negocio', err)
    return NextResponse.json({ error: 'Error al obtener métricas de negocio' }, { status: 500 })
  }
}
