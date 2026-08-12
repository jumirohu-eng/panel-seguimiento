'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const OPCIONES = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/admin', label: 'Gestión' },
  { href: '/metricas', label: 'Métricas' },
]

const OPCIONES_VISTA = [
  { href: '/dashboard?vista=entrenador', label: 'Ver como entrenador' },
  { href: '/cliente/dashboard', label: 'Ver como cliente' },
]

export default function AdminNavDropdown() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  const ref = useRef<HTMLDivElement>(null)

  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
      >
        Admin ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card py-1 shadow-sm">
          {OPCIONES.map((opcion) => {
            const activa = pathname === opcion.href
            return (
              <button
                key={opcion.href}
                onClick={() => router.push(opcion.href)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  activa
                    ? 'bg-background font-medium text-card-foreground'
                    : 'text-muted hover:bg-background'
                }`}
              >
                {opcion.label}
              </button>
            )
          })}
          <div className="my-1 border-t border-border" />
          {OPCIONES_VISTA.map((opcion) => {
            const activa = pathname === opcion.href
            return (
              <button
                key={opcion.href}
                onClick={() => router.push(opcion.href)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  activa
                    ? 'bg-background font-medium text-card-foreground'
                    : 'text-muted hover:bg-background'
                }`}
              >
                {opcion.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
