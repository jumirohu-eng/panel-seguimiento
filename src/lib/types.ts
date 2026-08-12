export interface Cliente {
  id: string
  nombre: string
  email: string
  telefono: string
  objetivo: string
  estado: string
  entrenamientos_objetivo: number
  linkRecordatorio: string
  tieneAlerta: boolean
  alertaResumen: string
  notasEntrenador: string
  notasIniciales: string
  linkTallyAlta: string
  lastModified: string
}

export interface Reporte {
  id: string
  fecha: string
  peso: number
  entrenamientos: number
  energia: 'Cansado' | 'Normal' | 'Con energía'
  notas: string
  analisisIA: string
  mensajeSugerido: string
  linkAlerta: string
}

export interface ReportesResponse {
  reportes: Reporte[]
  offset: string | null
}

export interface Invitacion {
  token: string
  tokenTruncado: string
  email: string
  estado: 'Activo' | 'Usado' | 'Expirado' | 'Cancelado'
  creado: string
  expira: string
}

export interface Entrenador {
  id: string
  email: string
  nombre: string
  telefono: string
  soluciones: string[]
  estado: 'Activo' | 'Prueba' | 'Inactivo'
  fechaAlta: string
  precioMensual: number
  notas: string
  clientesActivos: number
  linkWhatsapp: string
  ultimoLogin: string | null
}

export interface SnapshotPunto {
  fecha: string
  clientesActivos: number
}

export interface EntrenadorDetalle extends Entrenador {
  snapshots: SnapshotPunto[]
  invitacion: Invitacion | null
  lastModified: string
}

export interface AlertaNegocio {
  tipo: 'invitacion_expirando' | 'prueba_estancada' | 'sin_clientes' | 'inconsistencia'
  entrenador_email: string
  entrenador_nombre: string
  mensaje: string
  urgencia: 'ambar' | 'rojo'
}

export interface MetricasImpacto {
  total_clientes_seguidos: number
  promedio_clientes_activos: number
  alertas_riesgo_historicas: number
}

export interface AlertasStats {
  total_alertas_historico: number
  alertas_por_mes: { mes: string; count: number }[]
  alertas_por_entrenador: { entrenador_email: string; entrenador_nombre: string; count: number }[]
}

export interface EvolucionEntrenadoresPunto {
  mes: string
  total_entrenadores: number
  total_activos: number
  total_prueba: number
}

export interface ResumenNegocio {
  total_entrenadores_activos: number
  total_clientes_gestionados: number
  mrr_estimado: number
  entrenadores_prueba: number
  evolucion_entrenadores_mensual: EvolucionEntrenadoresPunto[]
  distribucion_soluciones: { solucion: string; count: number }[]
}

export interface AtencionResponse {
  alertas: AlertaNegocio[]
}

export interface MetricasEntrenadores {
  total_entrenadores_historico: number
  total_entrenadores_actuales: number
  evolucion_entrenadores_mensual: EvolucionEntrenadoresPunto[]
  entrenadores_por_estado: { estado: string; count: number }[]
  entrenadores_por_plan: { solucion: string; count: number }[]
}

export interface ClientePerfil {
  nombre: string
  objetivo: string
  entrenadorNombre: string
  entrenamientosObjetivo: number
  pesoHistorico: { fecha: string; peso: number }[]
  entrenamientosRecientes: { fecha: string; entrenamientos: number }[]
  energiaPromedio30dias: { cansado: number; normal: number; conEnergia: number; total: number }
  proximoCheckinDias: number | null
  alertaReciente: string | null
}

export interface MetricasNegocio {
  total_clientes_historicos: number
  total_clientes_actuales: number
  evolucion_clientes_mensual: { mes: string; total_clientes: number }[]
  metricas_impacto: MetricasImpacto | null
  metricas_entrenadores: MetricasEntrenadores
}
