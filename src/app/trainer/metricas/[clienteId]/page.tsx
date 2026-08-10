'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'

export default function TrainerMetricasPage() {
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

  return (
    <div className="min-h-screen bg-background">
      <Header email={email} />
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
        <span className="text-4xl">📊</span>
        <h1 className="text-xl font-semibold text-card-foreground">Métricas y Estadísticas</h1>
        <p className="text-sm text-muted">Próximamente. Estamos preparando esta sección.</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground hover:bg-background"
        >
          ← Volver al dashboard
        </button>
      </main>
    </div>
  )
}
