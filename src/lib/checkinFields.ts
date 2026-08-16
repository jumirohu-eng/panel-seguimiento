import type { AirtableRecord, CampoCheckinFields } from './airtable'

export type TipoCampoCheckin = 'escala' | 'si_no' | 'numero' | 'texto' | 'seleccion' | 'seleccion_multiple' | 'dolor'
export type FrecuenciaCheckin = 'diario' | 'semanal' | 'periodico'
export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
export type ModoPeriodico = 'intervalo' | 'dia_mes'

export interface DependenciaCampo {
  campoId: string
  valorRequerido: unknown
}

export interface CampoCheckinDef {
  id: string
  nombre: string
  tipo: TipoCampoCheckin
  categoria: string
  // Sigue siendo un array por compatibilidad con `Campos_checkin.Tipos` (multipleSelects en
  // Airtable) y con overrides antiguos, pero un campo de revisión editable desde
  // /checkin-config solo puede pertenecer a UN tipo a la vez desde DEC-2026-045 (reemplaza el
  // multi-tipo de DEC-2026-015: el contenido de un tipo no debe poder coincidir con el de
  // otro) — usar siempre `tiposDefault[0]` como el tipo real, salvo para los campos
  // exclusivos de objetivo (ver `CAMPOS_OCULTOS_EN_CONFIG_AVANZADA`), que no pasan por esta
  // pantalla y se resuelven por periodicidad del objetivo (ver DEC-2026-044).
  tiposDefault: FrecuenciaCheckin[]
  unidad?: string
  opciones?: string[]
  ordenDefault: number
  // Deshabilita este campo en frontend/backend cuando el campo del que depende no tiene
  // el valor requerido (regla "No he entrenado"). Ningún campo estándar actual lo usa —
  // ver DECISIONS.md: auditado explícitamente, ninguno depende estructuralmente de haber
  // entrenado. El mecanismo queda listo para un futuro campo de detalle de sesión.
  dependeDe?: DependenciaCampo
  // Etiquetas humanas para cada valor 1-5 de un campo tipo `escala` (p. ej. "Muy mal"…
  // "Muy bien" para Sueño) — opcional, solo para dejar explícito qué representa cada
  // número en la UI del cliente (ver DECISIONS.md, "Sueño como check-in informativo").
  // Ausente en Energía/Fatiga/Ánimo (sin cambios de comportamiento para ellos).
  escalaEtiquetas?: [string, string, string, string, string]
}

