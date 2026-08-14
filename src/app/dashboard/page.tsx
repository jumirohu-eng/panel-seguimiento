'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Cliente } from '@/lib/types'
import { tienePlanBase } from '@/lib/productos'
import Header from '@/components/Header'
import ClientesLista from '@/components/ClientesLista'
import ClienteFicha from '@/components/ClienteFicha'
import DashboardResumenView from '@/components/admin/DashboardResumenView'

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  )
}

function DashboardPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vistaEntrenador = searchParams.get('vista') === 'entrenador'

  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mostrarResumenAdmin, setMostrarResumenAdmin] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noRegistrado, setNoRegistrado] = useState(false)

  useEffect(() => {
    async function init() {
      setLoadingClientes(true)
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login')
        return
      }
      setEmail(userData.user.email ?? '')

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        router.push('/login')
        return
      }

      let esAdmin = false
      try {
        const rolRes = await fetch('/api/auth/rol', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (rolRes.ok) {
          const { rol } = await rolRes.json()
          esAdmin = rol === 'admin'
        }
      } catch {
        // Si falla la resolución de rol, seguimos como entrenador (comportamiento previo)
      }
      setIsAdmin(esAdmin)

      // Se recalcula explícitamente en cada ejecución (no solo se pone a `true`) —
      // si no, al navegar de Resumen a "Ver como entrenador" (mismo componente,
      // cambia solo el query param) el flag se quedaba en `true` para siempre y
      // la vista de entrenador nunca llegaba a mostrarse.
      const mostrarResumen = esAdmin && !vistaEntrenador
      setMostrarResumenAdmin(mostrarResumen)
      if (mostrarResumen) {
        setLoadingClientes(false)
        return
      }

      // A partir de aquí: entrenador real, o admin con "Ver como entrenador" (sin gate de
      // plan base — es una vista previa del admin, no aplica la restricción de un entrenador real)
      if (!esAdmin) {
        try {
          const perfilRes = await fetch('/api/entrenador/perfil', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (perfilRes.status === 404) {
            // Distinto de "sin plan" (eso redirige a /planes): aquí no existe ninguna
            // fila de Entrenadores con este email — mensaje propio en vez de dejar caer
            // en "Solicita acceso a un plan", que da a entender que sí eres entrenador.
            setNoRegistrado(true)
            setLoadingClientes(false)
            return
          }
          if (perfilRes.ok) {
            const perfil = await perfilRes.json()
            if (!tienePlanBase(perfil.soluciones ?? [])) {
              router.push('/planes')
              return
            }
          }
        } catch {
          // Si falla la comprobación de plan, dejamos pasar y que /api/clientes falle si toca
        }
      }

      try {
        const res = await fetch('/api/clientes', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('No se pudieron cargar los clientes')
        const clientesData: Cliente[] = await res.json()
        setClientes(clientesData)
      } catch {
        setError('Error al cargar los clientes.')
      } finally {
        setLoadingClientes(false)
      }
    }
    init()
  }, [router, vistaEntrenador])

  const handleSelect = useCallback((id: string) => setSelectedId(id), [])
  const handleBack = useCallback(() => setSelectedId(null), [])
  const handleClienteCreado = useCallback((cliente: Cliente) => {
    setClientes((prev) => [cliente, ...prev])
  }, [])
  const handleClienteActualizado = useCallback((cliente: Pick<Cliente, 'id'> & Partial<Cliente>) => {
    setClientes((prev) => prev.map((c) => (c.id === cliente.id ? { ...c, ...cliente } : c)))
  }, [])

  const clienteSeleccionado = clientes.find((c) => c.id === selectedId) ?? null

  if (loadingClientes) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    )
  }

  if (mostrarResumenAdmin) {
    return (
      <div className="min-h-screen bg-background">
        {email && <Header email={email} isAdmin />}
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <DashboardResumenView />
        </main>
      </div>
    )
  }

  if (noRegistrado) {
    return (
      <div className="min-h-screen bg-background">
        {email && <Header email={email} showMarketplace={false} />}
        <main className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-16 text-center sm:px-6">
          <h1 className="text-xl font-semibold text-card-foreground">Cuenta no registrada</h1>
          <p className="max-w-md text-sm text-muted">
            Esta cuenta ({email}) no está dada de alta como entrenador en RetainCoach. Si crees
            que es un error, contacta con el administrador para que revise el email exacto con
            el que se te dio de alta.
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {email && <Header email={email} isAdmin={isAdmin} />}

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {isAdmin && vistaEntrenador && (
          <p className="mb-4 rounded-lg bg-background px-3 py-2 text-xs text-muted">
            Vista previa como entrenador — los clientes mostrados son los reales asociados a tu email.
          </p>
        )}
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        {clienteSeleccionado ? (
          <ClienteFicha
            key={clienteSeleccionado.id}
            cliente={clienteSeleccionado}
            onBack={handleBack}
            onUpdated={handleClienteActualizado}
          />
        ) : (
          <ClientesLista
            clientes={clientes}
            onSelect={handleSelect}
            onClienteCreado={handleClienteCreado}
          />
        )}
      </main>
    </div>
  )
}
