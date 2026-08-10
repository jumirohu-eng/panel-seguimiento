'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'
import PlanesCards from '@/components/PlanesCards'

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

  const href = linkWhatsapp('Hola, quiero activar un plan en RetainCoach')

  return (
    <div className="min-h-screen bg-background">
      <Header email={email} />
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6">
        <section className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-2xl font-semibold text-card-foreground">Todavía no tienes ningún plan activo</h1>
          <p className="max-w-xl text-sm text-muted">
            Activa Seguimiento desde el marketplace (🏪 arriba) o solicita acceso a un plan y te
            ayudamos a configurarlo.
          </p>
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
      </main>
    </div>
  )
}