// Catálogo estándar definitivo (Parte 1.5). Cambios respecto a Parte 1:
// - `dolor_nivel` + `dolor_zona` se unifican en un único campo lógico `dolor` (tipo
//   compuesto, ver serializarValor/deserializarValor).
// - `comentario` + `reflexion_semanal` se unifican en un único `comentario` (multi-tipo).
// - Los ids viejos (`dolor_nivel`, `dolor_zona`, `reflexion_semanal`) no se reutilizan;
//   quedan en CAMPOS_ESTANDAR_DEPRECADOS solo para resolver historial ya existente.
export const CAMPOS_ESTANDAR: CampoCheckinDef[] = [
  {
    id: 'entrenamiento_realizado',
    nombre: 'Entrenamiento realizado',
    tipo: 'si_no',
    categoria: 'entrenamiento',
    tiposDefault: ['diario'],
    ordenDefault: 1,
  },
  // Revisiones: por defecto, todas semanales (una única "revisión semanal" con varias
  // preguntas, ver DECISIONS.md "Objetivos independientes de Revisiones") — antes repartidas
  // entre diario/semanal/periódico. Peso y Entrenamiento realizado se dejan con su tiposDefault
  // histórico (siguen funcionando igual como fuente de objetivo) pero ya no se ofrecen en la
  // pantalla de configuración avanzada, ver CheckinConfigView.tsx.
  { id: 'energia', nombre: 'Energía', tipo: 'escala', categoria: 'bienestar', tiposDefault: ['semanal'], ordenDefault: 2 },
  { id: 'fatiga', nombre: 'Fatiga', tipo: 'escala', categoria: 'bienestar', tiposDefault: ['semanal'], ordenDefault: 3 },
  {
    id: 'animo',
    nombre: 'Estado de ánimo',
    tipo: 'escala',
    categoria: 'bienestar',
    tiposDefault: ['semanal'],
    ordenDefault: 4,
  },
  {
    id: 'dolor',
    nombre: 'Dolor/molestias',
    tipo: 'dolor',
    categoria: 'dolor',
    tiposDefault: ['semanal'],
    opciones: ['Ninguno', 'Leve', 'Moderado', 'Alto'],
    ordenDefault: 5,
  },
  { id: 'comentario', nombre: 'Comentario', tipo: 'texto', categoria: 'comentario', tiposDefault: ['semanal'], ordenDefault: 6 },
  {
    id: 'adherencia',
    nombre: 'Adherencia',
    tipo: 'escala',
    categoria: 'adherencia',
    tiposDefault: ['semanal'],
    ordenDefault: 7,
  },
  { id: 'peso', nombre: 'Peso', tipo: 'numero', categoria: 'medida', tiposDefault: ['semanal', 'periodico'], unidad: 'kg', ordenDefault: 8 },
  { id: 'medidas', nombre: 'Medidas', tipo: 'texto', categoria: 'medida', tiposDefault: ['semanal'], ordenDefault: 9 },
  // Sueño (sesión "Objetivos predefinidos + check-ins", ver DECISIONS.md): información
  // sobre el cliente para el entrenador, NUNCA un objetivo — no tiene Fuente_field_id
  // asociada por catálogo, ni participa en resolverObjetivo()/cálculo de progreso. Mismo
  // tipo `escala` (1-5) que Energía/Fatiga/Ánimo, con etiquetas propias porque la escala
  // de calidad del sueño no es autoexplicativa como "del 1 al 5" genérico.
  {
    id: 'sueno',
    nombre: 'Sueño',
    tipo: 'escala',
    categoria: 'bienestar',
    tiposDefault: ['semanal'],
    ordenDefault: 10,
    escalaEtiquetas: ['Muy mal', 'Mal', 'Normal', 'Bien', 'Muy bien'],
  },
]

// Campos que dejan de ofrecerse en la pantalla de configuración avanzada
// (CheckinConfigView.tsx) porque su uso previsto es como fuente de un objetivo, no como
// revisión manual — el entrenador ya no los activa/programa a mano ahí, los "activa" creando
// un objetivo que los use. Siguen existiendo en el catálogo y en Registros_checkin sin
// cambios: un objetivo que ya los use como fuente sigue funcionando exactamente igual.
export const CAMPOS_OCULTOS_EN_CONFIG_AVANZADA = new Set(['peso', 'entrenamiento_realizado'])

// Nombres normalizados de métricas creadas dinámicamente (resolverOCrearCampoCheckinParaObjetivo,
// DEC-2026-034) que también deben ocultarse de config avanzada por su nombre, igual que "Pasos"
// ya lo hacía — "Movilidad" se suma con el objetivo predefinido nuevo (ver DECISIONS.md).
const NOMBRES_OCULTOS_EN_CONFIG_AVANZADA = new Set(['pasos', 'movilidad'])

export function esCampoOcultoEnConfigAvanzada(campo: Pick<CampoCheckinResuelto, 'id' | 'nombre'>): boolean {
  return CAMPOS_OCULTOS_EN_CONFIG_AVANZADA.has(campo.id) || NOMBRES_OCULTOS_EN_CONFIG_AVANZADA.has(campo.nombre.trim().toLowerCase())
}

export const CAMPOS_ESTANDAR_POR_ID = new Map(CAMPOS_ESTANDAR.map((c) => [c.id, c]))

// Ids estándar retirados del catálogo activo (nunca ofrecidos en config/formulario), pero
// necesarios para seguir resolviendo nombre/tipo de envíos históricos en Registros_checkin
// — ninguna fila histórica se borra ni se reescribe (ver DECISIONS.md).
export interface CampoCheckinDeprecado {
  id: string
  nombre: string
  tipo: TipoCampoCheckin
}

