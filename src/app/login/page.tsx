'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })

    setLoading(false)

    if (error) {
      setError(error.message || 'Error desconocido al iniciar sesión')
      return
    }

    router.push('/dashboard')
  }

  async function handleResetPassword() {
    setError(null)
    setInfo(null)

    if (!email) {
      setError('Introduce tu email para restablecer la contraseña.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError('No se pudo enviar el email de recuperación.')
      return
    }

    setInfo('Te hemos enviado un email para restablecer tu contraseña.')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold text-card-foreground">
          Panel de Seguimiento
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          Accede a tu panel de entrenador
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-card-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              placeholder="tu@email.com"
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {info && <p className="text-sm text-success">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResetPassword}
          className="mt-4 w-full text-center text-sm text-muted hover:text-primary"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>
    </main>
  )
}
