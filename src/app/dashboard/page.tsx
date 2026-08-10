'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Cliente, Reporte } from '@/lib/types'
import { ADMIN_EMAIL } from '@/lib/admin'
import Header from '@/components/Header'
import ClientSelector from '@/components/ClientSelector'
import EnergyChart from '@/components/EnergyChart'
import WorkoutsChart from '@/components/WorkoutsChart'
import WeightChart from '@/components/WeightChart'
import StatusBadge from '@/components/StatusBadge'
import SuggestedMessage from '@/components/SuggestedMessage'
import AIAnalysis from '@/components/AIAnalysis'
import ExportPDF from '@/components/ExportPDF'
import DashboardResumenView from '@/components/admin/DashboardResumenView'

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [loadingReportes, setLoadingReportes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login')
        return
      }
      setEmail(userData.user.email ?? '')

      if (userData.user.email === ADMIN_EMAIL) {
        setIsAdmin(true)
        setLoadingClientes(false)
        return
      }

      const token = await getToken()
      if (!token) {
        router.push('/login')
        return
      }

      try {
        const res = await fetch('/api/clientes', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('No se pudieron cargar los clientes')
        const clientesData: Cliente[] = await res.json()
        setClientes(clientesData)
        if (clientesData.length > 0) setSelectedId(clientesData[0].id)
      } catch {
        setError('Error al cargar los clientes.')
      } finally {
        setLoadingClientes(false)
      }
    }
    init()
  }, [router, getToken])

  useEffect(() => {
    if (!selectedId) return

    async function loadReportes() {
      setLoadingReportes(true)
      setError(null)
      try {
        const token = await getToken()
        const res = await fetch(`/api/reportes?clienteId=${selectedId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('No se pudieron cargar los reportes')
        const reportesData: Reporte[] = await res.json()
        setReportes(reportesData)
      } catch {
        setError('Error al cargar los reportes.')
      } finally {
        setLoadingReportes(false)
      }
    }
    loadReportes()
  }, [selectedId, getToken])

  const clienteSeleccionado = clientes.find((c) => c.id === selectedId) ?? null
  const ultimoReporte = reportes[0]

  if (loadingClientes) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        {email && <Header email={email} />}
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <DashboardResumenView />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {email && <Header email={email} />}

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ClientSelector clientes={clientes} selectedId={selectedId} onChange={setSelectedId} />
          {clienteSeleccionado && (
            <ExportPDF
              targetRef={exportRef}
              fileName={`Seguimiento_${clienteSeleccionado.nombre}_${new Date()
                .toISOString()
                .slice(0, 10)}`}
            />
          )}
        </div>

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        {clientes.length === 0 && !error && (
          <p className="text-sm text-muted">No tienes clientes asignados todavía.</p>
        )}

        {clienteSeleccionado && (
          <div ref={exportRef} className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">
                  {clienteSeleccionado.nombre}
                </h2>
                <p className="text-sm text-muted">{clienteSeleccionado.objetivo}</p>
              </div>
              {!loadingReportes && (
                <div className="flex items-center gap-2">
                  <StatusBadge reportes={reportes} />
                  {ultimoReporte?.linkAlerta && (
                    <a
                      href={ultimoReporte.linkAlerta}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              )}
            </div>

            {loadingReportes ? (
              <p className="text-sm text-muted">Cargando reportes…</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <EnergyChart reportes={reportes} />
                  <WorkoutsChart
                    reportes={reportes}
                    objetivo={clienteSeleccionado.entrenamientos_objetivo}
                  />
                  <div className="lg:col-span-2">
                    <WeightChart reportes={reportes} objetivo={clienteSeleccionado.objetivo} />
                  </div>
                </div>

                {ultimoReporte?.analisisIA && <AIAnalysis analysis={ultimoReporte.analisisIA} />}

                {ultimoReporte?.mensajeSugerido && (
                  <SuggestedMessage message={ultimoReporte.mensajeSugerido} />
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
