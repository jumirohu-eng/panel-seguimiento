'use client'

import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { ObjetivoResuelto, PeriodicidadObjetivo } from '@/lib/objetivos'
import { CampoCheckinResuelto } from '@/lib/types'

const PERIODICIDADES: { value: PeriodicidadObjetivo; label: string }[] = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
]

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function ObjetivoModal({
  clienteId,
  objetivoExistente,
  onClose,
  onSaved,
}: {
  clienteId: string
  objetivoExistente?: ObjetivoResuelto | null
  onClose: () => void
  onSaved: () => void
}) {
  const editando = Boolean(objetivoExistente)

  const [campos, setCampos] = useState<CampoCheckinResuelto[]>([])
  const [loadingCampos, setLoadingCampos] = useState(true)

  const [nombre, setNombre] = useState(objetivoExistente?.nombre ?? '')
  const [periodicidad, setPeriodicidad] = useState<PeriodicidadObjetivo>(objetivoExistente?.periodicidad ?? 'semanal')
  const [meta, setMeta] = useState(String(objetivoExistente?.meta ?? ''))
  const [unidad, setUnidad] = useState(objetivoExistente?.unidad ?? '')
  const [fuenteFieldId, setFuenteFieldId] = useState(objetivoExistente?.fuenteFieldId ?? '')
  const [fechaInicio, setFechaInicio] = useState(objetivoExistente?.fechaInicio ?? hoyISO())
  const [fechaFin, setFechaFin] = useState(objetivoExistente?.fechaFin ?? '')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function cargarCampos() {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      try {
        const res = await fetch('/api/entrenador/checkin-config', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const config: { campos: CampoCheckinResuelto[] } = await res.json()
          setCampos(config.campos.filter((c) => c.activo && (c.tipo === 'si_no' || c.tipo === 'numero')))
        }
      } finally {
        setLoadingCampos(false)
      }
    }
    cargarCampos()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const metaNum = Number(meta)
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!Number.isFinite(metaNum) || metaNum <= 0) {
      setError('La meta debe ser un número mayor que 0.')
      return
    }
    if (!unidad.trim()) {
      setError('La unidad es obligatoria.')
      return
    }

    setGuardando(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const body = {
        nombre: nombre.trim(),
        periodicidad,
        meta: metaNum,
        unidad: unidad.trim(),
        fuenteFieldId: fuenteFieldId || null,
        fechaInicio,
        fechaFin: fechaFin || null,
      }
      const url = editando
        ? `/api/clientes/${clienteId}/objetivos/${objetivoExistente!.id}`
        : `/api/clientes/${clienteId}/objetivos`
      const res = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const responseData = await res.json().catch(() => null)
      if (!res.ok) throw new Error(responseData?.error ?? 'No se pudo guardar el objetivo')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el objetivo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-card-foreground">
            {editando ? 'Editar objetivo' : 'Nuevo objetivo'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-card-foreground">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-card-foreground">Nombre</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Entrenamientos, Pasos, Movilidad…"
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-card-foreground">Periodicidad</label>
              <select
                value={periodicidad}
                onChange={(e) => setPeriodicidad(e.target.value as PeriodicidadObjetivo)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              >
                {PERIODICIDADES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-card-foreground">Meta</label>
              <input
                type="number"
                required
                min={0}
                step="any"
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-card-foreground">Unidad</label>
            <input
              type="text"
              required
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              placeholder="sesiones, pasos, kg…"
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-card-foreground">
              Fuente de progreso <span className="text-xs font-normal text-muted">(opcional)</span>
            </label>
            <select
              value={fuenteFieldId}
              onChange={(e) => setFuenteFieldId(e.target.value)}
              disabled={loadingCampos}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
            >
              <option value="">Sin fuente automática (solo informativo)</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.tipo === 'si_no' ? 'sí/no' : 'número'})
                </option>
              ))}
            </select>
            {!loadingCampos && campos.length === 0 && (
              <p className="text-xs text-muted">No hay campos de check-in numéricos/booleanos activos todavía.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-card-foreground">Fecha inicio</label>
              <input
                type="date"
                required
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-card-foreground">
                Fecha fin <span className="text-xs font-normal text-muted">(opcional)</span>
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="mt-1 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear objetivo'}
          </button>
        </form>
      </div>
    </div>
  )
}
