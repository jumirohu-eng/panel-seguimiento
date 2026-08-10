'use client'

import { useCallback, useEffect, useState } from 'react'
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

export default function ClienteFicha({ cliente, onBack }: { cliente: Cliente; onBack: () => void }) {
  const router = useRouter()
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [offset, setOffset] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tieneMetricas, setTieneMetricas] = useState(false)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

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
        </div>
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
