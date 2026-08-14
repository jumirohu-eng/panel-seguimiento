'use client'

import { useState } from 'react'
import { ProgramacionTipoConfig, DiaSemana, ModoPeriodico } from '@/lib/types'
import { describirRecurrencia, proximaAperturaGenerica, ReglaRecurrencia } from '@/lib/checkinFields'
import { formatFechaLarga } from '@/lib/format'

const DIAS_SEMANA: { value: DiaSemana; label: string }[] = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
]

// Programación propia de un tipo de check-in: día de la semana (semanal) o modo
// intervalo/día-del-mes (periódico). Diario no tiene programación propia — se abre todos
// los días, solo depende del lanzamiento (ver LanzamientoCheckin).
export default function ProgramacionTipo({
  token,
  tipo,
  programacionInicial,
}: {
  token: string
  tipo: 'semanal' | 'periodico'
  programacionInicial: ProgramacionTipoConfig
}) {
  const [diaSemana, setDiaSemana] = useState<DiaSemana>(programacionInicial.diaSemana ?? 'lunes')
  const [modoPeriodico, setModoPeriodico] = useState<ModoPeriodico>(programacionInicial.modoPeriodico ?? 'dia_mes')
  const [fechaInicio, setFechaInicio] = useState(programacionInicial.fechaInicioPeriodico ?? '')
  const [intervaloDias, setIntervaloDias] = useState(String(programacionInicial.intervaloDiasPeriodico ?? ''))
  const [diaMes, setDiaMes] = useState(String(programacionInicial.diaMesPeriodico ?? '1'))
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resumen en lenguaje claro de la recurrencia tal como está configurada ahora mismo en
  // el formulario (Parte 1.5.3) — se recalcula con cada cambio, sin esperar a guardar.
  const regla: ReglaRecurrencia = {
    diaSemana,
    modoPeriodico,
    fechaInicioPeriodico: fechaInicio || undefined,
    intervaloDiasPeriodico: Number(intervaloDias) || undefined,
    diaMesPeriodico: Number(diaMes) || undefined,
  }
  const resumen = describirRecurrencia(tipo, regla)
  const proximaApertura = proximaAperturaGenerica(tipo, regla)

  async function guardar() {
    setGuardando(true)
    setGuardadoOk(false)
    setError(null)
    const body: Record<string, unknown> = { tipo }
    if (tipo === 'semanal') {
      body.diaSemana = diaSemana
    } else {
      body.modoPeriodico = modoPeriodico
      if (modoPeriodico === 'intervalo') {
        body.fechaInicioPeriodico = fechaInicio
        body.intervaloDiasPeriodico = Number(intervaloDias)
      } else {
        body.diaMesPeriodico = Number(diaMes)
      }
    }
    try {
      const res = await fetch('/api/entrenador/checkin-config/programacion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      setGuardadoOk(true)
    } catch {
      setError('Error al guardar la programación. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  if (tipo === 'semanal') {
    return (
      <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
        <p className="text-xs text-muted">
          <span className="font-medium text-card-foreground">{resumen}</span>
          {proximaApertura && <> — próxima apertura: {formatFechaLarga(proximaApertura)}</>}
        </p>
        <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Día de la semana</label>
          <select
            value={diaSemana}
            onChange={(e) => setDiaSemana(e.target.value as DiaSemana)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-card-foreground"
          >
            {DIAS_SEMANA.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : guardadoOk ? '✓ Guardado' : 'Guardar día'}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      <p className="text-xs text-muted">
        <span className="font-medium text-card-foreground">{resumen}</span>
        {proximaApertura && <> — próxima apertura: {formatFechaLarga(proximaApertura)}</>}
      </p>
      <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Modo</label>
        <select
          value={modoPeriodico}
          onChange={(e) => setModoPeriodico(e.target.value as ModoPeriodico)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-card-foreground"
        >
          <option value="dia_mes">Día concreto del mes</option>
          <option value="intervalo">Cada X días</option>
        </select>
      </div>

      {modoPeriodico === 'dia_mes' ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Día del mes (1-31)</label>
          <input
            type="number"
            min={1}
            max={31}
            value={diaMes}
            onChange={(e) => setDiaMes(e.target.value)}
            className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-card-foreground"
          />
          <p className="mt-1 text-xs text-muted">En meses más cortos cae al último día válido de ese mes.</p>
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Fecha de inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-card-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Cada cuántos días</label>
            <input
              type="number"
              min={1}
              value={intervaloDias}
              onChange={(e) => setIntervaloDias(e.target.value)}
              className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-card-foreground"
            />
          </div>
        </>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : guardadoOk ? '✓ Guardado' : 'Guardar programación'}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  )
}
