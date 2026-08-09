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

const ENERGY_VALUE: Record<Reporte['energia'], number> = {
  Cansado: 1,
  Normal: 2,
  'Con energía': 3,
}

const ENERGY_LABEL: Record<number, string> = {
  1: 'Cansado',
  2: 'Normal',
  3: 'Con energía',
}

const ENERGY_COLOR: Record<number, string> = {
  1: '#EF4444',
  2: '#F59E0B',
  3: '#22C55E',
}

export default function EnergyChart({ reportes }: { reportes: Reporte[] }) {
  const data = [...reportes]
    .slice(0, 8)
    .reverse()
    .map((r) => ({
      fecha: formatDateShort(r.fecha),
      valor: ENERGY_VALUE[r.energia],
    }))

  let insight = ''
  if (data.length >= 2) {
    const last = data[data.length - 1].valor
    const prev = data[data.length - 2].valor
    if (last > prev) insight = '↑ Recuperando energía'
    else if (last < prev) insight = '↓ Bajó esta semana'
    else insight = '→ Estable'
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-card-foreground">Energía</h3>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Sin datos todavía</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="fecha" tick={{ fontSize: 12 }} stroke="var(--muted)" />
            <YAxis
              domain={[1, 3]}
              ticks={[1, 2, 3]}
              tickFormatter={(v) => ENERGY_LABEL[v as number] ?? ''}
              tick={{ fontSize: 11 }}
              stroke="var(--muted)"
              width={82}
            />
            <Tooltip
              formatter={(value) => [ENERGY_LABEL[value as number] ?? '', 'Energía']}
              labelFormatter={(label) => `Fecha: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="valor"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={(props: { cx?: number; cy?: number; payload?: { valor: number }; index?: number }) => {
                const { cx, cy, payload, index } = props
                if (cx === undefined || cy === undefined || !payload) return <g key={index} />
                return (
                  <circle
                    key={`dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={ENERGY_COLOR[payload.valor]}
                    stroke="none"
                  />
                )
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      {insight && <p className="mt-2 text-sm text-muted">{insight}</p>}
    </div>
  )
}