export const CAMPOS_ESTANDAR_DEPRECADOS: CampoCheckinDeprecado[] = [
  { id: 'dolor_nivel', nombre: 'Dolor/molestias (nivel) [antiguo]', tipo: 'seleccion' },
  { id: 'dolor_zona', nombre: 'Zona del dolor [antiguo]', tipo: 'texto' },
  { id: 'reflexion_semanal', nombre: 'Comentario/reflexión semanal [antiguo]', tipo: 'texto' },
]

export const CAMPOS_ESTANDAR_DEPRECADOS_POR_ID = new Map(CAMPOS_ESTANDAR_DEPRECADOS.map((c) => [c.id, c]))

export const CUSTOM_FIELD_PREFIX = 'custom_'

export interface CampoCheckinResuelto {
  id: string
  nombre: string
  tipo: TipoCampoCheckin
  categoria: string
  tipos: FrecuenciaCheckin[]
  unidad?: string
  opciones?: string[]
  activo: boolean
  orden: number
  esEstandar: boolean
  dependeDe?: DependenciaCampo
  escalaEtiquetas?: [string, string, string, string, string]
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

// `Campos_checkin.Tipos` sigue siendo un multiSelect en Airtable (no se cambió el esquema),
// pero desde DEC-2026-045 la app nunca escribe más de un valor — un campo pertenece a un
// único tipo. Filas con varios valores (legadas, de antes de esa decisión, o de un campo
// exclusivo de objetivo cuyo `Tipos` ya no es editable, ver DEC-2026-041/044) siguen
// leyéndose tal cual aquí sin normalizar, porque cada consumidor decide qué hacer con ellas
// (p.ej. `agruparPorFrecuencia` las incluye en cada tipo listado). Si esa fila todavía no
// tiene `Tipos` seteado (overrides creados en Parte 1, antes de esa migración), cae a
// `Frecuencia` (el singleSelect viejo, deprecado pero intacto) para no perder la config
// existente. Ver DECISIONS.md, migración de Campos_checkin.
function resolverTiposCampo(
  fields: { Tipos?: FrecuenciaCheckin[]; Frecuencia?: FrecuenciaCheckin },
  tiposDefault: FrecuenciaCheckin[]
): FrecuenciaCheckin[] {
  if (Array.isArray(fields.Tipos) && fields.Tipos.length > 0) return fields.Tipos
  if (fields.Frecuencia) return [fields.Frecuencia]
  return tiposDefault
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
      tipos: override ? resolverTiposCampo(override.fields, def.tiposDefault) : def.tiposDefault,
      unidad: def.unidad,
      opciones: def.opciones,
      // Airtable omite los campos checkbox de la respuesta cuando valen false
      // (convención de su API) — comparar contra `=== true`, no `!== false`,
      // o un override desactivado se leería como activo (undefined !== false).
      activo: override ? override.fields.Activo === true : true,
      orden: override?.fields.Orden ?? def.ordenDefault,
      esEstandar: true,
      dependeDe: def.dependeDe,
      escalaEtiquetas: def.escalaEtiquetas,
    }
  })

  const custom: CampoCheckinResuelto[] = personalizados.map((f) => ({
    id: f.fields.Field_id,
    nombre: f.fields.Nombre,
    tipo: f.fields.Tipo as TipoCampoCheckin,
    categoria: f.fields.Categoria ?? 'personalizado',
    tipos: resolverTiposCampo(f.fields, []),
    unidad: f.fields.Unidad,
    opciones: parseOpciones(f.fields.Opciones),
    activo: f.fields.Activo === true,
    orden: f.fields.Orden ?? 999,
    esEstandar: false,
  }))

  return [...estandar, ...custom].sort((a, b) => a.orden - b.orden)
}

