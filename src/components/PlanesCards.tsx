import { PRODUCTOS } from '@/lib/productos'

export default function PlanesCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PRODUCTOS.map((producto) => (
        <div key={producto.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <span className="text-2xl">{producto.icono}</span>
            {producto.id === 'Metricas' && (
              <span className="inline-flex items-center rounded-full bg-muted/10 px-3 py-1 text-xs font-medium text-muted">
                Requiere plan base
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-card-foreground">{producto.nombre}</h3>
          <p className="text-sm text-muted">{producto.descripcionCorta}</p>
        </div>
      ))}
    </div>
  )
}
