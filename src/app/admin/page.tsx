'use client'

import { useCallback, useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Invitacion } from '@/lib/types'
import Header from '@/components/Header'

interface GeneratedInvite {
  token: string
  inviteLink: string
  expiresAt: string
}

function formatRelativeDay(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const dayDiff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000
  )
  if (dayDiff === 0) return 'Hoy'
  if (dayDiff === 1) return 'Mañana'
  if (dayDiff === -1) return 'Ayer'
  return dayDiff > 0 ? `En ${dayDiff}d` : `Hace ${Math.abs(dayDiff)}d`
}

const ESTADO_STYLES: Record<Invitacion['estado'], string> = {
  Activo: 'text-primary',
  Usado: 'text-success',
  Expirado: 'text-warning',
  Cancelado: 'text-danger',
}

const ESTADO_ICONS: Record<Invitacion['estado'], string> = {
  Activo: '⏳',
  Usado: '✅',
  Expirado: '⏰',
  Cancelado: '✕',
}

export default function AdminPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [generateEmail, setGenerateEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(null)

  const [actionToken, setActionToken] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  const loadInvitaciones = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/invitaciones', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('No se pudo cargar el historial')
      const data = await res.json()
      setInvitaciones(data.invitaciones)
    } catch {
      setListError('Error al cargar el historial de invitaciones.')
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
      await loadInvitaciones()
    }
    init()
  }, [router, loadInvitaciones])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  async function handleGenerate(e: FormEvent) {
    e.preventDefault()
    setGenerateError(null)
    setGenerating(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: generateEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al generar invitación')

      setGeneratedInvite({
        token: data.token,
        inviteLink: data.inviteLink,
        expiresAt: data.expiresAt,
      })
      setGenerateEmail('')
      setToast('✅ Invitación generada')
      await loadInvitaciones()
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Error al generar invitación')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy(link: string) {
    await navigator.clipboard.writeText(link)
    setToast('Link copiado al portapapeles')
  }

  async function handleRegenerate(inv: Invitacion) {
    setActionToken(inv.token)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inv.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al regenerar invitación')

      setGeneratedInvite({
        token: data.token,
        inviteLink: data.inviteLink,
        expiresAt: data.expiresAt,
      })
      setToast('✅ Invitación regenerada')
      await loadInvitaciones()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Error al regenerar invitación')
    } finally {
      setActionToken(null)
    }
  }

  async function handleCancel(inv: Invitacion) {
    setActionToken(inv.token)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: inv.token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cancelar invitación')

      setToast('Invitación cancelada')
      await loadInvitaciones()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Error al cancelar invitación')
    } finally {
      setActionToken(null)
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
        {toast && (
          <div className="fixed right-4 top-4 z-50 rounded-lg border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-sm">
            {toast}
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Generar nueva invitación
          </h2>

          <form onSubmit={handleGenerate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="generateEmail" className="text-sm font-medium text-card-foreground">
                Email del entrenador
              </label>
              <input
                id="generateEmail"
                type="email"
                required
                value={generateEmail}
                onChange={(e) => setGenerateEmail(e.target.value)}
                placeholder="entrenador@email.com"
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={generating}
              className="rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {generating ? 'Generando…' : 'Generar invitación'}
            </button>
          </form>

          {generateError && <p className="mt-3 text-sm text-danger">{generateError}</p>}

          {generatedInvite && (
            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
              <p className="text-sm text-success">✅ Token generado: {generatedInvite.token}</p>
              <p className="break-all text-sm text-muted">{generatedInvite.inviteLink}</p>
              <button
                onClick={() => handleCopy(generatedInvite.inviteLink)}
                className="w-fit rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-card"
              >
                Copiar al portapapeles
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            Historial de invitaciones
          </h2>

          {loadingList && <p className="text-sm text-muted">Cargando…</p>}
          {listError && <p className="text-sm text-danger">{listError}</p>}
          {!loadingList && !listError && invitaciones.length === 0 && (
            <p className="text-sm text-muted">Todavía no se han generado invitaciones.</p>
          )}

          {!loadingList && invitaciones.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Token</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 pr-4 font-medium">Expira</th>
                    <th className="py-2 pr-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invitaciones.map((inv) => (
                    <tr key={inv.token} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 text-card-foreground">{inv.email}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted">
                        {inv.tokenTruncado}
                      </td>
                      <td className={`py-2 pr-4 font-medium ${ESTADO_STYLES[inv.estado]}`}>
                        {inv.estado} {ESTADO_ICONS[inv.estado]}
                      </td>
                      <td className="py-2 pr-4 text-card-foreground">
                        {formatRelativeDay(inv.expira)}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          {inv.estado === 'Activo' && (
                            <>
                              <button
                                onClick={() =>
                                  handleCopy(`${window.location.origin}/signup?token=${inv.token}`)
                                }
                                className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-card-foreground hover:bg-background"
                              >
                                Copiar link
                              </button>
                              <button
                                onClick={() => handleRegenerate(inv)}
                                disabled={actionToken === inv.token}
                                className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-card-foreground hover:bg-background disabled:opacity-50"
                              >
                                Regenerar
                              </button>
                              <button
                                onClick={() => handleCancel(inv)}
                                disabled={actionToken === inv.token}
                                className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-danger hover:bg-background disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