// Resuelve nombre/tipo de un Field_id histórico en Registros_checkin, incluso si ya no
// está en el catálogo activo (desactivado, o retirado como dolor_nivel/dolor_zona/
// reflexion_semanal). Usado por la vista del entrenador (GET /api/checkins) para no
// romper la lectura de envíos antiguos.
export function resolverNombreTipoHistorico(
  fieldId: string,
  camposActuales: Map<string, CampoCheckinResuelto>
): { nombre: string; tipo: TipoCampoCheckin } | null {
  const actual = camposActuales.get(fieldId)
  if (actual) return { nombre: actual.nombre, tipo: actual.tipo }
  const deprecado = CAMPOS_ESTANDAR_DEPRECADOS_POR_ID.get(fieldId)
  if (deprecado) return { nombre: deprecado.nombre, tipo: deprecado.tipo }
  return null
}

export function agruparPorFrecuencia(campos: CampoCheckinResuelto[]) {
  return {
    diario: campos.filter((c) => c.activo && c.tipos.includes('diario')),
    semanal: campos.filter((c) => c.activo && c.tipos.includes('semanal')),
    periodico: campos.filter((c) => c.activo && c.tipos.includes('periodico')),
  }
}

// Regla "No he entrenado": si el campo del que depende `campo` no tiene el valor
// requerido, el campo se considera no disponible — usado tanto en frontend (deshabilitar)
// como en backend (rechazar valores incompatibles aunque se manipule la petición).
export function campoDisponible(campo: Pick<CampoCheckinResuelto, 'dependeDe'>, valores: Record<string, unknown>): boolean {
  if (!campo.dependeDe) return true
  return valores[campo.dependeDe.campoId] === campo.dependeDe.valorRequerido
}

const DIAS_SEMANA_ISO: Record<DiaSemana, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
}

export function inicioDeHoyUTC(ahoraMs = Date.now()): number {
  const ahora = new Date(ahoraMs)
  return Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
}

// Generaliza el antiguo `inicioDeSemanaUTC()` (hardcodeado a lunes) para respetar el día
// de la semana configurado por el entrenador para el check-in semanal.
export function inicioDePeriodoSemanalUTC(diaSemana: DiaSemana = 'lunes', ahoraMs = Date.now()): number {
  const objetivo = DIAS_SEMANA_ISO[diaSemana]
  const ahora = new Date(ahoraMs)
  const hoy = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
  const diaActualIso = ahora.getUTCDay() === 0 ? 7 : ahora.getUTCDay()
  let diff = diaActualIso - objetivo
  if (diff < 0) diff += 7
  return hoy - diff * 24 * 60 * 60 * 1000
}

function ultimoDiaDelMesUTC(anio: number, mesIndex0: number): number {
  return new Date(Date.UTC(anio, mesIndex0 + 1, 0)).getUTCDate()
}

export interface ProgramacionResuelta {
  diaSemana?: DiaSemana
  modoPeriodico?: ModoPeriodico
  fechaInicioPeriodico?: string
  intervaloDiasPeriodico?: number
  diaMesPeriodico?: number
}

// Próxima fecha del check-in periódico. Dos modos:
// - intervalo: cada N días desde una fecha de inicio.
// - dia_mes: un día concreto de cada mes.
// Limitación documentada (no se inventa una solución compleja, ver CLAUDE.md): en meses
// más cortos que el día configurado (p.ej. día 31 en febrero), cae al último día válido
// de ese mes — no se "reprograma" al mes siguiente.
export function calcularProximaFechaPeriodico(config: ProgramacionResuelta, ahoraMs = Date.now()): string | null {
  if (config.modoPeriodico === 'intervalo' && config.fechaInicioPeriodico && config.intervaloDiasPeriodico) {
    const inicioMs = new Date(config.fechaInicioPeriodico).getTime()
    if (!Number.isFinite(inicioMs) || config.intervaloDiasPeriodico <= 0) return null
    const intervaloMs = config.intervaloDiasPeriodico * 24 * 60 * 60 * 1000
    if (ahoraMs <= inicioMs) return new Date(inicioMs).toISOString()
    const periodosPasados = Math.floor((ahoraMs - inicioMs) / intervaloMs) + 1
    return new Date(inicioMs + periodosPasados * intervaloMs).toISOString()
  }
  if (config.modoPeriodico === 'dia_mes' && config.diaMesPeriodico) {
    const ahora = new Date(ahoraMs)
    const anio = ahora.getUTCFullYear()
    const mes = ahora.getUTCMonth()
    const diaEsteMes = Math.min(config.diaMesPeriodico, ultimoDiaDelMesUTC(anio, mes))
    const fechaEsteMesMs = Date.UTC(anio, mes, diaEsteMes)
    if (fechaEsteMesMs >= inicioDeHoyUTC(ahoraMs)) return new Date(fechaEsteMesMs).toISOString()
    const diaMesSiguiente = Math.min(config.diaMesPeriodico, ultimoDiaDelMesUTC(anio, mes + 1))
    return new Date(Date.UTC(anio, mes + 1, diaMesSiguiente)).toISOString()
  }
  return null
}

