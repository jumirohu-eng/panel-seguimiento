'use client'

import { CampoCheckinResuelto } from '@/lib/types'

export default function CampoInput({
  campo,
  valor,
  onChange,
  disabled,
}: {
  campo: CampoCheckinResuelto
  valor: unknown
  onChange: (valor: unknown) => void
  disabled?: boolean
}) {
  const label = (
    <label className="mb-2 block text-sm font-medium text-card-foreground">
      {campo.nombre}
      {campo.unidad ? <span className="text-muted"> ({campo.unidad})</span> : null}
      {disabled ? <span className="text-muted"> — no disponible</span> : null}
    </label>
  )

  if (campo.tipo === 'escala') {
    return (
      <div className={disabled ? 'opacity-50' : undefined}>
        {label}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              title={campo.escalaEtiquetas?.[n - 1]}
              onClick={() => onChange(n)}
              className={`h-10 w-10 rounded-lg border text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                valor === n
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-card-foreground hover:bg-background'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {campo.escalaEtiquetas && (
          <p className="mt-1 text-xs text-muted">
            {campo.escalaEtiquetas[0]} (1) · {campo.escalaEtiquetas[4]} (5)
            {typeof valor === 'number' && valor >= 1 && valor <= 5 ? ` — ${campo.escalaEtiquetas[valor - 1]}` : ''}
          </p>
        )}
      </div>
    )
  }

  if (campo.tipo === 'si_no') {
    return (
      <div className={disabled ? 'opacity-50' : undefined}>
        {label}
        <div className="flex gap-2">
          {[
            { v: true, t: 'Sí' },
            { v: false, t: 'No' },
          ].map((opt) => (
            <button
              key={opt.t}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.v)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
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
      <div className={disabled ? 'opacity-50' : undefined}>
        {label}
        <input
          type="number"
          min={0}
          step="any"
          disabled={disabled}
          value={typeof valor === 'number' ? valor : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground disabled:cursor-not-allowed"
        />
      </div>
    )
  }

  if (campo.tipo === 'seleccion') {
    return (
      <div className={disabled ? 'opacity-50' : undefined}>
        {label}
        <div className="flex flex-wrap gap-2">
          {(campo.opciones ?? []).map((o) => (
            <button
              key={o}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed ${
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
      <div className={disabled ? 'opacity-50' : undefined}>
        {label}
        <div className="flex flex-wrap gap-2">
          {(campo.opciones ?? []).map((o) => {
            const activo = seleccionados.includes(o)
            return (
              <button
                key={o}
                type="button"
                disabled={disabled}
                onClick={() => onChange(activo ? seleccionados.filter((s) => s !== o) : [...seleccionados, o])}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed ${
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

  if (campo.tipo === 'dolor') {
    const actual = valor && typeof valor === 'object' ? (valor as { nivel?: string; zona?: string }) : {}
    return (
      <div className={disabled ? 'opacity-50' : undefined}>
        {label}
        <div className="flex flex-wrap gap-2">
          {(campo.opciones ?? []).map((o) => (
            <button
              key={o}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...actual, nivel: o })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed ${
                actual.nivel === o
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-card-foreground hover:bg-background'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
        <input
          type="text"
          disabled={disabled}
          placeholder="Zona (opcional)"
          value={actual.zona ?? ''}
          onChange={(e) => onChange({ ...actual, zona: e.target.value })}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground disabled:cursor-not-allowed"
        />
      </div>
    )
  }

  // texto
  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      {label}
      <textarea
        disabled={disabled}
        value={typeof valor === 'string' ? valor : ''}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground disabled:cursor-not-allowed"
      />
    </div>
  )
}
