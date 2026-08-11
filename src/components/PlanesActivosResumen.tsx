'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PRODUCTOS } from '@/lib/productos'
import { PLANES_COPY } from '@/content/plans-copy'
import { SolucionEntrenador } from '@/lib/airtable'

function linkSolicitar(nombre: string): string | null {
  const numero = (process.env.NEXT_PUBLIC_JUANMI_WHATSAPP ?? '').replace(/\D/g, '')
  if (!numero) return null
  const mensaje = encodeURIComponent(`Quiero activar ${nombre}`)
  return `https://wa.me/${numero}?text=${mensaje}`
}

const PRODUCTOS_DASHBOARD = PRODUCTOS.filter((p) => p.id !== 'Referidos')

export default function PlanesActivosResumen() {
  const [soluciones, setSoluciones] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        const res = await fetch('/api/entrenador/perfil', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const perfil = await res.json()
        setSoluciones(perfil.soluciones ?? [])
      } catch {
        // Si falla, simplemente no se muestran badges "En uso"
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  if (loading) return null

  return (
    <section className="mb-6 flex flex-col gap-3">
      <h2 className="text-base font-semibold text-card-foreground">Tus planes</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCTOS_DASHBOARD.map((producto) => {
          const enUso = soluciones.includes(producto.id)
          const copy = PLANES_COPY.porProducto[producto.id as SolucionEntrenador]
          const href = linkSolicitar(producto.nombre)
          return (
            <div
              key={producto.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl">{producto.icono}</span>
                {enUso && (
                  <span className="inline-flex items-center rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                    En uso
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-card-foreground">{producto.nombre}</h3>
              {copy && (
                <ul className="flex flex-col gap-1 text-xs text-muted">
                  {copy.features.slice(0, 2).map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
              )}
              {!enUso &&
                (href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto w-fit rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                  >
                    Quiero este plan
                  </a>
                ) : null)}
            </div>
          )
        })}
      </div>
    </section>
  )
}
