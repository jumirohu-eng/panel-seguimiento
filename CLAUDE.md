# CLAUDE.md — RetainCoach

## Cómo trabajar en este repositorio

Antes de trabajar:
1. Lee este archivo completo.
2. Lee `DECISIONS.md` completo.
3. Revisa el estado actual del código y los últimos commits relevantes.
4. No contradigas una decisión existente silenciosamente. Si hay nueva evidencia para cambiarla, documenta qué cambia, por qué y qué decisión anterior reemplaza.
5. Distingue hechos comprobados, hipótesis e inferencias.

Al finalizar una tarea:
- Actualiza `CLAUDE.md` con el estado actual y contexto relevante para futuras sesiones.
- Actualiza `DECISIONS.md` con las decisiones técnicas relevantes tomadas durante la tarea.
- No inventes entradas si no hubo cambios relevantes.
- Haz commit y push de la documentación junto con los cambios de código.

## División de memoria

- **GitHub / `DECISIONS.md`** → decisiones técnicas, arquitectura, implementación, seguridad, infraestructura, bugs relevantes y aprendizajes técnicos.
- **Airtable / Registro Maestro** → estrategia, mercado, validaciones comerciales, pricing, hipótesis de negocio y decisiones de producto.
- **Documentos del proyecto** → fuente de verdad de evidencia y contexto documentado.

## Estado actual

Repositorio: `jumirohu-eng/panel-seguimiento`
Rama: `main`
Stack: Next.js 16 App Router + TypeScript + Tailwind; Supabase Auth; Vercel API Routes; Airtable; n8n self-hosted; Claude API; Resend.
Tally se retiró por completo en Parte 1.5.3 (ver `DECISIONS.md` DEC-2026-029) — ya no forma
parte del stack operativo. El único punto de entrada de clientes es la invitación privada
(entrenador → cliente → invitación → signup → onboarding → app).

Arquitectura de roles:
- `admin` se resuelve desde Airtable `Admins` con `Activo=true`.
- `entrenador` se resuelve desde `Entrenadores`.
- `cliente` se resuelve desde `Clientes`.
- Prioridad actual: `admin > entrenador > cliente`.
- Un mismo email puede tener varios roles.
- Todos usan Supabase Auth; no existe `clientes_login`.

Datos:
- Airtable es la fuente de datos operativa de clientes, entrenadores y reportes.
- `Clientes.Entrenador` contiene el email del entrenador y es la fuente de verdad para ownership.
- `Entrenador_nuevo` y `Reportes.Cliente_Entrenador` son vestigiales y no deben utilizarse para resolver ownership.
- `Campos_checkin` (`tblY8lFGaO2iA29Zf`) + `Registros_checkin` (`tbl7usdXJYJA83lsm`) + `Checkin_tipos` (`tblsiRHYa7SFro2Th`, Parte 1.5): modelo de check-in in-app del cliente. Ver sección dedicada más abajo y `DECISIONS.md` DEC-2026-006 a 020.
- `notas_privadas` (Supabase Postgres, no Airtable): "Mis notas" se **eliminó por completo** de la app en Parte 1.5.3 (UI, rutas, API) — ver `DECISIONS.md` DEC-2026-030. La tabla en sí y su única fila real (de `jumirohu@gmail.com`, rol cliente) **no se han borrado**, por decisión explícita del usuario al confirmar la retirada — quedan huérfanas en Supabase, sin ningún endpoint que las use. No reintroducir esta funcionalidad sin revisar antes esa decisión.
- `Objetivos` (`tbl0IwhFmKLc0MolG`, Parte 1.5.2): objetivos configurables por cliente, con progreso calculado desde `Registros_checkin`. Sustituye a `Clientes.Entrenamientos_objetivo` como indicador fijo del dashboard. `Objetivos.Eliminado` (checkbox, Parte 1.5.3) es un soft-delete distinto de `Activo` — ver `DECISIONS.md` DEC-2026-032. Ver sección dedicada más abajo.

Auth/API:
- Las API routes deben verificar el JWT de Supabase.
- Los endpoints de admin usan `getAuthenticatedAdminEmail()`.
- Los endpoints que modifican datos de un entrenador/cliente deben comprobar ownership/rol explícitamente.
- Los secretos nunca deben estar en frontend, Git o nodos de n8n.

## RetainCoach Parte 1.5.3 — Limpieza, programación clara y objetivos integrados (2026-08-14)

Rama: `retaincoach-parte-1.5.3` (derivada de `retaincoach-objetivos-parte-1.5.2`, que ya
incluía el fast-forward del bugfix de `/planes`). Push pendiente hasta confirmar con el
usuario — ver "Pendiente real" al final de esta sección.

**Contradicción señalada antes de implementar (regla de `CLAUDE.md`):** DEC-2026-027
había decidido explícitamente NO tocar el flujo Tally semanal
(`Resumen&Alerta`/`Análisis Lunes`) porque la cuenta real del usuario lo usaba. Este
brief pedía retirarlo por completo. Se preguntó explícitamente antes de tocar nada — el
usuario confirmó la retirada total, aceptando perder el análisis IA semanal sin
sustituto hasta Parte 2. Ver DEC-2026-029 (reemplaza a DEC-2026-027).

### 1. Retirada completa de Tally
n8n: eliminados permanentemente (no solo desactivados) `Recepción entrenador`,
`Seguimiento - Análisis Lunes`, `Seguimiento - Resumen&Alerta` y `Seguimiento - Alta
cliente`. Se mantienen `Snapshot mensual` (no depende de Tally, solo lee
Airtable directamente) y `Seguimiento - Limpieza de datos antiguos` (inactivo,
archiva `Reportes`→`Archivo`, sin relación operativa con Tally).

Código: eliminados `linkTallyAlta`/`tieneAlerta`/`alertaResumen` de `Cliente` (tipo, API,
UI), `StatusBadge.tsx` (código muerto, nunca se importaba) y `estadoReporte.ts`.
`ClienteFicha` ya no calcula el botón de WhatsApp a partir del último `Reporte` — usa
siempre `Clientes.Link_recordatorio`. `Link_tally_alta` se quitó de `ClienteFields`
(la app ya no lo lee ni escribe; la columna en Airtable no se toca). Variable de entorno
`NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL` (ya muerta, sin uso en código) retirada de
`.env.example`.

**Decisión explícita: `Reportes`/`Archivo` se conservan como histórico de solo lectura.**
`GET /api/reportes`, `getReportesConMensajeSugerido()`/`getArchivoConMensajeSugerido()`
(usadas por `/api/admin/alertas-stats` y `/api/admin/metricas-negocio`) y la sección
"Reportes semanales (histórico Tally)" en `ClienteFicha` (relabeled, con nota explícita
de que ya no llegan reportes nuevos, solo visible si el cliente tiene reportes) se dejan
tal cual — ningún dato se borra. Ver DEC-2026-029.

