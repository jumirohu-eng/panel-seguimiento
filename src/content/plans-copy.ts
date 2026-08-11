import { SolucionEntrenador } from '@/lib/airtable'

export interface PlanCopy {
  problema: string
  features: string[]
  resultados: string
}

export const PLANES_COPY: {
  headline: string
  subheadline: string
  porProducto: Record<SolucionEntrenador, PlanCopy>
  comparativa: { sinAutomatizacion: string[]; conRetainCoach: string[] }
  pricingNote: string
} = {
  headline: 'Escala tu negocio de entrenamiento sin escalar tus horas',
  subheadline:
    'RetainCoach automatiza el seguimiento, la captación y la recuperación de clientes para que puedas llevar más clientes sin perder calidad ni retención.',
  porProducto: {
    Seguimiento: {
      problema:
        'Perseguir a cada cliente para que te cuente cómo le fue esta semana consume horas que deberías dedicar a entrenar, no a perseguir WhatsApps.',
      features: [
        'Check-in semanal automático por formulario',
        'Análisis de cada respuesta con IA',
        'Alerta y mensaje sugerido listo para enviar cuando un cliente lo necesita',
      ],
      resultados: 'Entrenadores que lo usan detectan riesgo de abandono antes de perder al cliente, sin revisar manualmente cada caso.',
    },
    'Captación': {
      problema:
        'Preparar una propuesta a medida para cada contacto nuevo es lento, y muchos se enfrían mientras la escribes.',
      features: [
        'Cuestionario de cualificación para nuevos contactos',
        'Propuesta personalizada generada automáticamente',
        'Lista para revisar y enviar en minutos',
      ],
      resultados: 'Menos tiempo preparando propuestas, más contactos cerrados mientras el interés sigue caliente.',
    },
    'Recuperación': {
      problema:
        'Los clientes que se dan de baja casi nunca reciben un segundo intento — se pierden silenciosamente y ese ingreso desaparece con ellos.',
      features: [
        'Detección automática de clientes dados de baja',
        'Mensaje de reactivación adaptado a su caso',
        'Panel para ver a quién podrías recuperar de un vistazo',
      ],
      resultados: 'Cada cliente recuperado es MRR que ya tenías y que no necesitas volver a captar desde cero.',
    },
    'Referidos': {
      problema: 'El boca a boca funciona, pero sin seguimiento no sabes quién te está trayendo clientes ni cómo premiarlo.',
      features: [
        'Enlace único por cliente',
        'Panel de visitas y conversiones por referido',
        'Trazabilidad completa de quién trajo a quién',
      ],
      resultados: 'Convierte a tus mejores clientes en tu canal de captación más barato, de forma medible.',
    },
    Metricas: {
      problema:
        'Sin números claros, es difícil saber si tu negocio está creciendo o si estás perdiendo clientes silenciosamente.',
      features: [
        'Gráficas de evolución por cliente (peso, entrenamientos, energía)',
        'Ranking de clientes por evolución',
        'MRR, retención y clientes activos calculados automáticamente',
      ],
      resultados: 'Toma decisiones de negocio con datos reales, sin montar una hoja de cálculo cada mes.',
    },
  },
  comparativa: {
    sinAutomatizacion: [
      'Persigues a cada cliente manualmente para pedirle datos',
      'Te enteras de que un cliente está en riesgo cuando ya se dio de baja',
      'Preparas cada propuesta comercial desde cero',
      'No sabes cuántos clientes gestionas ni cuánto factura tu negocio sin abrir una hoja de cálculo',
    ],
    conRetainCoach: [
      'Tus clientes rellenan un check-in semanal por su cuenta',
      'Recibes una alerta con mensaje listo antes de perder al cliente',
      'La propuesta se genera sola a partir de un cuestionario',
      'Ves tu MRR, retención y clientes activos en un panel, siempre actualizado',
    ],
  },
  pricingNote: 'Cada producto se activa por separado, desde 99€/mes. Escríbenos y te ayudamos a elegir por dónde empezar.',
}
