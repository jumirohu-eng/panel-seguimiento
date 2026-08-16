import type { AirtableRecord, ObjetivoFields, RegistroCheckinFields } from './airtable'
import type { CheckinFrecuenciaEstado } from './types'
import {
  CampoCheckinResuelto,
  FrecuenciaCheckin,
  TipoCampoCheckin,
  ProgramacionTipoResuelta,
  inicioDeHoyUTC,
  inicioDePeriodoSemanalUTC,
  DiaSemana,
  esCampoOcultoEnConfigAvanzada,
  deserializarValor,
  calcularProximaFecha,
  finVentanaRegistro,
} from './checkinFields'

export type PeriodicidadObjetivo = 'diario' | 'semanal' | 'mensual'

// Modo de cálculo de progreso (integración Objetivos↔Check-ins). 'acumulado' (por
// defecto, comportamiento histórico desde Parte 1.5.2): suma/cuenta registros dentro de
// la ventana de la periodicidad — sirve para métricas de actividad (pasos,
// entrenamientos, movilidad...). 'valor_objetivo': el progreso es la distancia entre un
// Valor_inicial explícito y el último registro real hacia una Meta, en una Direccion
// (subir/bajar) — sirve para métricas de estado puntual como el peso, donde sumar/contar
// no tiene sentido (DECISIONS.md, sección "Peso como objetivo").
export type ModoProgresoObjetivo = 'acumulado' | 'valor_objetivo'
export type DireccionObjetivo = 'subir' | 'bajar'

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
  // Para 'valor_objetivo': puede superar 100 (meta ya superada, "sobre-meta" — ver
  // DECISIONS.md) — la UI decide cómo recortar visualmente la barra, el número real no
  // se trunca aquí. Para 'acumulado' se mantiene acotado [0, 100] como hasta ahora.
  porcentaje: number
  completado: boolean
  // Presentes solo cuando el objetivo es de modo 'valor_objetivo' (peso y similares) —
  // ausentes (undefined) para 'acumulado', así el consumidor puede distinguir el modo
  // sin tener que leer el objetivo completo.
  direccion?: DireccionObjetivo
  valorInicial?: number
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

// Último valor numérico REAL registrado para un campo, sin acotar a ninguna ventana de
// tiempo (a diferencia de calcularProgresoDesdeCheckins) — un objetivo 'valor_objetivo'
// (peso) no tiene "ventana": siempre refleja el dato más reciente conocido, venga de
// cuando venga. `null` si el cliente todavía no ha registrado nunca ese campo.
export function obtenerUltimoValorNumerico(registros: AirtableRecord<RegistroCheckinFields>[], fieldId: string): number | null {
  let masReciente: { valor: number; fechaMs: number } | null = null
  for (const r of registros) {
    if (r.fields.Field_id !== fieldId) continue
    const n = Number(r.fields.Valor)
    if (!Number.isFinite(n)) continue
    const fechaMs = new Date(r.fields.Fecha).getTime()
    if (!Number.isFinite(fechaMs)) continue
    if (!masReciente || fechaMs > masReciente.fechaMs) masReciente = { valor: n, fechaMs }
  }
  return masReciente?.valor ?? null
}

// Progreso de un objetivo 'valor_objetivo' (peso y similares): distancia recorrida desde
// Valor_inicial hacia Meta, en la Direccion indicada, usando el último registro real
// (obtenerUltimoValorNumerico). Sin registros nuevos todavía, el actual = Valor_inicial
// (0% de avance, nunca se inventa un valor). El porcentaje puede superar 100 (meta
// superada, "sobre-meta") y puede RETROCEDER de una lectura a otra si el valor se aleja
// de la meta — es una foto del estado actual, no un acumulado histórico irreversible.
export function calcularProgresoValorObjetivo(
  registros: AirtableRecord<RegistroCheckinFields>[],
  fieldId: string,
  valorInicial: number,
  meta: number,
  direccion: DireccionObjetivo
): ProgresoObjetivo {
  const ultimo = obtenerUltimoValorNumerico(registros, fieldId)
  const actual = ultimo ?? valorInicial
  const totalNecesario = Math.abs(meta - valorInicial)
  const avance = direccion === 'bajar' ? valorInicial - actual : actual - valorInicial
  const porcentaje = totalNecesario > 0 ? Math.round((avance / totalNecesario) * 100) : avance >= 0 ? 100 : 0
  const completado = direccion === 'bajar' ? actual <= meta : actual >= meta
  return { valor: actual, meta, porcentaje: Math.max(0, porcentaje), completado, direccion, valorInicial }
}