### 2. Eliminación de "Mis notas" — salvo la tabla
UI/rutas/API eliminadas por completo: `/cliente/notas`, `/api/cliente/notas`, el bloque
"Mis notas" en `/cliente/dashboard`, y `createSupabaseUserClient()` en
`supabase-server.ts` (quedaba sin ningún otro consumidor). **La tabla Postgres
`notas_privadas` no se ha tocado** — antes de dropearla se auditó y tenía 1 fila real
(no de prueba) escrita el mismo día por la cuenta real del usuario
(`jumirohu@gmail.com`, rol cliente). Se preguntó explícitamente y el usuario pidió
conservar la tabla/datos, eliminando solo la interfaz de la app. Ver DEC-2026-030.

### 3. Programación de check-ins en lenguaje claro
Nuevas funciones puras en `checkinFields.ts`: `describirRecurrencia()` ("Cada día" /
"Cada lunes" / "Cada 7 días" / "El día 1 de cada mes") y `proximaAperturaGenerica()` /
`proximaAperturaSemanal()` (próxima apertura calculada de forma genérica, no ligada a un
cliente concreto — para la vista de configuración del entrenador). `ProgramacionTipo.tsx`
y `CheckinConfigView.tsx` ahora muestran ese resumen. Reutiliza el modelo existente de
`Checkin_tipos` (Parte 1.5, DEC-2026-014) sin cambios de esquema. **No se añadió hora del
día** — el modelo sigue siendo día-granular en UTC; añadir una hora exacta habría sido
inventar una capacidad que el sistema no tiene y que no es necesaria (el check-in es
insert-only y nunca bloquea el envío). Ver DEC-2026-031.

### 4-8. Objetivos: integración, recurrencia y fuentes ya estaban resueltos desde 1.5.2
Auditado antes de tocar nada: la integración objetivo→check-in
(`GET /api/cliente/checkin` ya exponía `objetivos` por tipo, sin duplicar en
`Registros_checkin`), la recurrencia diario/semanal/mensual y la coexistencia de varios
objetivos con la misma fuente (cada uno con su propio id/meta/periodicidad/progreso) ya
funcionaban correctamente desde Parte 1.5.2 (DEC-2026-026). Verificado con la prueba E2E
de esta sesión, sin necesitar cambios de arquitectura. Mejoras de UX añadidas: cabecera
"Objetivos de hoy/esta semana/este periodo" en `/cliente/checkin`, y en `ObjetivoModal`
el selector de fuente ya mostraba el nombre real del campo (nunca el `Field_id`) — se
añadió además una frase explicando cómo se calcula el progreso según el tipo
(sí/no → días con "Sí"; número → suma de lo registrado).

### 9. Objetivos: eliminar (soft-delete), distinto de desactivar
Nuevo campo Airtable `Objetivos.Eliminado` (checkbox). `getObjetivosByClienteEmail()` lo
filtra de forma centralizada (`{Eliminado} != TRUE()`, nunca `= FALSE()` — ver
DEC-2026-008) — un único punto de exclusión para toda la app. Nuevo
`DELETE /api/clientes/[id]/objetivos/[objetivoId]` (mismo gate de ownership que
GET/PATCH). Un objetivo eliminado se trata como inexistente (404) ante cualquier
intento posterior de PATCH — no se puede reactivar ni editar manipulando la API.
`ObjetivosEntrenador.tsx` añade el botón "Eliminar" con confirmación inline, distinto de
"Desactivar/Reactivar". La fila de Airtable nunca se borra (soft-delete real). Ver
DEC-2026-032.

### 10-11. Seguridad y migración
Todos los endpoints de objetivos ya comprobaban ownership del cliente
(`cliente.fields.Entrenador !== email`) y del objetivo dentro del cliente
(`objetivo.fields.Cliente?.includes(id)`, patrón DEC-2026-024) — el `DELETE` nuevo
reutiliza exactamente el mismo patrón. Nada de lo eliminado en esta parte borra datos:
`Reportes`/`Archivo` intactos, `notas_privadas` intacta, `Objetivos` eliminados quedan
como filas con `Eliminado=true` (nunca se destruyen), `Registros_checkin` no se toca en
ningún punto de esta sesión.

### Validación
`tsc --noEmit`, `eslint` y `next build`, los tres sin errores. Prueba E2E con fixtures
aislados y desechables (patrón DEC-2026-009: 2 entrenadores + 2 clientes ficticios,
`@example.com`, borrados al terminar), 40 comprobaciones: programación clara y próxima
apertura (semanal/periódico), creación de objetivos diario/semanal/mensual, dos
objetivos con la misma fuente sin fusionarse ni interferir, objetivo con fuente de otro
tipo de check-in (DEC-2026-026 sigue vigente), integración en `/api/cliente/checkin` por
sección correcta, progreso actualizado tras un envío real y con metas independientes,
edición reflejada, desactivar/reactivar sin perder historial, eliminar (soft-delete) y
confirmación de que no reaparece ni es reactivable por API, aislamiento completo entre
dos entrenadores (403 en GET/POST/PATCH/DELETE sobre cliente/objetivo ajeno, incluso con
IDs reales adivinados), objetivo real de OTRO cliente con `objetivoId` cruzado (404),
cliente inactivo bloqueado en check-in y objetivos, y confirmación de que
`/cliente/notas` y `/api/cliente/notas` ya no existen (404).

**No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta
sesión) — verificado contra la API real, Airtable real, Supabase real y n8n real.

**Pendiente real:**
- Prueba visual en navegador de la programación de check-ins y de "Objetivos de
  hoy/esta semana/este periodo" en `/cliente/checkin`.
- Confirmar con el usuario el mensaje de commit/push de esta rama antes de subirla.
- Decisión de producto que sigue abierta (no de esta sesión): motor de señales/alertas
  IA nuevo (Parte 2) — Tally ya no existe como sustituto parcial.

---

## Bugfix — `/planes` no se autocorregía tras conceder un plan (2026-08-14)

Rama: `bugfix-planes-no-se-autocorrige` (derivada de `retaincoach-objetivos-parte-1.5.2`,
no mergeada a `main`, sin push).

**Síntoma reportado:** un entrenador con `Seguimiento` concedido desde Admin seguía viendo
"Solicita acceso a un plan" en vez del dashboard.

**Causa exacta (demostrada, no hipótesis):** `tienePlanBase()`, el PUT de Admin
(`/api/admin/entrenadores/[email]`) y la lectura del entrenador
(`/api/entrenador/perfil`) funcionan correctamente — verificado con una prueba E2E contra
la API real que concede/quita/re-concede `Seguimiento` y confirma en cada paso el valor
real en Airtable y lo que devuelve la API (ver Validación). El bug real está en
`src/app/planes/page.tsx`: **esta página nunca comprobaba el plan del entrenador ni
redirigía de vuelta a `/dashboard`** — confirmado leyendo el archivo completo, el único
`router.push` era el de "no hay sesión → /login". Un entrenador sin plan que aterriza en
`/dashboard` es redirigido a `/planes` (lógica correcta, ahí sí se comprueba
`tienePlanBase`); pero una vez en `/planes`, esa página es estática — ni recargarla ni
esperar vuelve a comprobar nada. Si el admin concede el plan mientras el entrenador ya
está en esa pestaña, se queda viendo "Solicita acceso" indefinidamente hasta que navegue
manualmente a `/dashboard` (o vuelva a iniciar sesión, que también pasa por `/dashboard`).

