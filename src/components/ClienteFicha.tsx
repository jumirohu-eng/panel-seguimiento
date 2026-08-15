'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Cliente,
  Reporte,
  ReportesResponse,
  CheckinEnvio,
  ChecklinsResponse,
  PendientesCheckin,
} from '@/lib/types'
import { formatDateTime } from '@/lib/format'
import AIAnalysis from './AIAnalysis'
import SuggestedMessage from './SuggestedMessage'
import ObjetivosEntrenador from './ObjetivosEntrenador'

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
  const [reactivando, setReactivando] = useState(false)
  const [errorReactivar, setErrorReactivar] = useState<string | null>(null)
  const [conflictoError, setConflictoError] = useState<string | null>(null)
  const [checkins, setCheckins] = useState<CheckinEnvio[]>([])
  const [checkinsPage, setCheckinsPage] = useState(0)
  const [checkinsHasMore, setCheckinsHasMore] = useState(false)
  const [loadingCheckins, setLoadingCheckins] = useState(true)
  const [loadingMoreCheckins, setLoadingMoreCheckins] = useState(false)
  const [errorCheckins, setErrorCheckins] = useState<string | null>(null)
  const [pendientesCheckin, setPendientesCheckin] = useState<PendientesCheckin | null>(null)
  const [confirmandoEliminarCheckin, setConfirmandoEliminarCheckin] = useState<string | null>(null)
  const [eliminandoCheckin, setEliminandoCheckin] = useState<string | null>(null)
  const [errorEliminarCheckin, setErrorEliminarCheckin] = useState<string | null>(null)
  // Incrementado tras eliminar un check-in — pasado a ObjetivosEntrenador para que recargue
  // el progreso (recalculado en caliente en el backend, ver DECISIONS.md) sin necesitar un
  // refresco manual de página.
  const [objetivosRefreshToken, setObjetivosRefreshToken] = useState(0)
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

  // Inactivo/perdido no equivale a eliminado (ver DECISIONS.md) — el entrenador siempre
  // puede reactivar un cliente 'Perdido' de vuelta a 'Activo', sin perder historial.
  const handleReactivar = useCallback(async () => {
    setReactivando(true)
    setErrorReactivar(null)
    const token = await getToken()
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: 'Activo', lastModified: cliente.lastModified }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 409) {
          setConflictoError(data?.error ?? 'Conflicto al guardar.')
          return
        }
        throw new Error(data?.error ?? 'No se pudo reactivar al cliente')
      }
      onUpdated?.({ id: cliente.id, estado: 'Activo', lastModified: data?.lastModified })
    } catch (err) {
      setErrorReactivar(err instanceof Error ? err.message : 'Error al reactivar al cliente. Inténtalo de nuevo.')
    } finally {
      setReactivando(false)
    }
  }, [cliente.id, cliente.lastModified, getToken, onUpdated])

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

  const cargarCheckins = useCallback(
    async (pagina = 0) => {
      const esMas = pagina > 0
      const token = await getToken()
      if (esMas) setLoadingMoreCheckins(true)
      else setLoadingCheckins(true)
      setErrorCheckins(null)
      try {
        const params = new URLSearchParams({ clienteId: cliente.id, page: String(pagina) })
        const res = await fetch(`/api/checkins?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('No se pudieron cargar los check-ins')
        const data: ChecklinsResponse = await res.json()
        setCheckins((prev) => (esMas ? [...prev, ...data.checkins] : data.checkins))
        setCheckinsHasMore(data.hasMore)
        setCheckinsPage(pagina)
        setPendientesCheckin(data.pendientes)
      } catch {
        setErrorCheckins('Error al cargar los check-ins.')
      } finally {
        if (esMas) setLoadingMoreCheckins(false)
        else setLoadingCheckins(false)
      }
    },
    [cliente.id, getToken]
  )

  useEffect(() => {
    async function load() {
      await cargarCheckins(0)
    }
    load()
    // Solo al cambiar de cliente: cargarCheckins cambia de identidad en cada render de cliente.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id])

  const handleEliminarCheckin = useCallback(
    async (c: CheckinEnvio) => {
      setEliminandoCheckin(c.fecha)
      setErrorEliminarCheckin(null)
      const token = await getToken()
      try {
        const res = await fetch('/api/checkins', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ clienteId: cliente.id, fecha: c.fecha, tipo: c.tipo }),
        })
        if (!res.ok) throw new Error()
        setConfirmandoEliminarCheckin(null)
        // Recarga desde la primera página: refresca historial + pendientes en un mismo golpe
        // (el objetivo lanzado puede volver a aparecer como pendiente si este era su único
        // registro de la ventana actual).
        await cargarCheckins(0)
        setObjetivosRefreshToken((v) => v + 1)
      } catch {
        setErrorEliminarCheckin('No se pudo eliminar el check-in. Inténtalo de nuevo.')
      } finally {
        setEliminandoCheckin(null)
      }
    },
    [cliente.id, getToken, cargarCheckins]
  )

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
          {cliente.linkRecordatorio && (
            <a
              href={cliente.linkRecordatorio}
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
          {cliente.estado === 'Perdido' && (
            <button
              type="button"
              onClick={handleReactivar}
              disabled={reactivando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-success hover:bg-background disabled:opacity-50"
            >
              {reactivando ? 'Reactivando…' : 'Reactivar'}
            </button>
          )}
        </div>
      </div>

      {errorReactivar && <p className="text-sm text-danger">{errorReactivar}</p>}

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
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted">Seguimiento del cliente</h3>
        <ObjetivosEntrenador clienteId={cliente.id} refreshToken={objetivosRefreshToken} />

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-card-foreground">Check-ins pendientes</h3>
          {loadingCheckins ? (
            <p className="text-sm text-muted">Cargando…</p>
          ) : !pendientesCheckin || (!pendientesCheckin.diario && !pendientesCheckin.semanal && !pendientesCheckin.periodico) ? (
            <p className="text-sm text-muted">No hay check-ins pendientes.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pendientesCheckin.diario && (
                <div className="flex items-center justify-between rounded-lg bg-background p-3">
                  <span className="text-sm font-medium text-card-foreground">Diario</span>
                  <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">Pendiente</span>
                </div>
              )}
              {pendientesCheckin.semanal && (
                <div className="flex items-center justify-between rounded-lg bg-background p-3">
                  <span className="text-sm font-medium text-card-foreground">Semanal</span>
                  <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">Pendiente</span>
                </div>
              )}
              {pendientesCheckin.periodico && (
                <div className="flex items-center justify-between rounded-lg bg-background p-3">
                  <span className="text-sm font-medium text-card-foreground">Periódico</span>
                  <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">Pendiente</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {reportes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted">Reportes semanales (histórico Tally)</h3>
          <p className="text-xs text-muted">
            El flujo de Tally se retiró (Parte 1.5.3) — esto es historial, ya no llegan reportes nuevos.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading ? null : reportes.length > 0 && (
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

      <h3 className="mt-2 text-sm font-semibold text-muted">Historial de check-ins</h3>

      {errorCheckins && <p className="text-sm text-danger">{errorCheckins}</p>}
      {errorEliminarCheckin && <p className="text-sm text-danger">{errorEliminarCheckin}</p>}

      {loadingCheckins ? (
        <p className="text-sm text-muted">Cargando check-ins…</p>
      ) : checkins.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay check-ins registrados.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {checkins.map((c) => (
            <div key={c.fecha} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-card-foreground">{formatDateTime(c.fecha)}</p>
                <span className="rounded-full bg-muted/10 px-3 py-1 text-xs font-medium text-muted capitalize">
                  {c.tipo}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-sm text-card-foreground">
                {c.valores.map((v) => (
                  <p key={v.fieldId}>
                    <span className="text-muted">{v.nombre}: </span>
                    {typeof v.valor === 'boolean'
                      ? v.valor
                        ? 'Sí'
                        : 'No'
                      : Array.isArray(v.valor)
                        ? v.valor.join(', ')
                        : v.valor && typeof v.valor === 'object'
                          ? [(v.valor as { nivel?: string }).nivel, (v.valor as { zona?: string }).zona].filter(Boolean).join(' — ') || '—'
                          : String(v.valor)}
                  </p>
                ))}
              </div>

              {confirmandoEliminarCheckin === c.fecha ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-danger/10 p-3">
                  <span className="text-xs text-card-foreground">
                    ¿Eliminar este check-in? Los datos registrados dejarán de contar para los objetivos que dependan de ellos.
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmandoEliminarCheckin(null)}
                    disabled={eliminandoCheckin === c.fecha}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-card-foreground hover:bg-background disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminarCheckin(c)}
                    disabled={eliminandoCheckin === c.fecha}
                    className="rounded-lg bg-danger px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {eliminandoCheckin === c.fecha ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoEliminarCheckin(c.fecha)}
                  className="mt-3 text-xs font-medium text-danger hover:underline"
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}

          {checkinsHasMore && (
            <button
              type="button"
              onClick={() => cargarCheckins(checkinsPage + 1)}
              disabled={loadingMoreCheckins}
              className="w-fit rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground transition hover:bg-background disabled:opacity-50"
            >
              {loadingMoreCheckins ? 'Cargando…' : 'Ver más'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
