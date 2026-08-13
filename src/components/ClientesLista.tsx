'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Cliente } from '@/lib/types'
import RegistrarClienteModal from './RegistrarClienteModal'
import Tooltip from './Tooltip'

const ESTADO_BADGE: Record<string, string> = {
  Activo: 'bg-success/10 text-success',
  Pausado: 'bg-warning/10 text-warning',
  Perdido: 'bg-danger/10 text-danger',
}

type FiltroEstado = 'alertas' | 'activos' | 'inactivos' | 'todos'

export default function ClientesLista({
  clientes,
  onSelect,
  onClienteCreado,
}: {
  clientes: Cliente[]
  onSelect: (id: string) => void
  onClienteCreado: (cliente: Cliente) => void
}) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('activos')
  const [mostrarRegistro, setMostrarRegistro] = useState(false)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return clientes.filter((c) => {
      if (q && !c.nombre.toLowerCase().includes(q)) return false
      if (filtroEstado === 'alertas') return c.tieneAlerta
      if (filtroEstado === 'activos') return c.estado === 'Activo'
      if (filtroEstado === 'inactivos') return c.estado !== 'Activo'
      return true
    })
  }, [clientes, busqueda, filtroEstado])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar cliente por nombre…"
          className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
        >
          <option value="alertas">Alertas</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
        <button
          type="button"
          onClick={() => router.push('/checkin-config')}
          className="ml-auto rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground transition hover:bg-background"
        >
          ⚙️ Configurar check-in
        </button>
        <button
          type="button"
          onClick={() => setMostrarRegistro(true)}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          + Registrar cliente
        </button>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-muted">
          {clientes.length === 0
            ? 'No tienes clientes asignados todavía.'
            : 'Ningún cliente coincide con el filtro.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <ul className="divide-y divide-border">
            {filtrados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-background"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {c.tieneAlerta && (
                      <Tooltip content={c.alertaResumen || 'Alerta reciente sin resolver'}>
                        <span className="shrink-0 text-warning">⚠️</span>
                      </Tooltip>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-card-foreground">{c.nombre}</p>
                      <p className="truncate text-xs text-muted">{c.objetivo}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      ESTADO_BADGE[c.estado] ?? 'bg-muted/10 text-muted'
                    }`}
                  >
                    {c.estado || '—'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mostrarRegistro && (
        <RegistrarClienteModal
          onClose={() => setMostrarRegistro(false)}
          onCreated={onClienteCreado}
        />
      )}
    </div>
  )
}
