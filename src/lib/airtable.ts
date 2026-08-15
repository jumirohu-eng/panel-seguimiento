import 'server-only'
import { resolverCamposEfectivos, generarFieldIdPersonalizado } from './checkinFields'

const AIRTABLE_API_URL = 'https://api.airtable.com/v0'
const TABLE_CLIENTES = 'tblcpRBZbtViJzQVQ'
const TABLE_REPORTES = 'tbljT33LCBLT6NoKf'
const TABLE_INVITACIONES = 'tblzr50mLzLgnIsVg'
const TABLE_ENTRENADORES = 'tblo7dLrfaOxcPppY'
const TABLE_SNAPSHOTS = 'tbliaBxJa4GIYoHId'
const TABLE_SNAPSHOTS_ENTRENADORES = 'tblEaBtZvUXyzPk8y'
const TABLE_ARCHIVO = 'tblgwKrbv6kRYqrAt'
const TABLE_ADMINS = 'tbl9rBIoivD65ojPx'
const TABLE_CAMPOS_CHECKIN = 'tblY8lFGaO2iA29Zf'
const TABLE_REGISTROS_CHECKIN = 'tbl7usdXJYJA83lsm'
const TABLE_CHECKIN_TIPOS = 'tblsiRHYa7SFro2Th'
const TABLE_INVITACIONES_CLIENTE = 'tblrWxTzzuPSFPzNP'
const TABLE_OBJETIVOS = 'tbl0IwhFmKLc0MolG'

export interface AirtableRecord<T> {
  id: string
  fields: T
  createdTime: string
}

export interface ClienteFields {
  Nombre: string
  Email?: string
  'Teléfono'?: string
  Objetivo: string
  // Onboarding nativo (Parte 1.5.1, ver DECISIONS.md): objetivos secundarios y días
  // habituales, elegidos por el propio cliente tras su primer login. `Objetivo`
  // (principal) y `Notas_iniciales` (comentario) se reutilizan tal cual, sin duplicar.
  Objetivos_adicionales?: string[]
  Dias_disponibles?: DiaSemanaAirtable[]
  Estado?: string
  Entrenamientos_objetivo: number
  Entrenador: string
  Link_recordatorio?: string
  Notas_entrenador?: string
  Notas_iniciales?: string
  Last_modified?: string
}

export interface ReporteFields {
  Fecha: string
  Cliente: string[]
  Peso: number
  Entrenamientos: number
  Energía: 'Cansado' | 'Normal' | 'Con energía'
  Notas?: string
  'Análisis IA'?: string
  'Mensaje sugerido'?: string
  Link_alerta?: string
  Last_modified?: string
}

export type EstadoInvitacion = 'Activo' | 'Usado' | 'Expirado' | 'Cancelado'

export interface InvitacionFields {
  Token: string
  Email_entrenador: string
  Estado: EstadoInvitacion
  Creado: string
  Expira: string
}

// Invitación privada de un entrenador a un cliente concreto (Parte 1.5.1, ver
// DECISIONS.md) — mismo patrón/estados que InvitacionFields, tabla separada porque
// esta invitación está ligada a un Cliente+Entrenador, no solo a un email suelto.
export interface InvitacionClienteFields {
  Token: string
  Cliente: string[]
  Entrenador: string
  Email_cliente: string
  Estado: EstadoInvitacion
  Creado: string
  Expira: string
}

export type EstadoEntrenador = 'Activo' | 'Prueba' | 'Inactivo'
export type SolucionEntrenador = 'Seguimiento' | 'Captación' | 'Recuperación' | 'Referidos' | 'Metricas'

export interface EntrenadorFields {
  Email: string
  Nombre: string
  'Teléfono'?: string
  Soluciones?: SolucionEntrenador[]
  Estado: EstadoEntrenador
  Fecha_alta?: string
  Precio_mensual?: number
  Notas?: string
  Link_whatsapp?: string
  'Último_login'?: string
  Permite_marketing?: boolean
  Consentimiento_IA?: boolean
  Consentimiento_IA_fecha?: string
  Checkin_disponible_desde?: string | null
  Last_modified?: string
}

export interface AdminFields {
  Email: string
  Nombre: string
  Activo: boolean
}

