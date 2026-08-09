'use client'

import { Suspense, useEffect, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [checking, setChecking] = useState(true)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      router.push('/login')
      return
    }

    async function validate() {
      try {
        const res = await fetch(`/api/signup/validate?token=${encodeURIComponent(token!)}`)
        const data = await res.json()
        if (!res.ok || !data.valid) {
          setTokenError(data.error ?? 'Token inválido')
          return
        }
        setEmail(data.email)
      } catch {
        setTokenError('No se pudo validar el token.')
      } finally {
        setChecking(false)
      }
    }
    validate()
  }, [token, router])

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

    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setLoading(false)
      setError('No se pudo crear la cuenta. Puede que el email ya esté registrado.')
      return
    }

    await fetch('/api/signup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    setLoading(false)
    setSuccess(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold text-card-foreground">
          Crear cuenta
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          Completa tu registro como entrenador
        </p>

        {checking && <p className="text-center text-sm text-muted">Validando invitación…</p>}

        {!checking && tokenError && (
          <p className="text-center text-sm text-danger">{tokenError}</p>
        )}

        {!checking && !tokenError && !success && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-card-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                disabled
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-muted outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-card-foreground">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-card-foreground">
                Repetir contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
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
              {loading ? 'Creando cuenta…' : 'Registrarse'}
            </button>
          </form>
        )}

        {success && (
          <p className="text-center text-sm text-success">
            ✅ Cuenta creada. Redirigiendo…
          </p>
        )}
      </div>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted">Cargando…</p>
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  )
}
