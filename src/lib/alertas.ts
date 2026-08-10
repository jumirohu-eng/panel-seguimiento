import 'server-only'
import { AirtableRecord, EntrenadorFields, InvitacionFields } from './airtable'
import { AlertaNegocio } from './types'

const CUATRO_HORAS_MS = 4 * 60 * 60 * 1000
const CATORCE_DIAS_MS = 14 * 24 * 60 * 60 * 1000

export function calcularAlertasNegocio({
  entrenadores,
  invitaciones,
  clientesActivosPorEntrenador,
}: {
  entrenadores: AirtableRecord<EntrenadorFields>[]
  invitaciones: AirtableRecord<InvitacionFields>[]
  clientesActivosPorEntrenador: Record<string, number>
}): AlertaNegocio[] {
  const activos = entrenadores.filter((e) => e.fields.Estado === 'Activo')
  const enPrueba = entrenadores.filter((e) => e.fields.Estado === 'Prueba')
  const inactivos = entrenadores.filter((e) => e.fields.Estado === 'Inactivo')

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

  return alertas
}