export interface SnapshotFields {
  Entrenador_email: string
  Fecha: string
  Clientes_activos: number
}

export interface SnapshotEntrenadorFields {
  Fecha: string
  Total_entrenadores: number
  Total_activos: number
  Total_prueba: number
}

export type TipoCampoCheckinAirtable = 'escala' | 'si_no' | 'numero' | 'texto' | 'seleccion' | 'seleccion_multiple' | 'dolor'
export type FrecuenciaCheckinAirtable = 'diario' | 'semanal' | 'periodico'
export type DiaSemanaAirtable = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
export type ModoPeriodicoAirtable = 'intervalo' | 'dia_mes'

export interface CampoCheckinFields {
  Nombre: string
  Field_id: string
  Entrenador: string
  Tipo: TipoCampoCheckinAirtable
  Categoria?: string
  Opciones?: string
  Unidad?: string
  // Frecuencia (singleSelect, un único valor) es el modelo de Parte 1, deprecado pero
  // intacto — se usa como fallback de lectura. Tipos (multiSelect) es el modelo vigente
  // desde Parte 1.5: un campo puede pertenecer a varios tipos a la vez. Ver DECISIONS.md.
  Frecuencia?: FrecuenciaCheckinAirtable
  Tipos?: FrecuenciaCheckinAirtable[]
  Activo?: boolean
  Orden?: number
  Es_estandar?: boolean
  Last_modified?: string
}

export interface RegistroCheckinFields {
  Fecha: string
  Cliente: string[]
  Field_id: string
  Tipo_registro: FrecuenciaCheckinAirtable
  Valor: string
  Cliente_Email?: string[]
  Entrenador_email?: string[]
  Last_modified?: string
}

// Programación y lanzamiento independiente por (Entrenador, Tipo). Una fila por
// combinación, creada de forma perezosa (Parte 1.5, ver DECISIONS.md).
export interface CheckinTipoFields {
  Entrenador: string
  Tipo: FrecuenciaCheckinAirtable
  Disponible_desde?: string | null
  Dia_semana?: DiaSemanaAirtable
  Modo_periodico?: ModoPeriodicoAirtable
  Fecha_inicio_periodico?: string
  Intervalo_dias_periodico?: number
  Dia_mes_periodico?: number
  Last_modified?: string
}

// Objetivos configurables por cliente (Parte 1.5.2, ver DECISIONS.md). Sustituyen a
// Clientes.Entrenamientos_objetivo como indicador fijo — ese campo no se borra (histórico),
// pero deja de leerse para el dashboard/ficha.
export type PeriodicidadObjetivoAirtable = 'diario' | 'semanal' | 'mensual'

export interface ObjetivoFields {
  Nombre: string
  Cliente: string[]
  // Escrito por la app al crear, no es un lookup de Airtable — ver DEC-2026-024 (filtrar
  // por ARRAYJOIN sobre un campo enlazado no funciona de forma fiable).
  Cliente_Email: string
  Periodicidad: PeriodicidadObjetivoAirtable
  Meta: number
  Unidad: string
  // Field_id de Campos_checkin (estándar o personalizado) usado para calcular el
  // progreso. Vacío/null = objetivo sin fuente automática, solo informativo.
  Fuente_field_id?: string | null
  Fecha_inicio: string
  Fecha_fin?: string | null
  Activo: boolean
  // Soft-delete (Parte 1.5.3, ver DECISIONS.md) — distinto de Activo (que sí conserva
  // historial y puede reactivarse). Un objetivo eliminado nunca se borra de Airtable: el
  // registro se conserva por integridad, pero deja de listarse en cualquier consulta
  // (ver getObjetivosByClienteEmail) y no puede reactivarse desde la UI.
  Eliminado?: boolean
  // Modo de cálculo de progreso (integración Objetivos↔Check-ins, ver DECISIONS.md).
  // Ausente = 'acumulado' (comportamiento histórico: sumar/contar dentro de la ventana,
  // sin backfill necesario en objetivos ya existentes). 'valor_objetivo': el progreso es
  // la distancia entre Valor_inicial y el último registro real hacia Meta, en la
  // Direccion indicada (peso, medidas de composición corporal…) — nunca se suma/cuenta.
  Modo_progreso?: 'acumulado' | 'valor_objetivo'
  // Obligatorio si Modo_progreso='valor_objetivo'; sin valor por defecto — nunca se
  // infiere silenciosamente (ver DECISIONS.md, sección "valor inicial"). Nullable para
  // poder limpiarlos explícitamente al volver a modo 'acumulado' (PATCH).
  Direccion?: 'subir' | 'bajar' | null
  Valor_inicial?: number | null
  Orden?: number
  Last_modified?: string
}