**Dato que lo demuestra:** `grep -n "fetch\|tienePlanBase\|router.push" src/app/planes/page.tsx`
antes del fix solo devolvía la línea del redirect a `/login` — cero llamadas a
`/api/entrenador/perfil` ni a `tienePlanBase` en todo el archivo.

**Cambio:** `/planes/page.tsx` replica ahora el mismo chequeo que ya hace
`/dashboard/page.tsx` (rol admin → `/dashboard`; `tienePlanBase(soluciones)` → `/dashboard`;
si no, se queda mostrando la página tal cual). Así la página se autocorrige en cada carga
— basta con recargar o volver a `/planes` después de que el admin conceda el plan. No se
tocó `tienePlanBase()`, el modelo de `Soluciones`, ni ningún endpoint de Admin.

**Validación:** prueba E2E contra la API real (Airtable + Supabase reales, fixtures
desechables): sin `Seguimiento` → `tienePlanBase=false`; se concede → `true`; se quita →
`false`; se vuelve a conceder → `true`; se comprueba además que `Referidos`/`Captación`
por separado no interfieren entre sí (planes independientes intactos). `tsc --noEmit`,
`eslint` y `next build` sin errores. **No probado visualmente en navegador** (sin acceso
a la extensión de Chrome en esta sesión) — la lógica de `/planes` añadida es una copia
mecánica de la de `/dashboard`, ya probada en producción.

---

## RetainCoach Parte 1.5.2 — Objetivos, progreso y retirada de Tally para clientes nuevos (2026-08-14)

Rama: `retaincoach-objetivos-parte-1.5.2` (derivada de `retaincoach-onboarding-parte-1.5.1`, no
mergeada a `main`). **Sin push todavía** — a la espera de revisión explícita antes de subir la rama.

### 1–2. Objetivos configurables + fuente de progreso
Tabla nueva `Objetivos` (`tbl0IwhFmKLc0MolG`): `Nombre`, `Cliente` (link), `Cliente_Email`
(texto, escrito por la app — no lookup, ver DEC-2026-024), `Periodicidad`
(diario/semanal/mensual), `Meta`, `Unidad`, `Fuente_field_id` (opcional, `Field_id` de
`Campos_checkin`), `Fecha_inicio`, `Fecha_fin` (opcional), `Activo`, `Orden`,
`Last_modified`. El entrenador crea/edita/desactiva objetivos por cliente
(`ObjetivosEntrenador.tsx` + `ObjetivoModal.tsx`, embebidos en `ClienteFicha.tsx`) — nunca se
borran, solo se desactivan (mismo patrón que el resto del proyecto).

Fuente de progreso: solo campos de check-in **activos** de tipo `si_no` o `numero` (validado
server-side, `validarFuenteObjetivo()` en `src/lib/objetivos.ts`) — el resto de tipos
(texto, selección, dolor…) no tiene un cálculo numérico claro y no se ofrecen como opción.
"Sin fuente" es válido (objetivo puramente informativo, sin barra de progreso).

### 3–4. Integración con check-ins y cálculo del progreso
**Decisión de diseño importante, corregida durante esta misma sesión:** el campo fuente de
un objetivo NO tiene que estar asignado al mismo tipo de check-in que la periodicidad del
objetivo. El propio ejemplo del brief ("Entrenamientos — semanal — 4 — sesiones") se
alimenta de `entrenamiento_realizado`, que en este proyecto solo se pregunta en el check-in
**diario** — exigir coincidencia de tipo (diseño inicial de esta sesión, descartado antes de
terminar) habría hecho ese ejemplo literalmente imposible de construir. El progreso se
calcula agregando `Registros_checkin` por `Field_id` dentro de la ventana de la periodicidad
del objetivo (hoy/semana/mes), sin filtrar por `Tipo_registro`:
- `si_no`: cuenta de días con valor `true` dentro de la ventana (dedupe por día, se queda
  con el envío más reciente — resuelve correcciones sin duplicar, mismo criterio que ya
  usaba Parte 1.5).
- `numero`: suma del valor más reciente de cada día dentro de la ventana.
- Vigencia (`Fecha_inicio`/`Fecha_fin`) se respeta siempre, independiente del toggle Activo.

"Mensual" (periodicidad de objetivo) se empareja con "periódico" (tipo de check-in) — es la
cadencia existente más cercana a un mes (día del mes / cada N días, ver DEC-2026-014), tal
como lo pide el brief explícitamente. Esa correspondencia (`PERIODICIDAD_A_TIPO_CHECKIN`,
`src/lib/objetivos.ts`) solo decide en QUÉ SECCIÓN del check-in (`/cliente/checkin`) se
muestra el objetivo — no de dónde sale su progreso (ver arriba). Solo se muestran ahí
objetivos con progreso resoluble (`GET /api/cliente/checkin` filtra por
`o.progreso !== null`), para no mostrar un objetivo sin forma de actuar sobre él.

### 5. Dashboard cliente
Eliminada la sección fija "Entrenamientos esta semana" (leía `Clientes.Entrenamientos_objetivo`,
ver DEC-2026-020) y `ClientePerfil.entrenamientosObjetivo`/`entrenamientosSemana`. Sustituida
por "Mis objetivos" (`MisObjetivos.tsx`), agrupada en Hoy/Esta semana/Este mes por
`periodicidad`, mostrando solo objetivos `activo && vigenteHoy` (`GET /api/cliente/objetivos`).
`Clientes.Entrenamientos_objetivo` **no se borra** de Airtable (histórico), simplemente deja
de leerse. `contarEntrenamientosSemana()` (código muerto tras el cambio) se eliminó de
`checkinFields.ts`.

### 6. Ficha entrenador
`ObjetivosEntrenador.tsx`: lista todos los objetivos (activos e inactivos, vigentes o no) con
periodicidad, meta, progreso del periodo actual, estado (Activo/Fuera de vigencia/Desactivado)
y botones editar/(des)activar. Colocado justo después del bloque de invitación y antes de
"Reportes semanales (Tally)" — mismo sitio donde el entrenador ya revisa check-ins e historial,
para que Objetivos → progreso → check-ins → datos quede junto, tal como pide el brief. No se
implementan alertas ni IA (fuera de alcance explícito de esta parte).

### 7. Preparado para IA futura (no implementada)
El modelo (`ObjetivoResuelto`: nombre, periodicidad, meta, unidad, progreso, historial vía
`Registros_checkin`) queda listo para que un futuro motor de señales lo consuma — no se
construye ningún motor ni alerta en esta parte. `notas_privadas` sigue estructuralmente
fuera de este y de cualquier flujo de IA (sin cambios, ver DEC-2026-018).

