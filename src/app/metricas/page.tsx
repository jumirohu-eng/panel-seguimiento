'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'
import MetricasView from '@/components/admin/MetricasView'

export default function MetricasPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const rolRes = token
        ? await fetch('/api/auth/rol', { headers: { Authorization: `Bearer ${token}` } })
        : null
      const rol = rolRes?.ok ? (await rolRes.json()).rol : null
      if (rol !== 'admin') {
        router.push('/dashboard')
        return
      }
      setEmail(data.user.email ?? '')
      setAuthorized(true)
      setCheckingAuth(false)
    }
    init()
  }, [router])

  if (checkingAuth || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {email && <Header email={email} isAdmin />}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <MetricasView />
      </main>
    </div>
  )
}
