import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getClienteById, getObjetivoById, getCamposCheckinByEntrenador, actualizarObjetivo, ObjetivoFields } from '@/lib/airtable'
import { resolverCamposEfectivos } from '@/lib/checkinFields'
import { validarFuenteObjetivo, PeriodicidadObjetivo } from '@/lib/objetivos'

const PERIODICIDADES_VALIDAS: PeriodicidadObjetivo[] = ['diario', 'semanal', 'mensual']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; objetivoId: string }> }
) {
  const email = await getAuthenticatedEmail(request)
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id, objetivoId } = await params
  const cliente = await getClienteById(id)
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (cliente.fields.Entrenador !== email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const objetivo = await getObjetivoById(objetivoId)
  // El objetivo debe pertenecer de verdad al cliente del path, no solo existir — evita que
  // un entrenador edite el objetivo de un cliente ajeno pasando un objetivoId adivinado.
  // Un objetivo eliminado (soft-delete) se trata como inexistente para cualquier mutación:
  // ya no aparece en la UI y no debe poder reactivarse ni editarse vía API manipulada.
  if (!objetivo || !objetivo.fields.Cliente?.includes(id) || objetivo.fields.Eliminado === true) {
    return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const fields: Partial<ObjetivoFields> = {}

  if (typeof body?.nombre === 'string') {
    const nombre = body.nombre.trim()
    if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    fields.Nombre = nombre
  }
  if (typeof body?.periodicidad === 'string') {
    if (!PERIODICIDADES_VALIDAS.includes(body.periodicidad)) {
      return NextResponse.json({ error: 'Periodicidad no válida' }, { status: 400 })
    }
    fields.Periodicidad = body.periodicidad
  }
  if (body?.meta !== undefined) {
    const meta = Number(body.meta)
    if (!Number.isFinite(meta) || meta <= 0) {
      return NextResponse.json({ error: 'La meta debe ser un número mayor que 0' }, { status: 400 })
    }
    fields.Meta = meta
  }
  if (typeof body?.unidad === 'string') {
    const unidad = body.unidad.trim()
    if (!unidad) return NextResponse.json({ error: 'La unidad es obligatoria' }, { status: 400 })
    fields.Unidad = unidad
  }
  if ('fuenteFieldId' in (body ?? {})) {
    fields.Fuente_field_id = typeof body.fuenteFieldId === 'string' && body.fuenteFieldId ? body.fuenteFieldId : null
  }
  if (typeof body?.fechaInicio === 'string') {
    if (Number.isNaN(new Date(body.fechaInicio).getTime())) {
      return NextResponse.json({ error: 'Fecha de inicio no válida' }, { status: 400 })
    }
    fields.Fecha_inicio = body.fechaInicio
  }
  if ('fechaFin' in (body ?? {})) {
    fields.Fecha_fin = typeof body.fechaFin === 'string' && body.fechaFin ? body.fechaFin : null
  }
  if (typeof body?.activo === 'boolean') {
    fields.Activo = body.activo
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const fuenteFinal = 'Fuente_field_id' in fields ? fields.Fuente_field_id || null : (objetivo.fields.Fuente_field_id ?? null)
  if (fuenteFinal) {
    try {
      const filasConfig = await getCamposCheckinByEntrenador(email)
      const camposPorId = new Map(resolverCamposEfectivos(filasConfig).map((c) => [c.id, c]))
      const errorFuente = validarFuenteObjetivo(fuenteFinal, camposPorId)
      if (errorFuente) return NextResponse.json({ error: errorFuente }, { status: 400 })
    } catch (err) {
      console.error('Error al validar fuente de objetivo', err)
      return NextResponse.json({ error: 'Error al validar la fuente del objetivo' }, { status: 500 })
    }
  }

  try {
    await actualizarObjetivo(objetivoId, fields)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al actualizar objetivo', err)
    return NextResponse.json({ error: 'Error al actualizar el objetivo' }, { status: 500 })
  }
}

// Soft-delete (Parte 1.5.3, ver DECISIONS.md): nunca borra la fila de Airtable — el
// historial de Registros_checkin no depende del objetivo para reconstruir progreso (se
// agrega por Field_id, ver objetivos.ts), pero conservar la fila del objetivo en sí
// permite auditoría. `Eliminado=true` + `Activo=false` para que, aunque algún flujo
// futuro olvide filtrar por Eliminado, tampoco lo trate como activo.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; objetivoId: string }> }
) {
  const email = await getAuthenticatedEmail(request)
  if (!email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id, objetivoId } = await params
  const cliente = await getClienteById(id)
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (cliente.fields.Entrenador !== email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const objetivo = await getObjetivoById(objetivoId)
  if (!objetivo || !objetivo.fields.Cliente?.includes(id) || objetivo.fields.Eliminado === true) {
    return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 })
  }

  try {
    await actualizarObjetivo(objetivoId, { Eliminado: true, Activo: false })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar objetivo', err)
    return NextResponse.json({ error: 'Error al eliminar el objetivo' }, { status: 500 })
  }
}
