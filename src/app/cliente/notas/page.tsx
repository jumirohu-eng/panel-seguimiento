'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ClienteNotasPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [contenido, setContenido] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inactivo, setInactivo] = useState(false)
  const [estadoGuardado, setEstadoGuardado] = useState<'idle' | 'guardando' | 'guardado'>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      setToken(accessToken)

      try {
        const res = await fetch('/api/cliente/notas', { headers: { Authorization: `Bearer ${accessToken}` } })
        if (res.status === 403) {
          setInactivo(true)
          return
        }
        if (!res.ok) throw new Error('No se pudieron cargar tus notas')
        const data: { contenido: string } = await res.json()
        setContenido(data.contenido)
      } catch {
        setError('Error al cargar tus notas.')
      } finally {
        setLoading(false)
      }
    }
    init()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [router])

  const handleChange = useCallback(
    (value: string) => {
      setContenido(value)
      setEstadoGuardado('guardando')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(async () => {
        if (!token) return
        try {
          const res = await fetch('/api/cliente/notas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ contenido: value }),
          })
          if (!res.ok) throw new Error()
          setEstadoGuardado('guardado')
        } catch {
          setEstadoGuardado('idle')
        }
      }, 800)
    },
    [token]
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  if (inactivo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="max-w-sm text-center text-sm text-danger">
          Tu acceso está desactivado. Contacta con tu entrenador si crees que es un error.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <h1 className="text-sm font-medium text-card-foreground">Mis notas</h1>
        <button
          onClick={() => router.push('/cliente/dashboard')}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
        >
          Volver
        </button>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="mb-4 text-sm text-muted">
            Tu libreta personal — pesos, repeticiones, apuntes… Solo tú puedes verla: ni tu entrenador ni ningún
            análisis automático tienen acceso a estas notas.
          </p>
          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted">
              {estadoGuardado === 'guardando' ? 'Guardando…' : estadoGuardado === 'guardado' ? 'Guardado' : ''}
            </span>
          </div>
          <textarea
            value={contenido}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Escribe aquí…"
            rows={16}
            className="w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
          />
        </div>
      </main>
    </div>
  )
}