// Inicio de la apertura periódica VIGENTE que contiene `momentoMs` (no la próxima, la que
// ya está en curso ahora) — inversa de calcularProximaFechaPeriodico. Ver DECISIONS.md
// DEC-2026-052: es la base de `Ventana_inicio`, la identidad persistente e inmutable de un
// registro periódico. `null` si no hay programación configurada todavía (mismo fallback
// seguro que el resto del sistema: sin config, sin ventana, comportamiento insert-only) o
// si `momentoMs` es anterior a la primera apertura configurada (todavía no ha abierto
// ningún período).
export function inicioPeriodoActualPeriodico(config: ProgramacionResuelta, momentoMs = Date.now()): number | null {
  if (config.modoPeriodico === 'intervalo' && config.fechaInicioPeriodico && config.intervaloDiasPeriodico) {
    const inicioMs = new Date(config.fechaInicioPeriodico).getTime()
    if (!Number.isFinite(inicioMs) || config.intervaloDiasPeriodico <= 0 || momentoMs < inicioMs) return null
    const intervaloMs = config.intervaloDiasPeriodico * 24 * 60 * 60 * 1000
    const periodosPasados = Math.floor((momentoMs - inicioMs) / intervaloMs)
    return inicioMs + periodosPasados * intervaloMs
  }
  if (config.modoPeriodico === 'dia_mes' && config.diaMesPeriodico) {
    const momento = new Date(momentoMs)
    const anio = momento.getUTCFullYear()
    const mes = momento.getUTCMonth()
    const diaEsteMes = Math.min(config.diaMesPeriodico, ultimoDiaDelMesUTC(anio, mes))
    const fechaEsteMesMs = Date.UTC(anio, mes, diaEsteMes)
    if (fechaEsteMesMs <= momentoMs) return fechaEsteMesMs
    const mesAnterior = mes - 1
    const diaMesAnterior = Math.min(config.diaMesPeriodico, ultimoDiaDelMesUTC(anio, mesAnterior))
    return Date.UTC(anio, mesAnterior, diaMesAnterior)
  }
  return null
}

// Única función que calcula el inicio de una "ventana de registro" — la unidad lógica
// cliente+campo+tipo+ventana que identifica un registro editable (ver DECISIONS.md
// DEC-2026-052). Usada tanto para "ahora" (al escribir, o al calcular ultimosValores/
// yaEnviado) como para el `Fecha` histórico de una fila legacy sin `Ventana_inicio` (al
// agrupar el historial o al resolver un DELETE reconstruido) — mismo cálculo siempre, cero
// divergencia posible entre escritura y lectura.
export function inicioVentanaRegistro(
  tipo: FrecuenciaCheckin,
  diaSemana: DiaSemana,
  programacionPeriodica: ProgramacionResuelta,
  momentoMs = Date.now()
): number | null {
  if (tipo === 'diario') return inicioDeHoyUTC(momentoMs)
  if (tipo === 'semanal') return inicioDePeriodoSemanalUTC(diaSemana, momentoMs)
  return inicioPeriodoActualPeriodico(programacionPeriodica, momentoMs)
}

