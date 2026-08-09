'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('No se pudo actualizar la contraseña.')
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold text-card-foreground">
          Nueva contraseña
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          Introduce tu nueva contraseña
        </p>

        {!ready && !success && (
          <p className="text-center text-sm text-muted">
            Abre el enlace que recibiste por email para continuar.
          </p>
        )}

        {ready && !success && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-card-foreground">
                Nueva contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-card-foreground">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        {success && (
          <p className="text-center text-sm text-success">
            Contraseña actualizada. Redirigiendo…
          </p>
        )}
      </div>
    </main>
  )
}
