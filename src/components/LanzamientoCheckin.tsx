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

export default function LanzamientoCheckin({
  token,
  lanzadoInicial,
  disponibleDesdeInicial,
}: {
  token: string
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
        body: JSON.stringify({ fecha }),
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
    <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-card-foreground">Lanzamiento</h2>
      <p className="mb-4 text-sm text-muted">
        {lanzado ? (
          <>
            <span className="font-medium text-success">● Activo</span> — tus clientes ven el check-in desde el{' '}
            {disponibleDesde && formatFechaLarga(disponibleDesde)}
          </>
        ) : programado ? (
          <>
            <span className="font-medium text-warning">● Programado</span> — se abrirá solo para tus clientes el{' '}
            {disponibleDesde && formatFechaLarga(disponibleDesde)}
          </>
        ) : (
          <>
            <span className="font-medium text-muted">● Borrador</span> — configura los campos y lánzalo cuando estés listo,
            tus clientes todavía no lo ven
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
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={fechaProgramada}
              onChange={(e) => setFechaProgramada(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-card-foreground"
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