function airtableHeaders() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function escapeFormulaValue(value: string) {
  return value.replace(/"/g, '\\"')
}

// Airtable limita a 5 req/seg por base, compartida entre TODOS los entrenadores.
// Con varios entrenadores concurrentes ese límite se puede alcanzar en ráfagas cortas;
// sin reintento, cada 429 se propagaba como un 500 genérico al usuario.
const MAX_RETRIES = 3

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, options)
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res
    const retryAfterHeader = res.headers.get('Retry-After')
    const waitMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 1000
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
}

async function airtableGet<T>(path: string, params?: URLSearchParams): Promise<T> {
  const baseId = process.env.AIRTABLE_BASE_ID
  const query = params ? `?${params.toString()}` : ''
  const url = `${AIRTABLE_API_URL}/${baseId}/${path}${query}`
  const res = await fetchWithRetry(url, { headers: airtableHeaders(), cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function airtableWrite<T>(
  path: string,
  method: 'POST' | 'PATCH',
  fields: Record<string, unknown>
): Promise<T> {
  const baseId = process.env.AIRTABLE_BASE_ID
  const url = `${AIRTABLE_API_URL}/${baseId}/${path}`
  const res = await fetchWithRetry(url, {
    method,
    headers: airtableHeaders(),
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function getClientesByEntrenador(email: string) {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Entrenador} = "${escapeFormulaValue(email)}"`)
  ;[
    'Nombre',
    'Email',
    'Teléfono',
    'Objetivo',
    'Estado',
    'Entrenamientos_objetivo',
    'Entrenador',
    'Link_recordatorio',
    'Notas_entrenador',
    'Notas_iniciales',
    'Last_modified',
  ].forEach((f) => params.append('fields[]', f))
  const data = await airtableGet<{ records: AirtableRecord<ClienteFields>[] }>(TABLE_CLIENTES, params)
  return data.records
}

export async function crearCliente(fields: Partial<ClienteFields>) {
  return airtableWrite<AirtableRecord<ClienteFields>>(TABLE_CLIENTES, 'POST', fields)
}

export async function actualizarCliente(recordId: string, fields: Partial<ClienteFields>) {
  return airtableWrite<AirtableRecord<ClienteFields>>(`${TABLE_CLIENTES}/${recordId}`, 'PATCH', fields)
}

export async function getClienteByEmail(email: string): Promise<AirtableRecord<ClienteFields> | null> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Email} = "${escapeFormulaValue(email)}"`)
  params.set('maxRecords', '1')
  const data = await airtableGet<{ records: AirtableRecord<ClienteFields>[] }>(TABLE_CLIENTES, params)
  return data.records[0] ?? null
}

export async function getClienteById(id: string): Promise<AirtableRecord<ClienteFields> | null> {
  const baseId = process.env.AIRTABLE_BASE_ID
  const url = `${AIRTABLE_API_URL}/${baseId}/${TABLE_CLIENTES}/${id}`
  const res = await fetchWithRetry(url, { headers: airtableHeaders(), cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function getReportesByClienteEmail(
  clienteEmail: string,
  pageSize = 7,
  offset?: string
): Promise<{ records: AirtableRecord<ReporteFields>[]; offset?: string }> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `FIND("${escapeFormulaValue(clienteEmail)}", ARRAYJOIN({Cliente_Email})) > 0`)
  params.set('sort[0][field]', 'Fecha')
  params.set('sort[0][direction]', 'desc')
  params.set('pageSize', String(pageSize))
  if (offset) params.set('offset', offset)
  ;['Fecha', 'Peso', 'Entrenamientos', 'Energía', 'Notas', 'Análisis IA', 'Mensaje sugerido', 'Link_alerta'].forEach(
    (f) => params.append('fields[]', f)
  )
  const data = await airtableGet<{ records: AirtableRecord<ReporteFields>[]; offset?: string }>(
    TABLE_REPORTES,
    params
  )
  return { records: data.records, offset: data.offset }
}

export async function getInvitacionActivaByEmail(
  email: string
): Promise<AirtableRecord<InvitacionFields> | null> {
  const params = new URLSearchParams()
  params.set(
    'filterByFormula',
    `AND({Email_entrenador} = "${escapeFormulaValue(email)}", {Estado} = "Activo")`
  )
  params.set('maxRecords', '1')
  const data = await airtableGet<{ records: AirtableRecord<InvitacionFields>[] }>(
    TABLE_INVITACIONES,
    params
  )
  return data.records[0] ?? null
}

export async function getInvitacionByToken(
  token: string
): Promise<AirtableRecord<InvitacionFields> | null> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Token} = "${escapeFormulaValue(token)}"`)
  params.set('maxRecords', '1')
  const data = await airtableGet<{ records: AirtableRecord<InvitacionFields>[] }>(
    TABLE_INVITACIONES,
    params
  )
  return data.records[0] ?? null
}

export async function getAllInvitaciones() {
  const params = new URLSearchParams()
  params.set('sort[0][field]', 'Creado')
  params.set('sort[0][direction]', 'desc')
  const data = await airtableGet<{ records: AirtableRecord<InvitacionFields>[] }>(
    TABLE_INVITACIONES,
    params
  )
  return data.records
}

export async function crearInvitacion(email: string, token: string) {
  const creado = new Date()
  const expira = new Date(creado.getTime() + 24 * 60 * 60 * 1000)
  return airtableWrite<AirtableRecord<InvitacionFields>>(TABLE_INVITACIONES, 'POST', {
    Token: token,
    Email_entrenador: email,
    Estado: 'Activo',
    Creado: creado.toISOString(),
    Expira: expira.toISOString(),
  })
}

export async function cancelarInvitacion(recordId: string) {
  return airtableWrite<AirtableRecord<InvitacionFields>>(
    `${TABLE_INVITACIONES}/${recordId}`,
    'PATCH',
    { Estado: 'Cancelado' }
  )
}

export async function marcarInvitacionUsada(recordId: string) {
  return airtableWrite<AirtableRecord<InvitacionFields>>(
    `${TABLE_INVITACIONES}/${recordId}`,
    'PATCH',
    { Estado: 'Usado' }
  )
}

// `Cliente` es un campo de tipo "link to another record" — en filterByFormula, Airtable
// resuelve ARRAYJOIN()/FIND() sobre esos campos contra el valor del campo primario del
// registro enlazado (Clientes.Nombre), no contra su record id. Filtrar por id de cliente
// vía fórmula buscaría el id dentro de nombres de cliente y nunca encontraría nada. Por
// eso se filtra por Entrenador (texto plano, sí es fiable en fórmula — el llamador ya
// comprobó ownership) y se afina en JS comparando fields.Cliente (array de ids reales
// cuando se lee vía API, a diferencia de una fórmula) contra clienteId.
export async function getInvitacionClienteActivaByClienteId(
  clienteId: string,
  entrenadorEmail: string
): Promise<AirtableRecord<InvitacionClienteFields> | null> {
  const params = new URLSearchParams()
  params.set(
    'filterByFormula',
    `AND({Entrenador} = "${escapeFormulaValue(entrenadorEmail)}", {Estado} = "Activo")`
  )
  params.set('sort[0][field]', 'Creado')
  params.set('sort[0][direction]', 'desc')
  const data = await airtableGet<{ records: AirtableRecord<InvitacionClienteFields>[] }>(
    TABLE_INVITACIONES_CLIENTE,
    params
  )
  return data.records.find((r) => r.fields.Cliente?.includes(clienteId)) ?? null
}

export async function getInvitacionClienteMasRecienteByClienteId(
  clienteId: string,
  entrenadorEmail: string
): Promise<AirtableRecord<InvitacionClienteFields> | null> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Entrenador} = "${escapeFormulaValue(entrenadorEmail)}"`)
  params.set('sort[0][field]', 'Creado')
  params.set('sort[0][direction]', 'desc')
  const data = await airtableGet<{ records: AirtableRecord<InvitacionClienteFields>[] }>(
    TABLE_INVITACIONES_CLIENTE,
    params
  )
  return data.records.find((r) => r.fields.Cliente?.includes(clienteId)) ?? null
}

export async function getInvitacionClienteByToken(
  token: string
): Promise<AirtableRecord<InvitacionClienteFields> | null> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Token} = "${escapeFormulaValue(token)}"`)
  params.set('maxRecords', '1')
  const data = await airtableGet<{ records: AirtableRecord<InvitacionClienteFields>[] }>(
    TABLE_INVITACIONES_CLIENTE,
    params
  )
  return data.records[0] ?? null
}

export async function crearInvitacionCliente(clienteId: string, entrenadorEmail: string, clienteEmail: string, token: string) {
  const creado = new Date()
  const expira = new Date(creado.getTime() + 24 * 60 * 60 * 1000)
  return airtableWrite<AirtableRecord<InvitacionClienteFields>>(TABLE_INVITACIONES_CLIENTE, 'POST', {
    Token: token,
    Cliente: [clienteId],
    Entrenador: entrenadorEmail,
    Email_cliente: clienteEmail,
    Estado: 'Activo',
    Creado: creado.toISOString(),
    Expira: expira.toISOString(),
  })
}

export async function cancelarInvitacionCliente(recordId: string) {
  return airtableWrite<AirtableRecord<InvitacionClienteFields>>(
    `${TABLE_INVITACIONES_CLIENTE}/${recordId}`,
    'PATCH',
    { Estado: 'Cancelado' }
  )
}

export async function marcarInvitacionClienteUsada(recordId: string) {
  return airtableWrite<AirtableRecord<InvitacionClienteFields>>(
    `${TABLE_INVITACIONES_CLIENTE}/${recordId}`,
    'PATCH',
    { Estado: 'Usado' }
  )
}

export async function getAllEntrenadores() {
  const params = new URLSearchParams()
  params.set('sort[0][field]', 'Nombre')
  params.set('sort[0][direction]', 'asc')
  const data = await airtableGet<{ records: AirtableRecord<EntrenadorFields>[] }>(
    TABLE_ENTRENADORES,
    params
  )
  return data.records
}

export async function getEntrenadorByEmail(
  email: string
): Promise<AirtableRecord<EntrenadorFields> | null> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Email} = "${escapeFormulaValue(email)}"`)
  params.set('maxRecords', '1')
  const data = await airtableGet<{ records: AirtableRecord<EntrenadorFields>[] }>(
    TABLE_ENTRENADORES,
    params
  )
  return data.records[0] ?? null
}