export interface ObjetivoResuelto {
  id: string
  nombre: string
  periodicidad: PeriodicidadObjetivo
  meta: number
  unidad: string
  fuenteFieldId: string | null
  fuenteNombre: string | null
  // Tipo(s) de check-in donde el campo fuente realmente recibe datos (Campos_checkin.Tipos),
  // NO necesariamente el mismo tipo que la periodicidad del objetivo — un objetivo semanal
  // puede alimentarse de un campo que solo se pregunta a diario (ver comentario en
  // resolverObjetivo). El deep-link "Registrar" debe apuntar aquí, no a
  // PERIODICIDAD_A_TIPO_CHECKIN[periodicidad], o el campo no aparecerá en la sección a la que
  // se le manda al cliente (ver DECISIONS.md).
  fuenteTipos: FrecuenciaCheckin[]
  modoProgreso: ModoProgresoObjetivo
  direccion: DireccionObjetivo | null
  valorInicial: number | null
  fechaInicio: string
  fechaFin: string | null
  activo: boolean
  vigenteHoy: boolean
  orden: number
  lastModified: string
  progreso: ProgresoObjetivo | null
}

// Resuelve un objetivo completo (metadatos + progreso actual) a partir de su fila de
// Airtable, el catálogo de campos de check-in ya resuelto del entrenador y el historial
// de Registros_checkin del cliente. `progreso` es null cuando el objetivo no tiene
// fuente configurada, cuando la fuente ya no existe / no es de un tipo compatible (campo
// "huérfano"), o cuando falta configuración obligatoria de 'valor_objetivo'
// (Direccion/Valor_inicial) — nunca se inventa un cálculo con datos incompletos.
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
  const modoProgreso: ModoProgresoObjetivo = record.fields.Modo_progreso === 'valor_objetivo' ? 'valor_objetivo' : 'acumulado'
  const direccion = record.fields.Direccion ?? null
  const valorInicial = typeof record.fields.Valor_inicial === 'number' ? record.fields.Valor_inicial : null

  let progreso: ProgresoObjetivo | null = null
  if (campoFuente && campoFuente.activo && esFuenteCompatible(campoFuente.tipo)) {
    if (modoProgreso === 'valor_objetivo') {
      // 'valor_objetivo' exige tipo numérico + Direccion + Valor_inicial explícitos —
      // si falta cualquiera (dato incompleto/huérfano), no se calcula progreso.
      if (campoFuente.tipo === 'numero' && direccion && valorInicial !== null) {
        progreso = calcularProgresoValorObjetivo(registros, fuenteFieldId!, valorInicial, record.fields.Meta, direccion)
      }
    } else {
      const { inicioMs, finMs } = ventanaPeriodoActual(periodicidad, diaSemanaCheckin, ahoraMs)
      progreso = calcularProgresoDesdeCheckins(registros, fuenteFieldId!, campoFuente.tipo, record.fields.Meta, inicioMs, finMs)
    }
  }

  return {
    id: record.id,
    nombre: record.fields.Nombre,
    periodicidad,
    meta: record.fields.Meta,
    unidad: record.fields.Unidad,
    fuenteFieldId,
    fuenteNombre: campoFuente?.nombre ?? null,
    fuenteTipos: campoFuente?.tipos ?? [],
    modoProgreso,
    direccion,
    valorInicial,
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

// Validación server-side de la configuración de modo de progreso al crear/editar un
// objetivo. 'acumulado' no tiene requisitos extra (comportamiento histórico). Rechaza
// de forma explícita — nunca ignora en silencio — cualquier combinación incoherente:
// 'valor_objetivo' sin fuente numérica, sin Direccion o sin Valor_inicial; o Direccion/
// Valor_inicial presentes cuando el modo es 'acumulado' (evita estados ambiguos donde
// el modo dice una cosa y los datos otra).
export function validarConfiguracionProgreso(
  modoProgreso: ModoProgresoObjetivo,
  direccion: DireccionObjetivo | null,
  valorInicial: number | null,
  fuenteTipo: TipoCampoCheckin | null
): string | null {
  if (modoProgreso === 'acumulado') {
    if (direccion !== null || valorInicial !== null) {
      return 'Dirección y valor inicial solo se aplican al modo "valor objetivo".'
    }
    return null
  }
  // modoProgreso === 'valor_objetivo'
  if (!fuenteTipo) return 'El modo "valor objetivo" necesita una fuente numérica (p. ej. Peso).'
  if (fuenteTipo !== 'numero') return 'El modo "valor objetivo" solo es compatible con fuentes numéricas.'
  if (direccion !== 'subir' && direccion !== 'bajar') return 'Indica si el objetivo es subir o bajar.'
  if (valorInicial === null || !Number.isFinite(valorInicial)) return 'El valor inicial es obligatorio y debe ser un número.'
  return null
}

// Entrada pura para resolverEstadoCheckinTipo — separada de cualquier fetch/auth para poder
// reutilizarse tal cual desde GET /api/cliente/checkin (auth de cliente) y desde el endpoint
// de "check-ins pendientes" de la ficha del entrenador (auth de entrenador), sin duplicar el
// cálculo entre ambas pantallas (ver DECISIONS.md, resiliencia: misma lógica en ficha y
// dashboard/check-in del cliente).
// Identidad de la ventana de registro "actual" (ahora), calculada con inicioVentanaRegistro
// — ver DECISIONS.md DEC-2026-052. `null` cuando esa ventana no se puede calcular (p. ej.
// periódico sin programación configurada todavía): en ese caso se mantiene el
// comportamiento histórico sin ninguna ventana (insert-only puro).
export interface VentanaActual {
  inicioMs: number
  inicioISO: string
}

export interface EntradaEstadoCheckinTipo {
  tipo: FrecuenciaCheckin
  campos: CampoCheckinResuelto[]
  programacion: ProgramacionTipoResuelta
  registros: AirtableRecord<RegistroCheckinFields>[]
  camposPorId: Map<string, CampoCheckinResuelto>
  // Global (no local al tipo): ver comentario en GET /api/cliente/checkin — un objetivo
  // puede alimentarse de un campo que vive en un tipo distinto al de su periodicidad.
  idsFuenteObjetivoGlobal: Set<string>
  objetivosDelTipo: ObjetivoResuelto[]
  ventanaActual: VentanaActual | null
  // Necesario para decidir si una fila NUEVA (con Ventana_inicio propio) sigue vigente —
  // ver finVentanaRegistro más abajo, DEC-2026-052 (corrección del bug de reprogramación).
  ahoraMs: number
}

// Movido tal cual desde el `estadoPara` que vivía inline en GET /api/cliente/checkin (Parte
// 1.5.3 en adelante), parametrizado para reutilizarse también desde el endpoint de
// check-ins pendientes de la ficha del entrenador.
//
// DEC-2026-052/053: `ultimosValores`/`yaEnviado` distinguen, POR CAMPO, entre registros
// nuevos (con `Ventana_inicio` persistido, identidad estable) y registros legacy (sin
// `Ventana_inicio`, anteriores a introducir este campo).
//
// Una fila NUEVA sigue vigente mientras `ahora` no supere el fin de SU PROPIA ventana
// (`finVentanaRegistro`, anclado siempre al `Ventana_inicio` ya persistido de esa fila) —
// nunca se compara contra un recálculo de "ventana actual" con la programación de HOY
// (DEC-2026-053, corrige un bug real: una reprogramación de `Dia_semana`/periodicidad a
// mitad de ventana podía hacer que esa comparación dejara de coincidir y la fila se volviera
// invisible, aunque siguiera siendo la misma vigente). Solo si NO existe ninguna fila nueva
// vigente para ese campo se usa el fallback legacy (`Fecha >= inicio de la ventana actual`,
// recalculada en vivo con la programación vigente — con el riesgo de reprogramación
// retroactiva ya documentado, acotado exclusivamente a datos anteriores al despliegue de
// `Ventana_inicio`). Los dos caminos nunca se mezclan para un mismo campo.
export function resolverEstadoCheckinTipo(entrada: EntradaEstadoCheckinTipo): CheckinFrecuenciaEstado {
  const { tipo, campos, programacion, registros, camposPorId, idsFuenteObjetivoGlobal, objetivosDelTipo, ventanaActual, ahoraMs } = entrada

  const camposSinExclusivosSueltos = campos.filter(
    (c) => idsFuenteObjetivoGlobal.has(c.id) || !esCampoOcultoEnConfigAvanzada(c)
  )
  const camposVisibles = programacion.lanzado
    ? camposSinExclusivosSueltos
    : camposSinExclusivosSueltos.filter((c) => idsFuenteObjetivoGlobal.has(c.id))

  const idsVisibles = new Set(camposVisibles.map((c) => c.id))
  const registrosDelTipo = registros.filter((r) => r.fields.Tipo_registro === tipo && idsVisibles.has(r.fields.Field_id))

  // Sin ventana calculable (p. ej. periódico sin programación): sin filtrar, comportamiento
  // histórico sin ninguna ventana — mismo fallback que el resto del sistema.
  const nuevosVigentes = ventanaActual
    ? registrosDelTipo.filter((r) => {
        if (!r.fields.Ventana_inicio) return false
        const inicioMs = new Date(r.fields.Ventana_inicio).getTime()
        if (!Number.isFinite(inicioMs)) return false
        const finMs = finVentanaRegistro(tipo, inicioMs, programacion)
        // Sin duración calculable (edge case: la programación periódica se retiró después
        // de crear la fila) — único caso que cae al criterio antiguo de coincidencia exacta.
        return finMs === null ? r.fields.Ventana_inicio === ventanaActual.inicioISO : ahoraMs < finMs
      })
    : []
  const legacyVigentes = ventanaActual
    ? registrosDelTipo.filter((r) => !r.fields.Ventana_inicio && new Date(r.fields.Fecha).getTime() >= ventanaActual.inicioMs)
    : registrosDelTipo

  const ultimosValores: Record<string, unknown> = {}
  // registros ya vienen ordenados desc por Fecha (ver getRegistrosCheckinByClienteEmail) —
  // los nuevos se resuelven primero; el legacy solo rellena huecos de campos sin ningún
  // registro nuevo en esta ventana, nunca sobrescribe uno que ya tenga valor nuevo.
  for (const r of nuevosVigentes) {
    const campo = camposPorId.get(r.fields.Field_id)
    if (campo && !(r.fields.Field_id in ultimosValores)) {
      ultimosValores[r.fields.Field_id] = deserializarValor(campo.tipo, r.fields.Valor)
    }
  }
  for (const r of legacyVigentes) {
    const campo = camposPorId.get(r.fields.Field_id)
    if (campo && !(r.fields.Field_id in ultimosValores)) {
      ultimosValores[r.fields.Field_id] = deserializarValor(campo.tipo, r.fields.Valor)
    }
  }
  const yaEnviado = nuevosVigentes.length > 0 || legacyVigentes.length > 0

  const proximaFecha = calcularProximaFecha(tipo, yaEnviado, ventanaActual?.inicioMs ?? null, programacion)

  return {
    lanzado: programacion.lanzado,
    disponibleDesde: programacion.disponibleDesde,
    campos: camposVisibles,
    yaEnviado,
    ultimosValores,
    proximaFecha,
    objetivos: objetivosDelTipo,
  }
}

// Un campo es "de objetivo" si al menos un objetivo vigente (de CUALQUIER periodicidad) lo
// usa como fuente de progreso — Objetivos y Revisiones son independientes: un campo fuente de
// objetivo nunca debe presentarse como pregunta de revisión, aunque su periodicidad no
// coincida con el tipo de check-in donde vive el campo (mismo motivo que `idsFuenteObjetivo`
// en GET /api/cliente/checkin, ver comentario en `resolverEstadoCheckinTipo` más arriba).
// GLOBAL a propósito, nunca calculado por tipo/sección — ver DECISIONS.md DEC-2026-047 (bug
// real corregido en checkin/page.tsx por calcularlo local) y DEC-2026-050 (mismo bug, hasta
// entonces sin corregir, en dashboard/page.tsx). Único punto de esta lógica en el frontend —
// reutilizado por checkin/page.tsx y dashboard/page.tsx, para que ambas pantallas del cliente
// nunca puedan divergir sobre si un campo cuenta como revisión.
export function idsFuenteDeObjetivos(objetivos: ObjetivoResuelto[]): Set<string> {
  return new Set(objetivos.filter((o) => o.fuenteFieldId).map((o) => o.fuenteFieldId!))
}

// Texto de progreso reutilizado por las 3 vistas que lo muestran (ficha del entrenador,
// dashboard del cliente, check-in) — evita triplicar el formateo. 'valor_objetivo' se
// expresa como "valor → objetivo meta" (con flecha de dirección), nunca como
// "valor/meta", que solo tiene sentido para conteos/sumas ('acumulado').
export function formatearProgresoTexto(unidad: string, progreso: ProgresoObjetivo): string {
  if (progreso.direccion) {
    const flecha = progreso.direccion === 'bajar' ? '↓' : '↑'
    const sufijo = progreso.completado ? (progreso.porcentaje > 100 ? ' — ¡meta superada!' : ' — ¡completado!') : ''
    return `${progreso.valor} ${unidad} ${flecha} objetivo ${progreso.meta} ${unidad}${sufijo}`
  }
  return `${progreso.valor}/${progreso.meta} ${unidad} (${progreso.porcentaje}%)`
}
