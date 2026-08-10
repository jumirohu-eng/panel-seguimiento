'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AtencionResponse } from '@/lib/types'

const URGENCIA_STYLES: Record<string, string> = {
  rojo: 'border-danger/40 bg-danger/5',
  ambar: 'border-warning/40 bg-warning/5',
}

const URGENCIA_ICON: Record<string, string> = {
  rojo: '🔴',
  ambar: '🟠',
}

export default function AlertasPanel() {
  const router = useRouter()
  const [data, setData] = useState<AtencionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = await getToken()
        const res = await fetch('/api/admin/alertas', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 403) {
          router.push('/login')
          return
        }
        if (!res.ok) throw new Error('No se pudieron cargar las alertas')
        const json: AtencionResponse = await res.json()
        setData(json)
      } catch {
        setError('Error al cargar las alertas.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken, router])

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-card-foreground">Requiere tu atención</h2>
      {loading && <p className="text-sm text-muted">Cargando…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && data && data.alertas.length === 0 && (
        <p className="text-sm text-success">Todo en orden ✓</p>
      )}
      {!loading && !error && data && data.alertas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.alertas.map((alerta, i) => (
            <li
              key={i}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${URGENCIA_STYLES[alerta.urgencia] ?? 'border-border'}`}
            >
              <div className="flex items-start gap-2">
                <span>{URGENCIA_ICON[alerta.urgencia] ?? '⚪'}</span>
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    {alerta.entrenador_nombre}
                  </p>
                  <p className="text-sm text-muted">{alerta.mensaje}</p>
                </div>
              </div>
              <button
                onClick={() =>
                  router.push(`/admin/entrenador/${encodeURIComponent(alerta.entrenador_email)}`)
                }
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
              >
                Ver entrenador
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
