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