export async function getAdminByEmail(email: string): Promise<AirtableRecord<AdminFields> | null> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Email} = "${escapeFormulaValue(email)}"`)
  params.set('maxRecords', '1')
  const data = await airtableGet<{ records: AirtableRecord<AdminFields>[] }>(TABLE_ADMINS, params)
  return data.records[0] ?? null
}

export async function crearEntrenador(fields: Partial<EntrenadorFields>) {
  return airtableWrite<AirtableRecord<EntrenadorFields>>(TABLE_ENTRENADORES, 'POST', fields)
}

export async function actualizarEntrenador(recordId: string, fields: Partial<EntrenadorFields>) {
  return airtableWrite<AirtableRecord<EntrenadorFields>>(
    `${TABLE_ENTRENADORES}/${recordId}`,
    'PATCH',
    fields
  )
}

export async function borrarEntrenador(recordId: string) {
  const baseId = process.env.AIRTABLE_BASE_ID
  const url = `${AIRTABLE_API_URL}/${baseId}/${TABLE_ENTRENADORES}/${recordId}`
  const res = await fetchWithRetry(url, { method: 'DELETE', headers: airtableHeaders() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable error ${res.status}: ${text}`)
  }
  return res.json() as Promise<{ id: string; deleted: boolean }>
}

