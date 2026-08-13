'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ClienteCheckinResponse } from '@/lib/types'
import CampoInput from '@/components/CampoInput'

type Seccion = 'diario' | 'semanal' | 'periodico'

const TITULOS: Record<Seccion, string> = {
  diario: 'Hoy',
  semanal: 'Esta semana',
  periodico: 'Tus datos',
}

function formatFechaLarga(fechaISO: string) {
  return new Date(fechaISO).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })
}

export default function ClienteCheckinPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<ClienteCheckinResponse | null>(null)
  const [valoresPorSeccion, setValoresPorSeccion] = useState<Record<Seccion, Record<string, unknown>>>({
    diario: {},
    semanal: {},
    periodico: {},
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<Seccion | null>(null)
  const [guardadoOk, setGuardadoOk] = useState<Seccion | null>(null)

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login')
        return
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        router.push('/login')
        return
      }
      setToken(accessToken)

      try {
        const res = await fetch('/api/cliente/checkin', { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!res.ok) throw new Error('No se pudo cargar el check-in')
        const json: ClienteCheckinResponse = await res.json()
        setData(json)
        setValoresPorSeccion({
          diario: { ...json.diario.ultimosValores },
          semanal: { ...json.semanal.ultimosValores },
          periodico: { ...json.periodico.ultimosValores },
        })
      } catch {
        setError('Error al cargar tu check-in.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  async function enviar(seccion: Seccion) {
    if (!token) return
    setGuardando(seccion)
    setGuardadoOk(null)
    try {
      const res = await fetch('/api/cliente/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tipo: seccion, valores: valoresPorSeccion[seccion] }),
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      setGuardadoOk(seccion)
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setGuardando(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-danger">{error ?? 'No se encontraron datos.'}</p>
      </div>
    )
  }

  const secciones: Seccion[] = ['diario', 'semanal', 'periodico']

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <h1 className="text-sm font-medium text-card-foreground">Registrar check-in</h1>
        <button
          onClick={() => router.push('/cliente/dashboard')}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
        >
          Volver
        </button>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6 sm:px-6">
        {secciones.map((seccion) => {
          const estado = data[seccion]
          if (estado.campos.length === 0) return null
          return (
            <section key={seccion} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-card-foreground">{TITULOS[seccion]}</h2>
                {estado.yaEnviado && (
                  <span className="text-xs text-muted">
                    {estado.proximaDisponibilidad
                      ? `Ya registrado — próximo turno el ${formatFechaLarga(estado.proximaDisponibilidad)}, pero puedes corregirlo ahora`
                      : 'Ya registrado — puedes actualizarlo cuando quieras'}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-4">
                {estado.campos.map((campo) => (
                  <CampoInput
                    key={campo.id}
                    campo={campo}
                    valor={valoresPorSeccion[seccion][campo.id]}
                    onChange={(v) =>
                      setValoresPorSeccion((prev) => ({
                        ...prev,
                        [seccion]: { ...prev[seccion], [campo.id]: v },
                      }))
                    }
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => enviar(seccion)}
                disabled={guardando === seccion}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {guardando === seccion ? 'Guardando…' : guardadoOk === seccion ? '✓ Guardado' : 'Guardar'}
              </button>
            </section>
          )
        })}

        {secciones.every((s) => data[s].campos.length === 0) && (
          <p className="text-sm text-muted">
            {!data.lanzado && data.disponibleDesde
              ? `Tu check-in estará disponible a partir del ${formatFechaLarga(data.disponibleDesde)}.`
              : !data.lanzado
                ? 'Tu entrenador todavía no ha activado tu check-in.'
                : 'Tu entrenador todavía no ha activado ningún campo de check-in.'}
          </p>
        )}
      </main>
    </div>
  )
}
