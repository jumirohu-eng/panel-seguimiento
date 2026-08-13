import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import {
  getCamposCheckinByEntrenador,
  actualizarCampoCheckin,
  crearCampoCheckin,
  getEntrenadorByEmail,
  getCheckinTiposByEntrenador,
} from '@/lib/airtable'
import {
  resolverCamposEfectivos,
  resolverProgramacionTipo,
  CAMPOS_ESTANDAR_POR_ID,
  FrecuenciaCheckin,
} from '@/lib/checkinFields'
import { CheckinConfigResponse } from '@/lib/types'

const TIPOS: FrecuenciaCheckin[] = ['diario', 'semanal', 'periodico']

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

export async function GET(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const entrenador = await getEntrenadorByEmail(email)
    const response = await construirRespuesta(email, entrenador?.fields.Checkin_disponible_desde)
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error al obtener configuración de check-in', err)
    return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })
  }
}

interface ActualizacionCampo {
  fieldId: string
  activo: boolean
  orden: number
  tipos: FrecuenciaCheckin[]
}

export async function PUT(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Configurar el check-in es una capacidad de entrenador, mismo criterio que
  // POST /api/clientes (ver DEC-2026-004): autenticación no equivale a autorización.
  const entrenador = await getEntrenadorByEmail(email)
  if (!entrenador) {
    return NextResponse.json({ error: 'Solo un entrenador puede configurar el check-in' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const actualizaciones: ActualizacionCampo[] = Array.isArray(body?.campos) ? body.campos : []
  if (actualizaciones.length === 0) {
    return NextResponse.json({ error: 'Falta el array de campos a actualizar' }, { status: 400 })
  }

  try {
    const filasExistentes = await getCamposCheckinByEntrenador(email)
    const filaPorFieldId = new Map(filasExistentes.map((f) => [f.fields.Field_id, f]))

    for (const act of actualizaciones) {
      if (typeof act.fieldId !== 'string') continue
      const tipos = Array.isArray(act.tipos) ? act.tipos.filter((t) => TIPOS.includes(t)) : []
      const filaExistente = filaPorFieldId.get(act.fieldId)
      const esEstandar = CAMPOS_ESTANDAR_POR_ID.has(act.fieldId)

      if (filaExistente) {
        await actualizarCampoCheckin(filaExistente.id, {
          Activo: act.activo,
          Orden: act.orden,
          Tipos: tipos,
        })
      } else if (esEstandar) {
        // Primera vez que este entrenador personaliza un campo estándar: crea el override.
        const def = CAMPOS_ESTANDAR_POR_ID.get(act.fieldId)!
        await crearCampoCheckin({
          Nombre: def.nombre,
          Field_id: def.id,
          Entrenador: email,
          // 'dolor' no es una choice del singleSelect Tipo en Airtable (solo se usa para
          // campos personalizados, que nunca ofrecen 'dolor' como opción, ver
          // CampoPersonalizadoModal). Para overrides estándar este campo nunca se relee
          // (resolverCamposEfectivos siempre usa CAMPOS_ESTANDAR para el tipo real) —
          // 'seleccion' es solo un placeholder inofensivo para no romper el write.
          Tipo: def.tipo === 'dolor' ? 'seleccion' : def.tipo,
          Categoria: def.categoria,
          Unidad: def.unidad,
          Opciones: def.opciones ? JSON.stringify(def.opciones) : undefined,
          Tipos: tipos,
          Activo: act.activo,
          Orden: act.orden,
          Es_estandar: true,
        })
      }
      // Si no es estándar y no existe fila, es un fieldId de un campo personalizado
      // desconocido (no debería pasar desde la UI) — se ignora en vez de fallar todo el guardado.
    }

    const response = await construirRespuesta(email, entrenador.fields.Checkin_disponible_desde)
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error al guardar configuración de check-in', err)
    return NextResponse.json({ error: 'Error al guardar la configuración' }, { status: 500 })
  }
}
