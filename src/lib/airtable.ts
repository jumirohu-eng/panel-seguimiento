import 'server-only'

const AIRTABLE_API_URL = 'https://api.airtable.com/v0'
const TABLE_CLIENTES = 'tblcpRBZbtViJzQVQ'
const TABLE_REPORTES = 'tbljT33LCBLT6NoKf'
const TABLE_INVITACIONES = 'tblzr50mLzLgnIsVg'
const TABLE_ENTRENADORES = 'tblo7dLrfaOxcPppY'
const TABLE_SNAPSHOTS = 'tbliaBxJa4GIYoHId'

export interface AirtableRecord<T> {
  id: string
  fields: T
  createdTime: string
}

export interface ClienteFields {
  Nombre: string
  Email?: string
  Objetivo: string
  Estado?: string
  Entrenamientos_objetivo: number
  Entrenador: string
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
export type SolucionEntrenador = 'Seguimiento' | 'Captación' | 'Recuperación' | 'Referidos'

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
}

export interface SnapshotFields {
  Entrenador_email: string
  Fecha: string
  Clientes_activos: number
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

async function airtableGet<T>(path: string, params?: URLSearchParams): Promise<T> {
  const baseId = process.env.AIRTABLE_BASE_ID
  const query = params ? `?${params.toString()}` : ''
  const url = `${AIRTABLE_API_URL}/${baseId}/${path}${query}`
  const res = await fetch(url, { headers: airtableHeaders(), cache: 'no-store' })
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
  const res = await fetch(url, {
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
  ;['Nombre', 'Email', 'Objetivo', 'Estado', 'Entrenamientos_objetivo', 'Entrenador'].forEach((f) =>
    params.append('fields[]', f)
  )
  const data = await airtableGet<{ records: AirtableRecord<ClienteFields>[] }>(TABLE_CLIENTES, params)
  return data.records
}

export async function getClienteById(id: string): Promise<AirtableRecord<ClienteFields> | null> {
  const baseId = process.env.AIRTABLE_BASE_ID
  const url = `${AIRTABLE_API_URL}/${baseId}/${TABLE_CLIENTES}/${id}`
  const res = await fetch(url, { headers: airtableHeaders(), cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function getReportesByClienteEmail(clienteEmail: string, maxRecords = 8) {
  const params = new URLSearchParams()
  params.set('filterByFormula', `FIND("${escapeFormulaValue(clienteEmail)}", ARRAYJOIN({Cliente_Email})) > 0`)
  params.set('sort[0][field]', 'Fecha')
  params.set('sort[0][direction]', 'desc')
  params.set('maxRecords', String(maxRecords))
  ;['Fecha', 'Peso', 'Entrenamientos', 'Energía', 'Notas', 'Análisis IA', 'Mensaje sugerido'].forEach((f) =>
    params.append('fields[]', f)
  )
  const data = await airtableGet<{ records: AirtableRecord<ReporteFields>[] }>(TABLE_REPORTES, params)
  return data.records
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
