import { Reporte } from '@/lib/types'
import Tooltip from './Tooltip'

function calcularEstado(ultimo: Reporte | undefined): 'pendiente' | 'alerta' | 'bien' {
  if (!ultimo) return 'pendiente'

  const dias = (Date.now() - new Date(ultimo.fecha).getTime()) / (1000 * 60 * 60 * 24)
  if (dias > 8) return 'pendiente'
  if (ultimo.mensajeSugerido && ultimo.mensajeSugerido.trim() !== '') return 'alerta'
  return 'bien'
}

export default function StatusBadge({ reportes }: { reportes: Reporte[] }) {
  const ultimo = reportes[0]
  const estado = calcularEstado(ultimo)

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
