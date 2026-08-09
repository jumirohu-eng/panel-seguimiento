'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { Reporte } from '@/lib/types'
import { formatDateShort } from '@/lib/format'

export default function WorkoutsChart({
  reportes,
  objetivo,
}: {
  reportes: Reporte[]
  objetivo: number
}) {
  const data = [...reportes]
    .slice(0, 4)
    .reverse()
    .map((r) => ({
      fecha: formatDateShort(r.fecha),
      entrenamientos: r.entrenamientos,
    }))

  const cumplimiento =
    data.length > 0 && objetivo > 0
      ? Math.round(
          (data.reduce((sum, d) => sum + d.entrenamientos, 0) / data.length / objetivo) * 100
        )
      : null

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-card-foreground">Entrenamientos</h3>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Sin datos todavía</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 24, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="fecha" tick={{ fontSize: 12 }} stroke="var(--muted)" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted)" />
            <Tooltip />
            {objetivo > 0 && (
              <ReferenceLine
                y={objetivo}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                label={{
                  value: `Objetivo: ${objetivo}`,
                  position: 'right',
                  fontSize: 11,
                  fill: 'var(--muted)',
                }}
              />
            )}
            <Bar dataKey="entrenamientos" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.entrenamientos >= objetivo ? '#22C55E' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {cumplimiento !== null && (
        <p className="mt-2 text-sm text-muted">Cumplimiento: {cumplimiento}%</p>
      )}
    </div>
  )
}
