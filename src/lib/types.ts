import type { ObjetivoResuelto } from './objetivos'

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

// Invitación privada de un entrenador a un cliente (Parte 1.5.1). `cuentaActiva` es un
// estado derivado (no guardado en Airtable, ver DECISIONS.md): true si ya existe un
// usuario de Supabase con este email y el email está confirmado.
export interface InvitacionClienteEstado {
  invitacion: {
    estado: 'Activo' | 'Usado' | 'Expirado' | 'Cancelado'
    creado: string
    expira: string
    inviteLink: string | null
  } | null
  cuentaActiva: boolean
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
  // Onboarding nativo (Parte 1.5.1): true si el cliente ya tiene Objetivo guardado.
  // El dashboard redirige a /cliente/onboarding cuando es false.
  onboardingCompletado: boolean
}

// Onboarding nativo del cliente tras su primer login (Parte 1.5.1, ver DECISIONS.md).
// No confundir con "Mis notas" (notas_privadas, Supabase, privadas del cliente).
export interface OnboardingCliente {
  objetivo: string
  objetivosAdicionales: string[]
  diasDisponibles: DiaSemana[]
  comentario: string
  completado: boolean
}

export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
export type ModoPeriodico = 'intervalo' | 'dia_mes'

export interface CampoCheckinResuelto {
  id: string
  nombre: string
  tipo: 'escala' | 'si_no' | 'numero' | 'texto' | 'seleccion' | 'seleccion_multiple' | 'dolor'
  categoria: string
  // Un campo puede pertenecer a varios tipos de check-in a la vez (Parte 1.5).
  tipos: ('diario' | 'semanal' | 'periodico')[]
  unidad?: string
  opciones?: string[]
  activo: boolean
  orden: number
  esEstandar: boolean
  dependeDe?: { campoId: string; valorRequerido: unknown }
}

export interface ProgramacionTipoConfig {
  lanzado: boolean
  disponibleDesde: string | null
  diaSemana?: DiaSemana
  modoPeriodico?: ModoPeriodico
  fechaInicioPeriodico?: string
  intervaloDiasPeriodico?: number
  diaMesPeriodico?: number
}

export interface CheckinConfigResponse {
  campos: CampoCheckinResuelto[]
  programacion: {
    diario: ProgramacionTipoConfig
    semanal: ProgramacionTipoConfig
    periodico: ProgramacionTipoConfig
  }
}

export interface CheckinFrecuenciaEstado {
  lanzado: boolean
  disponibleDesde: string | null
  campos: CampoCheckinResuelto[]
  yaEnviado: boolean
  ultimosValores: Record<string, unknown>
  // Fecha ISO de la próxima apertura de este tipo. diario/semanal: solo tras enviar (null
  // = disponible ahora). periódico: siempre calculada según su programación.
  proximaFecha: string | null
  // Objetivos del cliente cuya periodicidad corresponde a este tipo de check-in (Parte
  // 1.5.2, ver DECISIONS.md) — solo los que tienen una fuente activa y compatible aquí,
  // para que el cliente siempre pueda registrar el dato que les da progreso.
  objetivos: ObjetivoResuelto[]
}

export interface ClienteCheckinResponse {
  diario: CheckinFrecuenciaEstado
  semanal: CheckinFrecuenciaEstado
  periodico: CheckinFrecuenciaEstado
}

export interface CheckinEnvio {
  fecha: string
  tipo: 'diario' | 'semanal' | 'periodico'
  valores: { fieldId: string; nombre: string; valor: unknown }[]
}

export interface ChecklinsResponse {
  checkins: CheckinEnvio[]
  hasMore: boolean
}

export interface MetricasNegocio {
  total_clientes_historicos: number
  total_clientes_actuales: number
  evolucion_clientes_mensual: { mes: string; total_clientes: number }[]
  metricas_impacto: MetricasImpacto | null
  metricas_entrenadores: MetricasEntrenadores
}
