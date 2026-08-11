'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { AlertasStats, MetricasNegocio } from '@/lib/types'
import { formatMonthLabel } from '@/lib/format'

const NOMBRE_PLAN: Record<string, string> = {
  Metricas: 'Métricas y Estadísticas',
}

export default function MetricasView() {
  const router = useRouter()
  const [metricas, setMetricas] = useState<MetricasNegocio | null>(null)
  const [alertasStats, setAlertasStats] = useState<AlertasStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = await getToken()
        const headers = { Authorization: `Bearer ${token}` }
        const [resMetricas, resAlertas] = await Promise.all([
          fetch('/api/admin/metricas-negocio', { headers }),
          fetch('/api/admin/alertas-stats', { headers }),
        ])
        if (resMetricas.status === 403 || resAlertas.status === 403) {
          router.push('/login')
          return
        }
        if (!resMetricas.ok || !resAlertas.ok) throw new Error('No se pudieron cargar las métricas')
        const [metricasData, alertasData]: [MetricasNegocio, AlertasStats] = await Promise.all([
          resMetricas.json(),
          resAlertas.json(),
        ])
        setMetricas(metricasData)
        setAlertasStats(alertasData)
      } catch {
        setError('Error al cargar las métricas.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken, router])

  if (loading) {
    return <p className="text-sm text-muted">Cargando métricas…</p>
  }

  if (error || !metricas || !alertasStats) {
    return <p className="text-sm text-danger">{error ?? 'No se pudieron cargar las métricas.'}</p>
  }

  const evolucionClientes = metricas.evolucion_clientes_mensual.map((d) => ({
    mes: formatMonthLabel(d.mes),
    total_clientes: d.total_clientes,
  }))
  const alertasPorMes = alertasStats.alertas_por_mes.map((d) => ({
    mes: formatMonthLabel(d.mes),
    count: d.count,
  }))
  const evolucionEntrenadores = metricas.metricas_entrenadores.evolucion_entrenadores_mensual.map((d) => ({
    mes: formatMonthLabel(d.mes),
    total_entrenadores: d.total_entrenadores,
    total_activos: d.total_activos,
    total_prueba: d.total_prueba,
  }))
  const entrenadoresPorPlan = metricas.metricas_entrenadores.entrenadores_por_plan.map((d) => ({
    solucion: NOMBRE_PLAN[d.solucion] ?? d.solucion,
    count: d.count,
  }))
  const desglosePorEstado = metricas.metricas_entrenadores.entrenadores_por_estado
    .map((d) => `${d.estado}: ${d.count}`)
    .join(' · ')

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-xl font-semibold text-foreground">Métricas históricas</h1>

      {/* BLOQUE 1 — Métricas de entrenadores */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-card-foreground">Métricas de entrenadores</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">Entrenadores registrados (histórico)</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">
              {metricas.metricas_entrenadores.total_entrenadores_historico}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">Entrenadores registrados (actuales)</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">
              {metricas.metricas_entrenadores.total_entrenadores_actuales}
            </p>
            {desglosePorEstado && <p className="mt-1 text-xs text-muted">{desglosePorEstado}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-card-foreground">
            Evolución de entrenadores
          </h3>
          {evolucionEntrenadores.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Sin datos todavía</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolucionEntrenadores} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="total_activos"
                  name="Activos"
                  stroke="var(--success)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="total_prueba"
                  name="Prueba"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="total_entrenadores"
                  name="Total"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">Alertas generadas (total)</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">
              {alertasStats.total_alertas_historico}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-card-foreground">Alertas por mes</h3>
            {alertasPorMes.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Sin datos todavía</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={alertasPorMes} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted)" />
                  <Tooltip formatter={(value) => [value, 'Alertas']} />
                  <Bar dataKey="count" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-card-foreground">Entrenadores por plan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={entrenadoresPorPlan} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="solucion" tick={{ fontSize: 12 }} stroke="var(--muted)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted)" />
              <Tooltip formatter={(value) => [value, 'Entrenadores']} />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* BLOQUE 2 — Métricas de clientes */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-card-foreground">Métricas de clientes</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">Clientes históricos registrados</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">
              {metricas.total_clientes_historicos}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">Clientes totales actuales</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">
              {metricas.total_clientes_actuales}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-card-foreground">
            Evolución de clientes
          </h3>
          {evolucionClientes.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Sin datos todavía</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolucionClientes} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <Tooltip formatter={(value) => [value, 'Clientes activos']} />
                <Line
                  type="monotone"
                  dataKey="total_clientes"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {metricas.metricas_impacto && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-card-foreground">Métricas de impacto</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted">Clientes seguidos</p>
                <p className="mt-1 text-xl font-semibold text-card-foreground">
                  {metricas.metricas_impacto.total_clientes_seguidos}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Promedio clientes activos / entrenador</p>
                <p className="mt-1 text-xl font-semibold text-card-foreground">
                  {metricas.metricas_impacto.promedio_clientes_activos}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Alertas de riesgo históricas</p>
                <p className="mt-1 text-xl font-semibold text-card-foreground">
                  {metricas.metricas_impacto.alertas_riesgo_historicas}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">
              Basado en entrenadores que han dado su consentimiento.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
