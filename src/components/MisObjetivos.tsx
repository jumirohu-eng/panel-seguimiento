import type { ObjetivoResuelto, PeriodicidadObjetivo } from '@/lib/objetivos'
import { formatearProgresoTexto } from '@/lib/objetivos'

const GRUPOS: { periodicidad: PeriodicidadObjetivo; titulo: string }[] = [
  { periodicidad: 'diario', titulo: 'Hoy' },
  { periodicidad: 'semanal', titulo: 'Esta semana' },
  { periodicidad: 'mensual', titulo: 'Este mes' },
]

function BarraProgreso({ objetivo }: { objetivo: ObjetivoResuelto }) {
  if (!objetivo.progreso) {
    return <p className="text-xs text-muted">Meta: {objetivo.meta} {objetivo.unidad}</p>
  }
  const { completado, porcentaje } = objetivo.progreso
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{formatearProgresoTexto(objetivo.unidad, objetivo.progreso)}</p>
        {!objetivo.progreso.direccion && (
          <span className={`text-xs font-medium ${completado ? 'text-success' : 'text-muted'}`}>
            {completado ? '✓ Completado' : 'Pendiente'}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
        <div
          className={`h-full rounded-full ${completado ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }}
        />
      </div>
    </div>
  )
}

export default function MisObjetivos({ objetivos }: { objetivos: ObjetivoResuelto[] }) {
  if (objetivos.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-card-foreground">Mis objetivos</h2>
        <p className="text-sm text-muted">Tu entrenador todavía no te ha asignado ningún objetivo.</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-card-foreground">Mis objetivos</h2>
      <div className="flex flex-col gap-5">
        {GRUPOS.map((grupo) => {
          const delGrupo = objetivos.filter((o) => o.periodicidad === grupo.periodicidad)
          if (delGrupo.length === 0) return null
          return (
            <div key={grupo.periodicidad} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-muted">{grupo.titulo}</h3>
              {delGrupo.map((o) => (
                <div key={o.id} className="rounded-lg bg-background p-3">
                  <p className="mb-1 text-sm font-medium text-card-foreground">{o.nombre}</p>
                  <BarraProgreso objetivo={o} />
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
