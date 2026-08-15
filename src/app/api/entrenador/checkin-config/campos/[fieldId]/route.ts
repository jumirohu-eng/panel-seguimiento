import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import {
  getEntrenadorByEmail,
  getCamposCheckinByEntrenador,
  actualizarCampoCheckin,
  crearCampoCheckin,
  borrarCampoCheckin,
  getCheckinTiposByEntrenador,
} from '@/lib/airtable'
import { resolverCamposEfectivos, resolverProgramacionTipo, CAMPOS_ESTANDAR_POR_ID } from '@/lib/checkinFields'
import { CheckinConfigResponse } from '@/lib/types'

async function construirRespuesta(email: string, disponibleDesdeLegacy: string | null | undefined): Promise<CheckinConfigResponse> {
  const [filasConfig, filasTipos] = await Promise.all([
    getCamposCheckinByEntrenador(email),
    getCheckinTiposByEntrenador(email),
  ])
  const campos = resolverCamposEfectivos(filasConfig)
  const filaPorTipo = new Map(filasTipos.map((f) => [f.fields.Tipo, f.fields]))
  return {
    campos,
    programacion: {
      diario: resolverProgramacionTipo(filaPorTipo.get('diario'), disponibleDesdeLegacy),
      semanal: resolverProgramacionTipo(filaPorTipo.get('semanal'), disponibleDesdeLegacy),
      periodico: resolverProgramacionTipo(filaPorTipo.get('periodico'), disponibleDesdeLegacy),
    },
  }
}

// "Eliminar" una revisión: para un campo PERSONALIZADO no hay fallback en código, así que
// se borra la fila de verdad — desaparece del catálogo del entrenador. Para un campo
// ESTÁNDAR (peso, energía, entrenamiento_realizado...) no existe forma de borrarlo del
// catálogo (vive en CAMPOS_ESTANDAR, en el código) — "eliminar" aquí significa desactivarlo
// de forma duradera (Activo=false), creando el override si todavía no existía, para que
// quede fuera de las pantallas de revisión igual que si se hubiera borrado de verdad.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ fieldId: string }> }) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const entrenador = await getEntrenadorByEmail(email)
  if (!entrenador) {
    return NextResponse.json({ error: 'Solo un entrenador puede eliminar campos de check-in' }, { status: 403 })
  }

  const { fieldId } = await params

  try {
    const filasExistentes = await getCamposCheckinByEntrenador(email)
    const filaExistente = filasExistentes.find((f) => f.fields.Field_id === fieldId)
    const esEstandar = CAMPOS_ESTANDAR_POR_ID.has(fieldId)

    if (esEstandar) {
      const def = CAMPOS_ESTANDAR_POR_ID.get(fieldId)!
      if (filaExistente) {
        await actualizarCampoCheckin(filaExistente.id, { Activo: false })
      } else {
        await crearCampoCheckin({
          Nombre: def.nombre,
          Field_id: def.id,
          Entrenador: email,
          Tipo: def.tipo === 'dolor' ? 'seleccion' : def.tipo,
          Categoria: def.categoria,
          Unidad: def.unidad,
          Opciones: def.opciones ? JSON.stringify(def.opciones) : undefined,
          Tipos: [],
          Activo: false,
          Orden: def.ordenDefault,
          Es_estandar: true,
        })
      }
    } else {
      if (!filaExistente) {
        return NextResponse.json({ error: 'Campo no encontrado' }, { status: 404 })
      }
      await borrarCampoCheckin(filaExistente.id)
    }

    const response = await construirRespuesta(email, entrenador.fields.Checkin_disponible_desde)
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error al eliminar el campo de check-in', err)
    return NextResponse.json({ error: 'Error al eliminar el campo' }, { status: 500 })
  }
}
