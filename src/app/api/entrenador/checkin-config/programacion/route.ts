import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedEmail } from '@/lib/auth-server'
import { getEntrenadorByEmail, getCheckinTiposByEntrenador, upsertCheckinTipo } from '@/lib/airtable'
import { resolverProgramacionTipo, FrecuenciaCheckin, DiaSemana, ModoPeriodico } from '@/lib/checkinFields'

const TIPOS: FrecuenciaCheckin[] = ['diario', 'semanal', 'periodico']
const DIAS_SEMANA: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const MODOS_PERIODICO: ModoPeriodico[] = ['intervalo', 'dia_mes']

// Programación propia de cada tipo de check-in (Parte 1.5): día de la semana para
// semanal; modo (intervalo de días o día concreto del mes) para periódico. Diario no
// tiene programación propia — se abre todos los días, solo depende del lanzamiento.
export async function PUT(request: NextRequest) {
  const email = await getAuthenticatedEmail(request)
  if (!email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const entrenador = await getEntrenadorByEmail(email)
  if (!entrenador) {
    return NextResponse.json({ error: 'Solo un entrenador puede configurar el check-in' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const tipo = body?.tipo as FrecuenciaCheckin
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: 'tipo debe ser diario, semanal o periodico' }, { status: 400 })
  }

  const fields: Record<string, unknown> = {}

  if (tipo === 'semanal') {
    const diaSemana = body?.diaSemana as DiaSemana
    if (!DIAS_SEMANA.includes(diaSemana)) {
      return NextResponse.json({ error: 'diaSemana inválido' }, { status: 400 })
    }
    fields.Dia_semana = diaSemana
  }

  if (tipo === 'periodico') {
    const modoPeriodico = body?.modoPeriodico as ModoPeriodico
    if (!MODOS_PERIODICO.includes(modoPeriodico)) {
      return NextResponse.json({ error: 'modoPeriodico debe ser intervalo o dia_mes' }, { status: 400 })
    }
    fields.Modo_periodico = modoPeriodico
    if (modoPeriodico === 'intervalo') {
      const fechaInicio = body?.fechaInicioPeriodico
      const intervaloDias = Number(body?.intervaloDiasPeriodico)
      if (typeof fechaInicio !== 'string' || Number.isNaN(new Date(fechaInicio).getTime())) {
        return NextResponse.json({ error: 'fechaInicioPeriodico debe ser una fecha válida' }, { status: 400 })
      }
      if (!Number.isFinite(intervaloDias) || intervaloDias <= 0) {
        return NextResponse.json({ error: 'intervaloDiasPeriodico debe ser un número mayor que 0' }, { status: 400 })
      }
      fields.Fecha_inicio_periodico = fechaInicio
      fields.Intervalo_dias_periodico = intervaloDias
    } else {
      const diaMes = Number(body?.diaMesPeriodico)
      if (!Number.isFinite(diaMes) || diaMes < 1 || diaMes > 31) {
        return NextResponse.json({ error: 'diaMesPeriodico debe estar entre 1 y 31' }, { status: 400 })
      }
      fields.Dia_mes_periodico = diaMes
    }
  }

  try {
    await upsertCheckinTipo(email, tipo, fields)
    const filasTipos = await getCheckinTiposByEntrenador(email)
    const filaTipo = filasTipos.find((f) => f.fields.Tipo === tipo)
    const programacion = resolverProgramacionTipo(filaTipo?.fields, entrenador.fields.Checkin_disponible_desde)
    return NextResponse.json({ tipo, ...programacion })
  } catch (err) {
    console.error('Error al actualizar la programación del check-in', err)
    return NextResponse.json({ error: 'Error al actualizar la programación' }, { status: 500 })
  }
}
