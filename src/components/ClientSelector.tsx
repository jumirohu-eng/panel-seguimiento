import { Cliente } from '@/lib/types'

export default function ClientSelector({
  clientes,
  selectedId,
  onChange,
}: {
  clientes: Cliente[]
  selectedId: string | null
  onChange: (id: string) => void
}) {
  return (
    <select
      value={selectedId ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary sm:w-auto"
    >
      <option value="" disabled>
        Selecciona un cliente
      </option>
      {clientes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  )
}
