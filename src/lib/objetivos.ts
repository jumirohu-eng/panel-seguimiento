import type { AirtableRecord, ObjetivoFields, RegistroCheckinFields } from './airtable'
import { CampoCheckinResuelto, FrecuenciaCheckin, inicioDeHoyUTC, inicioDePeriodoSemanalUTC, DiaSemana } from './checkinFields'

export type PeriodicidadObjetivo = 'diario' | 'semanal' | 'mensual'

// Un objetivo vive en su propia periodicidad (diario/semanal/mensual), pero su fuente de
// progreso siempre es un campo de check-in, que vive en diario/semanal/periodico (Parte
// 1.5). "Mensual" se empareja con "periódico" — es la cadencia existente más cercana a un
// mes (día del mes / cada N días, ver DEC-2026-014) y así lo pide el brief de Parte 1.5.2
// explícitamente ("Mensual/periódico → objetivos correspondientes + campos configurados").
// No se inventa una tabla de equivalencia distinta.
export const PERIODICIDAD_A_TIPO_CHECKIN: Record<PeriodicidadObjetivo, FrecuenciaCheckin> = {
  diario: 'diario',
  semanal: 'semanal',
  mensual: 'periodico',
}

// Tipos de campo de check-in compatibles como fuente de progreso automática. El resto
// (texto, selección, dolor…) no tiene un cálculo numérico claro — no se inventa uno, ver
// DECISIONS.md (brief: "no inventar cálculos para objetivos sin fuente clara").
export const TIPOS_FUENTE_COMPATIBLES = ['si_no', 'numero'] as const
export type TipoFuenteCompatible = (typeof TIPOS_FUENTE_COMPATIBLES)[number]

export function esFuenteCompatible(tipo: string): tipo is TipoFuenteCompatible {
  return (TIPOS_FUENTE_COMPATIBLES as readonly string[]).includes(tipo)
}

export function inicioDePeriodoMensualUTC(ahoraMs = Date.now()): number {
  const ahora = new Date(ahoraMs)
  return Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)
}

function finDePeriodoUTC(periodicidad: PeriodicidadObjetivo, inicioPeriodoMs: number): number {
  if (periodicidad === 'diario') return inicioPeriodoMs + 24 * 60 * 60 * 1000
  if (periodicidad === 'semanal') return inicioPeriodoMs + 7 * 24 * 60 * 60 * 1000
  const inicio = new Date(inicioPeriodoMs)
  return Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1)
}

// Ventana del periodo "actual" (hoy/esta semana/este mes) para una periodicidad dada.
// `diaSemanaCheckin` alinea la semana del objetivo con la misma semana que usa el
// check-in semanal del entrenador (Checkin_tipos.Dia_semana) — no se inventa un segundo
// calendario de semanas.
export function ventanaPeriodoActual(
  periodicidad: PeriodicidadObjetivo,
  diaSemanaCheckin: DiaSemana,
  ahoraMs = Date.now()
): { inicioMs: number; finMs: number } {
  const inicioMs =
    periodicidad === 'diario'
      ? inicioDeHoyUTC(ahoraMs)
      : periodicidad === 'semanal'
        ? inicioDePeriodoSemanalUTC(diaSemanaCheckin, ahoraMs)
        : inicioDePeriodoMensualUTC(ahoraMs)
  return { inicioMs, finMs: finDePeriodoUTC(periodicidad, inicioMs) }
}

// Vigencia por fechas (independiente del toggle Activo). Fecha_fin es inclusiva (todo el
// día). Sin Fecha_fin = vigente indefinidamente hacia adelante.
export function esVigenteHoy(
  fechaInicioISO: string,
  fechaFinISO: string | null | undefined,
  ahoraMs = Date.now()
): boolean {
  const inicioMs = new Date(fechaInicioISO).getTime()
  if (!Number.isFinite(inicioMs) || ahoraMs < inicioMs) return false
  if (!fechaFinISO) return true
  const finMs = new Date(fechaFinISO).getTime() + 24 * 60 * 60 * 1000
  return ahoraMs < finMs
}

export interface ProgresoObjetivo {
  valor: number
  meta: number
  porcentaje: number
  completado: boolean
}

