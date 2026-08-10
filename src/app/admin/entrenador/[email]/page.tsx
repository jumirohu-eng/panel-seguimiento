'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { EntrenadorDetalle } from '@/lib/types'
import { formatDateTime } from '@/lib/format'
import Header from '@/components/Header'

const SOLUCIONES = ['Seguimiento', 'Captación', 'Recuperación', 'Referidos', 'Metricas']
const ESTADOS = ['Activo', 'Prueba', 'Inactivo'] as const

const ESTADO_BADGE: Record<string, string> = {
  Activo: 'bg-success/10 text-success',
  Prueba: 'bg-warning/10 text-warning',
  Inactivo: 'bg-danger/10 text-danger',
}

const INVITACION_COLOR: Record<string, string> = {
  Activo: 'text-primary',
  Usado: 'text-success',
  Expirado: 'text-warning',
  Cancelado: 'text-danger',
}

export default function EntrenadorFichaPage() {
  const router = useRouter()
  const params = useParams<{ email: string }>()
  const emailParam = decodeURIComponent(params.email)

  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [entrenador, setEntrenador] = useState<EntrenadorDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [estado, setEstado] = useState<string>('Prueba')
  const [soluciones, setSoluciones] = useState<string[]>([])
  const [precio, setPrecio] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [invitando, setInvitando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  const loadEntrenador = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/entrenadores/${encodeURIComponent(emailParam)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('No se pudo cargar el entrenador')
      const data = await res.json()
      const ent: EntrenadorDetalle = data.entrenador
      setEntrenador(ent)
      setEstado(ent.estado)
      setSoluciones(ent.soluciones)
      setPrecio(String(ent.precioMensual))
      setNotas(ent.notas)
    } catch {
      setError('Error al cargar la ficha del entrenador.')
    } finally {
      setLoading(false)
    }
  }, [emailParam, getToken, router])

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }
      setSessionEmail(data.user.email ?? '')
      setAuthorized(true)
      setCheckingAuth(false)
      await loadEntrenador()
    }
    init()
  }, [router, loadEntrenador])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  function toggleSolucion(sol: string) {
    setSoluciones((prev) => (prev.includes(sol) ? prev.filter((s) => s !== sol) : [...prev, sol]))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/entrenadores/${encodeURIComponent(emailParam)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          estado,
          soluciones,
          precioMensual: precio ? Number(precio) : 0,
          notas,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar los cambios')
      setToast('✅ Cambios guardados')
      await loadEntrenador()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyInvite(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/signup?token=${token}`)
    setToast('Link copiado al portapapeles')
  }

  async function handleGenerarInvitacion() {
    setInvitando(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: emailParam }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al generar invitación')
      setToast('✅ Invitación generada')
      await loadEntrenador()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Error al generar invitación')
    } finally {
      setInvitando(false)
    }
  }

  async function handleRegenerarInvitacion() {
    setInvitando(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: emailParam }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al regenerar invitación')
      setToast('✅ Invitación regenerada')
      await loadEntrenador()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Error al regenerar invitación')
    } finally {
      setInvitando(false)
    }
  }

  async function handleResetPassword() {
    setResetting(true)
    setResetError(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: emailParam }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al resetear la contraseña')
      setNewPassword(data.newPassword)
      setShowResetConfirm(false)
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Error al resetear la contraseña')
    } finally {
      setResetting(false)
    }
  }

  async function handleCopyPassword() {
    if (!newPassword) return
    await navigator.clipboard.writeText(newPassword)
    setToast('Contraseña copiada')
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/entrenadores/${encodeURIComponent(emailParam)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Error al borrar el entrenador')
      router.push('/admin')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al borrar el entrenador')
      setDeleting(false)
    }
  }

  const isDirty = entrenador
    ? estado !== entrenador.estado ||
      precio !== String(entrenador.precioMensual) ||
      notas !== entrenador.notas ||
      JSON.stringify([...soluciones].sort()) !== JSON.stringify([...entrenador.soluciones].sort())
    : false

  if (checkingAuth || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {sessionEmail && <Header email={sessionEmail} />}

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
        {toast && (
          <div className="fixed right-4 top-4 z-50 rounded-lg border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-sm">
            {toast}
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-card-foreground">
                ¿Borrar a {entrenador?.nombre}?
              </h3>
              <p className="mb-4 text-sm text-muted">
                Esta acción no se puede deshacer. Se borrará su registro de Airtable y, si tiene
                cuenta creada, su usuario de Supabase (ya no podrá iniciar sesión).
              </p>
              {deleteError && <p className="mb-3 text-sm text-danger">{deleteError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {deleting ? 'Borrando…' : 'Sí, borrar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-card-foreground">
                ¿Resetear contraseña?
              </h3>
              <p className="mb-4 text-sm text-muted">
                Esto invalida su contraseña actual e impide que inicie sesión hasta que le des la
                nueva.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetting}
                  className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {resetting ? 'Reseteando…' : 'Sí, resetear'}
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/admin')}
          className="w-fit text-sm text-muted hover:text-primary"
        >
          ← Volver a entrenadores
        </button>

        {loading && <p className="text-sm text-muted">Cargando…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {entrenador && (
          <>
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-card-foreground">
                    {entrenador.nombre}
                  </h1>
                  <p className="text-sm text-muted">{entrenador.email}</p>
                  {entrenador.telefono && (
                    <p className="text-sm text-muted">{entrenador.telefono}</p>
                  )}
                  {entrenador.linkWhatsapp && (
                    <a
                      href={entrenador.linkWhatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
                    >
                      Escribir por WhatsApp
                    </a>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${ESTADO_BADGE[estado] ?? ''}`}
                  >
                    {estado}
                  </span>
                  {isDirty && <span className="text-xs text-warning">Sin guardar</span>}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Estado</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">
                    Precio mensual (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">
                    Fecha de alta
                  </label>
                  <p className="text-sm text-muted">{entrenador.fechaAlta || '—'}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">
                    Última actividad
                  </label>
                  <p className="text-sm text-muted">
                    {entrenador.ultimoLogin
                      ? formatDateTime(entrenador.ultimoLogin)
                      : 'Nunca ha iniciado sesión'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm font-medium text-card-foreground">
                  Soluciones contratadas
                </label>
                <div className="flex flex-wrap gap-2">
                  {SOLUCIONES.map((sol) => (
                    <button
                      type="button"
                      key={sol}
                      onClick={() => toggleSolucion(sol)}
                      className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                        soluciones.includes(sol)
                          ? 'border-primary bg-primary text-white'
                          : 'border-border text-card-foreground hover:bg-background'
                      }`}
                    >
                      {sol}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm font-medium text-card-foreground">Notas</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={4}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                />
              </div>

              {saveError && <p className="mt-3 text-sm text-danger">{saveError}</p>}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {isDirty && !saving && (
                  <span className="text-sm text-warning">Tienes cambios sin guardar</span>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-card-foreground">Clientes</h2>
              <p className="text-3xl font-semibold text-card-foreground">
                {entrenador.clientesActivos}{' '}
                <span className="text-base font-normal text-muted">clientes activos</span>
              </p>

              {entrenador.snapshots.length > 0 ? (
                <div className="mt-4 h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={entrenador.snapshots}>
                      <XAxis dataKey="fecha" hide />
                      <Tooltip formatter={(value) => [value, 'Clientes activos']} />
                      <Line
                        type="monotone"
                        dataKey="clientesActivos"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Todavía no hay histórico mensual para este entrenador.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-card-foreground">Invitación</h2>

              {entrenador.invitacion ? (
                <div className="mb-3 flex flex-col gap-1">
                  <p className="text-sm text-card-foreground">
                    Token:{' '}
                    <span className="font-mono text-xs text-muted">
                      {entrenador.invitacion.tokenTruncado}
                    </span>
                  </p>
                  <p
                    className={`text-sm font-medium ${INVITACION_COLOR[entrenador.invitacion.estado] ?? ''}`}
                  >
                    {entrenador.invitacion.estado}
                  </p>
                </div>
              ) : (
                <p className="mb-3 text-sm text-muted">
                  Este entrenador todavía no tiene ninguna invitación.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {entrenador.invitacion?.estado === 'Activo' ? (
                  <>
                    <button
                      onClick={() => handleCopyInvite(entrenador.invitacion!.token)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
                    >
                      Copiar link de invitación
                    </button>
                    <button
                      onClick={handleRegenerarInvitacion}
                      disabled={invitando}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background disabled:opacity-50"
                    >
                      {invitando ? 'Regenerando…' : 'Regenerar invitación'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleGenerarInvitacion}
                    disabled={invitando}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {invitando ? 'Generando…' : 'Generar nueva invitación'}
                  </button>
                )}
              </div>

              <div className="my-4 border-t border-border" />

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-card-foreground">Acceso</h3>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="w-fit rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
                >
                  Resetear contraseña
                </button>

                {resetError && <p className="text-sm text-danger">{resetError}</p>}

                {newPassword && (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
                    <p className="text-sm text-card-foreground">
                      Nueva contraseña temporal:{' '}
                      <span className="font-mono font-semibold">{newPassword}</span>
                    </p>
                    <button
                      onClick={handleCopyPassword}
                      className="w-fit rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-card"
                    >
                      Copiar
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-danger/30 bg-card p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-card-foreground">Zona de peligro</h2>
              <p className="mb-4 text-sm text-muted">
                Borra a este entrenador de Airtable y su cuenta de Supabase. Útil para limpiar
                registros de prueba. No borra sus clientes ni reportes.
              </p>
              <button
                onClick={() => {
                  setDeleteError(null)
                  setShowDeleteConfirm(true)
                }}
                className="w-fit rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
              >
                Borrar entrenador
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
