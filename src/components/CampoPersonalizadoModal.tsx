'use client'

import { useState } from 'react'

type Tipo = 'escala' | 'si_no' | 'numero' | 'texto' | 'seleccion' | 'seleccion_multiple'
type Frecuencia = 'diario' | 'semanal' | 'periodico'

const TIPOS: { value: Tipo; label: string }[] = [
  { value: 'escala', label: 'Escala (1-5)' },
  { value: 'si_no', label: 'Sí/No' },
  { value: 'numero', label: 'Número' },
  { value: 'texto', label: 'Texto' },
  { value: 'seleccion', label: 'Selección' },
  { value: 'seleccion_multiple', label: 'Selección múltiple' },
]

const FRECUENCIAS: { value: Frecuencia; label: string }[] = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'periodico', label: 'Periódico' },
]

export default function CampoPersonalizadoModal({
  token,
  onClose,
  onCreated,
}: {
  token: string
  onClose: () => void
  onCreated: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<Tipo>('escala')
  const [categoria, setCategoria] = useState('personalizado')
  const [unidad, setUnidad] = useState('')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('diario')
  const [opciones, setOpciones] = useState<string[]>(['', ''])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requiereOpciones = tipo === 'seleccion' || tipo === 'seleccion_multiple'

  async function handleSubmit() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    const opcionesLimpias = opciones.map((o) => o.trim()).filter(Boolean)
    if (requiereOpciones && opcionesLimpias.length < 2) {
      setError('Añade al menos 2 opciones')
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
          categoria: categoria.trim() || 'personalizado',
          unidad: unidad.trim() || undefined,
          frecuencia,
          opciones: requiereOpciones ? opcionesLimpias : undefined,
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear el campo')
      onCreated()
      onClose()
    } catch {
      setError('Error al crear el campo. Inténtalo de nuevo.')
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
          <h2 className="text-lg font-semibold text-card-foreground">Añadir campo personalizado</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-card-foreground">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Tipo</label>
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
            <label className="mb-1 block text-sm font-medium text-card-foreground">Frecuencia</label>
            <select
              value={frecuencia}
              onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            >
              {FRECUENCIAS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Categoría (opcional)</label>
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
            />
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
            {guardando ? 'Creando…' : 'Crear campo'}
          </button>
        </div>
      </div>
    </div>
  )
}
