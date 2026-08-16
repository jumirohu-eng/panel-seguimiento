import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import {
  getClienteById,
  getObjetivoById,
  getCamposCheckinByEntrenador,
  actualizarObjetivo,
  resolverOCrearCampoCheckinParaObjetivo,
  ObjetivoFields,
} from '@/lib/airtable'
import { resolverCamposEfectivos } from '@/lib/checkinFields'
import {
  validarFuenteObjetivo,
  validarConfiguracionProgreso,
  PeriodicidadObjetivo,
  ModoProgresoObjetivo,
  DireccionObjetivo,
} from '@/lib/objetivos'

const PERIODICIDADES_VALIDAS: PeriodicidadObjetivo[] = ['diario', 'semanal', 'mensual']
const MODOS_PROGRESO_VALIDOS: ModoProgresoObjetivo[] = ['acumulado', 'valor_objetivo']

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
  if ('periodicidad' in (body ?? {})) {
    // null explícito = "sin frecuencia fija" (ver DECISIONS.md, "Objetivos avanzados sin
    // frecuencia") — validarConfiguracionProgreso() decide más abajo si la combinación final
    // (con el modo de progreso resultante) es válida.
    if (body.periodicidad === null) {
      fields.Periodicidad = null
    } else if (!PERIODICIDADES_VALIDAS.includes(body.periodicidad)) {
      return NextResponse.json({ error: 'Periodicidad no válida' }, { status: 400 })
    } else {
      fields.Periodicidad = body.periodicidad
    }
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
  const fuenteNuevaRaw = body?.fuenteNueva
  const fuenteNueva =
    fuenteNuevaRaw && typeof fuenteNuevaRaw === 'object'
      ? {
          nombre: typeof fuenteNuevaRaw.nombre === 'string' ? fuenteNuevaRaw.nombre.trim() : '',
          tipo: fuenteNuevaRaw.tipo as 'si_no' | 'numero',
          unidad: typeof fuenteNuevaRaw.unidad === 'string' ? fuenteNuevaRaw.unidad.trim() : undefined,
        }
      : null
  if ('fuenteFieldId' in (body ?? {}) && fuenteNueva) {
    return NextResponse.json({ error: 'Indica una fuente existente o una métrica nueva, no ambas' }, { status: 400 })
  }
  if (fuenteNueva) {
    if (!fuenteNueva.nombre) return NextResponse.json({ error: 'El nombre de la métrica nueva es obligatorio' }, { status: 400 })
    if (fuenteNueva.tipo !== 'si_no' && fuenteNueva.tipo !== 'numero') {
      return NextResponse.json({ error: 'El tipo de la métrica nueva debe ser sí/no o número' }, { status: 400 })
    }
  } else if ('fuenteFieldId' in (body ?? {})) {
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
  if ('modoProgreso' in (body ?? {})) {
    if (!MODOS_PROGRESO_VALIDOS.includes(body.modoProgreso)) {
      return NextResponse.json({ error: 'Modo de progreso no válido' }, { status: 400 })
    }
    fields.Modo_progreso = body.modoProgreso
  }
  if ('direccion' in (body ?? {})) {
    fields.Direccion = body.direccion === 'subir' || body.direccion === 'bajar' ? body.direccion : null
  }
  if ('valorInicial' in (body ?? {})) {
    const v = body.valorInicial === null ? null : Number(body.valorInicial)
    if (v !== null && !Number.isFinite(v)) {
      return NextResponse.json({ error: 'El valor inicial debe ser un número' }, { status: 400 })
    }
    fields.Valor_inicial = v
  }

  if (Object.keys(fields).length === 0 && !fuenteNueva) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  try {
    const filasConfig = await getCamposCheckinByEntrenador(email)
    const camposPorId = new Map(resolverCamposEfectivos(filasConfig).map((c) => [c.id, c]))

    if (fuenteNueva) {
      fields.Fuente_field_id = await resolverOCrearCampoCheckinParaObjetivo(email, fuenteNueva.nombre, fuenteNueva.tipo, fuenteNueva.unidad)
    } else if ('Fuente_field_id' in fields && fields.Fuente_field_id) {
      const errorFuente = validarFuenteObjetivo(fields.Fuente_field_id, camposPorId)
      if (errorFuente) return NextResponse.json({ error: errorFuente }, { status: 400 })
    }

    // Estado final tras aplicar los cambios sobre el objetivo existente — para validar
    // la coherencia modo/dirección/valor-inicial/fuente en conjunto, no campo a campo.
    const fuenteFinalId = 'Fuente_field_id' in fields ? (fields.Fuente_field_id ?? null) : (objetivo.fields.Fuente_field_id ?? null)
    const fuenteFinalTipo = fuenteNueva
      ? fuenteNueva.tipo
      : (() => {
          const c = fuenteFinalId ? camposPorId.get(fuenteFinalId) : undefined
          return c?.tipo === 'si_no' || c?.tipo === 'numero' ? c.tipo : null
        })()
    const modoFinal: ModoProgresoObjetivo =
      'Modo_progreso' in fields ? (fields.Modo_progreso as ModoProgresoObjetivo) : objetivo.fields.Modo_progreso === 'valor_objetivo' ? 'valor_objetivo' : 'acumulado'
    const direccionFinal: DireccionObjetivo | null = 'Direccion' in fields ? (fields.Direccion ?? null) : (objetivo.fields.Direccion ?? null)
    const valorInicialFinal: number | null =
      'Valor_inicial' in fields ? (fields.Valor_inicial ?? null) : (typeof objetivo.fields.Valor_inicial === 'number' ? objetivo.fields.Valor_inicial : null)
    const periodicidadFinal: PeriodicidadObjetivo | null =
      'Periodicidad' in fields ? (fields.Periodicidad ?? null) : (objetivo.fields.Periodicidad ?? null)

    const errorModo = validarConfiguracionProgreso(modoFinal, direccionFinal, valorInicialFinal, fuenteFinalTipo, periodicidadFinal)
    if (errorModo) return NextResponse.json({ error: errorModo }, { status: 400 })

    await actualizarObjetivo(objetivoId, fields)
    return NextResponse.json({ ok: true, fuenteFieldId: fuenteFinalId })
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
