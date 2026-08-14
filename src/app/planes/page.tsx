'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { tienePlanBase } from '@/lib/productos'
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
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      // Esta página no tenía forma de detectar que el acceso cambió después de aterrizar
      // aquí (ni admin la concede desde aquí, ni había re-comprobación al recargar) — un
      // entrenador que llegaba sin plan se quedaba viendo "Solicita acceso" para siempre,
      // aunque el admin le concediera un plan después, hasta que navegara manualmente a
      // /dashboard o volviera a iniciar sesión. Se replica aquí el mismo chequeo que ya
      // hace /dashboard, para que esta página se autocorrija en cada carga.
      if (token) {
        try {
          const rolRes = await fetch('/api/auth/rol', { headers: { Authorization: `Bearer ${token}` } })
          if (rolRes.ok) {
            const { rol } = await rolRes.json()
            if (rol === 'admin') {
              router.push('/dashboard')
              return
            }
          }
        } catch {
          // Si falla la resolución de rol, seguimos comprobando el plan por si acaso
        }

        try {
          const perfilRes = await fetch('/api/entrenador/perfil', { headers: { Authorization: `Bearer ${token}` } })
          if (perfilRes.ok) {
            const perfil = await perfilRes.json()
            if (tienePlanBase(perfil.soluciones ?? [])) {
              router.push('/dashboard')
              return
            }
          }
        } catch {
          // Si falla la comprobación de plan, mostramos esta página igualmente
        }
      }

      setEmail(data.user.email ?? '')
      setChecking(false)
    }
    init()
  }, [router])

  if (checking || !email) return null

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
