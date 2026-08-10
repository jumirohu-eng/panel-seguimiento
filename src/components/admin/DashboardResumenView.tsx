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
import { ResumenNegocio } from '@/lib/types'
import { formatMonthLabel } from '@/lib/format'

export default function DashboardResumenView() {
  const router = useRouter()
  const [resumen, setResumen] = useState<ResumenNegocio | null>(null)
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

  const evolucionData = resumen.evolucion_entrenadores_mensual.map((d) => ({
    mes: formatMonthLabel(d.mes),
    total_entrenadores: d.total_entrenadores,
    total_activos: d.total_activos,
    total_prueba: d.total_prueba,
  }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Resumen del negocio</h1>

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
            Evolución de entrenadores
          </h3>
          {evolucionData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Sin datos todavía</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolucionData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="total_entrenadores"
                  name="Total"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
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
    </div>
  )
}