### 8. Retirada de Tally (auditada antes de tocar nada)
Auditados: Tally, n8n (`n8n_list_workflows`/`n8n_get_workflow`), `Reportes`, endpoints,
componentes del dashboard. Workflows n8n activos confirmados: `Recepción entrenador`,
`Seguimiento - Análisis Lunes`, `Seguimiento - Resumen&Alerta`, `Seguimiento - Alta cliente`,
`Snapshot mensual` (los 5 ya documentados) + descubierto `Seguimiento - Limpieza de datos
antiguos` (**inactivo**, archiva `Reportes` viejos a `Archivo` antes de borrarlos — no
tocado, no se activó).

**Única dependencia activa identificada para clientes nuevos:** `POST /api/clientes` generaba
un `Link_tally_alta` (formulario Tally de alta) para que el cliente rellenara
objetivo/notas/entrenamientos — ahora cubierto por el onboarding nativo (Parte 1.5.1) +
Objetivos (esta parte). **Retirada:** ya no se genera para clientes nuevos
(`linkTallyAlta()` eliminada de `src/app/api/clientes/route.ts`, bloque correspondiente
eliminado de `RegistrarClienteModal.tsx`). `Link_tally_alta` de clientes ya existentes no se
toca ni se borra — sigue mostrándose en `ClienteFicha` si lo tienen.

**Deliberadamente NO tocado (fuera de alcance — "para nuevos clientes ni check-ins", no
"para todo el mundo"):** el webhook `Seguimiento - Resumen&Alerta` (Tally semanal →
`Reportes`) y `Seguimiento - Análisis Lunes` (IA sobre `Reportes`) siguen activos y en uso
real por clientes existentes (ver DEC-2026-010, actividad real de
`jumirohu@gmail.com`/`reccN567mhDPMes36`). El check-in in-app (Parte 1.5) nunca dependió de
Tally — nada de esto es una dependencia para clientes nuevos ni para check-ins. Apagar ese
flujo es una decisión de producto mayor (ver DEC-2026-006, "decidir si/cuándo migrar Tally →
check-in in-app", todavía sin resolver) que rompería el uso real de hoy — no se toma en esta
sesión sin confirmación explícita.

### Backfill de continuidad
4 clientes reales ya tenían `Entrenamientos_objetivo` > 0 (Carlos=5, Juanmi=5,
`retaincoachsolution@gmail.com`=5, Sofia=4). Para no perder ese indicador de golpe en el
dashboard, se creó para cada uno un `Objetivo` "Entrenamientos" (semanal, meta = su valor
anterior, unidad "sesiones", fuente `entrenamiento_realizado`) — mismo criterio que backfills
anteriores del proyecto (DEC-2026-013, DEC-2026-015). No se tocó `Entrenamientos_objetivo` en
sí (queda igual, histórico). 2 clientes sin `Entrenamientos_objetivo`/`Objetivo` (nunca
completaron alta) no recibieron backfill — no había nada que preservar.

### Validación
Prueba E2E con fixtures aislados y desechables (patrón DEC-2026-009), 46 comprobaciones:
retirada de Tally (sin `Link_tally_alta` en clientes nuevos), validación de creación
(periodicidad/meta/unidad/fuente inválidas → 400), ownership (entrenador ajeno → 403 en
GET/POST/PATCH), el ejemplo exacto del brief (objetivo semanal desde fuente diaria) con
progreso resuelto correctamente (0→1/3→3/3 tras backdatear registros dentro de la misma
semana), objetivo numérico mensual (`peso`) sumando correctamente, integración en
`/cliente/checkin` (el objetivo aparece en `semanal.objetivos`, no en `diario.objetivos`;
el mensual aparece en `periodico.objetivos`), vigencia (fecha de inicio futura invisible
para el cliente pero visible para el entrenador, progreso `null` sin fuente), desactivar/
reactivar sin perder progreso ni historial, edición de nombre/meta, historial de
`GET /api/checkins` intacto, y `Entrenamientos_objetivo` de un cliente real sin modificar.
`tsc --noEmit`, `eslint` y `next build`, los tres sin errores. Limpieza confirmada (0 filas
de prueba restantes en las 3 tablas tocadas, 0 usuarios Supabase de prueba restantes).

**No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta sesión)
— verificado contra la API real, Airtable real y Supabase real.

**Pendiente real:**
- Prueba visual en navegador (creación de objetivos desde la ficha, vista del cliente en
  dashboard y check-in).
- Decisión de producto pendiente (no de esta sesión): si/cuándo retirar también el flujo
  Tally semanal (`Reportes`) para clientes existentes — ver DEC-2026-006.

---

## RetainCoach Parte 1.5.1 — onboarding y activación de clientes (2026-08-14)

Rama: `retaincoach-onboarding-parte-1.5.1` (derivada de `main`). No mergeada a `main`.

**Qué se construyó:** flujo definitivo de alta de cliente por invitación privada, sustituyendo
la generación de contraseñas temporales por el entrenador. Entrenador crea cliente → genera
invitación (token único, 24h, un solo uso) → cliente abre el link → email pre-rellenado y no
editable → crea su propia contraseña → confirma email → login → onboarding nativo breve →
dashboard. **No hay registro público de clientes** — el único punto de entrada es un token
válido generado por su propio entrenador.

### Modelo de datos (aditivo)
- Tabla nueva `Invitaciones_cliente` (`tblrWxTzzuPSFPzNP`): mismo patrón/estados que
  `Invitaciones` (entrenadores) — `Token`, `Estado` (Activo/Usado/Expirado/Cancelado),
  `Creado`, `Expira` — pero añade `Cliente` (link a `Clientes`) y `Entrenador` (email,
  texto plano) porque esta invitación está ligada a un cliente+entrenador concreto, no
  solo a un email suelto. Tabla separada de `Invitaciones`, que no se toca.
- `Clientes.Objetivos_adicionales` (multipleSelects, mismas 4 opciones que `Objetivo`) y
  `Clientes.Dias_disponibles` (multipleSelects, días de la semana) — campos nuevos del
  onboarding nativo. El objetivo principal reutiliza `Objetivo` (ya existente) y el
  comentario reutiliza `Notas_iniciales` (ya existente, mostrado en `ClienteFicha` como
  "Notas del cliente al registrarse") — auditado antes de crear campos, sin duplicar.
- **`Clientes.Estado` no cambia** (sigue siendo `Activo`/`Pausado`/`Perdido`, ver
  DEC-2026-019). "Pendiente de activación" NO es un valor de `Estado` nuevo — ver
  DEC-2026-022.

### Endpoints nuevos
- `GET/POST /api/clientes/[id]/invitacion` (gate entrenador+ownership, mismo patrón que
  el resto de `/api/clientes/[id]/*`): GET devuelve el estado actual sin generar nada
  (para pintar la ficha); POST genera una invitación nueva y sirve tanto para "generar"
  como para "regenerar" — si ya había una activa, la cancela primero (mismo
  comportamiento que `admin/invite`).
