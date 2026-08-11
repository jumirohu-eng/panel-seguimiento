'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/admin'
import AdminNavDropdown from './AdminNavDropdown'
import Marketplace from './Marketplace'
import ChangePasswordModal from './ChangePasswordModal'

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem('theme')
  if (stored) return stored === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function Header({ email, showMarketplace = true }: { email: string; showMarketplace?: boolean }) {
  const router = useRouter()
  const [dark, setDark] = useState(getInitialDark)
  const [mostrarMarketplace, setMostrarMarketplace] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

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

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-6">
      <div>
        <p className="text-sm font-medium capitalize text-card-foreground">{nombre}</p>
        <p className="text-xs text-muted">{email}</p>
      </div>
      <div className="flex items-center gap-2">
        {isAdmin && <AdminNavDropdown />}
        {!isAdmin && showMarketplace && (
          <button
            onClick={() => setMostrarMarketplace(true)}
            aria-label="Abrir marketplace"
            className="rounded-lg border border-border p-2 text-sm text-card-foreground hover:bg-background"
          >
            🏪
          </button>
        )}
        <button
          onClick={() => setShowChangePassword(true)}
          aria-label="Cambiar contraseña"
          className="rounded-lg border border-border p-2 text-sm text-card-foreground hover:bg-background"
        >
          🔑
        </button>
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

      {mostrarMarketplace && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10"
          onClick={() => setMostrarMarketplace(false)}
        >
          <div
            className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">Marketplace</h2>
              <button
                type="button"
                onClick={() => setMostrarMarketplace(false)}
                aria-label="Cerrar"
                className="text-muted hover:text-card-foreground"
              >
                ✕
              </button>
            </div>
            <Marketplace />
          </div>
        </div>
      )}

      {showChangePassword && (
        <ChangePasswordModal email={email} onClose={() => setShowChangePassword(false)} />
      )}
    </header>
  )
}
