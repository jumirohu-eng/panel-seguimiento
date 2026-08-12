'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Cliente } from '@/lib/types'
import { tienePlanBase } from '@/lib/productos'
import Header from '@/components/Header'
import ClientesLista from '@/components/ClientesLista'
import ClienteFicha from '@/components/ClienteFicha'
import DashboardResumenView from '@/components/admin/DashboardResumenView'

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
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

      try {
        const rolRes = await fetch('/api/auth/rol', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (rolRes.ok) {
          const { rol } = await rolRes.json()
          if (rol === 'admin') {
            setIsAdmin(true)
            setLoadingClientes(false)
            return
          }
        }
      } catch {
        // Si falla la resolución de rol, seguimos como entrenador (comportamiento previo)
      }

      try {
        const perfilRes = await fetch('/api/entrenador/perfil', {
          headers: { Authorization: `Bearer ${token}` },
        })
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
  }, [router])

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

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        {email && <Header email={email} isAdmin />}
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
