import { NextRequest, NextResponse } from 'next/server'
import { getClienteActivoAutenticado } from '@/lib/auth-server'
import { getCamposCheckinByEntrenador, getCheckinTiposByEntrenador, getObjetivosByClienteEmail, getRegistrosCheckinByClienteEmail } from '@/lib/airtable'
import { resolverCamposEfectivos } from '@/lib/checkinFields'
import { resolverObjetivo } from '@/lib/objetivos'

function mensajeGate(status: 401 | 403 | 404) {
  if (status === 401) return 'No autorizado'
  if (status === 404) return 'No se encontró ningún cliente con este email'
  return 'Tu acceso está desactivado. Contacta con tu entrenador.'
}

// Objetivos vigentes hoy y activos, con progreso del periodo actual — para "Mis objetivos"
// en el dashboard del cliente (Parte 1.5.2, ver DECISIONS.md). Objetivos inactivos o fuera
// de vigencia no se exponen aquí (solo el entrenador los ve/gestiona, en su ficha).
export async function GET(request: NextRequest) {
  const gate = await getClienteActivoAutenticado(request)
  if (!gate.ok) {
    return NextResponse.json({ error: mensajeGate(gate.status) }, { status: gate.status })
  }
  const cliente = gate.cliente

  try {
    const [filasObjetivos, filasConfig, filasTipos, registros] = await Promise.all([
      getObjetivosByClienteEmail(cliente.fields.Email ?? ''),
      getCamposCheckinByEntrenador(cliente.fields.Entrenador),
      getCheckinTiposByEntrenador(cliente.fields.Entrenador),
      getRegistrosCheckinByClienteEmail(cliente.fields.Email ?? ''),
    ])

    const camposPorId = new Map(resolverCamposEfectivos(filasConfig).map((c) => [c.id, c]))
    const diaSemanaCheckin = filasTipos.find((f) => f.fields.Tipo === 'semanal')?.fields.Dia_semana ?? 'lunes'

    const objetivos = filasObjetivos
      .map((r) => resolverObjetivo(r, camposPorId, registros, diaSemanaCheckin))
      .filter((o) => o.activo && o.vigenteHoy)

    return NextResponse.json({ objetivos })
  } catch (err) {
    console.error('Error al obtener objetivos de cliente', err)
    return NextResponse.json({ error: 'Error al obtener los objetivos' }, { status: 500 })
  }
}
