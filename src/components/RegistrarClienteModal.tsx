'use client'

import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Cliente } from '@/lib/types'

function linkTallyAlta(nombre: string, email: string, telefono: string, entrenador: string): string | null {
  const base = process.env.NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL
  if (!base) return null
  const params = new URLSearchParams({ nombre, email, telefono, entrenador })
  return `${base}?${params.toString()}`
}

export default function RegistrarClienteModal({
  entrenadorEmail,
  onClose,
  onCreated,
}: {
  entrenadorEmail: string
  onClose: () => void
  onCreated: (cliente: Cliente) => void
}) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [linkGenerado, setLinkGenerado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre, email, telefono }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo crear el cliente')
      }
      const creado = await res.json()

      onCreated({
        id: creado.id,
        nombre: creado.nombre,
        email: creado.email,
        telefono: creado.telefono,
        objetivo: '',
        estado: 'Activo',
        entrenamientos_objetivo: 0,
        linkRecordatorio: '',
        tieneAlerta: false,
        notasEntrenador: '',
        notasIniciales: '',
      })

      setLink(linkTallyAlta(creado.nombre, creado.email, creado.telefono, entrenadorEmail))
      setLinkGenerado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el cliente')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-card-foreground">Registrar cliente</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted hover:text-card-foreground"
          >
            ✕
          </button>
        </div>

        {linkGenerado ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-success">Cliente creado ✅</p>
            {link ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-card-foreground">
                  Envíale este enlace para que complete su alta:
                </p>
                <p className="break-all rounded-lg border border-border bg-background p-2 text-xs text-muted">
                  {link}
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                >
                  {copiado ? '¡Copiado!' : 'Copiar al portapapeles'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-warning">
                El cliente se creó, pero el formulario de alta todavía no está configurado
                (falta NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL). Pídele el resto de datos manualmente
                por ahora.
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground hover:bg-background"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="nombre" className="text-sm font-medium text-card-foreground">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-card-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="telefono" className="text-sm font-medium text-card-foreground">
                Teléfono
              </label>
              <input
                id="telefono"
                type="tel"
                required
                placeholder="+34..."
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Generando…' : 'Generar enlace de registro'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
