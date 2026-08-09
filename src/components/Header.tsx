'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/admin'

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem('theme')
  if (stored) return stored === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function Header({ email }: { email: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [dark, setDark] = useState(getInitialDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  function toggleDark() {
    setDark((d) => !d)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const nombre = email.split('@')[0]
  const isAdmin = email === ADMIN_EMAIL
  const onAdminPages = pathname?.startsWith('/admin') ?? false

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-6">
      <div>
        <p className="text-sm font-medium capitalize text-card-foreground">{nombre}</p>
        <p className="text-xs text-muted">{email}</p>
      </div>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            onClick={() => router.push(onAdminPages ? '/dashboard' : '/admin')}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
          >
            {onAdminPages ? 'Volver al dashboard' : 'Admin'}
          </button>
        )}
        <button
          onClick={toggleDark}
          aria-label="Cambiar modo oscuro"
          className="rounded-lg border border-border p-2 text-sm text-card-foreground hover:bg-background"
        >
          {dark ? '☀️' : '🌙'}
        </button>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
