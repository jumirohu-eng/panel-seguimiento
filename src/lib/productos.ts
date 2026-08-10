export interface ProductoInfo {
  id: string
  nombre: string
  icono: string
  descripcionCorta: string
  lanzado: boolean
  incluye: string
  comoFunciona: string
  aQuienLeSirve: string
}

export const PRODUCTOS: ProductoInfo[] = [
  {
    id: 'Seguimiento',
    nombre: 'Seguimiento',
    icono: '📊',
    descripcionCorta: 'Check-in semanal de tus clientes con análisis automático y alertas.',
    lanzado: true,
    incluye:
      'Un formulario semanal para tus clientes, un panel con su evolución de peso, entrenamientos y energía, análisis de cada check-in y un mensaje sugerido listo para enviar cuando algo requiere tu atención.',
    comoFunciona:
      'Cada semana tu cliente rellena un formulario corto. El sistema revisa sus respuestas y, si detecta que necesita seguimiento, te avisa con una alerta y te prepara un mensaje para que se lo mandes por WhatsApp con un clic.',
    aQuienLeSirve:
      'A cualquier entrenador que quiera dejar de perseguir a sus clientes para pedirles datos y dedicar ese tiempo a entrenarlos mejor.',
  },
  {
    id: 'Captación',
    nombre: 'Captación',
    icono: '🎯',
    descripcionCorta: 'Cuestionario y propuesta automática para convertir contactos en clientes.',
    lanzado: false,
    incluye:
      'Un cuestionario para nuevos contactos y una propuesta personalizada generada automáticamente a partir de sus respuestas.',
    comoFunciona:
      'Compartes un enlace con tus contactos. Al rellenarlo, el sistema genera una propuesta a medida que puedes revisar y enviar para cerrar la venta.',
    aQuienLeSirve:
      'A entrenadores que quieren un proceso de venta más profesional y rápido, sin preparar cada propuesta a mano.',
  },
  {
    id: 'Referidos',
    nombre: 'Referidos',
    icono: '🔗',
    descripcionCorta: 'Enlaces únicos para que tus clientes te traigan nuevos clientes.',
    lanzado: false,
    incluye: 'Un enlace personal por cliente y un panel para ver cuántas visitas y conversiones genera cada uno.',
    comoFunciona:
      'Le das a cada cliente su enlace. Cuando alguien se registra a través de él, queda registrado como referido suyo.',
    aQuienLeSirve:
      'A entrenadores que ya tienen clientes contentos y quieren aprovechar el boca a boca de forma organizada.',
  },
  {
    id: 'Recuperación',
    nombre: 'Recuperación',
    icono: '🔄',
    descripcionCorta: 'Mensajes preparados para reactivar a clientes que se dieron de baja.',
    lanzado: false,
    incluye:
      'Detección automática de clientes marcados como "Perdido" y un mensaje sugerido para intentar recuperarlos.',
    comoFunciona:
      'Cuando un cliente pasa a estado "Perdido", el sistema te avisa y te prepara un mensaje adaptado a su caso para que decidas si quieres reactivarlo.',
    aQuienLeSirve:
      'A entrenadores que pierden clientes por falta de seguimiento y quieren una segunda oportunidad de recuperarlos sin esfuerzo extra.',
  },
]

export type EstadoProducto = 'en_uso' | 'disponible' | 'proximamente'

export function calcularEstadoProducto(producto: ProductoInfo, soluciones: string[]): EstadoProducto {
  if (soluciones.includes(producto.id)) return 'en_uso'
  if (producto.lanzado) return 'disponible'
  return 'proximamente'
}
