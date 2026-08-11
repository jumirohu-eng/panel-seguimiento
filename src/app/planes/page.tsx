'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'
import PlanesCards from '@/components/PlanesCards'
import { PLANES_COPY } from '@/content/plans-copy'

function linkWhatsapp(mensaje: string): string | null {
  const numero = (process.env.NEXT_PUBLIC_JUANMI_WHATSAPP ?? '').replace(/\D/g, '')
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

export default function PlanesPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }
      setEmail(data.user.email ?? '')
    }
    init()
  }, [router])

  if (!email) return null

  const href = linkWhatsapp('Hola, quiero activar un plan de RetainCoach')

  return (
    <div className="min-h-screen bg-background">
      <Header email={email} showMarketplace={false} />
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6">
        <section className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-2xl font-semibold text-card-foreground">{PLANES_COPY.headline}</h1>
          <p className="max-w-xl text-sm text-muted">{PLANES_COPY.subheadline}</p>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              Solicita acceso a un plan
            </a>
          )}
        </section>

        <PlanesCards />

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-center text-lg font-semibold text-card-foreground">
            Por qué escala más con RetainCoach
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-muted">Sin automatización</p>
              <ul className="flex flex-col gap-2 text-sm text-card-foreground">
                {PLANES_COPY.comparativa.sinAutomatizacion.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="text-danger">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-muted">Con RetainCoach</p>
              <ul className="flex flex-col gap-2 text-sm text-card-foreground">
                {PLANES_COPY.comparativa.conRetainCoach.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="text-success">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {PLANES_COPY.pricingNote && (
            <p className="mt-5 text-center text-sm text-muted">{PLANES_COPY.pricingNote}</p>
          )}
        </section>
      </main>
    </div>
  )
}
