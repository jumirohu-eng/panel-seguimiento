'use client'

import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { ObjetivoResuelto, PeriodicidadObjetivo, ModoProgresoObjetivo, DireccionObjetivo } from '@/lib/objetivos'
import { CampoCheckinResuelto } from '@/lib/types'
import { LISTA_OBJETIVOS_PREDEFINIDOS, OBJETIVOS_PREDEFINIDOS, ObjetivoPredefinidoId } from '@/lib/objetivosPredefinidos'

const PERIODICIDADES: { value: PeriodicidadObjetivo; label: string }[] = [
  { value: 'diario', label: 'Cada día' },
  { value: 'semanal', label: 'Cada semana' },
  { value: 'mensual', label: 'Cada mes' },
]

// 'existente' = el cliente ya registra este dato con otro objetivo/en el check-in. 'nueva' =
// no existe todavía, se crea un dato nuevo para registrar ("Otra métrica"). 'ninguna' = objetivo
// solo informativo, sin dato asociado.
type ModoFuente = 'existente' | 'nueva' | 'ninguna'

// Paso 1 (solo al crear): elegir un objetivo predefinido o "Avanzado/personalizado". Al
// editar un objetivo ya existente se salta directo al formulario avanzado — no existe (a
// propósito) ningún campo en Objetivos que recuerde "esto se creó desde la plantilla Pasos",
// así que editar siempre reutiliza el configurador completo, igual que antes de esta sesión
// (ver DECISIONS.md, "Objetivos predefinidos + check-ins").
type Paso = 'elegir' | 'formulario'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function ObjetivoModal({
  clienteId,
  objetivoExistente,
  onClose,
  onSaved,
}: {
  clienteId: string
  objetivoExistente?: ObjetivoResuelto | null
  onClose: () => void
  onSaved: () => void
}) {
  const editando = Boolean(objetivoExistente)

  const [paso, setPaso] = useState<Paso>(editando ? 'formulario' : 'elegir')
  const [predefinidoId, setPredefinidoId] = useState<ObjetivoPredefinidoId | null>(null)
  const predefinido = predefinidoId ? OBJETIVOS_PREDEFINIDOS[predefinidoId] : null

  const [campos, setCampos] = useState<CampoCheckinResuelto[]>([])
  const [loadingCampos, setLoadingCampos] = useState(true)

  const [nombre, setNombre] = useState(objetivoExistente?.nombre ?? '')
  // La frecuencia la decide siempre el entrenador (nunca fijada por el objetivo
  // predefinido) — "¿Tiene frecuencia?" solo existe como pregunta en el avanzado, porque
  // 'acumulado' la necesita técnicamente para saber en qué ventana sumar (ver DECISIONS.md).
  const [tieneFrecuencia, setTieneFrecuencia] = useState(objetivoExistente ? objetivoExistente.periodicidad !== null : true)
  const [periodicidad, setPeriodicidad] = useState<PeriodicidadObjetivo>(objetivoExistente?.periodicidad ?? 'semanal')
  const [meta, setMeta] = useState(String(objetivoExistente?.meta ?? ''))
  const [unidad, setUnidad] = useState(objetivoExistente?.unidad ?? '')
  const [fechaInicio, setFechaInicio] = useState(objetivoExistente?.fechaInicio ?? hoyISO())
  const [fechaFin, setFechaFin] = useState(objetivoExistente?.fechaFin ?? '')

  const [modoFuente, setModoFuente] = useState<ModoFuente>(
    objetivoExistente?.fuenteFieldId ? 'existente' : 'ninguna'
  )
  const [fuenteFieldId, setFuenteFieldId] = useState(objetivoExistente?.fuenteFieldId ?? '')
  const [nuevaNombre, setNuevaNombre] = useState('')
  const [nuevaTipo, setNuevaTipo] = useState<'si_no' | 'numero'>('numero')
  const [nuevaUnidad, setNuevaUnidad] = useState('')

  const [modoProgreso, setModoProgreso] = useState<ModoProgresoObjetivo>(objetivoExistente?.modoProgreso ?? 'acumulado')
  const [direccion, setDireccion] = useState<DireccionObjetivo>(objetivoExistente?.direccion ?? 'bajar')
  const [valorInicial, setValorInicial] = useState(
    objetivoExistente?.valorInicial !== null && objetivoExistente?.valorInicial !== undefined
      ? String(objetivoExistente.valorInicial)
      : ''
  )

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const campoSeleccionado = campos.find((c) => c.id === fuenteFieldId)
  const tipoFuenteEfectivo: 'si_no' | 'numero' | null =
    modoFuente === 'existente'
      ? campoSeleccionado?.tipo === 'si_no' || campoSeleccionado?.tipo === 'numero'
        ? campoSeleccionado.tipo
        : null
      : modoFuente === 'nueva'
        ? nuevaTipo
        : null

  // "Sin frecuencia" solo es coherente en modo valor_objetivo (no necesita ventana de
  // tiempo para calcular progreso, ver resolverObjetivo()) — en acumulado, la frecuencia ES
  // la ventana en la que se suma. Se fuerza "Sí" en el propio onChange del radio de modo
  // (ver más abajo), no en un efecto, para no encadenar renders innecesarios.
  function elegirModoProgreso(modo: ModoProgresoObjetivo) {
    setModoProgreso(modo)
    if (modo === 'acumulado') setTieneFrecuencia(true)
  }

  const explicacionProgreso =
    modoProgreso === 'valor_objetivo'
      ? 'El progreso se mide por la distancia entre el punto de partida y el último dato registrado, hacia la meta.'
      : tipoFuenteEfectivo === 'si_no'
        ? 'Se contará 1 por cada día del periodo en que tu cliente responda "Sí".'
        : tipoFuenteEfectivo === 'numero'
          ? 'Se sumará lo que tu cliente registre cada día del periodo.'
          : null

  useEffect(() => {
    async function cargarCampos() {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      try {
        const res = await fetch('/api/entrenador/checkin-config', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const config: { campos: CampoCheckinResuelto[] } = await res.json()
          setCampos(config.campos.filter((c) => c.activo && (c.tipo === 'si_no' || c.tipo === 'numero')))
        }
      } finally {
        setLoadingCampos(false)
      }
    }
    cargarCampos()
  }, [])

  function elegirPredefinido(id: ObjetivoPredefinidoId) {
    setPredefinidoId(id)
    setMeta('')
    setValorInicial('')
    setTieneFrecuencia(true)
    setDireccion('bajar')
    setPaso('formulario')
  }

  function elegirAvanzado() {
    setPredefinidoId(null)
    setPaso('formulario')
  }

  function volverAElegir() {
    setPaso('elegir')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const metaNum = Number(meta)
    if (!Number.isFinite(metaNum) || metaNum <= 0) return setError('La meta debe ser un número mayor que 0.')
    if (!predefinido) {
      if (!nombre.trim()) return setError('Ponle un nombre al objetivo.')
      if (!unidad.trim()) return setError('Indica la unidad (kg, pasos, sesiones…).')
      if (modoFuente === 'nueva' && !nuevaNombre.trim()) return setError('Escribe el nombre de la métrica nueva.')
    }

    const modoProgresoFinal = predefinido ? predefinido.modoProgreso : modoProgreso
    const usaValorObjetivo = predefinido ? predefinido.requiereDireccion : tipoFuenteEfectivo === 'numero' && modoProgreso === 'valor_objetivo'

    let valorInicialNum: number | null = null
    if (valorInicial.trim() !== '') {
      valorInicialNum = Number(valorInicial)
      if (!Number.isFinite(valorInicialNum)) return setError('El valor inicial debe ser un número.')
    }
    if (usaValorObjetivo && valorInicialNum === null) {
      return setError('Indica el punto de partida (p. ej. el peso actual de tu cliente).')
    }
    // Para los predefinidos "acumulado" (Pasos/Entrenamientos/Movilidad) pedimos el valor
    // inicial como parte del propio flujo guiado, aunque el backend lo trate como opcional/
    // informativo para este modo (ver DECISIONS.md) — coincide con el ejemplo del brief
    // ("meta → valor inicial → frecuencia").
    if (predefinido && !predefinido.requiereDireccion && valorInicialNum === null) {
      return setError('Indica el valor inicial de tu cliente (p. ej. sus pasos habituales).')
    }

    const periodicidadFinal: PeriodicidadObjetivo | null = tieneFrecuencia ? periodicidad : null

    setGuardando(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      const cuerpoFuente = predefinido
        ? predefinido.fuente.modo === 'fija'
          ? { fuenteFieldId: predefinido.fuente.fieldId }
          : { fuenteNueva: { nombre: predefinido.fuente.nombreMetrica, tipo: predefinido.fuente.tipoMetrica } }
        : modoFuente === 'existente'
          ? { fuenteFieldId: fuenteFieldId || null }
          : modoFuente === 'nueva'
            ? {
                fuenteNueva: {
                  nombre: nuevaNombre.trim(),
                  tipo: nuevaTipo,
                  unidad: nuevaTipo === 'numero' ? nuevaUnidad.trim() || undefined : undefined,
                },
              }
            : { fuenteFieldId: null }

      const body = {
        nombre: predefinido ? predefinido.nombre : nombre.trim(),
        periodicidad: periodicidadFinal,
        meta: metaNum,
        unidad: predefinido ? predefinido.unidad : unidad.trim(),
        fechaInicio,
        fechaFin: fechaFin || null,
        ...cuerpoFuente,
        modoProgreso: modoProgresoFinal,
        direccion: usaValorObjetivo ? direccion : null,
        valorInicial: valorInicialNum,
      }
      const url = editando
        ? `/api/clientes/${clienteId}/objetivos/${objetivoExistente!.id}`
        : `/api/clientes/${clienteId}/objetivos`
      const res = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const responseData = await res.json().catch(() => null)
      if (!res.ok) throw new Error(responseData?.error ?? 'No se pudo guardar el objetivo')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el objetivo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-card-foreground">
            {editando ? 'Editar objetivo' : paso === 'elegir' ? 'Nuevo objetivo' : predefinido ? predefinido.nombre : 'Objetivo avanzado'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-card-foreground">
            ✕
          </button>
        </div>

        {paso === 'elegir' ? (
          <div className="flex flex-col gap-2">
            <p className="mb-1 text-sm text-muted">Elige qué quiere conseguir tu cliente.</p>
            {LISTA_OBJETIVOS_PREDEFINIDOS.map((def) => (
              <button
                key={def.id}
                type="button"
                onClick={() => elegirPredefinido(def.id)}
                className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-background"
              >
                <p className="text-sm font-medium text-card-foreground">{def.nombre}</p>
                <p className="text-xs text-muted">{def.descripcion}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={elegirAvanzado}
              className="rounded-lg border border-dashed border-border p-3 text-left transition-colors hover:bg-background"
            >
              <p className="text-sm font-medium text-card-foreground">Avanzado / Personalizado</p>
              <p className="text-xs text-muted">Configura nombre, fuente y progreso a tu medida.</p>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!editando && (
              <button type="button" onClick={volverAElegir} className="w-fit text-xs text-muted underline hover:text-card-foreground">
                ← Elegir otro tipo de objetivo
              </button>
            )}

            {!predefinido && (
              <>
                {/* Nombre — solo en el avanzado, los predefinidos ya tienen el suyo */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Nombre del objetivo</label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="10.000 pasos, 3 entrenamientos, Peso…"
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-card-foreground">¿Qué dato mide este objetivo?</label>
                  <div className="flex flex-wrap gap-2">
                    {campos.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setModoFuente('existente')
                          setFuenteFieldId(c.id)
                        }}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          modoFuente === 'existente' && fuenteFieldId === c.id
                            ? 'border-primary bg-primary text-white'
                            : 'border-border text-card-foreground hover:bg-background'
                        }`}
                      >
                        {c.nombre}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setModoFuente('nueva')}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        modoFuente === 'nueva'
                          ? 'border-primary bg-primary text-white'
                          : 'border-border text-card-foreground hover:bg-background'
                      }`}
                    >
                      Otra métrica
                    </button>
                  </div>
                  {!loadingCampos && campos.length === 0 && modoFuente === 'existente' && (
                    <p className="text-xs text-muted">Tu cliente todavía no registra ninguna métrica — elige &ldquo;Otra métrica&rdquo;.</p>
                  )}

                  {modoFuente === 'nueva' && (
                    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border p-3">
                      <input
                        type="text"
                        value={nuevaNombre}
                        onChange={(e) => setNuevaNombre(e.target.value)}
                        placeholder="Nombre de la métrica (p. ej. Pasos, Movilidad, Peso)"
                        className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
                      />
                      <div className="flex gap-3 text-xs text-card-foreground">
                        <label className="flex items-center gap-1">
                          <input type="radio" name="nuevaTipo" checked={nuevaTipo === 'numero'} onChange={() => setNuevaTipo('numero')} />
                          Es un número
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="radio" name="nuevaTipo" checked={nuevaTipo === 'si_no'} onChange={() => setNuevaTipo('si_no')} />
                          Es sí/no
                        </label>
                      </div>
                      {nuevaTipo === 'numero' && (
                        <input
                          type="text"
                          value={nuevaUnidad}
                          onChange={(e) => setNuevaUnidad(e.target.value)}
                          placeholder="Unidad (opcional): kg, pasos…"
                          className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
                        />
                      )}
                      <p className="text-xs text-muted">Tu cliente podrá registrarla desde su seguimiento diario.</p>
                    </div>
                  )}

                  {modoFuente !== 'ninguna' ? (
                    <button
                      type="button"
                      onClick={() => setModoFuente('ninguna')}
                      className="w-fit text-xs text-muted underline hover:text-card-foreground"
                    >
                      Este objetivo es solo informativo (sin dato asociado)
                    </button>
                  ) : (
                    <p className="text-xs text-muted">
                      Objetivo informativo, sin dato asociado.{' '}
                      <button
                        type="button"
                        onClick={() => setModoFuente(campos.length > 0 ? 'existente' : 'nueva')}
                        className="text-primary underline"
                      >
                        Asociar un dato
                      </button>
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Meta (+ unidad, ya resuelta en los predefinidos) */}
            {predefinido ? (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-card-foreground">Meta ({predefinido.unidad})</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Meta</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={meta}
                    onChange={(e) => setMeta(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Unidad</label>
                  <input
                    type="text"
                    required
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value)}
                    placeholder="sesiones, pasos, kg…"
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {/* Valor inicial — punto de partida del cliente. Obligatorio para Peso/valor
                objetivo; pedido también en los predefinidos "acumulado" como parte del
                flujo guiado (ver DECISIONS.md), pero nunca entra en el cálculo de esos. */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-card-foreground">
                Valor inicial
                {predefinido && !predefinido.requiereDireccion ? (
                  <span className="text-xs font-normal text-muted"> (punto de partida de tu cliente)</span>
                ) : null}
              </label>
              <input
                type="number"
                step="any"
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value)}
                placeholder={predefinido ? `p. ej. ${predefinido.id === 'peso' ? '80' : '7500'}` : 'p. ej. 70'}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
              />
            </div>

            {/* Frecuencia — siempre la decide el entrenador, nunca fijada por el objetivo. */}
            <div className="flex flex-col gap-2">
              {!predefinido && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">¿Tiene frecuencia?</label>
                  <div className="flex gap-3 text-sm text-card-foreground">
                    <label className="flex items-center gap-1">
                      <input type="radio" name="tieneFrecuencia" checked={tieneFrecuencia} onChange={() => setTieneFrecuencia(true)} />
                      Sí
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="tieneFrecuencia"
                        checked={!tieneFrecuencia}
                        disabled={modoProgreso === 'acumulado'}
                        onChange={() => setTieneFrecuencia(false)}
                      />
                      No
                    </label>
                  </div>
                  {modoProgreso === 'acumulado' && (
                    <p className="text-xs text-muted">
                      Un objetivo que suma registros necesita frecuencia — es el periodo en el que se suman.
                    </p>
                  )}
                </div>
              )}
              {tieneFrecuencia && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Frecuencia</label>
                  <select
                    value={periodicidad}
                    onChange={(e) => setPeriodicidad(e.target.value as PeriodicidadObjetivo)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  >
                    {PERIODICIDADES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {predefinido?.requiereDireccion && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-card-foreground">¿Subir o bajar?</label>
                <select
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value as DireccionObjetivo)}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                >
                  <option value="bajar">Bajar</option>
                  <option value="subir">Subir</option>
                </select>
              </div>
            )}

            {!predefinido && tipoFuenteEfectivo === 'numero' && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <label className="text-xs font-medium text-card-foreground">¿Cómo se mide el progreso?</label>
                <div className="flex flex-col gap-1 text-xs text-card-foreground">
                  <label className="flex items-center gap-1">
                    <input type="radio" name="modoProgreso" checked={modoProgreso === 'acumulado'} onChange={() => elegirModoProgreso('acumulado')} />
                    Sumando cada registro (pasos, entrenamientos…)
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="modoProgreso"
                      checked={modoProgreso === 'valor_objetivo'}
                      onChange={() => setModoProgreso('valor_objetivo')}
                    />
                    Acercándose a una meta (peso, medidas…)
                  </label>
                </div>

                {explicacionProgreso && <p className="text-xs text-muted">{explicacionProgreso}</p>}
              </div>
            )}
            {predefinido && explicacionProgreso && <p className="text-xs text-muted">{explicacionProgreso}</p>}

            {!predefinido && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">Fecha inicio</label>
                  <input
                    type="date"
                    required
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-card-foreground">
                    Fecha fin <span className="text-xs font-normal text-muted">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-card-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={guardando}
              className="mt-1 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear objetivo'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
