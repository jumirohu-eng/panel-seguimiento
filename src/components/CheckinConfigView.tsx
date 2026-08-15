'use client'

import { useState } from 'react'
import { CampoCheckinResuelto, CheckinConfigResponse } from '@/lib/types'
import { esCampoOcultoEnConfigAvanzada } from '@/lib/checkinFields'
import CampoPersonalizadoModal from './CampoPersonalizadoModal'
import LanzamientoCheckin from './LanzamientoCheckin'
import ProgramacionTipo from './ProgramacionTipo'

const TIPOS: { value: 'diario' | 'semanal' | 'periodico'; label: string }[] = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'periodico', label: 'Periódico' },
]

export default function CheckinConfigView({
  token,
  configInicial,
}: {
  token: string
  configInicial: CheckinConfigResponse
}) {
  const [campos, setCampos] = useState(configInicial.campos)
  const [programacion] = useState(configInicial.programacion)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [mostrarEliminados, setMostrarEliminados] = useState(false)

  // Opera sobre el array completo (por id, no por índice de la lista filtrada) — los campos
  // ocultos en esta pantalla (peso, entrenamiento_realizado, pasos) siguen en `campos` para no
  // perder su Activo/Tipos al guardar, solo no se muestran ni se reordenan aquí.
  function moverCampo(campoId: string, direccion: -1 | 1) {
    setCampos((prev) => {
      const index = prev.findIndex((c) => c.id === campoId)
      const destino = index + direccion
      if (index < 0 || destino < 0 || destino >= prev.length) return prev
      const copia = [...prev]
      ;[copia[index], copia[destino]] = [copia[destino], copia[index]]
      return copia.map((c, i) => ({ ...c, orden: i }))
    })
  }

  function actualizarCampo(id: string, cambios: Partial<CampoCheckinResuelto>) {
    setCampos((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
  }

  // Un campo pertenece a un único tipo de check-in (diario/semanal/periódico), nunca a
  // varios a la vez — así el contenido de un tipo nunca coincide con el de otro (ver
  // DECISIONS.md, reemplaza el multi-tipo de DEC-2026-015).
  function seleccionarTipo(campo: CampoCheckinResuelto, tipo: 'diario' | 'semanal' | 'periodico') {
    actualizarCampo(campo.id, { tipos: [tipo] })
  }

  async function guardar() {
    setGuardando(true)
    setGuardadoOk(false)
    setError(null)
    try {
      const res = await fetch('/api/entrenador/checkin-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campos: campos.map((c) => ({ fieldId: c.id, activo: c.activo, orden: c.orden, tipos: c.tipos })),
        }),
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      const data: CheckinConfigResponse = await res.json()
      setCampos(data.campos)
      setGuardadoOk(true)
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // Campo estándar: no se puede borrar del catálogo (vive en el código) — el backend lo
  // desactiva de forma duradera. Campo personalizado: se borra la fila de verdad. En
  // ambos casos desaparece de esta lista (ver DELETE /api/entrenador/checkin-config/campos).
  async function eliminar(campoId: string) {
    setEliminando(campoId)
    setError(null)
    try {
      const res = await fetch(`/api/entrenador/checkin-config/campos/${encodeURIComponent(campoId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data: CheckinConfigResponse = await res.json()
      setCampos(data.campos)
      setConfirmandoEliminar(null)
    } catch {
      setError('No se pudo eliminar el campo.')
    } finally {
      setEliminando(null)
    }
  }

  async function reactivar(campo: CampoCheckinResuelto) {
    setEliminando(campo.id)
    setError(null)
    try {
      const res = await fetch('/api/entrenador/checkin-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campos: [{ fieldId: campo.id, activo: true, orden: campo.orden, tipos: campo.tipos }],
        }),
      })
      if (!res.ok) throw new Error()
      const data: CheckinConfigResponse = await res.json()
      setCampos(data.campos)
    } catch {
      setError('No se pudo reactivar el campo.')
    } finally {
      setEliminando(null)
    }
  }

  async function recargarTrasCrear() {
    const res = await fetch('/api/entrenador/checkin-config', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data: CheckinConfigResponse = await res.json()
      setCampos(data.campos)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-3 text-lg font-semibold text-card-foreground">Programación por tipo de check-in</h1>
        <div className="grid gap-4 sm:grid-cols-3">
          {TIPOS.map((t) => (
            <div key={t.value} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-card-foreground">{t.label}</h2>
              <LanzamientoCheckin
                token={token}
                tipo={t.value}
                lanzadoInicial={programacion[t.value].lanzado}
                disponibleDesdeInicial={programacion[t.value].disponibleDesde}
              />
              {t.value === 'diario' ? (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                  <span className="font-medium text-card-foreground">Cada día</span> — se abre todos los días, sin
                  recurrencia que configurar.
                </p>
              ) : (
                <ProgramacionTipo token={token} tipo={t.value} programacionInicial={programacion[t.value]} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-card-foreground">Campos del check-in</h1>
          <button
            type="button"
            onClick={() => setMostrarModal(true)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background"
          >
            + Añadir campo personalizado
          </button>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {campos
            // "Eliminar" desactiva de forma duradera (campos estándar) o borra la fila
            // (personalizados) — en ambos casos, la fila deja de mostrarse aquí. `activo`
            // ya no controla solo el badge, controla si la fila aparece en absoluto: si
            // solo se ocultara el badge, "Eliminar" parecería no hacer nada (la fila
            // seguía ahí, solo marcada "Inactivo").
            .filter((campo) => !esCampoOcultoEnConfigAvanzada(campo) && campo.activo)
            .map((campo, index, visibles) => (
            <div key={campo.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moverCampo(campo.id, -1)}
                  disabled={index === 0}
                  className="text-xs text-muted hover:text-card-foreground disabled:opacity-30"
                  aria-label="Subir"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moverCampo(campo.id, 1)}
                  disabled={index === visibles.length - 1}
                  className="text-xs text-muted hover:text-card-foreground disabled:opacity-30"
                  aria-label="Bajar"
                >
                  ▼
                </button>
              </div>

              <div className="min-w-[10rem] flex-1">
                <p className="text-sm font-medium text-card-foreground">{campo.nombre}</p>
                <p className="text-xs text-muted">
                  {campo.tipo} · {campo.categoria} {campo.esEstandar ? '' : '· personalizado'}
                </p>
              </div>

              <div className="flex gap-3 text-xs text-card-foreground">
                {TIPOS.map((t) => (
                  <label key={t.value} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`tipo-${campo.id}`}
                      checked={campo.tipos.includes(t.value)}
                      onChange={() => seleccionarTipo(campo, t.value)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>

              {confirmandoEliminar === campo.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-danger">¿Eliminar «{campo.nombre}»?</span>
                  <button
                    type="button"
                    onClick={() => setConfirmandoEliminar(null)}
                    disabled={eliminando === campo.id}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-card-foreground hover:bg-background disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminar(campo.id)}
                    disabled={eliminando === campo.id}
                    className="rounded-lg bg-danger px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {eliminando === campo.id ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoEliminar(campo.id)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-danger hover:bg-background"
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
        </div>

        {(() => {
          const eliminados = campos.filter((c) => !esCampoOcultoEnConfigAvanzada(c) && !c.activo)
          if (eliminados.length === 0) return null
          return (
            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setMostrarEliminados((v) => !v)}
                className="text-xs font-medium text-muted hover:text-card-foreground"
              >
                {mostrarEliminados ? '▾' : '▸'} Campos eliminados ({eliminados.length})
              </button>
              {mostrarEliminados && (
                <div className="mt-2 flex flex-col divide-y divide-border">
                  {eliminados.map((campo) => (
                    <div key={campo.id} className="flex items-center justify-between gap-3 py-2">
                      <p className="text-sm text-muted">{campo.nombre}</p>
                      <button
                        type="button"
                        onClick={() => reactivar(campo)}
                        disabled={eliminando === campo.id}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-card-foreground hover:bg-background disabled:opacity-50"
                      >
                        {eliminando === campo.id ? '…' : 'Reactivar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : guardadoOk ? '✓ Guardado' : 'Guardar cambios'}
        </button>

        {mostrarModal && (
          <CampoPersonalizadoModal token={token} onClose={() => setMostrarModal(false)} onCreated={recargarTrasCrear} />
        )}
      </div>
    </div>
  )
}