// Fin de la ventana que EMPIEZA en `inicioVentanaMs` — a diferencia de `inicioVentanaRegistro`
// (que calcula el inicio de la ventana de "ahora" con la programación vigente), esta función
// se ancla siempre al `Ventana_inicio` YA PERSISTIDO de una fila concreta, nunca a un
// recálculo de "inicio de la ventana actual". Es la base de la corrección de DEC-2026-052:
// una fila nueva sigue vigente mientras `ahora` no supere el fin de SU PROPIA ventana,
// aunque la programación (Dia_semana, Intervalo_dias_periodico, etc.) haya cambiado después
// de crearla — nunca deja de reconocerse solo porque el recálculo de "ventana actual" con la
// programación de hoy ya no coincide con su Ventana_inicio original. `null` únicamente si no
// hay programación calculable para periódico (mismo fallback que el resto del sistema).
export function finVentanaRegistro(
  tipo: FrecuenciaCheckin,
  inicioVentanaMs: number,
  programacionPeriodica: ProgramacionResuelta
): number | null {
  if (tipo === 'diario') return inicioVentanaMs + 24 * 60 * 60 * 1000
  if (tipo === 'semanal') return inicioVentanaMs + 7 * 24 * 60 * 60 * 1000
  if (programacionPeriodica.modoPeriodico === 'intervalo' && programacionPeriodica.intervaloDiasPeriodico) {
    return inicioVentanaMs + programacionPeriodica.intervaloDiasPeriodico * 24 * 60 * 60 * 1000
  }
  if (programacionPeriodica.modoPeriodico === 'dia_mes' && programacionPeriodica.diaMesPeriodico) {
    const inicio = new Date(inicioVentanaMs)
    const anio = inicio.getUTCFullYear()
    const mes = inicio.getUTCMonth()
    const diaMesSiguiente = Math.min(programacionPeriodica.diaMesPeriodico, ultimoDiaDelMesUTC(anio, mes + 1))
    return Date.UTC(anio, mes + 1, diaMesSiguiente)
  }
  return null
}

// Cuándo vuelve a tocar un check-in ya enviado, según su tipo.
// diario/semanal: el siguiente periodo empieza justo al terminar el actual.
// periódico: fecha calculada por calcularProximaFechaPeriodico, independiente de si ya se
// envió (no tiene un "periodo actual" acotado de la misma forma).
// Nunca implica bloqueo de envío: Registros_checkin es insert-only por defecto (ver
// DECISIONS.md DEC-2026-007/052), esto es puramente informativo para el cliente.
export function calcularProximaFecha(
  tipo: FrecuenciaCheckin,
  yaEnviado: boolean,
  inicioPeriodoActualMs: number | null,
  programacion: ProgramacionResuelta,
  ahoraMs = Date.now()
): string | null {
  if (tipo === 'periodico') return calcularProximaFechaPeriodico(programacion, ahoraMs)
  if (!yaEnviado || inicioPeriodoActualMs === null) return null
  const incrementoMs = (tipo === 'diario' ? 1 : 7) * 24 * 60 * 60 * 1000
  return new Date(inicioPeriodoActualMs + incrementoMs).toISOString()
}

export interface EstadoLanzamiento {
  lanzado: boolean
  disponibleDesde: string | null
}

// Estado de lanzamiento de UN tipo de check-in (borrador/programado/lanzado). Se recalcula
// en cada request (sin cron) — por eso "se auto-abre" simplemente con que el cliente
// vuelva a cargar la página después de la fecha programada.
export function resolverLanzamiento(disponibleDesde: string | null | undefined, ahoraMs = Date.now()): EstadoLanzamiento {
  if (!disponibleDesde) return { lanzado: false, disponibleDesde: null }
  return { lanzado: new Date(disponibleDesde).getTime() <= ahoraMs, disponibleDesde }
}