- `GET /api/signup/cliente/validate` y `POST /api/signup/cliente/complete` — calco
  exacto de `/api/signup/validate` y `/api/signup/complete` (entrenadores), sobre
  `Invitaciones_cliente` en vez de `Invitaciones`. El email y el cliente a activar se
  resuelven siempre desde el token en el servidor, nunca desde el body.
- `GET/PUT /api/cliente/onboarding` (gate `getClienteActivoAutenticado`, igual que
  `/api/cliente/perfil` y `/api/cliente/notas`): guarda objetivo principal, objetivos
  adicionales, días disponibles y comentario. `completado` se deriva de
  `Boolean(Objetivo)` — sin campo booleano nuevo.
- `GET /api/cliente/perfil` ahora expone `onboardingCompletado` (misma derivación). El
  dashboard del cliente redirige a `/cliente/onboarding` cuando es `false`.
- **Eliminado** `POST /api/clientes/[id]/crear-acceso` (generaba y mostraba una
  contraseña temporal al entrenador) — contradice el brief de esta parte ("no generar
  ni enviar contraseñas iniciales"). Sustituido por el flujo de invitación. Ver
  DEC-2026-023.

### UI nueva
- `/cliente/signup` — calco de `/signup` (email disabled, contraseña+confirmación,
  `supabase.auth.signUp` + `POST complete`), token de `Invitaciones_cliente`. Reutiliza
  la misma página `/signup/confirm` para la confirmación de email (el contenido ya era
  genérico, no mencionaba "entrenador").
- `/cliente/onboarding` — formulario nativo breve (objetivo principal, objetivos
  adicionales, días disponibles, comentario opcional). Se salta automáticamente si ya
  está completado.
- `ClienteFicha.tsx`: el bloque "Crear acceso" se sustituyó por un bloque de invitación
  con badge de estado (Sin invitación / Pendiente de activación / Cuenta activa), link
  copiable y botón generar/regenerar.
- `RegistrarClienteModal.tsx`: tras crear el cliente, genera la invitación automáticamente
  y la muestra como enlace principal a compartir; el enlace de alta por Tally se mantiene
  debajo, sin tocar ese flujo.

### Tally/n8n
No se tocó nada del flujo Tally → n8n → `Reportes` semanal. El check-in in-app de Parte
1.5 tampoco se tocó. `Link_tally_alta` se sigue generando igual en `POST /api/clientes`.

### Diagnóstico del 500 en signup — CORREGIDO (ver sesión de diagnóstico 2026-08-14)
Esta sección decía originalmente que el SMTP de Supabase Auth "no estaba configurado".
**Ese diagnóstico era incorrecto** — ver DEC-2026-025. El SMTP sí está configurado y
funciona correctamente con dominios reales; el `500 Error sending confirmation email`
observado en esta misma sesión ocurría porque las pruebas E2E usaban emails ficticios
`@example.com`, y el proveedor SMTP de pruebas de Supabase rechaza explícitamente ese
dominio (`550 "Invalid \`to\` field. Please use our testing email address instead of
domains like example.com..."`, confirmado en los logs de Auth). Con un email real
(`gmail.com`) el signup de cliente funciona de punta a punta: creación en Supabase Auth,
solicitud de email de confirmación sin error, confirmación, login y onboarding. El
mecanismo es idéntico al de entrenador (`supabase.auth.signUp()`, mismo cliente, mismo
shape) — no hay diferencia de código entre ambos flujos.

### Validación
Prueba E2E con fixtures aislados y desechables (mismo patrón DEC-2026-009): creación de
cliente, generación de invitación, ownership (entrenador ajeno rechazado con 403), token
único de 24h, validación pública, regeneración invalida el token anterior (410) y crea
uno nuevo con 24h propias, registro con email `@example.com` para las partes no
relacionadas con el envío real de correo (invalidación tras un solo uso, manipulación de
token de otro cliente, estados, onboarding), invalidación tras un solo uso (410 en
validate y en complete repetido), manipulación de token de otro cliente no filtra datos
ajenos, cuenta pendiente de activación no puede hacer login hasta confirmar el email,
onboarding no completado tras primer login y completado tras guardar (con objetivos
adicionales/días inválidos filtrados server-side), no reaparece tras completarse, estados
activo/inactivo/reactivado (403 en `perfil` y `onboarding` para `Perdido`, recuperado tras
reactivar sin perder el onboarding ya guardado), e invitación de entrenador
(`/api/admin/invite`) sigue funcionando sin cambios. Durante la prueba se encontró y
corrigió un bug real (no del test): el filtro de Airtable por campo enlazado `Cliente` no
funcionaba — ver DEC-2026-024. `tsc --noEmit`, `eslint` y `next build`, los tres sin
errores. Limpieza confirmada (0 filas de prueba restantes en las 5 tablas tocadas, 0
usuarios Supabase de prueba restantes).

En una sesión de diagnóstico posterior (misma fecha) se repitió el flujo completo con un
email real y controlable (`jumirohu+retaincoach-diag-...@gmail.com`, alias `+tag` de una
bandeja real) contra Supabase real: `signUp()` sin error, usuario creado sin confirmar,
login rechazado antes de confirmar, confirmación válida, login tras confirmar, onboarding
completo — 13/13 comprobaciones OK, confirmado además contra los logs de Auth del
proyecto (`status:200` en `/signup`, sin ningún error de `gomail`/envío). Ver DEC-2026-025.

**No probado con un click real en el email recibido** (sin acceso a la bandeja de
entrada) — se confirmó el email en su lugar generando un segundo link de confirmación
válido vía Admin API para el mismo usuario ya creado por `signUp()`, ejercitando el
endpoint real de verificación de Supabase (`/verify`) tal como lo haría el link del email.
El envío real por SMTP se verificó de forma independiente contra los logs de Auth (sin
error, a diferencia del caso `@example.com`).

**No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta
sesión) — verificado contra la API real, Airtable real y Supabase real.

**Pendiente real:**
- Prueba visual en navegador del flujo completo (invitación → registro → confirmación →
  onboarding → dashboard) con un click real en el email recibido.

---

## RetainCoach Parte 1.5 — rediseño del check-in: tres tipos independientes (2026-08-14)

Rama: `retaincoach-checkin-parte-1.5` (derivada de `main`). **Fusionada a `main` y en
producción (`retaincoach.com`)** — Juanmi promovió un deployment intermedio de esta
rama directamente a producción desde el panel de Vercel (sin pasar por `main`), por
lo que se hizo fast-forward merge de `main` a la punta de la rama (`7a4e929`) para
que ambos queden consistentes y el flujo normal de despliegue (push a `main` → Vercel
despliega) se restablezca. Sin conflictos (fast-forward limpio).

