'use client'

import { useCallback, useEffect, useState } from 'react'
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
  const [soluciones, setSoluciones] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productoInfo, setProductoInfo] = useState<ProductoInfo | null>(null)

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
    const href = linkActivarAhora(producto)
    if (href) window.open(href, '_blank', 'noopener,noreferrer')
  }, [])

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
                <button
                  type="button"
                  onClick={() => handleActivarAhora(producto)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Activar ahora
                </button>
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
          </div>
        </div>
      )}
    </div>
  )
}
