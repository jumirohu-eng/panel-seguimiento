import { Reporte } from '@/lib/types'
import { calcularEstadoReporte } from '@/lib/estadoReporte'
import Tooltip from './Tooltip'

export default function StatusBadge({ reportes }: { reportes: Reporte[] }) {
  const ultimo = reportes[0]
  const estado = calcularEstadoReporte(ultimo?.fecha, ultimo?.mensajeSugerido)

  const config = {
    pendiente: {
      label: 'Pendiente',
      icon: '❌',
      className: 'border-danger/30 bg-danger/10 text-danger',
    },
    alerta: {
      label: 'Alerta',
      icon: '⚠️',
      className: 'border-warning/30 bg-warning/10 text-warning',
    },
    bien: {
      label: 'Bien',
      icon: '✅',
      className: 'border-success/30 bg-success/10 text-success',
    },
  }[estado]

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${config.className}`}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  )

  if (estado === 'alerta') {
    const explicacion = ultimo?.analisisIA?.trim() || ultimo?.mensajeSugerido?.trim() || 'Sin detalle adicional'
    return <Tooltip content={explicacion}>{badge}</Tooltip>
  }

  return badge
}