export async function getClientesActivosPorEntrenador(): Promise<Record<string, number>> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Estado} = "Activo"`)
  params.append('fields[]', 'Entrenador')
  const data = await airtableGet<{ records: AirtableRecord<ClienteFields>[] }>(
    TABLE_CLIENTES,
    params
  )
  const counts: Record<string, number> = {}
  for (const record of data.records) {
    const entrenador = record.fields.Entrenador
    if (!entrenador) continue
    counts[entrenador] = (counts[entrenador] ?? 0) + 1
  }
  return counts
}

export async function getInvitacionMasRecienteByEmail(
  email: string
): Promise<AirtableRecord<InvitacionFields> | null> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Email_entrenador} = "${escapeFormulaValue(email)}"`)
  params.set('sort[0][field]', 'Creado')
  params.set('sort[0][direction]', 'desc')
  params.set('maxRecords', '1')
  const data = await airtableGet<{ records: AirtableRecord<InvitacionFields>[] }>(
    TABLE_INVITACIONES,
    params
  )
  return data.records[0] ?? null
}

export async function getSnapshotsByEntrenador(email: string) {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Entrenador_email} = "${escapeFormulaValue(email)}"`)
  params.set('sort[0][field]', 'Fecha')
  params.set('sort[0][direction]', 'asc')
  const data = await airtableGet<{ records: AirtableRecord<SnapshotFields>[] }>(
    TABLE_SNAPSHOTS,
    params
  )
  return data.records
}

export async function getAllSnapshots() {
  const params = new URLSearchParams()
  params.set('sort[0][field]', 'Fecha')
  params.set('sort[0][direction]', 'asc')
  const data = await airtableGet<{ records: AirtableRecord<SnapshotFields>[] }>(
    TABLE_SNAPSHOTS,
    params
  )
  return data.records
}

export async function getAllSnapshotsEntrenadores() {
  const params = new URLSearchParams()
  params.set('sort[0][field]', 'Fecha')
  params.set('sort[0][direction]', 'asc')
  const data = await airtableGet<{ records: AirtableRecord<SnapshotEntrenadorFields>[] }>(
    TABLE_SNAPSHOTS_ENTRENADORES,
    params
  )
  return data.records
}

export async function getAllClientes() {
  const params = new URLSearchParams()
  ;['Nombre', 'Email', 'Estado', 'Entrenador'].forEach((f) => params.append('fields[]', f))
  const data = await airtableGet<{ records: AirtableRecord<ClienteFields>[] }>(
    TABLE_CLIENTES,
    params
  )
  return data.records
}

export interface ReporteConMensajeFields {
  Cliente_Email?: string[]
  Fecha?: string
}

export async function getReportesConMensajeSugerido() {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Mensaje sugerido} != ""`)
  ;['Cliente_Email', 'Fecha'].forEach((f) => params.append('fields[]', f))
  const data = await airtableGet<{ records: AirtableRecord<ReporteConMensajeFields>[] }>(
    TABLE_REPORTES,
    params
  )
  return data.records
}

