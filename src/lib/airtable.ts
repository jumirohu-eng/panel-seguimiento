import 'server-only'

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
  Estado?: string
  Entrenamientos_objetivo: number
  Entrenador: string
  Link_recordatorio?: string
  Notas_entrenador?: string
  Notas_iniciales?: string
  Link_tally_alta?: string
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

export type TipoCampoCheckinAirtable = 'escala' | 'si_no' | 'numero' | 'texto' | 'seleccion' | 'seleccion_multiple'
export type FrecuenciaCheckinAirtable = 'diario' | 'semanal' | 'periodico'

export interface CampoCheckinFields {
  Nombre: string
  Field_id: string
  Entrenador: string
  Tipo: TipoCampoCheckinAirtable
  Categoria?: string
  Opciones?: string
  Unidad?: string
  Frecuencia: FrecuenciaCheckinAirtable
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
    'Link_tally_alta',
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

export interface UltimoReporteResumen {
  fecha?: string
  mensajeSugerido?: string
  analisisIA?: string
}

export async function getUltimosReportesPorClientes(
  emails: string[]
): Promise<Record<string, UltimoReporteResumen>> {
  if (emails.length === 0) return {}

  const formula = `OR(${emails
    .map((email) => `FIND("${escapeFormulaValue(email)}", ARRAYJOIN({Cliente_Email})) > 0`)
    .join(', ')})`
  const params = new URLSearchParams()
  params.set('filterByFormula', formula)
  params.set('sort[0][field]', 'Fecha')
  params.set('sort[0][direction]', 'desc')
  ;['Cliente_Email', 'Fecha', 'Mensaje sugerido', 'Análisis IA'].forEach((f) => params.append('fields[]', f))

  const data = await airtableGet<{ records: AirtableRecord<ReporteFields & { Cliente_Email?: string[] }>[] }>(
    TABLE_REPORTES,
    params
  )

  const porCliente: Record<string, UltimoReporteResumen> = {}
  for (const record of data.records) {
    const email = record.fields.Cliente_Email?.[0]
    if (!email || porCliente[email]) continue
    porCliente[email] = {
      fecha: record.fields.Fecha,
      mensajeSugerido: record.fields['Mensaje sugerido'],
      analisisIA: record.fields['Análisis IA'],
    }
  }
  return porCliente
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