// Progreso desde Registros_checkin para UN campo fuente dentro de una ventana de periodo.
// Se agrega por Field_id sin filtrar por Tipo_registro a propósito: el objetivo del brief
// "Entrenamientos — semanal — 4 — sesiones" se alimenta de un campo que solo se pregunta en
// el check-in DIARIO (entrenamiento_realizado) pero se evalúa en ventana semanal — exigir
// que la fuente esté asignada al mismo tipo que la periodicidad del objetivo (diseño
// inicial de esta sesión) rompía ese ejemplo tal cual lo pide el brief. Ver DECISIONS.md.
// si_no: se cuenta 1 por día con valor=true (dedupe por día quedándose con el registro más
// reciente — resuelve correcciones del mismo día sin duplicar, mismo criterio que ya usaba
// Parte 1.5 para "Entrenamientos esta semana", ver DEC-2026-007). numero: se suma el valor
// más reciente de cada día dentro de la ventana (mismo dedupe por día, generaliza el caso
// "diario" a "sumar los días de la semana/mes" sin inventar una media o un cálculo más
// complejo).
export function calcularProgresoDesdeCheckins(
  registros: AirtableRecord<RegistroCheckinFields>[],
  fieldId: string,
  tipoCampo: TipoFuenteCompatible,
  meta: number,
  inicioMs: number,
  finMs: number
): ProgresoObjetivo {
  const ultimoPorDia = new Map<string, { valor: string; fechaMs: number }>()
  for (const r of registros) {
    if (r.fields.Field_id !== fieldId) continue
    const fechaMs = new Date(r.fields.Fecha).getTime()
    if (fechaMs < inicioMs || fechaMs >= finMs) continue
    const diaKey = new Date(fechaMs).toISOString().slice(0, 10)
    const actual = ultimoPorDia.get(diaKey)
    if (!actual || fechaMs > actual.fechaMs) {
      ultimoPorDia.set(diaKey, { valor: r.fields.Valor, fechaMs })
    }
  }

  let valor = 0
  if (tipoCampo === 'si_no') {
    valor = [...ultimoPorDia.values()].filter((v) => v.valor === 'true').length
  } else {
    valor = [...ultimoPorDia.values()].reduce((acc, v) => acc + (Number(v.valor) || 0), 0)
  }

  const porcentaje = meta > 0 ? Math.min(100, Math.round((valor / meta) * 100)) : 0
  return { valor, meta, porcentaje, completado: meta > 0 && valor >= meta }
}

export interface ObjetivoResuelto {
  id: string
  nombre: string
  periodicidad: PeriodicidadObjetivo
  meta: number
  unidad: string
  fuenteFieldId: string | null
  fuenteNombre: string | null
  fechaInicio: string
  fechaFin: string | null
  activo: boolean
  vigenteHoy: boolean
  orden: number
  lastModified: string
  progreso: ProgresoObjetivo | null
}

// Resuelve un objetivo completo (metadatos + progreso del periodo actual) a partir de su
// fila de Airtable, el catálogo de campos de check-in ya resuelto del entrenador y el
// historial de Registros_checkin del cliente. `progreso` es null cuando el objetivo no
// tiene fuente configurada, o cuando la fuente ya no existe / no es de un tipo compatible
// (campo "huérfano" — se sigue mostrando el objetivo, pero sin inventar un cálculo).
export function resolverObjetivo(
  record: AirtableRecord<ObjetivoFields>,
  camposPorId: Map<string, CampoCheckinResuelto>,
  registros: AirtableRecord<RegistroCheckinFields>[],
  diaSemanaCheckin: DiaSemana,
  ahoraMs = Date.now()
): ObjetivoResuelto {
  const periodicidad = record.fields.Periodicidad
  const fuenteFieldId = record.fields.Fuente_field_id ?? null
  const campoFuente = fuenteFieldId ? camposPorId.get(fuenteFieldId) : undefined

  let progreso: ProgresoObjetivo | null = null
  if (campoFuente && campoFuente.activo && esFuenteCompatible(campoFuente.tipo)) {
    const { inicioMs, finMs } = ventanaPeriodoActual(periodicidad, diaSemanaCheckin, ahoraMs)
    progreso = calcularProgresoDesdeCheckins(registros, fuenteFieldId!, campoFuente.tipo, record.fields.Meta, inicioMs, finMs)
  }

  return {
    id: record.id,
    nombre: record.fields.Nombre,
    periodicidad,
    meta: record.fields.Meta,
    unidad: record.fields.Unidad,
    fuenteFieldId,
    fuenteNombre: campoFuente?.nombre ?? null,
    fechaInicio: record.fields.Fecha_inicio,
    fechaFin: record.fields.Fecha_fin ?? null,
    activo: record.fields.Activo === true,
    vigenteHoy: esVigenteHoy(record.fields.Fecha_inicio, record.fields.Fecha_fin, ahoraMs),
    orden: record.fields.Orden ?? 999,
    lastModified: record.fields.Last_modified ?? '',
    progreso,
  }
}

// Validación server-side al crear/editar un objetivo: si se indica una fuente, debe ser un
// campo de check-in activo y de tipo compatible (si_no/numero). No se exige que esté
// asignada al mismo tipo de check-in que la periodicidad del objetivo — un objetivo
// semanal puede alimentarse de un campo que solo se pregunta a diario (agregado en
// ventana semanal), como el ejemplo del brief "Entrenamientos — semanal". Ver DECISIONS.md.
export function validarFuenteObjetivo(fuenteFieldId: string | null, camposPorId: Map<string, CampoCheckinResuelto>): string | null {
  if (!fuenteFieldId) return null
  const campo = camposPorId.get(fuenteFieldId)
  if (!campo || !campo.activo) return 'La fuente seleccionada no existe o no está activa.'
  if (!esFuenteCompatible(campo.tipo)) return 'Ese campo no es numérico ni booleano — no puede usarse como fuente de progreso.'
  return null
}
