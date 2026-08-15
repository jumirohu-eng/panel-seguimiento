'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ClienteCheckinResponse } from '@/lib/types'
import type { ObjetivoResuelto } from '@/lib/objetivos'
import { formatearProgresoTexto } from '@/lib/objetivos'
import { campoDisponible } from '@/lib/checkinFields'
import { formatFechaLarga } from '@/lib/format'
import CampoInput from '@/components/CampoInput'

type Seccion = 'diario' | 'semanal' | 'periodico'

// Título de cada sección de revisión — antes las tres decían solo "Revisión" sin distinguir
// el tipo, así que aunque los campos ya estuvieran bien separados por tipo (backend), el
// cliente no podía saber a simple vista cuál sección era diaria y cuál semanal (ver
// DECISIONS.md, reporte de confusión pese a que los datos ya estaban correctos).
const TITULO_SECCION: Record<Seccion, string> = {
  diario: 'Revisión diaria',
  semanal: 'Revisión semanal',
  periodico: 'Revisión periódica',
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
  const tipoParam = searchParams.get('tipo')
  const tipoDestacado: Seccion | null =
    tipoParam === 'diario' || tipoParam === 'semanal' || tipoParam === 'periodico' ? tipoParam : null
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

  async function cargarCheckin(accessToken: string) {
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
  }

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
        await cargarCheckin(accessToken)
      } catch {
        setError('Error al cargar tu check-in.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  // Envía solo los campos indicados (nunca todo `valoresPorSeccion[seccion]` sin filtrar) —
  // así el envío de una revisión nunca reenvía de paso el valor de un campo de objetivo que
  // comparta el mismo tipo, y el registro enfocado de un objetivo nunca reenvía revisiones.
  async function enviarCampos(seccion: Seccion, campoIds: string[], recargar = false) {
    if (!token) return
    setGuardando(seccion)
    setGuardadoOk(null)
    try {
      const valores = Object.fromEntries(campoIds.map((id) => [id, valoresPorSeccion[seccion][id]]))
      const res = await fetch('/api/cliente/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tipo: seccion, valores }),
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      setGuardadoOk(seccion)
      if (recargar) await cargarCheckin(token)
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

  // Registro enfocado: llegada desde "Registrar" en un objetivo concreto (MisObjetivos.tsx)
  // con ?campo=&tipo= — se muestra solo ese campo, no el resto de objetivos/revisión de la
  // sección. Si el campo ya no está disponible (objetivo desactivado entre el click y la
  // carga, por ejemplo), se avisa en vez de mostrar un formulario roto.
  if (campoDestacado && tipoDestacado) {
    const estado = data[tipoDestacado]
    const campo = estado.campos.find((c) => c.id === campoDestacado)
    // Busca el objetivo en las TRES secciones, no solo en `estado.objetivos` — el campo
    // fuente puede vivir en un tipo distinto al de la periodicidad del objetivo (ver
    // `idsObjetivoGlobal` más abajo), así que el link "Registrar" puede aterrizar en un tipo
    // donde el campo existe pero el objetivo está filed bajo otro tipo.
    const objetivo = [...data.diario.objetivos, ...data.semanal.objetivos, ...data.periodico.objetivos].find(
      (o) => o.fuenteFieldId === campoDestacado
    )
    const esPeso = campo?.id === 'peso' && objetivo?.modoProgreso === 'valor_objetivo'
    const guardandoEste = guardando === tipoDestacado
    const guardadoEste = guardadoOk === tipoDestacado

    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
          <h1 className="text-sm font-medium text-card-foreground">{objetivo?.nombre ?? campo?.nombre ?? 'Registrar'}</h1>
          <button
            onClick={() => router.push('/cliente/dashboard')}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
          >
            Volver
          </button>
        </header>

        <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 sm:px-6">
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {!campo ? (
              <p className="text-sm text-muted">Este objetivo ya no está disponible.</p>
            ) : (
              <>
                {objetivo?.modoProgreso === 'valor_objetivo' && <ObjetivoPeso objetivo={objetivo} />}
                {objetivo?.modoProgreso === 'acumulado' && objetivo.progreso && (
                  <p className="mb-4 text-sm text-muted">{formatearProgresoTexto(objetivo.unidad, objetivo.progreso)}</p>
                )}
                <CampoInput
                  campo={esPeso ? { ...campo, nombre: '¿Cuánto pesas?' } : campo}
                  valor={valoresPorSeccion[tipoDestacado][campo.id]}
                  disabled={!campoDisponible(campo, valoresPorSeccion[tipoDestacado])}
                  onChange={(v) =>
                    setValoresPorSeccion((prev) => ({
                      ...prev,
                      [tipoDestacado]: { ...prev[tipoDestacado], [campo.id]: v },
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() => enviarCampos(tipoDestacado, [campo.id], true)}
                  disabled={guardandoEste}
                  className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {guardandoEste ? 'Guardando…' : guardadoEste ? '✓ Guardado' : 'Guardar'}
                </button>
              </>
            )}
          </section>
        </main>
      </div>
    )
  }

  const secciones: Seccion[] = ['diario', 'semanal', 'periodico']

  // Global (unión de las tres secciones), no por sección — el backend también decide esto de
  // forma global (ver DECISIONS.md, GET /api/cliente/checkin): un campo puede vivir en un tipo
  // distinto al de la periodicidad del objetivo que lo usa (p.ej. objetivo semanal alimentado
  // por un campo que solo se pregunta a diario), así que el objetivo puede caer en
  // `estado.semanal.objetivos` mientras el campo fuente aparece en `estado.diario.campos`. Si
  // esta exclusión se calculara solo con `estado[seccion].objetivos` (local a cada sección), un
  // campo así se mostraría como pregunta de revisión suelta en la sección donde realmente vive.
  const idsObjetivoGlobal = idsFuenteDeObjetivos([...data.diario.objetivos, ...data.semanal.objetivos, ...data.periodico.objetivos])

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <h1 className="text-sm font-medium text-card-foreground">Revisión</h1>
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
          // Esta vista general es solo Revisión — registrar un objetivo siempre pasa por el
          // modo enfocado (arriba, "Registrar" desde Mis objetivos). Los campos que son
          // fuente de un objetivo nunca se muestran aquí, aunque estén en `estado.campos`
          // (exclusión global, ver `idsObjetivoGlobal` arriba).
          const camposRevision = estado.campos.filter((c) => !idsObjetivoGlobal.has(c.id))

          // Las tres secciones se muestran siempre, cada una con su propio tipo en el
          // título — antes "periódico" desaparecía sin más cuando no tenía campos, lo que
          // sumaba a la confusión de no poder distinguir qué campos pertenecían a cada tipo.
          if (camposRevision.length === 0) {
            return (
              <section key={seccion} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-2 text-lg font-semibold text-card-foreground">{TITULO_SECCION[seccion]}</h2>
                <p className="text-sm text-muted">
                  {!estado.lanzado
                    ? estado.disponibleDesde
                      ? `Disponible a partir del ${formatFechaLarga(estado.disponibleDesde)}.`
                      : 'Tu entrenador todavía no ha activado ninguna revisión de este tipo.'
                    : 'Tu entrenador no ha configurado ninguna pregunta de revisión para este tipo.'}
                </p>
              </section>
            )
          }

          const valores = valoresPorSeccion[seccion]

          return (
            <section key={seccion} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-card-foreground">{TITULO_SECCION[seccion]}</h2>
                {estado.yaEnviado && (
                  <span className="text-xs text-muted">
                    {estado.proximaFecha
                      ? `Ya registrado — próximo turno el ${formatFechaLarga(estado.proximaFecha)}, pero puedes corregirlo ahora`
                      : 'Ya registrado — puedes actualizarlo cuando quieras'}
                  </span>
                )}
              </div>
              <p className="mb-4 text-xs text-muted">Esto es una revisión de tu estado, no un objetivo.</p>

              <div className="flex flex-col gap-4">
                {camposRevision.map((campo) => (
                  <CampoInput
                    key={campo.id}
                    campo={campo}
                    valor={valores[campo.id]}
                    disabled={!campoDisponible(campo, valores)}
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
                onClick={() => enviarCampos(seccion, camposRevision.map((c) => c.id))}
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
