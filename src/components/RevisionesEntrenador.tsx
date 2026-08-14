'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CampoCheckinResuelto, CheckinConfigResponse } from '@/lib/types'
import type { ObjetivoResuelto } from '@/lib/objetivos'
import { describirRecurrencia, FrecuenciaCheckin } from '@/lib/checkinFields'
import RevisionModal from './RevisionModal'

// "Revisión" = campo de Campos_checkin que NO es la fuente de ningún objetivo vigente de este
// cliente (esos ya se muestran en Objetivos). El catálogo en sí sigue siendo por entrenador
// (compartido entre todos sus clientes) — decisión explícita de esta fase, ver DECISIONS.md.
export default function RevisionesEntrenador({ clienteId }: { clienteId: string }) {
  const [config, setConfig] = useState<CheckinConfigResponse | null>(null)
  const [idsDeObjetivos, setIdsDeObjetivos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [cambiando, setCambiando] = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const t = await getToken()
    setToken(t)
    try {
      const [configRes, objetivosRes] = await Promise.all([
        fetch('/api/entrenador/checkin-config', { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`/api/clientes/${clienteId}/objetivos`, { headers: { Authorization: `Bearer ${t}` } }),
      ])
      if (!configRes.ok) throw new Error('No se pudo cargar la configuración')
      const configData: CheckinConfigResponse = await configRes.json()
      setConfig(configData)

      if (objetivosRes.ok) {
        const { objetivos }: { objetivos: ObjetivoResuelto[] } = await objetivosRes.json()
        setIdsDeObjetivos(new Set(objetivos.filter((o) => o.fuenteFieldId).map((o) => o.fuenteFieldId!)))
      }
    } catch {
      setError('Error al cargar las revisiones.')
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

  async function toggleActivo(campo: CampoCheckinResuelto) {
    if (!config || !token) return
    setCambiando(campo.id)
    try {
      const nuevosCampos = config.campos.map((c) => (c.id === campo.id ? { ...c, activo: !c.activo } : c))
      const res = await fetch('/api/entrenador/checkin-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campos: nuevosCampos.map((c) => ({ fieldId: c.id, activo: c.activo, orden: c.orden, tipos: c.tipos })),
        }),
      })
      if (!res.ok) throw new Error()
      await cargar()
    } catch {
      setError('No se pudo actualizar la revisión.')
    } finally {
      setCambiando(null)
    }
  }

  const revisiones = (config?.campos ?? []).filter((c) => c.activo !== undefined && !idsDeObjetivos.has(c.id))
  const revisionesActivas = revisiones.filter((c) => c.activo)
  const revisionesInactivas = revisiones.filter((c) => !c.activo)

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-card-foreground">Revisiones</h3>
        <button
          type="button"
          onClick={() => setMostrarModal(true)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-background"
        >
          + Añadir revisión
        </button>
      </div>
      <p className="mb-3 text-xs text-muted">
        Preguntas sobre cómo se encuentra tu cliente, distintas de sus objetivos. Estas preguntas
        se aplican a todos tus clientes.
      </p>

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : revisiones.length === 0 ? (
        <p className="text-sm text-muted">Todavía no tienes revisiones configuradas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...revisionesActivas, ...revisionesInactivas].map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-card-foreground">{c.nombre}</p>
                <p className="text-xs text-muted">
                  {c.tipos.length > 0 && config
                    ? c.tipos
                        .map((t) => {
                          const p = config.programacion[t as FrecuenciaCheckin]
                          return describirRecurrencia(t as FrecuenciaCheckin, { ...p, diaSemana: p.diaSemana ?? 'lunes' })
                        })
                        .join(' · ')
                    : 'Sin programar todavía'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleActivo(c)}
                disabled={cambiando === c.id}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                  c.activo ? 'bg-primary text-white' : 'bg-card text-muted'
                }`}
              >
                {cambiando === c.id ? '…' : c.activo ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          ))}
        </div>
      )}

      {mostrarModal && token && config && (
        <RevisionModal
          token={token}
          programacion={config.programacion}
          onClose={() => setMostrarModal(false)}
          onCreated={cargar}
        />
      )}
    </div>
  )
}
