import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import {
  getAllEntrenadores,
  getClientesActivosPorEntrenador,
  getAllSnapshots,
  getAllInvitaciones,
  getAllClientes,
  getReportesConMensajeSugerido,
  SolucionEntrenador,
} from '@/lib/airtable'
import { AlertaNegocio, ResumenNegocio } from '@/lib/types'

const SOLUCIONES: SolucionEntrenador[] = ['Seguimiento', 'Captación', 'Recuperación', 'Referidos']
const CUATRO_HORAS_MS = 4 * 60 * 60 * 1000
const CATORCE_DIAS_MS = 14 * 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const [entrenadores, clientesActivosPorEntrenador, snapshots, invitaciones, clientes, reportesConMensaje] =
      await Promise.all([
        getAllEntrenadores(),
        getClientesActivosPorEntrenador(),
        getAllSnapshots(),
        getAllInvitaciones(),
        getAllClientes(),
        getReportesConMensajeSugerido(),
      ])

    const activos = entrenadores.filter((e) => e.fields.Estado === 'Activo')
    const enPrueba = entrenadores.filter((e) => e.fields.Estado === 'Prueba')
    const inactivos = entrenadores.filter((e) => e.fields.Estado === 'Inactivo')

    const total_entrenadores_activos = activos.length
    const total_clientes_gestionados = activos.reduce(
      (sum, e) => sum + (clientesActivosPorEntrenador[e.fields.Email] ?? 0),
      0
    )
    const mrr_estimado = activos.reduce((sum, e) => sum + (e.fields.Precio_mensual ?? 0), 0)
    const entrenadores_prueba = enPrueba.length

    const porMes: Record<string, number> = {}
    for (const s of snapshots) {
      const mes = s.fields.Fecha?.slice(0, 7)
      if (!mes) continue
      porMes[mes] = (porMes[mes] ?? 0) + (s.fields.Clientes_activos ?? 0)
    }
    const evolucion_clientes_mensual = Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, total_clientes]) => ({ mes, total_clientes }))

    const distribucion_soluciones = SOLUCIONES.map((solucion) => ({
      solucion,
      count: entrenadores.filter((e) => (e.fields.Soluciones ?? []).includes(solucion)).length,
    }))

    const ahora = Date.now()
    const entrenadorPorEmail = new Map(entrenadores.map((e) => [e.fields.Email, e.fields]))
    const alertas: AlertaNegocio[] = []

    for (const inv of invitaciones) {
      if (inv.fields.Estado !== 'Activo') continue
      const msRestantes = new Date(inv.fields.Expira).getTime() - ahora
      if (msRestantes > 0 && msRestantes < CUATRO_HORAS_MS) {
        const ent = entrenadorPorEmail.get(inv.fields.Email_entrenador)
        alertas.push({
          tipo: 'invitacion_expirando',
          entrenador_email: inv.fields.Email_entrenador,
          entrenador_nombre: ent?.Nombre ?? inv.fields.Email_entrenador,
          mensaje: 'Su invitación expira en menos de 4 horas',
          urgencia: 'rojo',
        })
      }
    }

    for (const e of enPrueba) {
      if (!e.fields.Fecha_alta) continue
      const msDesdeAlta = ahora - new Date(e.fields.Fecha_alta).getTime()
      if (msDesdeAlta > CATORCE_DIAS_MS) {
        const dias = Math.floor(msDesdeAlta / (24 * 60 * 60 * 1000))
        alertas.push({
          tipo: 'prueba_estancada',
          entrenador_email: e.fields.Email,
          entrenador_nombre: e.fields.Nombre,
          mensaje: `Lleva ${dias} días en prueba sin decisión`,
          urgencia: 'ambar',
        })
      }
    }

    for (const e of activos) {
      if ((clientesActivosPorEntrenador[e.fields.Email] ?? 0) === 0) {
        alertas.push({
          tipo: 'sin_clientes',
          entrenador_email: e.fields.Email,
          entrenador_nombre: e.fields.Nombre,
          mensaje: 'Entrenador activo sin clientes activos asignados',
          urgencia: 'ambar',
        })
      }
    }

    for (const e of inactivos) {
      if ((clientesActivosPorEntrenador[e.fields.Email] ?? 0) > 0) {
        alertas.push({
          tipo: 'inconsistencia',
          entrenador_email: e.fields.Email,
          entrenador_nombre: e.fields.Nombre,
          mensaje: 'Entrenador inactivo pero todavía tiene clientes activos',
          urgencia: 'rojo',
        })
      }
    }

    const consentidos = entrenadores.filter((e) => e.fields.Permite_marketing === true)
    let metricas_impacto: ResumenNegocio['metricas_impacto'] = null

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

    const resumen: ResumenNegocio = {
      total_entrenadores_activos,
      total_clientes_gestionados,
      mrr_estimado,
      entrenadores_prueba,
      evolucion_clientes_mensual,
      distribucion_soluciones,
      alertas,
      metricas_impacto,
    }

    return NextResponse.json(resumen)
  } catch (err) {
    console.error('Error al obtener resumen de negocio', err)
    return NextResponse.json({ error: 'Error al obtener resumen de negocio' }, { status: 500 })
  }
}