export interface ArchivoConMensajeFields {
  Cliente_Email?: string
  Fecha?: string
}

export async function getCamposCheckinByEntrenador(email: string) {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Entrenador} = "${escapeFormulaValue(email)}"`)
  const data = await airtableGet<{ records: AirtableRecord<CampoCheckinFields>[] }>(
    TABLE_CAMPOS_CHECKIN,
    params
  )
  return data.records
}

export async function crearCampoCheckin(fields: Partial<CampoCheckinFields>) {
  return airtableWrite<AirtableRecord<CampoCheckinFields>>(TABLE_CAMPOS_CHECKIN, 'POST', fields)
}

export async function actualizarCampoCheckin(recordId: string, fields: Partial<CampoCheckinFields>) {
  return airtableWrite<AirtableRecord<CampoCheckinFields>>(
    `${TABLE_CAMPOS_CHECKIN}/${recordId}`,
    'PATCH',
    fields
  )
}

// Solo tiene sentido borrar de verdad la fila de un campo PERSONALIZADO (no existe en
// código, no hay a qué "volver"). Un override de un campo ESTÁNDAR nunca se borra por esta
// vía — ver DELETE /api/entrenador/checkin-config/campos/[fieldId], que en ese caso lo
// desactiva de forma duradera en su lugar (borrar la fila solo revertiría a los valores
// por defecto del catálogo, reapareciendo activo).
export async function borrarCampoCheckin(recordId: string) {
  const baseId = process.env.AIRTABLE_BASE_ID
  const url = `${AIRTABLE_API_URL}/${baseId}/${TABLE_CAMPOS_CHECKIN}/${recordId}`
  const res = await fetchWithRetry(url, { method: 'DELETE', headers: airtableHeaders() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable error ${res.status}: ${text}`)
  }
  return res.json() as Promise<{ id: string; deleted: boolean }>
}