Incluye, además de lo descrito abajo: ajustes de UI tras revisión del preview
(botón "Programar" apilado debajo de la fecha en vez de al lado — se solapaba con la
programación del tipo vecino; dashboard cliente reordenado: Entrenamientos esta
semana → Mis notas → Tus check-ins; eliminada la tarjeta "Próximo check-in semanal
(Tally)" del dashboard cliente) y un botón **"Cambiar contraseña"** en
`/cliente/dashboard` (reutiliza `ChangePasswordModal`, ya usado por
entrenador/admin en `Header.tsx` — el cliente no pasaba por ese componente y no
tenía forma de cambiar su contraseña estando logueado).

Rediseño grande sobre el check-in de Parte 1, pedido explícitamente por Juanmi:
diario/semanal/periódico dejan de compartir lanzamiento y un campo deja de estar
limitado a una única frecuencia. **NO implementa señales, análisis IA, alertas,
acciones, recuperación, captación, referidos ni predicción** — eso sigue diferido
a Parte 2 (ver DEC-2026-006).

### Modelo de datos (aditivo, nada se borró)
- `Campos_checkin.Tipos` (multiSelect, `diario`/`semanal`/`periodico`) reemplaza a
  `Frecuencia` (singleSelect, deprecado pero intacto, usado como fallback de lectura).
  Un campo puede pertenecer a varios tipos a la vez — no hace falta tabla intermedia,
  ver DEC-2026-015.
- Tabla nueva `Checkin_tipos` (`tblsiRHYa7SFro2Th`): programación y lanzamiento
  independiente por `(Entrenador, Tipo)`, creada de forma perezosa. Si un tipo no
  tiene fila propia, hereda `Entrenadores.Checkin_disponible_desde` (legacy) — ver
  DEC-2026-014.
- Catálogo estándar: 9 campos. `dolor` (nuevo, tipo compuesto `{nivel, zona}`)
  sustituye a `dolor_nivel`+`dolor_zona`; `comentario` unifica a `reflexion_semanal`.
  Los tres ids viejos quedan en `CAMPOS_ESTANDAR_DEPRECADOS` solo para resolver
  historial ya existente en `Registros_checkin`, nunca ofrecidos en config/formulario.
  Ver DEC-2026-016.
- `Registros_checkin.Tipo_registro` no cambió — auditado, ya soporta el modelo nuevo
  sin cambios de esquema (ver DEC-2026-015).

### Regla "No he entrenado"
Mecanismo genérico y reutilizable (`CampoCheckinDef.dependeDe`, prop `disabled` en
`CampoInput.tsx`, rechazo real en `POST /api/cliente/checkin`) — pero **no se aplicó
a ningún campo del catálogo actual**: auditado explícitamente que ninguno de los 9
campos estándar depende estructuralmente de haber entrenado. Ver DEC-2026-017.

### Cliente activo/inactivo
`Clientes.Estado='Perdido'` ya representaba "inactivo" — el hueco era que ningún
endpoint lo comprobaba. Nuevo gate `getClienteActivoAutenticado()`
(`src/lib/auth-server.ts`) aplicado en `GET/POST /api/cliente/checkin`, `GET
/api/cliente/perfil` y `GET/PUT /api/cliente/notas` (403 si inactivo). Botón
"Reactivar" en `ClienteFicha.tsx`. `ClientesLista.tsx` ya ocultaba `Perdido` por
defecto con filtro "Inactivos" — no requirió cambios. Ver DEC-2026-019.

### Notas privadas ("Mis notas")
Tabla nueva **en Supabase Postgres** (`notas_privadas`, RLS `auth.uid() = user_id`),
no en Airtable — primera tabla Postgres propia del proyecto. `GET/PUT
/api/cliente/notas` usan `createSupabaseUserClient()` (JWT del propio usuario, no
service role) para que la RLS aplique de verdad. Página `/cliente/notas`. Aislamiento
estructural: ningún flujo de entrenador/Airtable/n8n/IA puede tocar esta tabla. Ver
DEC-2026-018.

### Dashboard cliente
Eliminados de la UI (sin tocar datos): gráfica de peso, "Mensaje de tu entrenador"
(IA) y la métrica de energía de 30 días — todas leían del sistema Tally antiguo sin
distinguirse del check-in nuevo. Nueva sección "Entrenamientos esta semana: X/Y"
(`Y = Clientes.Entrenamientos_objetivo`, objetivo fijo, no varía semana a semana —
limitación documentada, no hay fuente de asignación semanal real; `X` = días con
`entrenamiento_realizado=true` en la semana). "Tu check-in" ahora muestra estado
independiente por tipo. Ver DEC-2026-020.

### UI del entrenador (`/checkin-config`)
Tres bloques "Diario/Semanal/Periódico" con su propio `LanzamientoCheckin` +
`ProgramacionTipo` (día de semana / intervalo o día del mes). Lista única de campos
con checkboxes de tipo múltiple (no un `<select>` exclusivo) — `activo`/`orden` siguen
siendo propiedades globales del campo, no por tipo, a propósito (evita explotar la
complejidad).

### Validación
`tsc --noEmit`, `eslint`, `next build` sin errores. Prueba E2E con fixtures aislados
y desechables (mismo patrón DEC-2026-009) cubriendo: independencia real de los 3
tipos, campo multi-tipo, "No he entrenado" (backend no bloquea nada indebido),
historial intacto tras desactivar un campo, cliente inactivo bloqueado en 4 endpoints
y reactivado sin pérdida, X/Y, notas privadas con RLS verificada contra un token de
otro usuario (no solo ausencia de ruta), y `Reportes`/Tally sin romperse.

**No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta
sesión) — verificado contra la API real, Airtable real y Supabase real.

**Pendiente real para Parte 2:** motor de señales + análisis longitudinal + alertas +
acciones/intervenciones sobre `Registros_checkin` (las notas privadas quedan siempre
fuera de esa cadena, por diseño). Decidir si/cuándo migrar Tally → check-in in-app.

---

## RetainCoach MVP Parte 1 — lanzamiento programable del check-in (2026-08-13)

Nueva capacidad pedida por Juanmi: desde `/checkin-config`, el entrenador puede
controlar **cuándo** su check-in se hace visible para sus clientes, en vez de
que se active automáticamente en cuanto configura campos.

- Nuevo campo `Entrenadores.Checkin_disponible_desde` (DateTime, opcional).
  Vacío = borrador (cliente no ve nada). Fecha pasada/presente = lanzado.
  Fecha futura = programado — se abre solo, sin cron: cada request del
  cliente recalcula `lanzado` comparando esa fecha contra la hora actual
  (`resolverLanzamiento()` en `checkinFields.ts`).
- `PUT /api/entrenador/checkin-config/lanzamiento` (`{ fecha: string | null }`):
  `fecha` ISO pasada/presente = "Lanzar ahora"; futura = "Programar"; `null` =
  "Volver a borrador". Mismo gate de rol-entrenador que el resto de escritura.
- `GET/POST /api/cliente/checkin` respetan el estado: en borrador o programado
  (sin llegar la fecha) devuelven `lanzado:false` y campos vacíos en el GET, y
  el POST responde `403`. Nunca se filtra la config de campos antes de lanzar.
