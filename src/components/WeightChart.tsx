'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Reporte } from '@/lib/types'
import { formatDateShort } from '@/lib/format'

export default function WeightChart({
  reportes,
  objetivo,
}: {
  reportes: Reporte[]
  objetivo: string
}) {
  const data = [...reportes]
    .slice(0, 8)
    .reverse()
    .map((r) => ({
      fecha: formatDateShort(r.fecha),
      peso: r.peso,
    }))

  const pesos = data.map((d) => d.peso)
  const min = pesos.length ? Math.min(...pesos) - 2 : 0
  const max = pesos.length ? Math.max(...pesos) + 2 : 0

  let insight = ''
  if (data.length >= 2) {
    const first = data[0].peso
    const last = data[data.length - 1].peso
    const semanas = data.length - 1
    const perWeek = (last - first) / semanas
    const abs = Math.abs(perWeek).toFixed(1)
    const subiendo = perWeek > 0.05
    const bajando = perWeek < -0.05

    if (objetivo === 'Pérdida de peso') {
      insight = bajando
        ? `↓ -${abs}kg/semana ✅`
        : subiendo
          ? `↑ +${abs}kg/semana ⚠️`
          : '→ Estable'
    } else if (objetivo === 'Hipertrofia') {
      insight = subiendo
        ? `↑ +${abs}kg/semana ✅`
        : bajando
          ? `↓ -${abs}kg/semana ⚠️`
          : '→ Estable'
    } else {
      insight = subiendo ? `→ +${abs}kg/semana` : bajando ? `→ -${abs}kg/semana` : '→ Estable'
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-card-foreground">Peso</h3>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Sin datos todavía</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="fecha" tick={{ fontSize: 12 }} stroke="var(--muted)" />
            <YAxis domain={[min, max]} tick={{ fontSize: 12 }} stroke="var(--muted)" />
            <Tooltip formatter={(value) => [`${value} kg`, 'Peso']} />
            <Line
              type="monotone"
              dataKey="peso"
              stroke="#6366F1"
              strokeWidth={2}
              dot={{ r: 4, fill: '#6366F1' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      {insight && <p className="mt-2 text-sm text-muted">{insight}</p>}
    </div>
  )
}
