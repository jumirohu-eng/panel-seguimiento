export function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

export function formatMonthLabel(mes: string) {
  const [year, month] = mes.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Fecha larga sin hora ("viernes 15 de agosto") — usada para describir la próxima
// apertura recurrente de un check-in u objetivo (ver checkinFields.ts, Parte 1.5.3).
export function formatFechaLarga(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })
}

export function truncateResumen(texto: string, maxLength = 100) {
  const limpio = texto.trim().split('\n')[0].trim()
  if (limpio.length <= maxLength) return limpio
  return `${limpio.slice(0, maxLength - 1).trimEnd()}…`
}
