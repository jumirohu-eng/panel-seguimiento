'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OnboardingCliente, DiaSemana } from '@/lib/types'

const OBJETIVOS = ['Hipertrofia', 'Pérdida de peso', 'Tonificar', 'Rehabilitación']

const DIAS: { value: DiaSemana; label: string }[] = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
]

export default function OnboardingClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const [objetivo, setObjetivo] = useState('')
  const [objetivosAdicionales, setObjetivosAdicionales] = useState<string[]>([])
  const [diasDisponibles, setDiasDisponibles] = useState<DiaSemana[]>([])
  const [comentario, setComentario] = useState('')

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

      try {
        const res = await fetch('/api/cliente/onboarding', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 403 || res.status === 404) {
          router.push('/cliente/dashboard')
          return
        }
        if (!res.ok) throw new Error('No se pudo cargar el onboarding')
        const data: OnboardingCliente = await res.json()
        if (data.completado) {
          router.push('/cliente/dashboard')
          return
        }
        setObjetivo(data.objetivo)
        setObjetivosAdicionales(data.objetivosAdicionales)
        setDiasDisponibles(data.diasDisponibles)
        setComentario(data.comentario)
      } catch {
        setError('Error al cargar tus datos.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  function toggleAdicional(v: string) {
    setObjetivosAdicionales((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  function toggleDia(v: DiaSemana) {
    setDiasDisponibles((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorGuardar(null)
    if (!objetivo) {
      setErrorGuardar('Selecciona tu objetivo principal.')
      return
    }
    setGuardando(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/cliente/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ objetivo, objetivosAdicionales, diasDisponibles, comentario }),
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      router.push('/cliente/dashboard')
    } catch {
      setErrorGuardar('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-danger">{error}</p>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-card-foreground">¡Bienvenido!</h1>
        <p className="mb-6 text-sm text-muted">
          Antes de empezar, cuéntanos un poco sobre ti. Es rápido.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-card-foreground">Objetivo principal</label>
            <select
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              required
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {OBJETIVOS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-card-foreground">
              Otros objetivos <span className="text-xs font-normal text-muted">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {OBJETIVOS.filter((o) => o !== objetivo).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggleAdicional(o)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    objetivosAdicionales.includes(o)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted hover:bg-background'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-card-foreground">
              Días habituales disponibles para entrenar <span className="text-xs font-normal text-muted">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDia(d.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    diasDisponibles.includes(d.value)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted hover:bg-background'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="comentario" className="text-sm font-medium text-card-foreground">
              Comentario <span className="text-xs font-normal text-muted">(opcional)</span>
            </label>
            <textarea
              id="comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              placeholder="Algo que quieras contarle a tu entrenador…"
              className="w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
            />
          </div>

          {errorGuardar && <p className="text-sm text-danger">{errorGuardar}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="mt-1 rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Empezar'}
          </button>
        </form>
      </div>
    </main>
  )
}
