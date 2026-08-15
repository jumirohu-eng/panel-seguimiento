import Link from 'next/link'
import type { ObjetivoResuelto, PeriodicidadObjetivo } from '@/lib/objetivos'
import { formatearProgresoTexto, PERIODICIDAD_A_TIPO_CHECKIN } from '@/lib/objetivos'

// El deep-link debe apuntar al tipo donde el campo REALMENTE recibe datos
// (`fuenteTipos`), no al tipo derivado de la periodicidad del objetivo — un objetivo
// semanal puede alimentarse de un campo que solo se pregunta a diario (agregado en ventana
// semanal, ver DECISIONS.md), y en ese caso el campo no existe en absoluto en la sección
// "semanal" del check-in. `fuenteTipos[0]` es el único tipo posible desde DEC-2026-045 (un
// campo pertenece a un único tipo); el fallback a la periodicidad solo cubre un campo
// huérfano sin `Tipos` resuelto.
function linkRegistrar(o: ObjetivoResuelto) {
  const tipo = o.fuenteTipos[0] ?? PERIODICIDAD_A_TIPO_CHECKIN[o.periodicidad]
  return `/cliente/checkin?campo=${o.fuenteFieldId}&tipo=${tipo}`
}

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

// Objetivos en modo "valor objetivo" (peso y similares) tienen su propia tarjeta: cabecera con
// la meta, "Actual: X" y una barra lineal dirigida — en vez de "valor/meta (%)", que no tiene
// sentido cuando el progreso puede retroceder o superar el 100%.
function ObjetivoValorLineal({ objetivo }: { objetivo: ObjetivoResuelto }) {
  const p = objetivo.progreso
  return (
    <div className="rounded-lg bg-background p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-card-foreground">
          {objetivo.nombre} objetivo: {objetivo.meta} {objetivo.unidad}
        </p>
        {objetivo.fuenteFieldId && (
          <Link href={linkRegistrar(objetivo)} className="shrink-0 text-xs font-medium text-primary hover:underline">
            Registrar
          </Link>
        )}
      </div>
      {p ? (
        <>
          <p className="mb-1 text-xs text-muted">Actual: {p.valor} {objetivo.unidad}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-card">
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

export default function MisObjetivos({ objetivos }: { objetivos: ObjetivoResuelto[] }) {
  if (objetivos.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-card-foreground">Mis objetivos</h2>
        <p className="text-sm text-muted">Todavía no tienes objetivos asignados.</p>
      </section>
    )
  }

  const sinDatosTodavia = objetivos.every((o) => !o.progreso || o.progreso.valor === 0)

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-card-foreground">Mis objetivos</h2>
      {sinDatosTodavia && <p className="mb-3 text-sm text-muted">Aún no has registrado datos.</p>}
      <div className="mt-3 flex flex-col gap-5">
        {GRUPOS.map((grupo) => {
          const delGrupo = objetivos.filter((o) => o.periodicidad === grupo.periodicidad)
          if (delGrupo.length === 0) return null
          return (
            <div key={grupo.periodicidad} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-muted">{grupo.titulo}</h3>
              {delGrupo.map((o) =>
                o.modoProgreso === 'valor_objetivo' ? (
                  <ObjetivoValorLineal key={o.id} objetivo={o} />
                ) : (
                  <div key={o.id} className="rounded-lg bg-background p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-card-foreground">{o.nombre}</p>
                      {o.fuenteFieldId && !(o.progreso?.completado ?? false) && (
                        <Link href={linkRegistrar(o)} className="shrink-0 text-xs font-medium text-primary hover:underline">
                          Registrar
                        </Link>
                      )}
                    </div>
                    <BarraProgreso objetivo={o} />
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