// Los tres tipos de check-in son independientes (Parte 1.5): cada uno tiene su propia fila
// opcional en Checkin_tipos. Si un tipo concreto todavía no tiene fila propia, hereda el
// campo legacy Entrenadores.Checkin_disponible_desde (mismo valor que veían los tres tipos
// antes de esta migración) — preserva el comportamiento exacto hasta que el entrenador
// configure ese tipo específico desde la nueva UI. Ver DECISIONS.md, migración.
export function resolverLanzamientoPorTipo(
  disponibleDesdeDelTipo: string | null | undefined,
  disponibleDesdeLegacy: string | null | undefined,
  filaTipoExiste: boolean,
  ahoraMs = Date.now()
): EstadoLanzamiento {
  if (filaTipoExiste) return resolverLanzamiento(disponibleDesdeDelTipo, ahoraMs)
  return resolverLanzamiento(disponibleDesdeLegacy, ahoraMs)
}

// Shape mínima de una fila de Checkin_tipos (o su ausencia) necesaria para resolver el
// estado de lanzamiento + programación de un tipo. Reutilizada por todas las rutas que
// exponen configuración de check-in al entrenador, para no duplicar esta lógica.
export interface FilaCheckinTipoLike {
  Disponible_desde?: string | null
  Dia_semana?: DiaSemana
  Modo_periodico?: ModoPeriodico
  Fecha_inicio_periodico?: string
  Intervalo_dias_periodico?: number
  Dia_mes_periodico?: number
}

export interface ProgramacionTipoResuelta extends EstadoLanzamiento {
  diaSemana: DiaSemana
  modoPeriodico?: ModoPeriodico
  fechaInicioPeriodico?: string
  intervaloDiasPeriodico?: number
  diaMesPeriodico?: number
}

export function resolverProgramacionTipo(
  filaTipo: FilaCheckinTipoLike | undefined,
  disponibleDesdeLegacy: string | null | undefined,
  ahoraMs = Date.now()
): ProgramacionTipoResuelta {
  const { lanzado, disponibleDesde } = resolverLanzamientoPorTipo(
    filaTipo?.Disponible_desde,
    disponibleDesdeLegacy,
    Boolean(filaTipo),
    ahoraMs
  )
  return {
    lanzado,
    disponibleDesde,
    diaSemana: filaTipo?.Dia_semana ?? 'lunes',
    modoPeriodico: filaTipo?.Modo_periodico,
    fechaInicioPeriodico: filaTipo?.Fecha_inicio_periodico,
    intervaloDiasPeriodico: filaTipo?.Intervalo_dias_periodico,
    diaMesPeriodico: filaTipo?.Dia_mes_periodico,
  }
}

const NOMBRE_DIA_SEMANA: Record<DiaSemana, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
}

// Próxima ocurrencia (hoy o en adelante) del día de la semana configurado — a diferencia
// de inicioDePeriodoSemanalUTC (que da el INICIO del periodo actual, pudiendo caer en el
// pasado dentro de la semana en curso), esta función siempre mira hacia adelante. Usada
// solo para mostrar al entrenador "próxima apertura" de forma genérica (no depende de si
// un cliente concreto ya envió su check-in — eso ya lo resuelve calcularProximaFecha).
export function proximaAperturaSemanal(diaSemana: DiaSemana, ahoraMs = Date.now()): string {
  const inicioPeriodoMs = inicioDePeriodoSemanalUTC(diaSemana, ahoraMs)
  const hoyMs = inicioDeHoyUTC(ahoraMs)
  const proximaMs = inicioPeriodoMs < hoyMs ? inicioPeriodoMs + 7 * 24 * 60 * 60 * 1000 : inicioPeriodoMs
  return new Date(proximaMs).toISOString()
}

// Subconjunto de ProgramacionTipoResuelta necesario para describir la recurrencia y su
// próxima apertura — no depende de `lanzado`/`disponibleDesde` (eso es el estado de
// borrador/programado/activo, un concepto distinto, ver LanzamientoCheckin).
export type ReglaRecurrencia = Pick<
  ProgramacionTipoResuelta,
  'diaSemana' | 'modoPeriodico' | 'fechaInicioPeriodico' | 'intervaloDiasPeriodico' | 'diaMesPeriodico'
>

