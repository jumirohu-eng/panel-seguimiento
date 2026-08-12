'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { ClientePerfil } from '@/lib/types'

function formatFecha(fechaISO: string) {
  return new Date(fechaISO).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

export default function ClienteDashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [perfil, setPerfil] = useState<ClientePerfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinCliente, setSinCliente] = useState(false)
  const [puedeVolver, setPuedeVolver] = useState(false)

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
        if (!res.ok) throw new Error('No se pudo cargar el perfil')
        const data: ClientePerfil = await res.json()
        setPerfil(data)
      } catch {
        setError('Error al cargar tus datos.')
      } finally {
        setLoading(false)
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
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground hover:bg-background"
        >
          Volver a mi panel
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

  const { cansado, normal, conEnergia, total } = perfil.energiaPromedio30dias
  const progresoEntrenamientos = perfil.entrenamientosRecientes[perfil.entrenamientosRecientes.length - 1]
  const pctObjetivo =
    progresoEntrenamientos && perfil.entrenamientosObjetivo > 0
      ? Math.min(100, Math.round((progresoEntrenamientos.entrenamientos / perfil.entrenamientosObjetivo) * 100))
      : 0

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div>
          <p className="text-sm font-medium capitalize text-card-foreground">{perfil.nombre}</p>
          <p className="text-xs text-muted">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          {puedeVolver && (
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
            >
              Volver al panel
            </button>
          )}
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

        {perfil.alertaReciente && (
          <section className="rounded-xl border border-warning bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-warning">Mensaje de tu entrenador</h2>
            <p className="text-sm text-card-foreground">{perfil.alertaReciente}</p>
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">Peso (últimos 3 meses)</h2>
          {perfil.pesoHistorico.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perfil.pesoHistorico} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="fecha"
                    tickFormatter={formatFecha}
                    tick={{ fontSize: 12 }}
                    stroke="var(--muted)"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" domain={['auto', 'auto']} />
                  <Tooltip
                    labelFormatter={(label) => formatFecha(String(label))}
                    formatter={(value) => [`${value} kg`, 'Peso']}
                  />
                  <Line type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted">Todavía no hay suficientes check-ins con peso registrado.</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">Entrenamientos</h2>
          {progresoEntrenamientos ? (
            <>
              <p className="mb-2 text-sm text-card-foreground">
                {progresoEntrenamientos.entrenamientos} de {perfil.entrenamientosObjetivo} entrenamientos
                (última semana)
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pctObjetivo}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Todavía no hay check-ins registrados.</p>
          )}

          {perfil.entrenamientosRecientes.length > 1 && (
            <div className="mt-4 flex gap-4 text-xs text-muted">
              {perfil.entrenamientosRecientes.map((r) => (
                <span key={r.fecha}>
                  {formatFecha(r.fecha)}: {r.entrenamientos}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-card-foreground">Energía (últimos 30 días)</h2>
          {total > 0 ? (
            <p className="text-sm text-card-foreground">
              Con energía: {conEnergia} · Normal: {normal} · Cansado: {cansado}
            </p>
          ) : (
            <p className="text-sm text-muted">Todavía no hay check-ins en los últimos 30 días.</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-card-foreground">Próximo check-in</h2>
          {perfil.proximoCheckinDias === null ? (
            <p className="text-sm text-muted">Todavía no has hecho tu primer check-in.</p>
          ) : perfil.proximoCheckinDias > 0 ? (
            <p className="text-sm text-card-foreground">En {perfil.proximoCheckinDias} día(s)</p>
          ) : (
            <p className="text-sm text-warning">Ya te toca — no hemos recibido tu check-in de esta semana</p>
          )}
        </section>
      </main>
    </div>
  )
}