// Check-in dinámico a partir de Objetivos: cuando el entrenador da de alta un objetivo
// con una métrica nueva ("Pasos", "Movilidad"...), esa métrica debe quedar disponible
// automáticamente en el check-in — sin que el entrenador tenga que ir primero a
// /checkin-config a crearla a mano, y sin duplicar la pregunta si otro objetivo ya usa
// el mismo nombre. Busca por nombre (normalizado: trim + minúsculas) entre los campos
// YA activos y del mismo tipo de este entrenador; si no hay coincidencia, crea un campo
// personalizado nuevo. Se asigna solo a `Tipos: ['diario']` por defecto — la
// periodicidad más granular del check-in, capaz de alimentar objetivos diario/semanal/
// mensual por agregación (ver DECISIONS.md, mismo principio que DEC-2026-026) — el
// entrenador puede ampliarlo a otros tipos después desde /checkin-config si lo necesita.
//
// Limitación conocida y aceptada (no resuelta con una transacción, Airtable no las
// ofrece vía API REST): lectura-y-creación no es atómica. Dos objetivos creados con el
// mismo nombre de métrica nueva en un margen de milisegundos podrían, en el peor caso,
// generar dos campos casi duplicados — mismo tipo de riesgo ya aceptado en
// `upsertCheckinTipo` (Parte 1.5), documentado aquí explícitamente.
export async function resolverOCrearCampoCheckinParaObjetivo(
  email: string,
  nombre: string,
  tipo: 'si_no' | 'numero',
  unidad?: string
): Promise<string> {
  const filas = await getCamposCheckinByEntrenador(email)
  const nombreNormalizado = nombre.trim().toLowerCase()
  const existente = resolverCamposEfectivos(filas).find(
    (c) => c.activo && c.tipo === tipo && c.nombre.trim().toLowerCase() === nombreNormalizado
  )
  if (existente) return existente.id

  const orden = filas.reduce((max, f) => Math.max(max, f.fields.Orden ?? 0), 9) + 1
  const fieldId = generarFieldIdPersonalizado(nombre)
  await crearCampoCheckin({
    Nombre: nombre.trim(),
    Field_id: fieldId,
    Entrenador: email,
    Tipo: tipo,
    Categoria: 'objetivo',
    Unidad: unidad,
    Tipos: ['diario'],
    Activo: true,
    Orden: orden,
    Es_estandar: false,
  })
  return fieldId
}

export async function crearRegistrosCheckin(filas: Partial<RegistroCheckinFields>[]) {
  const creados: AirtableRecord<RegistroCheckinFields>[] = []
  for (const fields of filas) {
    creados.push(await airtableWrite<AirtableRecord<RegistroCheckinFields>>(TABLE_REGISTROS_CHECKIN, 'POST', fields))
  }
  return creados
}

export async function getRegistrosCheckinByClienteEmail(clienteEmail: string) {
  const params = new URLSearchParams()
  params.set('filterByFormula', `FIND("${escapeFormulaValue(clienteEmail)}", ARRAYJOIN({Cliente_Email})) > 0`)
  params.set('sort[0][field]', 'Fecha')
  params.set('sort[0][direction]', 'desc')
  const data = await airtableGet<{ records: AirtableRecord<RegistroCheckinFields>[] }>(
    TABLE_REGISTROS_CHECKIN,
    params
  )
  return data.records
}

