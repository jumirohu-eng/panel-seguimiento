export function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

export function formatMonthLabel(mes: string) {
  const [year, month] = mes.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
}
