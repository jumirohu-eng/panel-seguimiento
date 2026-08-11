import { PRODUCTOS } from '@/lib/productos'
import { PLANES_COPY } from '@/content/plans-copy'
import { SolucionEntrenador } from '@/lib/airtable'

export default function PlanesCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PRODUCTOS.map((producto) => {
        const copy = PLANES_COPY.porProducto[producto.id as SolucionEntrenador]
        return (
          <div key={producto.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="text-2xl">{producto.icono}</span>
              {producto.id === 'Metricas' && (
                <span className="inline-flex items-center rounded-full bg-muted/10 px-3 py-1 text-xs font-medium text-muted">
                  Requiere plan base
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-card-foreground">{producto.nombre}</h3>
            {copy ? (
              <>
                <p className="text-sm text-muted">{copy.problema}</p>
                <ul className="flex flex-col gap-1 text-sm text-card-foreground">
                  {copy.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <span className="text-success">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs font-medium text-primary">{copy.resultados}</p>
              </>
            ) : (
              <p className="text-sm text-muted">{producto.descripcionCorta}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
