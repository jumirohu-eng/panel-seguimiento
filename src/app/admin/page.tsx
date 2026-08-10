'use client'

import { Suspense, useCallback, useEffect, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Entrenador } from '@/lib/types'
import { formatDateTime } from '@/lib/format'
import Header from '@/components/Header'
import AlertasPanel from '@/components/admin/AlertasPanel'
import AplicacionesPanel from '@/components/admin/AplicacionesPanel'

const SOLUCIONES = ['Seguimiento', 'Captación', 'Recuperación', 'Referidos']
const ESTADOS = ['Activo', 'Prueba', 'Inactivo'] as const

const ESTADO_BADGE: Record<string, string> = {
  Activo: 'bg-success/10 text-success',
  Prueba: 'bg-warning/10 text-warning',
  Inactivo: 'bg-danger/10 text-danger',
}

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

function esLoginReciente(ultimoLogin: string | null) {
  if (!ultimoLogin) return false
  return Date.now() - new Date(ultimoLogin).getTime() < SIETE_DIAS_MS
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageContent />
    </Suspense>
  )
}

function AdminPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [entrenadores, setEntrenadores] = useState<Entrenador[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formNombre, setFormNombre] = useState('')
  const [formTelefono, setFormTelefono] = useState('')
  const [formSoluciones, setFormSoluciones] = useState<string[]>([])
  const [formEstado, setFormEstado] = useState('Prueba')
  const [formPrecio, setFormPrecio] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  const loadEntrenadores = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/entrenadores', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('No se pudo cargar la lista')
      const data = await res.json()
      setEntrenadores(data.entrenadores)
    } catch {
      setListError('Error al cargar los entrenadores.')
    } finally {
      setLoadingList(false)
    }
  }, [getToken, router])

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }
      setEmail(data.user.email ?? '')
      setAuthorized(true)
      setCheckingAuth(false)
      if (searchParams.get('nuevo') === '1') {
        setShowForm(true)
      }
      await loadEntrenadores()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadEntrenadores])

  function toggleSolucion(sol: string) {
    setFormSoluciones((prev) =>
      prev.includes(sol) ? prev.filter((s) => s !== sol) : [...prev, sol]
    )
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setCreating(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/entrenadores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formEmail.trim(),
          nombre: formNombre.trim(),
          telefono: formTelefono.trim(),
          soluciones: formSoluciones,
          estado: formEstado,
          precioMensual: formPrecio ? Number(formPrecio) : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear entrenador')

      setShowForm(false)
      setFormEmail('')
      setFormNombre('')
      setFormTelefono('')
      setFormSoluciones([])
      setFormEstado('Prueba')
      setFormPrecio('')
      await loadEntrenadores()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear entrenador')
    } finally {
      setCreating(false)
    }
  }

  if (checkingAuth || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {email && <Header email={email} />}

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-foreground">Entrenadores</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            {showForm ? 'Cancelar' : '+ Nuevo entrenador'}
          </button>
        </div>

        {showForm && (
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">Nuevo entrenador</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Email</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                    placeholder="entrenador@email.com"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Nombre</label>
                  <input
                    type="text"
                    required
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Teléfono</label>
                  <input
                    type="tel"
                    value={formTelefono}
                    onChange={(e) => setFormTelefono(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                    placeholder="+34600000000"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">
                    Precio mensual (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formPrecio}
                    onChange={(e) => setFormPrecio(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Estado</label>
                  <select
                    value={formEstado}
                    onChange={(e) => setFormEstado(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  >
                    {ESTADOS.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-card-foreground">Soluciones</label>
                <div className="flex flex-wrap gap-2">
                  {SOLUCIONES.map((sol) => (
                    <button
                      type="button"
                      key={sol}
                      onClick={() => toggleSolucion(sol)}
                      className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                        formSoluciones.includes(sol)
                          ? 'border-primary bg-primary text-white'
                          : 'border-border text-card-foreground hover:bg-background'
                      }`}
                    >
                      {sol}
                    </button>
                  ))}
                </div>
              </div>

              {formError && <p className="text-sm text-danger">{formError}</p>}

              <button
                type="submit"
                disabled={creating}
                className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {creating ? 'Creando…' : 'Crear entrenador'}
              </button>
            </form>
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {loadingList && <p className="text-sm text-muted">Cargando…</p>}
          {listError && <p className="text-sm text-danger">{listError}</p>}
          {!loadingList && !listError && entrenadores.length === 0 && (
            <p className="text-sm text-muted">Todavía no hay entrenadores dados de alta.</p>
          )}

          {!loadingList && entrenadores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 pr-4 font-medium">Nombre</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 pr-4 font-medium">Soluciones</th>
                    <th className="py-2 pr-4 font-medium">Clientes activos</th>
                    <th className="py-2 pr-4 font-medium">Precio/mes</th>
                    <th className="py-2 pr-4 font-medium">Alta</th>
                    <th className="py-2 pr-4 font-medium">Actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {entrenadores.map((ent) => (
                    <tr
                      key={ent.id}
                      onClick={() =>
                        router.push(`/admin/entrenador/${encodeURIComponent(ent.email)}`)
                      }
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
                    >
                      <td className="py-2 pr-4 font-medium text-card-foreground">{ent.nombre}</td>
                      <td className="py-2 pr-4 text-muted">{ent.email}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE[ent.estado] ?? ''}`}
                        >
                          {ent.estado}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {ent.soluciones.map((s) => (
                            <span
                              key={s}
                              className="rounded-full border border-border px-2 py-0.5 text-xs text-card-foreground"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-card-foreground">{ent.clientesActivos}</td>
                      <td className="py-2 pr-4 text-card-foreground">{ent.precioMensual}€</td>
                      <td className="py-2 pr-4 text-card-foreground">{ent.fechaAlta}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5 text-card-foreground">
                          <span
                            className={`h-2 w-2 rounded-full ${esLoginReciente(ent.ultimoLogin) ? 'bg-success' : 'bg-muted'}`}
                          />
                          <span className="text-xs text-muted">
                            {ent.ultimoLogin ? formatDateTime(ent.ultimoLogin) : 'Nunca'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <AlertasPanel />
        <AplicacionesPanel />
      </main>
    </div>
  )
}
