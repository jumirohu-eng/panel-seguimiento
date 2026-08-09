import 'server-only'

const AIRTABLE_API_URL = 'https://api.airtable.com/v0'
const TABLE_CLIENTES = 'tblcpRBZbtViJzQVQ'
const TABLE_REPORTES = 'tbljT33LCBLT6NoKf'

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
