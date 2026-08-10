export type EstadoReporte = 'pendiente' | 'alerta' | 'bien'

export function calcularEstadoReporte(fechaISO?: string, mensajeSugerido?: string): EstadoReporte {
  if (!fechaISO) return 'pendiente'

  const dias = (Date.now() - new Date(fechaISO).getTime()) / (1000 * 60 * 60 * 24)
  if (dias > 8) return 'pendiente'
  if (mensajeSugerido && mensajeSugerido.trim() !== '') return 'alerta'
  return 'bien'
}
