'use client'

import { useState } from 'react'
import { CampoCheckinResuelto } from '@/lib/types'
import CampoPersonalizadoModal from './CampoPersonalizadoModal'
import LanzamientoCheckin from './LanzamientoCheckin'

const FRECUENCIAS = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'periodico', label: 'Periódico' },
] as const

export default function CheckinConfigView({
  token,
  camposIniciales,
  lanzadoInicial,
  disponibleDesdeInicial,
}: {
  token: string
  camposIniciales: CampoCheckinResuelto[]
  lanzadoInicial: boolean
  disponibleDesdeInicial: string | null
}) {
  const [campos, setCampos] = useState(camposIniciales)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mostrarModal, setMostrarModal] = useState(false)

  function moverCampo(index: number, direccion: -1 | 1) {
    setCampos((prev) => {
      const destino = index + direccion
      if (destino < 0 || destino >= prev.length) return prev
      const copia = [...prev]
      ;[copia[index], copia[destino]] = [copia[destino], copia[index]]
      return copia.map((c, i) => ({ ...c, orden: i }))
    })
  }

  function actualizarCampo(id: string, cambios: Partial<CampoCheckinResuelto>) {
    setCampos((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
  }

  async function guardar() {
    setGuardando(true)
    setGuardadoOk(false)
    setError(null)
    try {
      const res = await fetch('/api/entrenador/checkin-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campos: campos.map((c) => ({ fieldId: c.id, activo: c.activo, orden: c.orden, frecuencia: c.frecuencia })),
        }),
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      const data: { campos: CampoCheckinResuelto[] } = await res.json()
      setCampos(data.campos)
      setGuardadoOk(true)
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function recargarTrasCrear() {
    const res = await fetch('/api/entrenador/checkin-config', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data: { campos: CampoCheckinResuelto[] } = await res.json()
      setCampos(data.campos)
    }
  }

  return (
    <div>
      <LanzamientoCheckin token={token} lanzadoInicial={lanzadoInicial} disponibleDesdeInicial={disponibleDesdeInicial} />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-card-foreground">Configurar check-in</h1>
        <button
          type="button"
          onClick={() => setMostrarModal(true)}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
        >
          + Añadir campo personalizado
        </button>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {campos.map((campo, index) => (
          <div key={campo.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => moverCampo(index, -1)}
                disabled={index === 0}
                className="text-xs text-muted hover:text-card-foreground disabled:opacity-30"
                aria-label="Subir"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moverCampo(index, 1)}
                disabled={index === campos.length - 1}
                className="text-xs text-muted hover:text-card-foreground disabled:opacity-30"
                aria-label="Bajar"
              >
                ▼
              </button>
            </div>

            <div className="min-w-[10rem] flex-1">
              <p className="text-sm font-medium text-card-foreground">{campo.nombre}</p>
              <p className="text-xs text-muted">
                {campo.tipo} · {campo.categoria} {campo.esEstandar ? '' : '· personalizado'}
              </p>
            </div>

            <select
              value={campo.frecuencia}
              onChange={(e) => actualizarCampo(campo.id, { frecuencia: e.target.value as CampoCheckinResuelto['frecuencia'] })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-card-foreground"
            >
              {FRECUENCIAS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => actualizarCampo(campo.id, { activo: !campo.activo })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                campo.activo ? 'bg-primary text-white' : 'bg-background text-muted'
              }`}
            >
              {campo.activo ? 'Activo' : 'Inactivo'}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : guardadoOk ? '✓ Guardado' : 'Guardar cambios'}
      </button>

      {mostrarModal && (
        <CampoPersonalizadoModal token={token} onClose={() => setMostrarModal(false)} onCreated={recargarTrasCrear} />
      )}
      </div>
    </div>
  )
}
