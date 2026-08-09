export interface Cliente {
  id: string
  nombre: string
  email: string
  objetivo: string
  estado: string
  entrenamientos_objetivo: number
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
}

export interface SnapshotPunto {
  fecha: string
  clientesActivos: number
}

export interface EntrenadorDetalle extends Entrenador {
  snapshots: SnapshotPunto[]
  invitacion: Invitacion | null
}
