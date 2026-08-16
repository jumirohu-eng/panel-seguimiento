import type { ModoProgresoObjetivo } from './objetivos'

// Catálogo de objetivos predefinidos (sesión "Objetivos predefinidos + check-ins", ver
// DECISIONS.md). Puramente frontend — el backend nunca sabe que un objetivo se creó desde
// una plantilla, solo recibe el mismo `body` que ya acepta `POST/PATCH
// /api/clientes/[id]/objetivos(/[objetivoId])` desde antes de esta sesión. Editar un
// objetivo ya creado (predefinido o no) reutiliza el formulario "avanzado" tal cual —
// no existe ningún campo en `Objetivos` que recuerde "esto se creó desde la plantilla
// Pasos", a propósito, para no inventar un segundo modelo de datos.
export type ObjetivoPredefinidoId = 'pasos' | 'entrenamientos' | 'movilidad' | 'peso'

export interface ObjetivoPredefinidoDef {
  id: ObjetivoPredefinidoId
  nombre: string
  descripcion: string
  unidad: string
  modoProgreso: ModoProgresoObjetivo
  // 'fija': reutiliza un Field_id ya existente en el catálogo estándar — nunca crea un
  // campo nuevo (Entrenamientos/Peso ya tienen su propio campo desde antes de esta sesión,
  // usado además por objetivos reales de producción — ver DECISIONS.md).
  // 'nueva': crea (o reutiliza por nombre normalizado, DEC-2026-034) una métrica
  // personalizada vía el mecanismo de check-in dinámico ya existente.
  fuente:
    | { modo: 'fija'; fieldId: string }
    | { modo: 'nueva'; nombreMetrica: string; tipoMetrica: 'si_no' | 'numero' }
  // Solo Peso pide Dirección — el resto son objetivos de tipo "acumulado" (comparar lo
  // registrado con la meta), donde "subir/bajar" no tiene sentido.
  requiereDireccion: boolean
}

export const OBJETIVOS_PREDEFINIDOS: Record<ObjetivoPredefinidoId, ObjetivoPredefinidoDef> = {
  pasos: {
    id: 'pasos',
    nombre: 'Pasos',
    descripcion: 'Meta diaria o semanal de pasos',
    unidad: 'pasos',
    modoProgreso: 'acumulado',
    fuente: { modo: 'nueva', nombreMetrica: 'Pasos', tipoMetrica: 'numero' },
    requiereDireccion: false,
  },
  entrenamientos: {
    id: 'entrenamientos',
    nombre: 'Entrenamientos',
    descripcion: 'Sesiones de entrenamiento completadas',
    unidad: 'sesiones',
    modoProgreso: 'acumulado',
    fuente: { modo: 'fija', fieldId: 'entrenamiento_realizado' },
    requiereDireccion: false,
  },
  movilidad: {
    id: 'movilidad',
    nombre: 'Movilidad',
    descripcion: 'Sesiones de movilidad completadas',
    unidad: 'sesiones',
    modoProgreso: 'acumulado',
    fuente: { modo: 'nueva', nombreMetrica: 'Movilidad', tipoMetrica: 'si_no' },
    requiereDireccion: false,
  },
  peso: {
    id: 'peso',
    nombre: 'Peso',
    descripcion: 'Subir o bajar de peso hacia una meta',
    unidad: 'kg',
    modoProgreso: 'valor_objetivo',
    fuente: { modo: 'fija', fieldId: 'peso' },
    requiereDireccion: true,
  },
}

export const LISTA_OBJETIVOS_PREDEFINIDOS: ObjetivoPredefinidoDef[] = [
  OBJETIVOS_PREDEFINIDOS.pasos,
  OBJETIVOS_PREDEFINIDOS.entrenamientos,
  OBJETIVOS_PREDEFINIDOS.movilidad,
  OBJETIVOS_PREDEFINIDOS.peso,
]
