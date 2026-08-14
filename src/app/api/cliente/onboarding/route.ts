import { NextRequest, NextResponse } from 'next/server'
import { getClienteActivoAutenticado } from '@/lib/auth-server'
import { actualizarCliente } from '@/lib/airtable'
import { OnboardingCliente } from '@/lib/types'

const OBJETIVOS_VALIDOS = ['Hipertrofia', 'Pérdida de peso', 'Tonificar', 'Rehabilitación']
const DIAS_VALIDOS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

function mensajeGate(status: 401 | 403 | 404) {
  if (status === 401) return 'No autorizado'
  if (status === 404) return 'No se encontró ningún cliente con este email'
  return 'Tu acceso está desactivado. Contacta con tu entrenador.'
}

export async function GET(request: NextRequest) {
  const gate = await getClienteActivoAutenticado(request)
  if (!gate.ok) {
    return NextResponse.json({ error: mensajeGate(gate.status) }, { status: gate.status })
  }
  const cliente = gate.cliente

  const respuesta: OnboardingCliente = {
    objetivo: cliente.fields.Objetivo ?? '',
    objetivosAdicionales: cliente.fields.Objetivos_adicionales ?? [],
    diasDisponibles: (cliente.fields.Dias_disponibles ?? []) as OnboardingCliente['diasDisponibles'],
    comentario: cliente.fields.Notas_iniciales ?? '',
    // Señal de completado: si ya tiene Objetivo guardado, ya pasó por el onboarding (o
    // venía de alta previa por Tally) — sin campo booleano nuevo, ver DECISIONS.md.
    completado: Boolean(cliente.fields.Objetivo),
  }
  return NextResponse.json(respuesta)
}

export async function PUT(request: NextRequest) {
  const gate = await getClienteActivoAutenticado(request)
  if (!gate.ok) {
    return NextResponse.json({ error: mensajeGate(gate.status) }, { status: gate.status })
  }
  const cliente = gate.cliente

  const body = await request.json().catch(() => null)
  const objetivo = typeof body?.objetivo === 'string' ? body.objetivo.trim() : ''
  const objetivosAdicionales = Array.isArray(body?.objetivosAdicionales)
    ? body.objetivosAdicionales.filter((v: unknown) => typeof v === 'string' && OBJETIVOS_VALIDOS.includes(v))
    : []
  const diasDisponibles = Array.isArray(body?.diasDisponibles)
    ? body.diasDisponibles.filter((v: unknown) => typeof v === 'string' && DIAS_VALIDOS.includes(v))
    : []
  const comentario = typeof body?.comentario === 'string' ? body.comentario.trim() : ''

  if (!objetivo || !OBJETIVOS_VALIDOS.includes(objetivo)) {
    return NextResponse.json({ error: 'Selecciona un objetivo principal válido' }, { status: 400 })
  }

  try {
    const actualizado = await actualizarCliente(cliente.id, {
      Objetivo: objetivo,
      Objetivos_adicionales: objetivosAdicionales.filter((o: string) => o !== objetivo),
      Dias_disponibles: diasDisponibles,
      Notas_iniciales: comentario,
    })
    return NextResponse.json({ success: true, objetivo: actualizado.fields.Objetivo })
  } catch (err) {
    console.error('Error al guardar onboarding de cliente', err)
    return NextResponse.json({ error: 'Error al guardar el onboarding' }, { status: 500 })
  }
}
