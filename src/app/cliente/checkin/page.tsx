'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ClienteCheckinResponse, CampoCheckinResuelto } from '@/lib/types'
import type { ObjetivoResuelto } from '@/lib/objetivos'
import { formatearProgresoTexto } from '@/lib/objetivos'
import { campoDisponible } from '@/lib/checkinFields'
import { formatFechaLarga } from '@/lib/format'
import CampoInput from '@/components/CampoInput'

type Seccion = 'diario' | 'semanal' | 'periodico'

const TITULOS: Record<Seccion, string> = {
  diario: 'Hoy',
  semanal: 'Esta semana',
  periodico: 'Tus datos',
}

const TITULOS_OBJETIVOS: Record<Seccion, string> = {
  diario: 'Objetivos de hoy',
  semanal: 'Objetivos de esta semana',
  periodico: 'Objetivos de este periodo',
}

// Un campo es "de objetivo" si al menos un objetivo vigente de esta sección lo usa como fuente
// de progreso — se registra dentro del bloque de objetivos, no como revisión. El resto de
// campos activos (Energía, Fatiga, Dolor, Comentario…) son "Revisión": preguntas sobre cómo
// está el cliente, no metas con progreso. Cálculo puramente derivado de datos ya cargados, sin
// tocar la API (ver DECISIONS.md, "Objetivos primero, Revisiones aparte").
function idsFuenteDeObjetivos(objetivos: ObjetivoResuelto[]): Set<string> {
  return new Set(objetivos.filter((o) => o.fuenteFieldId).map((o) => o.fuenteFieldId!))
}

function ObjetivoPeso({ objetivo }: { objetivo: ObjetivoResuelto }) {
  const p = objetivo.progreso
  return (
    <div className="mb-2 rounded-lg bg-card p-3">
      <p className="mb-1 text-xs font-medium text-muted">
        {objetivo.nombre} objetivo: {objetivo.meta} {objetivo.unidad}
      </p>
      {p ? (
        <>
          <p className="mb-1 text-xs text-muted">Actual: {p.valor} {objetivo.unidad}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className={`h-full rounded-full ${p.completado ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${Math.min(100, Math.max(0, p.porcentaje))}%` }}
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-muted">Aún no has registrado datos.</p>
      )}
    </div>
  )
}

export default function ClienteCheckinPage() {
  return (
    <Suspense fallback={null}>
      <ClienteCheckinPageContent />
    </Suspense>
  )
}

function ClienteCheckinPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campoDestacado = searchParams.get('campo')
  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<ClienteCheckinResponse | null>(null)
  const [valoresPorSeccion, setValoresPorSeccion] = useState<Record<Seccion, Record<string, unknown>>>({
    diario: {},
    semanal: {},
    periodico: {},
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inactivo, setInactivo] = useState(false)
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
        if (res.status === 403) {
          setInactivo(true)
          return
        }
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

  useEffect(() => {
    if (!campoDestacado || !data) return
    const el = document.getElementById(`campo-${campoDestacado}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [campoDestacado, data])

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

  if (inactivo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="max-w-sm text-center text-sm text-danger">
          Tu acceso está desactivado. Contacta con tu entrenador si crees que es un error.
        </p>
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
        <h1 className="text-sm font-medium text-card-foreground">Tu seguimiento</h1>
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

          // El registro de objetivos es independiente de que el entrenador haya lanzado el
          // check-in de este tipo — la API ya solo devuelve aquí los campos "de objetivo"
          // cuando no está lanzado (ver DECISIONS.md, "Objetivos independientes de
          // Revisiones"). Solo mostramos el aviso de "no disponible" cuando de verdad no hay
          // nada que registrar en este tipo.
          if (estado.campos.length === 0) {
            if (!estado.lanzado) {
              return (
                <section key={seccion} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="mb-2 text-lg font-semibold text-card-foreground">{TITULOS[seccion]}</h2>
                  <p className="text-sm text-muted">
                    {estado.disponibleDesde
                      ? `Disponible a partir del ${formatFechaLarga(estado.disponibleDesde)}.`
                      : 'Tu entrenador todavía no ha activado nada aquí.'}
                  </p>
                </section>
              )
            }
            return null
          }

          const valores = valoresPorSeccion[seccion]
          const idsObjetivo = idsFuenteDeObjetivos(estado.objetivos)
          const camposObjetivo = estado.campos.filter((c) => idsObjetivo.has(c.id))
          const camposRevision = estado.campos.filter((c) => !idsObjetivo.has(c.id))

          function renderCampo(campo: CampoCheckinResuelto, objetivoPeso?: ObjetivoResuelto) {
            return (
              <div key={campo.id} id={`campo-${campo.id}`}>
                {objetivoPeso && <ObjetivoPeso objetivo={objetivoPeso} />}
                <CampoInput
                  campo={objetivoPeso ? { ...campo, nombre: '¿Cuánto pesas?' } : campo}
                  valor={valores[campo.id]}
                  disabled={!campoDisponible(campo, valores)}
                  onChange={(v) =>
                    setValoresPorSeccion((prev) => ({
                      ...prev,
                      [seccion]: { ...prev[seccion], [campo.id]: v },
                    }))
                  }
                />
              </div>
            )
          }

          return (
            <section key={seccion} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-card-foreground">{TITULOS[seccion]}</h2>
                {estado.yaEnviado && (
                  <span className="text-xs text-muted">
                    {estado.proximaFecha
                      ? `Ya registrado — próximo turno el ${formatFechaLarga(estado.proximaFecha)}, pero puedes corregirlo ahora`
                      : 'Ya registrado — puedes actualizarlo cuando quieras'}
                  </span>
                )}
              </div>

              {camposObjetivo.length > 0 && (
                <div className="mb-5 flex flex-col gap-4">
                  {estado.objetivos.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-lg bg-background p-3">
                      <p className="text-xs font-semibold text-muted">{TITULOS_OBJETIVOS[seccion]}</p>
                      {estado.objetivos.map((o) => (
                        <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-card-foreground">{o.nombre}</span>
                          {o.progreso && o.modoProgreso === 'acumulado' && (
                            <span className={o.progreso.completado ? 'font-medium text-success' : 'text-muted'}>
                              {formatearProgresoTexto(o.unidad, o.progreso)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col gap-4">
                    {camposObjetivo.map((campo) => {
                      const objetivoPeso =
                        campo.id === 'peso'
                          ? estado.objetivos.find((o) => o.fuenteFieldId === campo.id && o.modoProgreso === 'valor_objetivo')
                          : undefined
                      return renderCampo(campo, objetivoPeso)
                    })}
                  </div>
                </div>
              )}

              {camposRevision.length > 0 && (
                <div className="flex flex-col gap-4 border-t border-border pt-4 first:border-t-0 first:pt-0">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">Revisión</p>
                    <p className="text-xs text-muted">Esto es una revisión de tu estado, no un objetivo.</p>
                  </div>
                  {camposRevision.map((campo) => renderCampo(campo))}
                </div>
              )}

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
      </main>
    </div>
  )
}
