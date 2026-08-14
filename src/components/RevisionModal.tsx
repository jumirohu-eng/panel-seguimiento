'use client'

import { useState } from 'react'
import { ProgramacionTipoConfig } from '@/lib/types'
import { describirRecurrencia, ReglaRecurrencia, FrecuenciaCheckin } from '@/lib/checkinFields'

type Tipo = 'escala' | 'si_no' | 'numero' | 'texto' | 'seleccion' | 'seleccion_multiple'

const TIPOS: { value: Tipo; label: string }[] = [
  { value: 'escala', label: 'Escala del 1 al 5' },
  { value: 'si_no', label: 'Sí / No' },
  { value: 'numero', label: 'Número' },
  { value: 'texto', label: 'Texto libre' },
  { value: 'seleccion', label: 'Una opción entre varias' },
  { value: 'seleccion_multiple', label: 'Varias opciones a la vez' },
]

const TIPOS_CHECKIN: FrecuenciaCheckin[] = ['diario', 'semanal', 'periodico']

// Modal para "+ Añadir revisión" en la ficha del cliente (Parte UX). Mismo endpoint que
// CampoPersonalizadoModal.tsx (POST /api/entrenador/checkin-config/campos) — se deja ese
// componente intacto para no arriesgar la pantalla avanzada /checkin-config, y este modal
// da la versión en lenguaje humano: sin Field_id, sin "campo del check-in", y la
// periodicidad se expresa con describirRecurrencia() usando la programación ya configurada
// por el entrenador, en vez de checkboxes "Diario/Semanal/Periódico".
export default function RevisionModal({
  token,
  programacion,
  onClose,
  onCreated,
}: {
  token: string
  programacion: Record<FrecuenciaCheckin, ProgramacionTipoConfig>
  onClose: () => void
  onCreated: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<Tipo>('escala')
  const [unidad, setUnidad] = useState('')
  const [cuando, setCuando] = useState<FrecuenciaCheckin[]>(['diario'])
  const [opciones, setOpciones] = useState<string[]>(['', ''])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requiereOpciones = tipo === 'seleccion' || tipo === 'seleccion_multiple'

  function describir(tipoCheckin: FrecuenciaCheckin) {
    const config = programacion[tipoCheckin]
    const regla: ReglaRecurrencia = { ...config, diaSemana: config.diaSemana ?? 'lunes' }
    return describirRecurrencia(tipoCheckin, regla)
  }

  async function handleSubmit() {
    if (!nombre.trim()) {
      setError('Ponle un nombre a la pregunta')
      return
    }
    const opcionesLimpias = opciones.map((o) => o.trim()).filter(Boolean)
    if (requiereOpciones && opcionesLimpias.length < 2) {
      setError('Añade al menos 2 opciones')
      return
    }
    if (cuando.length === 0) {
      setError('Elige cuándo quieres preguntarlo')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/entrenador/checkin-config/campos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo,
          categoria: 'personalizado',
          unidad: unidad.trim() || undefined,
          tipos: cuando,
          opciones: requiereOpciones ? opcionesLimpias : undefined,
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear la revisión')
      onCreated()
      onClose()
    } catch {
      setError('Error al crear la revisión. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-card-foreground">Añadir revisión</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-card-foreground">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-muted">
          Usa las revisiones para conocer cómo se encuentra tu cliente o hacerle preguntas que no
          son objetivos.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Pregunta</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Energía, Molestias, Comentario…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Tipo de respuesta</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Tipo)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">¿Cuándo se la preguntas?</label>
            <div className="flex flex-col gap-1">
              {TIPOS_CHECKIN.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-card-foreground">
                  <input
                    type="checkbox"
                    checked={cuando.includes(t)}
                    onChange={(e) =>
                      setCuando((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)))
                    }
                  />
                  {describir(t)}
                </label>
              ))}
            </div>
          </div>

          {tipo === 'numero' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-card-foreground">Unidad (opcional)</label>
              <input
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="kg, cm..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
              />
            </div>
          )}

          {requiereOpciones && (
            <div>
              <label className="mb-1 block text-sm font-medium text-card-foreground">Opciones</label>
              <div className="flex flex-col gap-2">
                {opciones.map((o, i) => (
                  <input
                    key={i}
                    value={o}
                    onChange={(e) =>
                      setOpciones((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOpciones((prev) => [...prev, ''])}
                className="mt-2 text-xs text-primary hover:underline"
              >
                + Añadir opción
              </button>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={guardando}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? 'Creando…' : 'Crear revisión'}
          </button>
        </div>
      </div>
    </div>
  )
}
