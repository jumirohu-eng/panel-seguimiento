'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { tienePlanBase } from '@/lib/productos'
import { CheckinConfigResponse } from '@/lib/types'
import Header from '@/components/Header'
import CheckinConfigView from '@/components/CheckinConfigView'

export default function CheckinConfigPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [config, setConfig] = useState<CheckinConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login')
        return
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        router.push('/login')
        return
      }
      setEmail(userData.user.email ?? '')
      setToken(accessToken)

      try {
        const perfilRes = await fetch('/api/entrenador/perfil', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (perfilRes.ok) {
          const perfil = await perfilRes.json()
          if (!tienePlanBase(perfil.soluciones ?? [])) {
            router.push('/planes')
            return
          }
        }
      } catch {
        // Si falla la comprobación de plan, dejamos pasar y que la API falle si toca
      }

      try {
        const res = await fetch('/api/entrenador/checkin-config', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) throw new Error('No se pudo cargar la configuración')
        const data: CheckinConfigResponse = await res.json()
        setConfig(data)
      } catch {
        setError('Error al cargar la configuración de check-in.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {email && <Header email={email} />}
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mb-4 flex items-center gap-1 text-sm font-medium text-muted hover:text-card-foreground"
        >
          ← Volver
        </button>
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        {token && config && (
          <CheckinConfigView
            token={token}
            camposIniciales={config.campos}
            lanzadoInicial={config.lanzado}
            disponibleDesdeInicial={config.disponibleDesde}
          />
        )}
      </main>
    </div>
  )
}