// Descripción en lenguaje claro de la recurrencia de un tipo de check-in (Parte 1.5.3,
// simplificación de UX pedida explícitamente: "Cada lunes", "Cada 7 días", "El día 1 de
// cada mes" en vez de exponer los campos técnicos crudos). No incluye hora: el modelo
// actual programa por día (UTC), no por hora del día — ver DECISIONS.md, limitación
// documentada a propósito, igual que el caso ya existente de día 31 en meses cortos.
export function describirRecurrencia(tipo: FrecuenciaCheckin, programacion: ReglaRecurrencia): string {
  if (tipo === 'diario') return 'Cada día'
  if (tipo === 'semanal') return `Cada ${NOMBRE_DIA_SEMANA[programacion.diaSemana]}`
  if (programacion.modoPeriodico === 'intervalo' && programacion.intervaloDiasPeriodico) {
    return `Cada ${programacion.intervaloDiasPeriodico} días`
  }
  if (programacion.modoPeriodico === 'dia_mes' && programacion.diaMesPeriodico) {
    return `El día ${programacion.diaMesPeriodico} de cada mes`
  }
  return 'Sin programar todavía'
}

// Próxima apertura genérica (no ligada a un cliente concreto) para mostrar al entrenador
// en /checkin-config. Diario no tiene "próxima apertura" propia — está disponible todos
// los días, así que no aplica (null).
export function proximaAperturaGenerica(
  tipo: FrecuenciaCheckin,
  programacion: ReglaRecurrencia,
  ahoraMs = Date.now()
): string | null {
  if (tipo === 'diario') return null
  if (tipo === 'semanal') return proximaAperturaSemanal(programacion.diaSemana, ahoraMs)
  return calcularProximaFechaPeriodico(programacion, ahoraMs)
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

// Valida tipo y rango de un valor ANTES de serializarlo — rechaza explícitamente en vez
// de convertir/descartar en silencio (ver DECISIONS.md, integración Objetivos↔Check-ins).
// `undefined`/`null`/`''` es válido (campo sin responder, se omite del envío) — solo se
// rechaza un valor presente pero incompatible con el tipo del campo.
export function validarValorCampo(campo: Pick<CampoCheckinResuelto, 'tipo' | 'nombre'>, valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null
  switch (campo.tipo) {
    case 'si_no':
      if (typeof valor !== 'boolean') return `${campo.nombre}: se esperaba sí/no.`
      return null
    case 'numero':
    case 'escala': {
      if (typeof valor !== 'number' || !Number.isFinite(valor)) return `${campo.nombre}: se esperaba un número.`
      if (valor < 0) return `${campo.nombre}: no puede ser negativo.`
      if (campo.tipo === 'escala' && (valor < 1 || valor > 5)) return `${campo.nombre}: debe estar entre 1 y 5.`
      return null
    }
    case 'seleccion':
      if (typeof valor !== 'string') return `${campo.nombre}: valor de selección inválido.`
      return null
    case 'seleccion_multiple':
      if (!Array.isArray(valor) || !valor.every((v) => typeof v === 'string')) {
        return `${campo.nombre}: valor de selección múltiple inválido.`
      }
      return null
    case 'dolor':
      if (typeof valor !== 'object' || Array.isArray(valor)) return `${campo.nombre}: valor de dolor inválido.`
      return null
    default:
      if (typeof valor !== 'string') return `${campo.nombre}: se esperaba texto.`
      return null
  }
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
    case 'dolor': {
      if (typeof valor !== 'object') return null
      const v = valor as { nivel?: unknown; zona?: unknown }
      const nivel = typeof v.nivel === 'string' ? v.nivel.trim() : ''
      const zona = typeof v.zona === 'string' ? v.zona.trim() : ''
      if (!nivel && !zona) return null
      return JSON.stringify({ nivel, zona })
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
    case 'dolor':
      try {
        const parsed = JSON.parse(valor)
        return { nivel: typeof parsed.nivel === 'string' ? parsed.nivel : '', zona: typeof parsed.zona === 'string' ? parsed.zona : '' }
      } catch {
        return { nivel: '', zona: '' }
      }
    default:
      return valor
  }
}

