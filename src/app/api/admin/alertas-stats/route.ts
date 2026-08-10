import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminEmail } from '@/lib/auth-server'
import {
  getReportesConMensajeSugerido,
  getArchivoConMensajeSugerido,
  getAllClientes,
  getAllEntrenadores,
} from '@/lib/airtable'
import { AlertasStats } from '@/lib/types'

export async function GET(request: NextRequest) {
  const adminEmail = await getAuthenticatedAdminEmail(request)
  if (!adminEmail) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const [reportes, archivo, clientes, entrenadores] = await Promise.all([
      getReportesConMensajeSugerido(),
      getArchivoConMensajeSugerido(),
      getAllClientes(),
      getAllEntrenadores(),
    ])

    const total_alertas_historico = reportes.length + archivo.length

    const porMes: Record<string, number> = {}
    for (const r of reportes) {
      const mes = r.fields.Fecha?.slice(0, 7)
      if (!mes) continue
      porMes[mes] = (porMes[mes] ?? 0) + 1
    }
    for (const a of archivo) {
      const mes = a.fields.Fecha?.slice(0, 7)
      if (!mes) continue
      porMes[mes] = (porMes[mes] ?? 0) + 1
    }
    const alertas_por_mes = Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, count]) => ({ mes, count }))

    // Cliente_Entrenador (lookup en Reportes) no es fiable — solo poblado si el
    // cliente tiene Entrenador_nuevo (vestigial). Resolvemos siempre cruzando el
    // email del cliente contra Clientes.Entrenador, igual que getClientesActivosPorEntrenador().
    const emailClienteAEntrenador = new Map(clientes.map((c) => [c.fields.Email, c.fields.Entrenador]))
    const entrenadorPorEmail = new Map(entrenadores.map((e) => [e.fields.Email, e.fields.Nombre]))

    const porEntrenador: Record<string, number> = {}
    for (const r of reportes) {
      const clienteEmail = r.fields.Cliente_Email?.[0]
      const entrenadorEmail = clienteEmail ? emailClienteAEntrenador.get(clienteEmail) : undefined
      const key = entrenadorEmail ?? 'sin_identificar'
      porEntrenador[key] = (porEntrenador[key] ?? 0) + 1
    }
    for (const a of archivo) {
      const clienteEmail = a.fields.Cliente_Email
      const entrenadorEmail = clienteEmail ? emailClienteAEntrenador.get(clienteEmail) : undefined
      const key = entrenadorEmail ?? 'sin_identificar'
      porEntrenador[key] = (porEntrenador[key] ?? 0) + 1
    }
    const alertas_por_entrenador = Object.entries(porEntrenador)
      .sort(([, a], [, b]) => b - a)
      .map(([entrenador_email, count]) => ({
        entrenador_email,
        entrenador_nombre:
          entrenador_email === 'sin_identificar'
            ? 'Sin identificar'
            : (entrenadorPorEmail.get(entrenador_email) ?? entrenador_email),
        count,
      }))

    const stats: AlertasStats = {
      total_alertas_historico,
      alertas_por_mes,
      alertas_por_entrenador,
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('Error al obtener estadísticas de alertas', err)
    return NextResponse.json({ error: 'Error al obtener estadísticas de alertas' }, { status: 500 })
  }
}