- UI: `LanzamientoCheckin.tsx` (nuevo, dentro de `CheckinConfigView`) — estado
  visual Borrador/Programado/Activo + "Lanzar ahora" + selector de fecha +
  "Volver a borrador". `cliente/checkin` muestra "disponible a partir de..."
  en vez de un formulario vacío cuando no está lanzado.

**Continuidad con uso real:** `jumirohu@gmail.com` ya tenía check-ins reales
enviados por su cliente (mismo email, cuenta multi-rol) antes de este cambio.
Se hizo un backfill puntual de `Checkin_disponible_desde = ahora` en su fila
de `Entrenadores` para que su check-in siguiera visible sin regresión — el
resto de entrenadores (sin uso previo real) arrancan en borrador por defecto.

**Probado con fixtures aislados** (creados y borrados en la sesión): borrador
bloquea GET/POST del cliente (403), programar con fecha futura mantiene
bloqueado, lanzar ahora lo abre de inmediato, una fecha ya pasada se resuelve
como lanzado sin acción manual (confirma el "auto-abrir" sin cron), y "volver
a borrador" limpia el estado y vuelve a bloquear. `tsc`/`eslint`/`next build`
sin errores. No probado visualmente en navegador.

---

## RetainCoach MVP Parte 1 — correcciones de navegación y frecuencia (2026-08-13)

Rama: `retaincoach-checkin-mvp1-fixes` (derivada de `retaincoach-checkin-mvp1`, no mergeada a `main`).

Detectados durante validación manual del deployment por Juanmi. Los dos bugs
compartían la misma causa raíz de fondo: partes del sistema nuevo (check-in
in-app) convivían sin distinguirse claramente de partes del sistema antiguo
(Tally semanal), y el segundo se colaba en la experiencia del primero.

**BUG 1 — sin acceso visible a `/checkin-config`:** el único punto de entrada
era un botón en `Header.tsx` gateado con `!isAdmin`. Un admin usando "Ver como
entrenador" (decisión 45, `isAdmin` se mantiene `true` en ese modo) nunca veía
el botón — y es exactamente el modo en el que Juanmi (multi-rol) prueba la
vista de entrenador. **Fix:** el botón se movió al toolbar de `ClientesLista.tsx`
(junto a "+ Registrar cliente"), que renderiza igual para un entrenador real y
para un admin en "Ver como entrenador" — visible en ambos casos sin lógica
condicional nueva. Se quitó el botón del Header en vez de mantener dos puntos
de entrada.

**BUG 2 — "próximo check-in en ~3 días" tras completar el diario:** revisado
todo el código y confirmado que **no era un bug de cálculo en el sistema
nuevo** — la tarjeta "Próximo check-in" de `/cliente/dashboard` nunca perteneció
al check-in diario/semanal/periódico nuevo; siempre leyó `proximoCheckinDias`
de `GET /api/cliente/perfil`, calculado sobre `Reportes` (el Tally semanal
antiguo, ciclo de 7 días). Al completar el check-in diario nuevo, esa tarjeta
vieja seguía mostrando su propio conteo (basado en cuándo fue el último
`Reporte` de Tally), leyéndose como un mensaje contradictorio. **Fix real**
(no solo cosmético):
- Nueva función pura `calcularProximaDisponibilidad()` en `checkinFields.ts`,
  usada por `GET /api/cliente/checkin`: diario → +1 día desde el inicio de hoy
  si ya se envió; semanal → +7 días desde el inicio de la semana si ya se envió;
  periódico → siempre `null` (sin cadencia fija, nunca "toca esperar"). Nunca
  bloquea el envío (`Registros_checkin` sigue insert-only, ver DEC-2026-007) —
  es puramente informativo.
- `/cliente/dashboard` reemplaza el banner efímero por una sección persistente
  "Tu check-in" con el estado real de cada frecuencia activa (pendiente /
  completado + próxima disponibilidad real).
- La tarjeta antigua se **relabeled** a "Próximo check-in semanal (Tally)" con
  una nota aclaratoria, para no volver a leerse como parte del sistema nuevo.

**Revisión 3 (frecuencia por campo) y Revisión 4 (config no destruye historial)
— verificadas, sin bugs encontrados, sin cambios de código necesarios:** el
diseño ya soportado por `Campos_checkin`/`agruparPorFrecuencia` permite
frecuencia independiente por campo (confirmado con test real: cambiar `peso`
de periódico a semanal no afecta a `energia`/`entrenamiento_realizado`, que
siguen en diario). Desactivar/reactivar/reordenar/cambiar frecuencia de un
campo nunca toca `Registros_checkin` — el historial se mantiene intacto y
`GET /api/checkins` sigue resolviendo el nombre/valor de campos ya
desactivados (usa la lista completa resuelta, no solo los activos). Confirmado
con prueba E2E dedicada, no solo lectura de código. Ver DEC-2026-010 a 012.

**Probado con fixtures aislados y desechables** (mismo patrón que DEC-2026-009,
entrenador/cliente `test-checkin-fixes@example.com` / `...-cliente@example.com`,
creados y borrados en la sesión). Verificado con `tsc --noEmit`, `eslint` y
`next build`, los tres sin errores. **Nota real observada durante la prueba**:
mientras se probaba, se detectó actividad real y concurrente de Juanmi sobre su
cuenta real (`jumirohu@gmail.com`, cliente `reccN567mhDPMes36`) con un envío
diario real en `Registros_checkin` sobre las 18:43 UTC — coincide con el
momento en que probablemente se originó el bug report. No se tocó ese dato
(fuera del alcance de la limpieza de esta sesión, es actividad real, no de
prueba).

**No probado visualmente en navegador** (sin acceso a la extensión de Chrome
en esta sesión) — verificado contra la API real y Airtable real.

---

## RetainCoach MVP Parte 1 — check-in configurable in-app (2026-08-13)

Rama: `retaincoach-checkin-mvp1` (no mergeada a `main` todavía).

**Qué se construyó:** el cliente ahora puede loguearse en RetainCoach y registrar su
seguimiento diario/semanal/periódico él mismo, sin depender del Tally externo. El
entrenador puede activar/desactivar/reordenar campos y añadir campos personalizados
desde `/checkin-config`.

- Modelo de datos nuevo (solo datos crudos, ver DEC-2026-006): `Campos_checkin`
  (config por entrenador: overrides de campos estándar + definiciones de campos
  personalizados) y `Registros_checkin` (EAV insert-only: una fila = un campo de
  un envío, nunca se sobrescribe, hay historial completo).
- Catálogo de 11 campos estándar en código: `src/lib/checkinFields.ts` (mismo
  espíritu que `lib/productos.ts`).
- API nueva: `GET/PUT /api/entrenador/checkin-config`, `POST /api/entrenador/checkin-config/campos`,
  `GET/POST /api/cliente/checkin`, `GET /api/checkins` (vista del entrenador, mismo
  patrón de ownership que `/api/reportes`).
- UI nueva: `/cliente/checkin` (registro rápido), `/checkin-config` (config del
  entrenador), sección "Check-ins recientes (app)" en `ClienteFicha.tsx`, banner
  sección "Tu check-in" en `/cliente/dashboard`, botón "⚙️ Configurar check-in" en
  el toolbar de `ClientesLista.tsx` (movido desde `Header.tsx`, ver corrección
  de navegación más abajo).
