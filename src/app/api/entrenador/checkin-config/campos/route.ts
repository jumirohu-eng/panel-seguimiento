import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getCamposCheckinByEntrenador, crearCampoCheckin, getEntrenadorByEmail } from '@/lib/airtable'
import { generarFieldIdPersonalizado, resolverCamposEfectivos, resolverLanzamiento, TipoCampoCheckin, FrecuenciaCheckin } from '@/lib/checkinFields'
import { CheckinConfigResponse } from '@/lib/types'

const TIPOS_VALIDOS: TipoCampoCheckin[] = ['escala', 'si_no', 'numero', 'texto', 'seleccion', 'seleccion_multiple']
const FRECUENCIAS_VALIDAS: FrecuenciaCheckin[] = ['diario', 'semanal', 'periodico']

export async function POST(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const entrenador = await getEntrenadorByEmail(email)
  if (!entrenador) {
    return NextResponse.json({ error: 'Solo un entrenador puede crear campos personalizados' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const tipo = body?.tipo as TipoCampoCheckin
  const categoria = typeof body?.categoria === 'string' ? body.categoria.trim() : 'personalizado'
  const frecuencia = body?.frecuencia as FrecuenciaCheckin
  const unidad = typeof body?.unidad === 'string' ? body.unidad.trim() : undefined
  const opciones = Array.isArray(body?.opciones)
    ? body.opciones.filter((o: unknown) => typeof o === 'string' && o.trim().length > 0)
    : undefined

  if (!nombre) {
    return NextResponse.json({ error: 'Falta el nombre del campo' }, { status: 400 })
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: 'Tipo de campo inválido' }, { status: 400 })
  }
  if (!FRECUENCIAS_VALIDAS.includes(frecuencia)) {
    return NextResponse.json({ error: 'Frecuencia inválida' }, { status: 400 })
  }
  if ((tipo === 'seleccion' || tipo === 'seleccion_multiple') && (!opciones || opciones.length < 2)) {
    return NextResponse.json({ error: 'Un campo de selección necesita al menos 2 opciones' }, { status: 400 })
  }

  try {
    const filasExistentes = await getCamposCheckinByEntrenador(email)
    const orden = filasExistentes.reduce((max, f) => Math.max(max, f.fields.Orden ?? 0), 11) + 1

    await crearCampoCheckin({
      Nombre: nombre,
      Field_id: generarFieldIdPersonalizado(nombre),
      Entrenador: email,
      Tipo: tipo,
      Categoria: categoria,
      Unidad: unidad,
      Opciones: opciones ? JSON.stringify(opciones) : undefined,
      Frecuencia: frecuencia,
      Activo: true,
      Orden: orden,
      Es_estandar: false,
    })

    const filasActualizadas = await getCamposCheckinByEntrenador(email)
    const campos = resolverCamposEfectivos(filasActualizadas)
    const { lanzado, disponibleDesde } = resolverLanzamiento(entrenador.fields.Checkin_disponible_desde)
    const response: CheckinConfigResponse = { campos, lanzado, disponibleDesde }
    return NextResponse.json(response, { status: 201 })
  } catch (err) {
    console.error('Error al crear campo personalizado de check-in', err)
    return NextResponse.json({ error: 'Error al crear el campo' }, { status: 500 })
  }
}
