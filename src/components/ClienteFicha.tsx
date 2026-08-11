'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Cliente, Reporte, ReportesResponse } from '@/lib/types'
import { formatDateTime } from '@/lib/format'
import { calcularEstadoReporte } from '@/lib/estadoReporte'
import AIAnalysis from './AIAnalysis'
import SuggestedMessage from './SuggestedMessage'

const ESTADO_BADGE: Record<string, string> = {
  Activo: 'bg-success/10 text-success',
  Pausado: 'bg-warning/10 text-warning',
  Perdido: 'bg-danger/10 text-danger',
}

const ENERGIA_BADGE: Record<string, string> = {
  Cansado: 'bg-danger/10 text-danger',
  Normal: 'bg-muted/10 text-muted',
  'Con energía': 'bg-success/10 text-success',
}

export default function ClienteFicha({
  cliente,
  onBack,
  onUpdated,
}: {
  cliente: Cliente
  onBack: () => void
  onUpdated?: (cliente: Pick<Cliente, 'id'> & Partial<Cliente>) => void
}) {
  const router = useRouter()
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [offset, setOffset] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tieneMetricas, setTieneMetricas] = useState(false)
  const [notas, setNotas] = useState(cliente.notasEntrenador)
  const [estadoGuardado, setEstadoGuardado] = useState<'idle' | 'guardando' | 'guardado'>('idle')
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  const [dandoBaja, setDandoBaja] = useState(false)
  const [errorBaja, setErrorBaja] = useState<string | null>(null)
  const [copiadoLinkTally, setCopiadoLinkTally] = useState(false)
  const [conflictoError, setConflictoError] = useState<string | null>(null)
  const notasTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  useEffect(() => {
    return () => {
      if (notasTimeout.current) clearTimeout(notasTimeout.current)
    }
  }, [])

  const handleNotasChange = useCallback(
    (value: string) => {
      setNotas(value)
      setEstadoGuardado('guardando')
      if (notasTimeout.current) clearTimeout(notasTimeout.current)
      notasTimeout.current = setTimeout(async () => {
        const token = await getToken()
        try {
          const res = await fetch(`/api/clientes/${cliente.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ notasEntrenador: value, lastModified: cliente.lastModified }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok) {
            if (res.status === 409) setConflictoError(data?.error ?? 'Conflicto al guardar.')
            throw new Error(data?.error ?? 'No se pudieron guardar las notas')
          }
          setEstadoGuardado('guardado')
          onUpdated?.({ id: cliente.id, notasEntrenador: value, lastModified: data?.lastModified })
        } catch {
          setEstadoGuardado('idle')
        }
      }, 800)
    },
    [cliente.id, cliente.lastModified, getToken, onUpdated]
  )

  const handleDarBaja = useCallback(async () => {
    setDandoBaja(true)
    setErrorBaja(null)
    const token = await getToken()
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: 'Perdido', lastModified: cliente.lastModified }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 409) {
          setConflictoError(data?.error ?? 'Conflicto al guardar.')
          setConfirmandoBaja(false)
          return
        }
        throw new Error(data?.error ?? 'No se pudo dar de baja al cliente')
      }
      onUpdated?.({ id: cliente.id, estado: 'Perdido', lastModified: data?.lastModified })
      onBack()
    } catch (err) {
      setErrorBaja(err instanceof Error ? err.message : 'Error al dar de baja al cliente. Inténtalo de nuevo.')
    } finally {
      setDandoBaja(false)
    }
  }, [cliente.id, cliente.lastModified, getToken, onBack, onUpdated])

  const handleCopyLinkTally = useCallback(async () => {
    if (!cliente.linkTallyAlta) return
    await navigator.clipboard.writeText(cliente.linkTallyAlta)
    setCopiadoLinkTally(true)
    setTimeout(() => setCopiadoLinkTally(false), 2000)
  }, [cliente.linkTallyAlta])

  useEffect(() => {
    async function cargarPerfil() {
      const token = await getToken()
      try {
        const res = await fetch('/api/entrenador/perfil', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const perfil = await res.json()
        setTieneMetricas((perfil.soluciones ?? []).includes('Metricas'))
      } catch {
        // Si falla, simplemente no se muestra el botón de métricas
      }
    }
    cargarPerfil()
  }, [getToken])

  const cargarReportes = useCallback(
    async (offsetActual?: string | null) => {
      const esMas = Boolean(offsetActual)
      const token = await getToken()
      if (esMas) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ clienteId: cliente.id })
        if (offsetActual) params.set('offset', offsetActual)
        const res = await fetch(`/api/reportes?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('No se pudieron cargar los reportes')
        const data: ReportesResponse = await res.json()
        setReportes((prev) => (esMas ? [...prev, ...data.reportes] : data.reportes))
        setOffset(data.offset)
      } catch {
        setError('Error al cargar los reportes.')
      } finally {
        if (esMas) setLoadingMore(false)
        else setLoading(false)
      }
    },
    [cliente.id, getToken]
  )

  useEffect(() => {
    async function load() {
      await cargarReportes()
    }
    load()
    // Solo al cambiar de cliente: cargarReportes cambia de identidad en cada render de cliente.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id])

  const ultimoReporte = reportes[0]
  const estadoUltimo = calcularEstadoReporte(ultimoReporte?.fecha, ultimoReporte?.mensajeSugerido)
  const linkWhatsapp =
    estadoUltimo === 'alerta' && ultimoReporte?.linkAlerta ? ultimoReporte.linkAlerta : cliente.linkRecordatorio

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="w-fit text-sm text-muted hover:text-primary">
        ← Volver a clientes
      </button>

      {conflictoError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
          <p className="text-sm text-card-foreground">{conflictoError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Recargar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">{cliente.nombre}</h2>
          <p className="text-sm text-muted">{cliente.objetivo}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              ESTADO_BADGE[cliente.estado] ?? 'bg-muted/10 text-muted'
            }`}
          >
            {cliente.estado || '—'}
          </span>
          {tieneMetricas && (
            <button
              type="button"
              onClick={() => router.push(`/trainer/metricas/${cliente.id}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
            >
              📊 Ver métricas
            </button>
          )}
          {linkWhatsapp && (
            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
            >
              WhatsApp
            </a>
          )}
          {cliente.estado === 'Activo' && !confirmandoBaja && (
            <button
              type="button"
              onClick={() => setConfirmandoBaja(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-danger hover:bg-background"
            >
              Dar de baja
            </button>
          )}
        </div>
      </div>

      {confirmandoBaja && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
          <p className="text-sm text-card-foreground">
            ¿Dar de baja a {cliente.nombre}? Dejará de aparecer en la lista de clientes activos.
          </p>
          <div className="flex items-center gap-2">
            {errorBaja && <p className="text-sm text-danger">{errorBaja}</p>}
            <button
              type="button"
              onClick={() => setConfirmandoBaja(false)}
              disabled={dandoBaja}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDarBaja}
              disabled={dandoBaja}
              className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {dandoBaja ? 'Dando de baja…' : 'Sí, dar de baja'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="notas-entrenador" className="text-sm font-semibold text-card-foreground">
            Notas
          </label>
          <span className="text-xs text-muted">
            {estadoGuardado === 'guardando' ? 'Guardando…' : estadoGuardado === 'guardado' ? 'Guardado' : ''}
          </span>
        </div>
        <textarea
          id="notas-entrenador"
          value={notas}
          onChange={(e) => handleNotasChange(e.target.value)}
          placeholder="Notas privadas sobre este cliente…"
          rows={3}
          className="w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
        />
        {cliente.notasIniciales.trim() && (
          <div className="mt-1 rounded-lg bg-background p-3">
            <p className="mb-1 text-xs font-medium text-muted">Notas del cliente al registrarse</p>
            <p className="whitespace-pre-wrap text-sm text-card-foreground">{cliente.notasIniciales}</p>
          </div>
        )}
        {cliente.linkTallyAlta && (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background p-3">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-medium text-muted">Link de alta (Tally)</p>
              <p className="truncate text-xs text-muted">{cliente.linkTallyAlta}</p>
            </div>
            <button
              type="button"
              onClick={handleCopyLinkTally}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-card"
            >
              {copiadoLinkTally ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Cargando reportes…</p>
      ) : reportes.length === 0 ? (
        <p className="text-sm text-muted">Este cliente todavía no tiene reportes.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reportes.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-card-foreground">{formatDateTime(r.fecha)}</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    ENERGIA_BADGE[r.energia] ?? 'bg-muted/10 text-muted'
                  }`}
                >
                  {r.energia}
                </span>
              </div>
              <div className="mb-3 flex gap-4 text-sm text-card-foreground">
                <p>
                  <span className="text-muted">Peso: </span>
                  {r.peso} kg
                </p>
                <p>
                  <span className="text-muted">Entrenamientos: </span>
                  {r.entrenamientos}
                </p>
              </div>
              {r.notas && <p className="mb-3 whitespace-pre-wrap text-sm text-muted">{r.notas}</p>}
              <div className="flex flex-col gap-3">
                <AIAnalysis analysis={r.analisisIA} tieneAlerta={Boolean(r.mensajeSugerido?.trim())} />
                <SuggestedMessage message={r.mensajeSugerido} />
              </div>
            </div>
          ))}

          {offset && (
            <button
              type="button"
              onClick={() => cargarReportes(offset)}
              disabled={loadingMore}
              className="w-fit rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground transition hover:bg-background disabled:opacity-50"
            >
              {loadingMore ? 'Cargando…' : 'Ver más'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