- **El flujo Tally → n8n → `Reportes` → análisis IA de los lunes NO se tocó.**
  Convive en paralelo. `ClienteFicha` muestra ambas listas por separado y
  etiquetadas ("Reportes semanales (Tally)" vs "Check-ins recientes (app)").
- **Diferido a Parte 2, a propósito:** tablas/lógica de Señales calculadas,
  Análisis IA, Alertas y Acciones/intervenciones sobre el nuevo modelo. Ver
  DEC-2026-006.

**Probado end-to-end con datos aislados de prueba** (creados y borrados en la misma
sesión, sin tocar clientes/entrenadores reales ni `Reportes` histórico): entrenador
y cliente ficticios (`test-checkin-mvp1@example.com` / `test-checkin-mvp1-cliente@example.com`),
tokens Supabase obtenidos vía `generateLink`/`verifyOtp` (sin contraseña real, mismo
patrón que sesiones anteriores). Verificado: catálogo por defecto (11 campos),
desactivar un campo estándar (con bug encontrado y corregido, ver DEC-2026-008),
crear campo personalizado de tipo selección, el cliente ve el campo personalizado
en su formulario diario, envío diario + periódico, y el entrenador ve ambos envíos
agrupados y con nombres legibles (incluido el campo personalizado) vía
`GET /api/checkins`. Verificado con `tsc --noEmit`, `eslint` y `next build`, los
tres sin errores. Limpieza confirmada en las 4 tablas afectadas (0 filas de prueba
restantes) y usuarios Supabase de prueba borrados.

**No probado visualmente en navegador** (sin acceso a la extensión de Chrome en
esta sesión) — verificado solo contra la API real y Airtable real.

**Siguiente paso — Parte 2:** motor de señales + análisis longitudinal + alertas +
acciones/intervenciones sobre `Registros_checkin`, y decidir si/cuándo consolidar
el flujo Tally hacia el check-in in-app.

---

## Migración en curso — auditoría 2026-08-13

### 1. Arquitectura antigua → actual

Completado el cambio principal de admin fijo → tabla `Admins` y multirol.

Se detectó un hueco durante la auditoría: `POST /api/clientes` aceptaba cualquier usuario autenticado, aunque la capacidad de crear clientes corresponde a un entrenador. Se corrigió en `src/app/api/clientes/route.ts`: ahora exige que el email autenticado exista en `Entrenadores`. Un admin que además sea entrenador también pasa el gate.

Commit: `488ab44448e593506d5bba751601423022a0daba`

### 2. Auditoría n8n ↔ Airtable ↔ Supabase

Workflows principales documentados como activos:
- `Seguimiento - Resumen&Alerta`
- `Seguimiento - Análisis Lunes`
- `Recepción entrenador`
- `Snapshot mensual`
- `Seguimiento - Alta cliente`

`Recordatorios viernes` sigue sin construirse.

Hallazgos confirmados:
- `Seguimiento - Análisis Lunes` ya está activo y tiene la protección contra `ultimoReporteId = null` documentada en `DECISIONS.md`.
- `Seguimiento - Alta cliente` actualiza el cliente existente; no crea duplicados.
- La integración de Airtable de la app tiene `fetchWithRetry()` para 429.
- Supabase Auth es compartido entre roles.

Pendiente de auditoría específica de n8n: comprobar directamente los workflows actuales contra las tablas/campos actuales y detectar referencias obsoletas. La documentación de Claude no debe considerarse prueba suficiente.

### 3. Seguridad / multirol

La revisión de código confirma que los endpoints principales de cliente comprueban autenticación y ownership. El endpoint `POST /api/clientes` fue endurecido durante esta auditoría.

Pendiente: prueba sistemática de autorización con tokens de cada rol contra todas las rutas sensibles, especialmente:
- admin → entrenador → cliente;
- entrenador A → datos de entrenador B;
- cliente → datos de otro cliente;
- usuario autenticado sin rol;
- acceso directo a rutas `/admin/*`.

### 4. Navegador

La mayoría de las sesiones anteriores documentan validaciones API/build pero no validación visual completa.

Pendiente de prueba real en navegador:
- login y redirección por rol;
- dashboard entrenador;
- dashboard cliente;
- selector admin “Ver como entrenador / Ver como cliente”;
- páginas admin;
- Marketplace;
- conflicto 409 de optimistic locking;
- reset de contraseña y confirmación de signup.

### 5. Correcciones

La corrección aplicada en esta auditoría:
- `POST /api/clientes` ahora requiere que el usuario autenticado sea entrenador.

Antes de declarar la migración cerrada, ejecutar typecheck/lint/build y pruebas de navegador después de desplegar.

### 6. Documentación

`DECISIONS.md` contiene el historial técnico compartido.

Este archivo contiene el estado actual que Claude Code debe conocer al iniciar una sesión. Evitar convertirlo de nuevo en un diario enorme de sesiones; registrar el detalle histórico en `DECISIONS.md`.

## Pendientes para cerrar la migración

### Bloqueantes técnicos/manuales
- Configurar Supabase Auth `Site URL` = `https://retaincoach.com`.
- Configurar Redirect URLs para `/signup/confirm` y `/reset-password`.
- ~~Configurar el SMTP de Supabase Auth~~ — **descartado como bloqueante** (sesión de
  diagnóstico 2026-08-14, ver DEC-2026-025): el SMTP sí está configurado y funciona con
  emails reales; el 500 observado antes era el rechazo de Supabase al dominio de pruebas
  `@example.com`, no un fallo de configuración. Sigue pendiente probar con un click real
  en el email recibido (no solo confirmación simulada vía Admin API).
- Completar validación real del flujo de reset/signup desde producción.
- Rellenar `NEXT_PUBLIC_JUANMI_WHATSAPP` en Vercel si Marketplace debe funcionar.
- Añadir manualmente `Metricas` como opción del multi-select `Entrenadores.Soluciones` si se quiere poder asignar ese producto.
- ~~Crear y conectar el formulario Tally de `Recepción entrenador`~~ — **descartado**
  (Parte 1.5.3, ver DEC-2026-029): Tally se retiró por completo, ese workflow se
  eliminó de n8n. El alta de entrenadores sigue haciéndose vía `/api/admin/invite`.

### Validación
- Auditoría completa n8n ↔ Airtable ↔ Supabase.
- Auditoría sistemática de autorización multirol.
- Pruebas reales de navegador.
- Typecheck + lint + build final.

### Producto / negocio
- Privacidad y política.
- DPA/onboarding para procesamiento con IA.
- Pre-venta con 3 entrenadores reales.
- Límite de gasto de Claude API.

## Regla de cierre

No declarar “migración cerrada” hasta completar los bloques 1–4 de la auditoría, corregir los hallazgos, ejecutar las pruebas finales y actualizar `CLAUDE.md` + `DECISIONS.md`.
