'use client'

import { useState } from 'react'
import { CampoCheckinResuelto, CheckinConfigResponse } from '@/lib/types'
import CampoPersonalizadoModal from './CampoPersonalizadoModal'
import LanzamientoCheckin from './LanzamientoCheckin'
import ProgramacionTipo from './ProgramacionTipo'

const TIPOS: { value: 'diario' | 'semanal' | 'periodico'; label: string }[] = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'periodico', label: 'Periódico' },
]

export default function CheckinConfigView({
  token,
  configInicial,
}: {
  token: string
  configInicial: CheckinConfigResponse
}) {
  const [campos, setCampos] = useState(configInicial.campos)
  const [programacion] = useState(configInicial.programacion)
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

  function toggleTipo(campo: CampoCheckinResuelto, tipo: 'diario' | 'semanal' | 'periodico', activo: boolean) {
    const tipos = activo ? [...campo.tipos, tipo] : campo.tipos.filter((t) => t !== tipo)
    actualizarCampo(campo.id, { tipos })
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
          campos: campos.map((c) => ({ fieldId: c.id, activo: c.activo, orden: c.orden, tipos: c.tipos })),
        }),
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      const data: CheckinConfigResponse = await res.json()
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
      const data: CheckinConfigResponse = await res.json()
      setCampos(data.campos)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-3 text-lg font-semibold text-card-foreground">Programación por tipo de check-in</h1>
        <div className="grid gap-4 sm:grid-cols-3">
          {TIPOS.map((t) => (
            <div key={t.value} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-card-foreground">{t.label}</h2>
              <LanzamientoCheckin
                token={token}
                tipo={t.value}
                lanzadoInicial={programacion[t.value].lanzado}
                disponibleDesdeInicial={programacion[t.value].disponibleDesde}
              />
              {t.value !== 'diario' && <ProgramacionTipo token={token} tipo={t.value} programacionInicial={programacion[t.value]} />}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-card-foreground">Campos del check-in</h1>
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

              <div className="flex gap-3 text-xs text-card-foreground">
                {TIPOS.map((t) => (
                  <label key={t.value} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={campo.tipos.includes(t.value)}
                      onChange={(e) => toggleTipo(campo, t.value, e.target.checked)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>

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
