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
Stack: Next.js 16 App Router + TypeScript + Tailwind; Supabase Auth; Vercel API Routes; Airtable; n8n self-hosted; Claude API; Tally; Resend.

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
- `Campos_checkin` (`tblY8lFGaO2iA29Zf`) + `Registros_checkin` (`tbl7usdXJYJA83lsm`): modelo de check-in in-app del cliente (MVP Parte 1). Ver sección dedicada más abajo y `DECISIONS.md` DEC-2026-006 a 009.

Auth/API:
- Las API routes deben verificar el JWT de Supabase.
- Los endpoints de admin usan `getAuthenticatedAdminEmail()`.
- Los endpoints que modifican datos de un entrenador/cliente deben comprobar ownership/rol explícitamente.
- Los secretos nunca deben estar en frontend, Git o nodos de n8n.

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
- Configurar SMTP de Supabase con Resend si se quiere usar Resend para Auth.
- Completar validación real del flujo de reset/signup desde producción.
- Rellenar `NEXT_PUBLIC_JUANMI_WHATSAPP` en Vercel si Marketplace debe funcionar.
- Añadir manualmente `Metricas` como opción del multi-select `Entrenadores.Soluciones` si se quiere poder asignar ese producto.
- Crear y conectar el formulario Tally de `Recepción entrenador` si todavía no se ha hecho.

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
