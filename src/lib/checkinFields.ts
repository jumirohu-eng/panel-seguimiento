import type { CampoCheckinFields, AirtableRecord } from './airtable'

export type TipoCampoCheckin = 'escala' | 'si_no' | 'numero' | 'texto' | 'seleccion' | 'seleccion_multiple'
export type FrecuenciaCheckin = 'diario' | 'semanal' | 'periodico'

export interface CampoCheckinDef {
  id: string
  nombre: string
  tipo: TipoCampoCheckin
  categoria: string
  frecuenciaDefault: FrecuenciaCheckin
  unidad?: string
  opciones?: string[]
  ordenDefault: number
}

// Biblioteca inicial de campos estándar (brief RetainCoach MVP Parte 1).
// Dolor se separa en nivel+zona y Comentario en diario/semanal porque un campo
// solo puede tener una frecuencia en este modelo — ver DECISIONS.md.
export const CAMPOS_ESTANDAR: CampoCheckinDef[] = [
  {
    id: 'entrenamiento_realizado',
    nombre: 'Entrenamiento realizado',
    tipo: 'si_no',
    categoria: 'entrenamiento',
    frecuenciaDefault: 'diario',
    ordenDefault: 1,
  },
  { id: 'energia', nombre: 'Energía', tipo: 'escala', categoria: 'bienestar', frecuenciaDefault: 'diario', ordenDefault: 2 },
  { id: 'fatiga', nombre: 'Fatiga', tipo: 'escala', categoria: 'bienestar', frecuenciaDefault: 'diario', ordenDefault: 3 },
  {
    id: 'animo',
    nombre: 'Estado de ánimo',
    tipo: 'escala',
    categoria: 'bienestar',
    frecuenciaDefault: 'diario',
    ordenDefault: 4,
  },
  {
    id: 'dolor_nivel',
    nombre: 'Dolor/molestias',
    tipo: 'seleccion',
    categoria: 'dolor',
    frecuenciaDefault: 'diario',
    opciones: ['Ninguno', 'Leve', 'Moderado', 'Alto'],
    ordenDefault: 5,
  },
  {
    id: 'dolor_zona',
    nombre: 'Zona del dolor',
    tipo: 'texto',
    categoria: 'dolor',
    frecuenciaDefault: 'diario',
    ordenDefault: 6,
  },
  { id: 'comentario', nombre: 'Comentario', tipo: 'texto', categoria: 'comentario', frecuenciaDefault: 'diario', ordenDefault: 7 },
  {
    id: 'adherencia',
    nombre: 'Adherencia',
    tipo: 'escala',
    categoria: 'adherencia',
    frecuenciaDefault: 'semanal',
    ordenDefault: 8,
  },
  {
    id: 'reflexion_semanal',
    nombre: 'Comentario/reflexión semanal',
    tipo: 'texto',
    categoria: 'comentario',
    frecuenciaDefault: 'semanal',
    ordenDefault: 9,
  },
  { id: 'peso', nombre: 'Peso', tipo: 'numero', categoria: 'medida', frecuenciaDefault: 'periodico', unidad: 'kg', ordenDefault: 10 },
  { id: 'medidas', nombre: 'Medidas', tipo: 'texto', categoria: 'medida', frecuenciaDefault: 'periodico', ordenDefault: 11 },
]

export const CAMPOS_ESTANDAR_POR_ID = new Map(CAMPOS_ESTANDAR.map((c) => [c.id, c]))

export const CUSTOM_FIELD_PREFIX = 'custom_'

export interface CampoCheckinResuelto {
  id: string
  nombre: string
  tipo: TipoCampoCheckin
  categoria: string
  frecuencia: FrecuenciaCheckin
  unidad?: string
  opciones?: string[]
  activo: boolean
  orden: number
  esEstandar: boolean
}

function parseOpciones(raw?: string): string[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((o) => typeof o === 'string') : undefined
  } catch {
    return undefined
  }
}

// Mergea el catálogo de código con los overrides/campos personalizados de Airtable
// para un entrenador. Si un campo estándar no tiene fila en Airtable, se usan sus
// valores por defecto del catálogo — evita sembrar filas para cada entrenador.
export function resolverCamposEfectivos(filas: AirtableRecord<CampoCheckinFields>[]): CampoCheckinResuelto[] {
  const overridesPorId = new Map(filas.filter((f) => f.fields.Es_estandar).map((f) => [f.fields.Field_id, f]))
  const personalizados = filas.filter((f) => !f.fields.Es_estandar)

  const estandar: CampoCheckinResuelto[] = CAMPOS_ESTANDAR.map((def) => {
    const override = overridesPorId.get(def.id)
    return {
      id: def.id,
      nombre: def.nombre,
      tipo: def.tipo,
      categoria: def.categoria,
      frecuencia: (override?.fields.Frecuencia as FrecuenciaCheckin) ?? def.frecuenciaDefault,
      unidad: def.unidad,
      opciones: def.opciones,
      // Airtable omite los campos checkbox de la respuesta cuando valen false
      // (convención de su API) — comparar contra `=== true`, no `!== false`,
      // o un override desactivado se leería como activo (undefined !== false).
      activo: override ? override.fields.Activo === true : true,
      orden: override?.fields.Orden ?? def.ordenDefault,
      esEstandar: true,
    }
  })

  const custom: CampoCheckinResuelto[] = personalizados.map((f) => ({
    id: f.fields.Field_id,
    nombre: f.fields.Nombre,
    tipo: f.fields.Tipo as TipoCampoCheckin,
    categoria: f.fields.Categoria ?? 'personalizado',
    frecuencia: f.fields.Frecuencia as FrecuenciaCheckin,
    unidad: f.fields.Unidad,
    opciones: parseOpciones(f.fields.Opciones),
    activo: f.fields.Activo === true,
    orden: f.fields.Orden ?? 999,
    esEstandar: false,
  }))

  return [...estandar, ...custom].sort((a, b) => a.orden - b.orden)
}

export function agruparPorFrecuencia(campos: CampoCheckinResuelto[]) {
  return {
    diario: campos.filter((c) => c.activo && c.frecuencia === 'diario'),
    semanal: campos.filter((c) => c.activo && c.frecuencia === 'semanal'),
    periodico: campos.filter((c) => c.activo && c.frecuencia === 'periodico'),
  }
}

export function generarFieldIdPersonalizado(nombre: string): string {
  const slug = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${CUSTOM_FIELD_PREFIX}${slug || 'campo'}_${rand}`
}

// Serializa un valor de formulario a texto para Registros_checkin.Valor.
export function serializarValor(tipo: TipoCampoCheckin, valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null
  switch (tipo) {
    case 'seleccion_multiple':
      return Array.isArray(valor) ? JSON.stringify(valor) : null
    case 'si_no':
      return valor === true || valor === 'true' ? 'true' : 'false'
    case 'numero':
    case 'escala': {
      const n = Number(valor)
      return Number.isFinite(n) ? String(n) : null
    }
    default:
      return String(valor).trim() || null
  }
}

// Deserializa Registros_checkin.Valor de vuelta a un valor de JS usable en la UI.
export function deserializarValor(tipo: TipoCampoCheckin, valor: string): unknown {
  switch (tipo) {
    case 'seleccion_multiple':
      try {
        return JSON.parse(valor)
      } catch {
        return []
      }
    case 'si_no':
      return valor === 'true'
    case 'numero':
    case 'escala':
      return Number(valor)
    default:
      return valor
  }
}
