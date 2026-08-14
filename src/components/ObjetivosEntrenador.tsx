'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ObjetivoResuelto } from '@/lib/objetivos'
import { formatearProgresoTexto } from '@/lib/objetivos'
import ObjetivoModal from './ObjetivoModal'

const TITULOS_PERIODICIDAD: Record<ObjetivoResuelto['periodicidad'], string> = {
  diario: 'Diario',
  semanal: 'Semanal',
  mensual: 'Mensual',
}

function estadoObjetivo(o: ObjetivoResuelto): { label: string; className: string } {
  if (!o.activo) return { label: 'Desactivado', className: 'bg-muted/10 text-muted' }
  if (!o.vigenteHoy) return { label: 'Fuera de vigencia', className: 'bg-warning/10 text-warning' }
  return { label: 'Activo', className: 'bg-success/10 text-success' }
}

export default function ObjetivosEntrenador({ clienteId }: { clienteId: string }) {
  const [objetivos, setObjetivos] = useState<ObjetivoResuelto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalAbierto, setModalAbierto] = useState<'nuevo' | ObjetivoResuelto | null>(null)
  const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const token = await getToken()
    try {
      const res = await fetch(`/api/clientes/${clienteId}/objetivos`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudieron cargar los objetivos')
      const data: { objetivos: ObjetivoResuelto[] } = await res.json()
      setObjetivos(data.objetivos)
    } catch {
      setError('Error al cargar los objetivos.')
    } finally {
      setLoading(false)
    }
  }, [clienteId, getToken])

  useEffect(() => {
    async function load() {
      await cargar()
    }
    load()
    // Solo al cambiar de cliente: cargar cambia de identidad en cada render de clienteId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  async function toggleActivo(o: ObjetivoResuelto) {
    setCambiandoEstado(o.id)
    const token = await getToken()
    try {
      const res = await fetch(`/api/clientes/${clienteId}/objetivos/${o.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ activo: !o.activo }),
      })
      if (!res.ok) throw new Error()
      await cargar()
    } catch {
      setError('No se pudo cambiar el estado del objetivo.')
    } finally {
      setCambiandoEstado(null)
    }
  }

  async function eliminar(o: ObjetivoResuelto) {
    setEliminando(o.id)
    const token = await getToken()
    try {
      const res = await fetch(`/api/clientes/${clienteId}/objetivos/${o.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setConfirmandoEliminar(null)
      await cargar()
    } catch {
      setError('No se pudo eliminar el objetivo.')
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-card-foreground">Objetivos</h3>
        <button
          type="button"
          onClick={() => setModalAbierto('nuevo')}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-background"
        >
          + Nuevo objetivo
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : objetivos.length === 0 ? (
        <p className="text-sm text-muted">Este cliente todavía no tiene objetivos configurados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {objetivos.map((o) => {
            const estado = estadoObjetivo(o)
            return (
              <div key={o.id} className="rounded-lg bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    {o.modoProgreso === 'valor_objetivo' ? (
                      <>
                        <p className="truncate text-sm font-medium text-card-foreground">
                          {o.nombre} objetivo: {o.meta} {o.unidad}
                        </p>
                        <p className="text-xs text-muted">
                          {o.progreso ? `Actual: ${o.progreso.valor} ${o.unidad}` : 'Sin datos todavía'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="truncate text-sm font-medium text-card-foreground">{o.nombre}</p>
                        <p className="text-xs text-muted">
                          {TITULOS_PERIODICIDAD[o.periodicidad]}
                          {o.progreso ? ` · ${formatearProgresoTexto(o.unidad, o.progreso)}` : ` · meta: ${o.meta} ${o.unidad}`}
                        </p>
                      </>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${estado.className}`}>
                    {estado.label}
                  </span>
                </div>

                {o.progreso && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card">
                      <div
                        className={`h-full rounded-full ${o.progreso.completado ? 'bg-success' : 'bg-primary'}`}
                        style={{ width: `${Math.min(100, Math.max(0, o.progreso.porcentaje))}%` }}
                      />
                    </div>
                    {o.modoProgreso !== 'valor_objetivo' && (
                      <span className="shrink-0 text-xs text-muted">{formatearProgresoTexto(o.unidad, o.progreso)}</span>
                    )}
                  </div>
                )}

                {confirmandoEliminar === o.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-danger">¿Eliminar «{o.nombre}»? No podrás reactivarlo.</span>
                    <button
                      type="button"
                      onClick={() => setConfirmandoEliminar(null)}
                      disabled={eliminando === o.id}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-card-foreground hover:bg-card disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(o)}
                      disabled={eliminando === o.id}
                      className="rounded-lg bg-danger px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {eliminando === o.id ? 'Eliminando…' : 'Sí, eliminar'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModalAbierto(o)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-card-foreground hover:bg-card"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActivo(o)}
                      disabled={cambiandoEstado === o.id}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-card-foreground hover:bg-card disabled:opacity-50"
                    >
                      {cambiandoEstado === o.id ? '…' : o.activo ? 'Desactivar' : 'Reactivar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoEliminar(o.id)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-danger hover:bg-card"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalAbierto && (
        <ObjetivoModal
          clienteId={clienteId}
          objetivoExistente={modalAbierto === 'nuevo' ? null : modalAbierto}
          onClose={() => setModalAbierto(null)}
          onSaved={() => {
            setModalAbierto(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}
