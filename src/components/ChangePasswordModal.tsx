'use client'

import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

export default function ChangePasswordModal({
  email,
  onClose,
}: {
  email: string
  onClose: () => void
}) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (nueva.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: actual,
      })
      if (signInError) {
        setError('La contraseña actual no es correcta.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: nueva })
      if (updateError) {
        setError('No se pudo actualizar la contraseña.')
        return
      }

      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-card-foreground">Cambiar contraseña</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted hover:text-card-foreground"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-success">Contraseña actualizada ✅</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="actual" className="text-sm font-medium text-card-foreground">
                Contraseña actual
              </label>
              <input
                id="actual"
                type="password"
                required
                autoComplete="current-password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="nueva" className="text-sm font-medium text-card-foreground">
                Contraseña nueva
              </label>
              <input
                id="nueva"
                type="password"
                required
                autoComplete="new-password"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirmar" className="text-sm font-medium text-card-foreground">
                Confirmar contraseña nueva
              </label>
              <input
                id="confirmar"
                type="password"
                required
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
