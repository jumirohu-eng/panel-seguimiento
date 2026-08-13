import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getCamposCheckinByEntrenador, crearCampoCheckin, getEntrenadorByEmail, getCheckinTiposByEntrenador } from '@/lib/airtable'
import { generarFieldIdPersonalizado, resolverCamposEfectivos, resolverProgramacionTipo, TipoCampoCheckin, FrecuenciaCheckin } from '@/lib/checkinFields'
import { CheckinConfigResponse } from '@/lib/types'

// 'dolor' es exclusivo de campos estándar (compuesto nivel+zona) — un entrenador nunca
// puede crear un campo personalizado de ese tipo, ver DECISIONS.md.
const TIPOS_VALIDOS: TipoCampoCheckin[] = ['escala', 'si_no', 'numero', 'texto', 'seleccion', 'seleccion_multiple']
const TIPOS_CHECKIN_VALIDOS: FrecuenciaCheckin[] = ['diario', 'semanal', 'periodico']

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
  const tipos: FrecuenciaCheckin[] = Array.isArray(body?.tipos)
    ? body.tipos.filter((t: unknown): t is FrecuenciaCheckin => TIPOS_CHECKIN_VALIDOS.includes(t as FrecuenciaCheckin))
    : []
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
  if (tipos.length === 0) {
    return NextResponse.json({ error: 'Selecciona al menos un tipo de check-in (diario/semanal/periódico)' }, { status: 400 })
  }
  if ((tipo === 'seleccion' || tipo === 'seleccion_multiple') && (!opciones || opciones.length < 2)) {
    return NextResponse.json({ error: 'Un campo de selección necesita al menos 2 opciones' }, { status: 400 })
  }

  try {
    const filasExistentes = await getCamposCheckinByEntrenador(email)
    const orden = filasExistentes.reduce((max, f) => Math.max(max, f.fields.Orden ?? 0), 9) + 1

    await crearCampoCheckin({
      Nombre: nombre,
      Field_id: generarFieldIdPersonalizado(nombre),
      Entrenador: email,
      Tipo: tipo,
      Categoria: categoria,
      Unidad: unidad,
      Opciones: opciones ? JSON.stringify(opciones) : undefined,
      Tipos: tipos,
      Activo: true,
      Orden: orden,
      Es_estandar: false,
    })

    const [filasActualizadas, filasTipos] = await Promise.all([
      getCamposCheckinByEntrenador(email),
      getCheckinTiposByEntrenador(email),
    ])
    const campos = resolverCamposEfectivos(filasActualizadas)
    const filaPorTipo = new Map(filasTipos.map((f) => [f.fields.Tipo, f.fields]))
    const disponibleDesdeLegacy = entrenador.fields.Checkin_disponible_desde
    const response: CheckinConfigResponse = {
      campos,
      programacion: {
        diario: resolverProgramacionTipo(filaPorTipo.get('diario'), disponibleDesdeLegacy),
        semanal: resolverProgramacionTipo(filaPorTipo.get('semanal'), disponibleDesdeLegacy),
        periodico: resolverProgramacionTipo(filaPorTipo.get('periodico'), disponibleDesdeLegacy),
      },
    }
    return NextResponse.json(response, { status: 201 })
  } catch (err) {
    console.error('Error al crear campo personalizado de check-in', err)
    return NextResponse.json({ error: 'Error al crear el campo' }, { status: 500 })
  }
}
