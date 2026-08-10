'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Estado = 'comprobando' | 'confirmado' | 'error'

function parseParams(search: string, hash: string) {
  const fromSearch = new URLSearchParams(search)
  const fromHash = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  return { fromSearch, fromHash }
}

export default function SignupConfirmPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('comprobando')
  const [mensajeError, setMensajeError] = useState('El enlace de confirmación no es válido.')

  useEffect(() => {
    async function procesar() {
      const { fromSearch, fromHash } = parseParams(window.location.search, window.location.hash)
      const errorCode = fromHash.get('error_code') ?? fromSearch.get('error_code')
      const errorDescription = fromHash.get('error_description') ?? fromSearch.get('error_description')

      if (errorCode || errorDescription) {
        setMensajeError(
          errorCode === 'otp_expired'
            ? 'Este enlace de confirmación ya se usó o ha caducado. Prueba a iniciar sesión directamente: es posible que tu cuenta ya esté activa. Si no, pide a tu administrador que te reenvíe la invitación.'
            : (errorDescription ? decodeURIComponent(errorDescription).replace(/\+/g, ' ') : null) ??
                'El enlace de confirmación no es válido.'
        )
        setEstado('error')
        return
      }

      try {
        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          setEstado('confirmado')
          setTimeout(() => router.push('/login'), 2000)
          return
        }
      } catch {
        // sigue al estado de error de abajo
      }

      setEstado('error')
    }

    procesar()
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-card-foreground">Confirmación de email</h1>

        {estado === 'comprobando' && (
          <p className="mt-4 text-sm text-muted">Comprobando tu enlace…</p>
        )}

        {estado === 'confirmado' && (
          <p className="mt-4 text-sm text-success">✅ Email confirmado. Redirigiendo a iniciar sesión…</p>
        )}

        {estado === 'error' && (
          <>
            <p className="mt-4 text-sm text-danger">{mensajeError}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Ir a iniciar sesión
            </button>
          </>
        )}
      </div>
    </main>
  )
}
