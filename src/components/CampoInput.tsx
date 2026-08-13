'use client'

import { CampoCheckinResuelto } from '@/lib/types'

export default function CampoInput({
  campo,
  valor,
  onChange,
}: {
  campo: CampoCheckinResuelto
  valor: unknown
  onChange: (valor: unknown) => void
}) {
  const label = (
    <label className="mb-2 block text-sm font-medium text-card-foreground">
      {campo.nombre}
      {campo.unidad ? <span className="text-muted"> ({campo.unidad})</span> : null}
    </label>
  )

  if (campo.tipo === 'escala') {
    return (
      <div>
        {label}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`h-10 w-10 rounded-lg border text-sm font-medium transition-colors ${
                valor === n
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-card-foreground hover:bg-background'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (campo.tipo === 'si_no') {
    return (
      <div>
        {label}
        <div className="flex gap-2">
          {[
            { v: true, t: 'Sí' },
            { v: false, t: 'No' },
          ].map((opt) => (
            <button
              key={opt.t}
              type="button"
              onClick={() => onChange(opt.v)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                valor === opt.v
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-card-foreground hover:bg-background'
              }`}
            >
              {opt.t}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (campo.tipo === 'numero') {
    return (
      <div>
        {label}
        <input
          type="number"
          value={typeof valor === 'number' ? valor : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
        />
      </div>
    )
  }

  if (campo.tipo === 'seleccion') {
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-2">
          {(campo.opciones ?? []).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                valor === o
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-card-foreground hover:bg-background'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (campo.tipo === 'seleccion_multiple') {
    const seleccionados = Array.isArray(valor) ? (valor as string[]) : []
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-2">
          {(campo.opciones ?? []).map((o) => {
            const activo = seleccionados.includes(o)
            return (
              <button
                key={o}
                type="button"
                onClick={() =>
                  onChange(activo ? seleccionados.filter((s) => s !== o) : [...seleccionados, o])
                }
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  activo ? 'border-primary bg-primary text-white' : 'border-border text-card-foreground hover:bg-background'
                }`}
              >
                {o}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // texto
  return (
    <div>
      {label}
      <textarea
        value={typeof valor === 'string' ? valor : ''}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground"
      />
    </div>
  )
}
