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
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { ResumenNegocio } from '@/lib/types'
import { formatMonthLabel } from '@/lib/format'

const URGENCIA_STYLES: Record<string, string> = {
  rojo: 'border-danger/40 bg-danger/5',
  ambar: 'border-warning/40 bg-warning/5',
}

const URGENCIA_ICON: Record<string, string> = {
  rojo: '🔴',
  ambar: '🟠',
}

export default function AdminResumenView() {
  const router = useRouter()
  const [resumen, setResumen] = useState<ResumenNegocio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQuick, setShowQuick] = useState(false)

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
        const res = await fetch('/api/admin/resumen-negocio', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 403) {
          router.push('/login')
          return
        }
        if (!res.ok) throw new Error('No se pudo cargar el resumen')
        const data: ResumenNegocio = await res.json()
        setResumen(data)
      } catch {
        setError('Error al cargar el resumen del negocio.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken, router])

  if (loading) {
    return <p className="text-sm text-muted">Cargando resumen…</p>
  }

  if (error || !resumen) {
    return <p className="text-sm text-danger">{error ?? 'No se pudo cargar el resumen.'}</p>
  }

  const evolucionData = resumen.evolucion_clientes_mensual.map((d) => ({
    mes: formatMonthLabel(d.mes),
    total_clientes: d.total_clientes,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Resumen del negocio</h1>
        <button
          onClick={() => router.push('/admin')}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Gestionar entrenadores →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted">Entrenadores activos</p>
          <p className="mt-1 text-2xl font-semibold text-card-foreground">
            {resumen.total_entrenadores_activos}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted">Clientes gestionados</p>
          <p className="mt-1 text-2xl font-semibold text-card-foreground">
            {resumen.total_clientes_gestionados}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted">MRR estimado</p>
          <p className="mt-1 text-2xl font-semibold text-card-foreground">
            {resumen.mrr_estimado}€
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted">En prueba</p>
          <p className="mt-1 text-2xl font-semibold text-card-foreground">
            {resumen.entrenadores_prueba}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-card-foreground">
            Evolución de clientes
          </h3>
          {evolucionData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Sin datos todavía</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolucionData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
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

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-card-foreground">
            Soluciones contratadas
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={resumen.distribucion_soluciones}
              margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="solucion" tick={{ fontSize: 12 }} stroke="var(--muted)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted)" />
              <Tooltip formatter={(value) => [value, 'Entrenadores']} />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-card-foreground">Requiere tu atención</h2>
        {resumen.alertas.length === 0 ? (
          <p className="text-sm text-success">Todo en orden ✓</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {resumen.alertas.map((alerta, i) => (
              <li
                key={i}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${URGENCIA_STYLES[alerta.urgencia] ?? 'border-border'}`}
              >
                <div className="flex items-start gap-2">
                  <span>{URGENCIA_ICON[alerta.urgencia] ?? '⚪'}</span>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">
                      {alerta.entrenador_nombre}
                    </p>
                    <p className="text-sm text-muted">{alerta.mensaje}</p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    router.push(`/admin/entrenador/${encodeURIComponent(alerta.entrenador_email)}`)
                  }
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
                >
                  Ver entrenador
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resumen.metricas_impacto && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">Métricas de impacto</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Clientes seguidos</p>
              <p className="mt-1 text-xl font-semibold text-card-foreground">
                {resumen.metricas_impacto.total_clientes_seguidos}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Promedio clientes activos / entrenador</p>
              <p className="mt-1 text-xl font-semibold text-card-foreground">
                {resumen.metricas_impacto.promedio_clientes_activos}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Alertas de riesgo históricas</p>
              <p className="mt-1 text-xl font-semibold text-card-foreground">
                {resumen.metricas_impacto.alertas_riesgo_historicas}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Basado en entrenadores que han dado su consentimiento.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <button
          onClick={() => setShowQuick((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <h2 className="text-lg font-semibold text-card-foreground">Accesos rápidos</h2>
          <span className="text-muted">{showQuick ? '▲' : '▼'}</span>
        </button>
        {showQuick && (
          <div className="flex flex-wrap gap-2 border-t border-border p-6 pt-4">
            <a
              href="https://airtable.com/appZ7NZWDl6haw8pK"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
            >
              Airtable
            </a>
            <a
              href="https://jolly-wolf-51.fr-1.instapods.app"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
            >
              n8n
            </a>
            <button
              onClick={() => router.push('/admin?nuevo=1')}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
            >
              Nuevo entrenador
            </button>
            <button
              onClick={() => router.push('/admin')}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
            >
              Ver todos los entrenadores
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
