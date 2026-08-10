'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PRODUCTOS, ProductoInfo, calcularEstadoProducto, EstadoProducto } from '@/lib/productos'

const ESTADO_CONFIG: Record<EstadoProducto, { label: string; className: string; icon: string | null }> = {
  en_uso: { label: 'En uso', className: 'bg-success/10 text-success', icon: null },
  disponible: { label: 'Disponible', className: 'bg-muted/10 text-muted', icon: '⚠️' },
  proximamente: { label: 'Próximamente', className: 'bg-muted/10 text-muted', icon: '🔒' },
}

// El botón "Activar ahora" apunta hoy a WhatsApp; cuando exista plataforma de pago,
// solo hay que cambiar esta función por el link de checkout del producto.
function linkActivarAhora(producto: ProductoInfo): string | null {
  const numero = (process.env.NEXT_PUBLIC_JUANMI_WHATSAPP ?? '').replace(/\D/g, '')
  if (!numero) return null
  const mensaje = encodeURIComponent(`Quiero activar ${producto.nombre}`)
  return `https://wa.me/${numero}?text=${mensaje}`
}

export default function Marketplace() {
  const router = useRouter()
  const [soluciones, setSoluciones] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productoInfo, setProductoInfo] = useState<ProductoInfo | null>(null)
  const [mostrarConsentimiento, setMostrarConsentimiento] = useState(false)
  const [aceptaConsentimiento, setAceptaConsentimiento] = useState(false)
  const [guardandoConsentimiento, setGuardandoConsentimiento] = useState(false)
  const [errorConsentimiento, setErrorConsentimiento] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        const res = await fetch('/api/entrenador/perfil', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('No se pudo cargar el marketplace')
        const perfil = await res.json()
        setSoluciones(perfil.soluciones ?? [])
      } catch {
        setError('Error al cargar el marketplace.')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const handleActivarAhora = useCallback((producto: ProductoInfo) => {
    if (producto.id === 'Seguimiento') {
      setAceptaConsentimiento(false)
      setErrorConsentimiento(null)
      setMostrarConsentimiento(true)
      return
    }
    const href = linkActivarAhora(producto)
    if (href) window.open(href, '_blank', 'noopener,noreferrer')
  }, [])

  const handleConfirmarConsentimiento = useCallback(async () => {
    setGuardandoConsentimiento(true)
    setErrorConsentimiento(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (sessionError || !token) {
        throw new Error('Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.')
      }
      const res = await fetch('/api/entrenador/consentimiento-ia', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `No se pudo guardar el consentimiento (${res.status})`)
      }
      setMostrarConsentimiento(false)
      router.push('/dashboard')
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      setErrorConsentimiento(
        aborted
          ? 'La solicitud tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.'
          : err instanceof Error
            ? err.message
            : 'Error al guardar el consentimiento. Inténtalo de nuevo.'
      )
    } finally {
      clearTimeout(timeout)
      setGuardandoConsentimiento(false)
    }
  }, [router])

  if (loading) return <p className="text-sm text-muted">Cargando marketplace…</p>
  if (error) return <p className="text-sm text-danger">{error}</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTOS.map((producto) => {
          const estado = calcularEstadoProducto(producto, soluciones)
          const config = ESTADO_CONFIG[estado]
          return (
            <div
              key={producto.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl">{producto.icono}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${config.className}`}
                >
                  {config.icon && <span>{config.icon}</span>}
                  {config.label}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-card-foreground">{producto.nombre}</h3>
                <p className="mt-1 text-sm text-muted">{producto.descripcionCorta}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {estado !== 'en_uso' && (
                  <button
                    type="button"
                    onClick={() => handleActivarAhora(producto)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    Activar ahora
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setProductoInfo(producto)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
                >
                  Más información
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {productoInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setProductoInfo(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
                <span>{productoInfo.icono}</span>
                {productoInfo.nombre}
              </h3>
              <button
                type="button"
                onClick={() => setProductoInfo(null)}
                aria-label="Cerrar"
                className="text-muted hover:text-card-foreground"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-sm text-card-foreground">
              <div>
                <p className="mb-1 font-medium text-muted">Qué incluye</p>
                <p>{productoInfo.incluye}</p>
              </div>
              <div>
                <p className="mb-1 font-medium text-muted">Cómo funciona</p>
                <p>{productoInfo.comoFunciona}</p>
              </div>
              <div>
                <p className="mb-1 font-medium text-muted">A quién le sirve</p>
                <p>{productoInfo.aQuienLeSirve}</p>
              </div>
            </div>

            {calcularEstadoProducto(productoInfo, soluciones) !== 'en_uso' && (
              <button
                type="button"
                onClick={() => {
                  setProductoInfo(null)
                  handleActivarAhora(productoInfo)
                }}
                className="mt-5 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                Activar ahora
              </button>
            )}
          </div>
        </div>
      )}

      {mostrarConsentimiento && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => !guardandoConsentimiento && setMostrarConsentimiento(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-card-foreground">Antes de activar Seguimiento</h3>
            <p className="mb-4 text-sm text-card-foreground">
              Al activar Seguimiento, confirmo que informaré a mis clientes que usamos IA (Claude) para analizar
              datos de entrenamiento y detectar riesgos de abandono.
            </p>
            <label className="mb-5 flex items-start gap-2 text-sm text-card-foreground">
              <input
                type="checkbox"
                checked={aceptaConsentimiento}
                onChange={(e) => setAceptaConsentimiento(e.target.checked)}
                className="mt-0.5"
              />
              He leído y acepto
            </label>
            {errorConsentimiento && <p className="mb-3 text-sm text-danger">{errorConsentimiento}</p>}
            <button
              type="button"
              disabled={!aceptaConsentimiento || guardandoConsentimiento}
              onClick={handleConfirmarConsentimiento}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardandoConsentimiento ? 'Guardando…' : 'Activar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
