import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import {
  getClienteById,
  getObjetivosByClienteEmail,
  getCamposCheckinByEntrenador,
  getCheckinTiposByEntrenador,
  getRegistrosCheckinByClienteEmail,
  crearObjetivo,
} from '@/lib/airtable'
import { resolverCamposEfectivos } from '@/lib/checkinFields'
import { resolverObjetivo, validarFuenteObjetivo, PeriodicidadObjetivo } from '@/lib/objetivos'

const PERIODICIDADES_VALIDAS: PeriodicidadObjetivo[] = ['diario', 'semanal', 'mensual']

async function cargarCliente(id: string, email: string) {
  const cliente = await getClienteById(id)
  if (!cliente) return { error: NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 }) }
  if (cliente.fields.Entrenador !== email) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { cliente }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAuthenticatedEmail(request)
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { cliente, error } = await cargarCliente(id, email)
  if (error) return error

  try {
    const [filasObjetivos, filasConfig, filasTipos, registros] = await Promise.all([
      getObjetivosByClienteEmail(cliente!.fields.Email ?? ''),
      getCamposCheckinByEntrenador(email),
      getCheckinTiposByEntrenador(email),
      getRegistrosCheckinByClienteEmail(cliente!.fields.Email ?? ''),
    ])

    const camposPorId = new Map(resolverCamposEfectivos(filasConfig).map((c) => [c.id, c]))
    const diaSemanaCheckin = filasTipos.find((f) => f.fields.Tipo === 'semanal')?.fields.Dia_semana ?? 'lunes'

    const objetivos = filasObjetivos.map((r) => resolverObjetivo(r, camposPorId, registros, diaSemanaCheckin))
    return NextResponse.json({ objetivos })
  } catch (err) {
    console.error('Error al obtener objetivos del cliente', err)
    return NextResponse.json({ error: 'Error al obtener los objetivos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const email = await getAuthenticatedEmail(request)
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { cliente, error } = await cargarCliente(id, email)
  if (error) return error
  if (!cliente!.fields.Email) {
    return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const periodicidad = body?.periodicidad as PeriodicidadObjetivo
  const meta = Number(body?.meta)
  const unidad = typeof body?.unidad === 'string' ? body.unidad.trim() : ''
  const fuenteFieldId = typeof body?.fuenteFieldId === 'string' && body.fuenteFieldId ? body.fuenteFieldId : null
  const fechaInicio = typeof body?.fechaInicio === 'string' ? body.fechaInicio : ''
  const fechaFin = typeof body?.fechaFin === 'string' && body.fechaFin ? body.fechaFin : undefined

  if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!PERIODICIDADES_VALIDAS.includes(periodicidad)) {
    return NextResponse.json({ error: 'Periodicidad no válida' }, { status: 400 })
  }
  if (!Number.isFinite(meta) || meta <= 0) {
    return NextResponse.json({ error: 'La meta debe ser un número mayor que 0' }, { status: 400 })
  }
  if (!unidad) return NextResponse.json({ error: 'La unidad es obligatoria' }, { status: 400 })
  if (!fechaInicio || Number.isNaN(new Date(fechaInicio).getTime())) {
    return NextResponse.json({ error: 'Fecha de inicio no válida' }, { status: 400 })
  }
  if (fechaFin && new Date(fechaFin).getTime() < new Date(fechaInicio).getTime()) {
    return NextResponse.json({ error: 'La fecha de fin no puede ser anterior a la de inicio' }, { status: 400 })
  }

  try {
    const filasConfig = await getCamposCheckinByEntrenador(email)
    const camposPorId = new Map(resolverCamposEfectivos(filasConfig).map((c) => [c.id, c]))
    const errorFuente = validarFuenteObjetivo(fuenteFieldId, camposPorId)
    if (errorFuente) return NextResponse.json({ error: errorFuente }, { status: 400 })

    const record = await crearObjetivo({
      Nombre: nombre,
      Cliente: [id],
      Cliente_Email: cliente!.fields.Email,
      Periodicidad: periodicidad,
      Meta: meta,
      Unidad: unidad,
      ...(fuenteFieldId ? { Fuente_field_id: fuenteFieldId } : {}),
      Fecha_inicio: fechaInicio,
      ...(fechaFin ? { Fecha_fin: fechaFin } : {}),
      Activo: true,
      Orden: 0,
    })
    return NextResponse.json({ id: record.id }, { status: 201 })
  } catch (err) {
    console.error('Error al crear objetivo', err)
    return NextResponse.json({ error: 'Error al crear el objetivo' }, { status: 500 })
  }
}
