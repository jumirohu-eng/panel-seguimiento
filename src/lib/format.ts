export function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}
