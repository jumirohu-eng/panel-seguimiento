'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ClientePerfil, ClienteCheckinResponse } from '@/lib/types'
import type { ObjetivoResuelto } from '@/lib/objetivos'
import { formatFechaLarga } from '@/lib/format'
import AdminNavDropdown from '@/components/AdminNavDropdown'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import MisObjetivos from '@/components/MisObjetivos'

const TITULOS_CHECKIN: Record<'diario' | 'semanal' | 'periodico', string> = {
  diario: 'Diario',
  semanal: 'Semanal',
  periodico: 'Periódico',
}

export default function ClienteDashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [perfil, setPerfil] = useState<ClientePerfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinCliente, setSinCliente] = useState(false)
  const [inactivo, setInactivo] = useState(false)
  const [puedeVolver, setPuedeVolver] = useState(false)
  const [esAdmin, setEsAdmin] = useState(false)
  const [checkin, setCheckin] = useState<ClienteCheckinResponse | null>(null)
  const [objetivos, setObjetivos] = useState<ObjetivoResuelto[]>([])
  const [showChangePassword, setShowChangePassword] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login')
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        router.push('/login')
        return
      }

      setEmail(userData.user.email ?? '')

      // Un admin o entrenador puede llegar aquí desde "Ver como cliente" sin re-loguearse
      // (ver AdminNavDropdown) — si además de cliente tiene otro rol, le mostramos un botón
      // para volver a su panel en vez de dejarlo sin salida en esta página.
      try {
        const rolRes = await fetch('/api/auth/rol', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (rolRes.ok) {
          const { rol } = await rolRes.json()
          setPuedeVolver(rol !== 'cliente')
          setEsAdmin(rol === 'admin')
        }
      } catch {
        // Si falla, simplemente no se muestra el botón de volver
      }

      try {
        const res = await fetch('/api/cliente/perfil', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 404) {
          // El email autenticado no corresponde a ningún cliente — no forzamos logout,
          // puede ser un admin/entrenador previsualizando esta vista sin tener ficha de cliente
          setSinCliente(true)
          return
        }
        if (res.status === 403) {
          setInactivo(true)
          return
        }
        if (!res.ok) throw new Error('No se pudo cargar el perfil')
        const data: ClientePerfil = await res.json()
        if (!data.onboardingCompletado) {
          router.push('/cliente/onboarding')
          return
        }
        setPerfil(data)
      } catch {
        setError('Error al cargar tus datos.')
      } finally {
        setLoading(false)
      }

      try {
        const checkinRes = await fetch('/api/cliente/checkin', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (checkinRes.ok) {
          const checkinData: ClienteCheckinResponse = await checkinRes.json()
          setCheckin(checkinData)
        }
      } catch {
        // Si falla, simplemente no se muestra el banner de check-in
      }

      try {
        const objetivosRes = await fetch('/api/cliente/objetivos', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (objetivosRes.ok) {
          const { objetivos: objetivosData } = await objetivosRes.json()
          setObjetivos(objetivosData)
        }
      } catch {
        // Si falla, simplemente no se muestra "Mis objetivos"
      }
    }
    init()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  if (sinCliente) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-sm text-muted">No se encontró ningún cliente asociado a {email}.</p>
        {esAdmin ? (
          <AdminNavDropdown />
        ) : (
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground hover:bg-background"
          >
            Volver a mi panel
          </button>
        )}
      </div>
    )
  }

  if (inactivo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="max-w-sm text-sm text-danger">
          Tu acceso está desactivado. Contacta con tu entrenador si crees que es un error.
        </p>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground hover:bg-background"
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  if (error || !perfil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-danger">{error ?? 'No se encontraron datos.'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div>
          <p className="text-sm font-medium capitalize text-card-foreground">{perfil.nombre}</p>
          <p className="text-xs text-muted">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          {esAdmin ? (
            <AdminNavDropdown />
          ) : (
            puedeVolver && (
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
              >
                Volver al panel
              </button>
            )
          )}
          <button
            onClick={() => setShowChangePassword(true)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
          >
            Cambiar contraseña
          </button>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-card-foreground">{perfil.nombre}</h1>
          <p className="mt-1 text-sm text-muted">
            Objetivo: {perfil.objetivo} · Entrenador: {perfil.entrenadorNombre}
          </p>
        </section>

        <MisObjetivos objetivos={objetivos} />

        {checkin && (
          <section className="rounded-xl border border-primary bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-card-foreground">Revisión</h2>
            <p className="mb-3 text-xs text-muted">Preguntas de tu entrenador sobre cómo te encuentras.</p>
            <div className="flex flex-col gap-3">
              {(['diario', 'semanal', 'periodico'] as const).map((tipo) => {
                const estado = checkin[tipo]
                // Esta tarjeta es solo para revisiones (el registro de objetivos se hace desde
                // "Mis objetivos", independiente de si el entrenador lanzó este tipo — ver
                // DECISIONS.md, "Objetivos independientes de Revisiones"). Si el tipo no está
                // lanzado, la API ya solo devuelve aquí campos de objetivo (o ninguno), así que
                // sin lanzar nunca hay revisión real que mostrar: se omite la fila entera en
                // vez de decir "No disponible todavía" sobre un tipo que puede tener un
                // objetivo perfectamente disponible.
                if (!estado.lanzado) return null
                const idsObjetivo = new Set(estado.objetivos.filter((o) => o.fuenteFieldId).map((o) => o.fuenteFieldId!))
                const tieneRevision = estado.campos.some((c) => !idsObjetivo.has(c.id))
                if (!tieneRevision) return null
                return (
                  <div key={tipo} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{TITULOS_CHECKIN[tipo]}</p>
                      {estado.yaEnviado ? (
                        estado.proximaFecha ? (
                          <p className="text-xs text-muted">
                            ✓ Completado — próxima fecha el {formatFechaLarga(estado.proximaFecha)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted">✓ Actualizado — disponible cuando quieras</p>
                        )
                      ) : estado.proximaFecha ? (
                        <p className="text-xs text-warning">Pendiente — próxima fecha el {formatFechaLarga(estado.proximaFecha)}</p>
                      ) : (
                        <p className="text-xs text-warning">Pendiente</p>
                      )}
                    </div>
                    <button
                      onClick={() => router.push(`/cliente/checkin?tipo=${tipo}`)}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-background"
                    >
                      {estado.yaEnviado ? 'Ver/actualizar' : 'Registrar'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {showChangePassword && (
        <ChangePasswordModal email={email} onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  )
}
