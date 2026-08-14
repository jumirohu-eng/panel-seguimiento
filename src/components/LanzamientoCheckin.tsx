'use client'

import { useState } from 'react'

function formatFechaLarga(fechaISO: string) {
  return new Date(fechaISO).toLocaleString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Controla el lanzamiento de UN tipo de check-in (diario/semanal/periódico). Los tres son
// independientes desde Parte 1.5 — cada uno tiene su propio estado borrador/programado/activo.
export default function LanzamientoCheckin({
  token,
  tipo,
  lanzadoInicial,
  disponibleDesdeInicial,
}: {
  token: string
  tipo: 'diario' | 'semanal' | 'periodico'
  lanzadoInicial: boolean
  disponibleDesdeInicial: string | null
}) {
  const [lanzado, setLanzado] = useState(lanzadoInicial)
  const [disponibleDesde, setDisponibleDesde] = useState(disponibleDesdeInicial)
  const [fechaProgramada, setFechaProgramada] = useState('')
  const [guardando, setGuardando] = useState<'lanzar' | 'programar' | 'borrador' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function actualizar(fecha: string | null, accion: 'lanzar' | 'programar' | 'borrador') {
    setGuardando(accion)
    setError(null)
    try {
      const res = await fetch('/api/entrenador/checkin-config/lanzamiento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tipo, fecha }),
      })
      if (!res.ok) throw new Error('No se pudo actualizar')
      const data: { lanzado: boolean; disponibleDesde: string | null } = await res.json()
      setLanzado(data.lanzado)
      setDisponibleDesde(data.disponibleDesde)
      setFechaProgramada('')
    } catch {
      setError('Error al actualizar el lanzamiento. Inténtalo de nuevo.')
    } finally {
      setGuardando(null)
    }
  }

  const programado = !lanzado && disponibleDesde !== null

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {lanzado ? (
          <>
            <span className="font-medium text-success">● Activo</span> — tus clientes lo ven desde el{' '}
            {disponibleDesde && formatFechaLarga(disponibleDesde)}
          </>
        ) : programado ? (
          <>
            <span className="font-medium text-warning">● Programado</span> — se abrirá solo el{' '}
            {disponibleDesde && formatFechaLarga(disponibleDesde)}
          </>
        ) : (
          <>
            <span className="font-medium text-muted">● Borrador</span> — tus clientes todavía no lo ven
          </>
        )}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={() => actualizar(new Date().toISOString(), 'lanzar')}
          disabled={guardando !== null}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {guardando === 'lanzar' ? 'Lanzando…' : lanzado ? 'Ya está activo' : 'Lanzar ahora'}
        </button>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Programar apertura</label>
          <div className="flex flex-col items-start gap-2">
            <input
              type="datetime-local"
              value={fechaProgramada}
              onChange={(e) => setFechaProgramada(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-card-foreground"
            />
            <button
              type="button"
              onClick={() => fechaProgramada && actualizar(new Date(fechaProgramada).toISOString(), 'programar')}
              disabled={guardando !== null || !fechaProgramada}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background disabled:opacity-50"
            >
              {guardando === 'programar' ? 'Programando…' : 'Programar'}
            </button>
          </div>
        </div>

        {(lanzado || programado) && (
          <button
            type="button"
            onClick={() => actualizar(null, 'borrador')}
            disabled={guardando !== null}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:bg-background disabled:opacity-50"
          >
            {guardando === 'borrador' ? 'Guardando…' : 'Volver a borrador'}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  )
}