// Borrado real (no soft-delete) de filas de Registros_checkin — a diferencia del resto de
// esta tabla (insert-only en el flujo normal del cliente, ver DEC-2026-007), esto es una
// acción de mantenimiento del entrenador desde la ficha del cliente. No hay nada que
// "reactivar": el progreso de cualquier objetivo se recalcula en caliente desde las filas
// que queden (ver resolverObjetivo/calcularProgresoDesdeCheckins/calcularProgresoValorObjetivo
// en objetivos.ts, que nunca cachean ni duplican este dato), así que borrar de verdad la fila
// es suficiente y no requiere ninguna lógica de recálculo adicional. Mismo patrón DELETE que
// borrarCampoCheckin. Secuencial (no Promise.all) por el límite compartido de 5 req/seg de
// Airtable (ver fetchWithRetry) — un envío normal tiene pocas filas (una por campo).
export async function borrarRegistrosCheckin(recordIds: string[]) {
  const baseId = process.env.AIRTABLE_BASE_ID
  for (const recordId of recordIds) {
    const url = `${AIRTABLE_API_URL}/${baseId}/${TABLE_REGISTROS_CHECKIN}/${recordId}`
    const res = await fetchWithRetry(url, { method: 'DELETE', headers: airtableHeaders() })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Airtable error ${res.status}: ${text}`)
    }
  }
}

export async function getCheckinTiposByEntrenador(email: string) {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Entrenador} = "${escapeFormulaValue(email)}"`)
  const data = await airtableGet<{ records: AirtableRecord<CheckinTipoFields>[] }>(TABLE_CHECKIN_TIPOS, params)
  return data.records
}

export async function crearCheckinTipo(fields: Partial<CheckinTipoFields>) {
  return airtableWrite<AirtableRecord<CheckinTipoFields>>(TABLE_CHECKIN_TIPOS, 'POST', fields)
}

export async function actualizarCheckinTipo(recordId: string, fields: Partial<CheckinTipoFields>) {
  return airtableWrite<AirtableRecord<CheckinTipoFields>>(`${TABLE_CHECKIN_TIPOS}/${recordId}`, 'PATCH', fields)
}

// Crea la fila de (Entrenador, Tipo) en Checkin_tipos si todavía no existe (creación
// perezosa, ver DECISIONS.md), o la actualiza si ya existe.
export async function upsertCheckinTipo(
  email: string,
  tipo: FrecuenciaCheckinAirtable,
  fields: Partial<CheckinTipoFields>
) {
  const existentes = await getCheckinTiposByEntrenador(email)
  const fila = existentes.find((f) => f.fields.Tipo === tipo)
  if (fila) return actualizarCheckinTipo(fila.id, fields)
  return crearCheckinTipo({ Entrenador: email, Tipo: tipo, ...fields })
}

// Nunca devuelve objetivos con Eliminado=true (soft-delete, Parte 1.5.3, ver
// DECISIONS.md) — un único punto de filtrado para que ningún consumidor (ficha del
// entrenador, dashboard/check-in del cliente) tenga que acordarse de excluirlos.
// `{Eliminado} != TRUE()` incluye correctamente el caso omitido (checkbox en false no
// viaja en la respuesta de Airtable, ver DEC-2026-008) — no usar `{Eliminado} = FALSE()`.
export async function getObjetivosByClienteEmail(clienteEmail: string) {
  const params = new URLSearchParams()
  params.set(
    'filterByFormula',
    `AND({Cliente_Email} = "${escapeFormulaValue(clienteEmail)}", {Eliminado} != TRUE())`
  )
  params.set('sort[0][field]', 'Orden')
  params.set('sort[0][direction]', 'asc')
  const data = await airtableGet<{ records: AirtableRecord<ObjetivoFields>[] }>(TABLE_OBJETIVOS, params)
  return data.records
}

export async function getObjetivoById(id: string): Promise<AirtableRecord<ObjetivoFields> | null> {
  const baseId = process.env.AIRTABLE_BASE_ID
  const url = `${AIRTABLE_API_URL}/${baseId}/${TABLE_OBJETIVOS}/${id}`
  const res = await fetchWithRetry(url, { headers: airtableHeaders(), cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function crearObjetivo(fields: Partial<ObjetivoFields>) {
  return airtableWrite<AirtableRecord<ObjetivoFields>>(TABLE_OBJETIVOS, 'POST', fields)
}

export async function actualizarObjetivo(recordId: string, fields: Partial<ObjetivoFields>) {
  return airtableWrite<AirtableRecord<ObjetivoFields>>(`${TABLE_OBJETIVOS}/${recordId}`, 'PATCH', fields)
}

export async function getArchivoConMensajeSugerido() {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{Mensaje_sugerido} != ""`)
  ;['Cliente_Email', 'Fecha'].forEach((f) => params.append('fields[]', f))
  const data = await airtableGet<{ records: AirtableRecord<ArchivoConMensajeFields>[] }>(
    TABLE_ARCHIVO,
    params
  )
  return data.records
}
