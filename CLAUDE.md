# CLAUDE.md — RetainCoach

> Contexto para Claude Code. Léelo al empezar cada sesión para ahorrar tokens y no repetir decisiones ya tomadas.
> Última actualización: 10 ago 2026 · Commit actual: `385e9e4` (origin/main)

---

## QUÉ ES

RetainCoach es un SaaS para entrenadores personales y nutricionistas online. Ayuda al entrenador a retener clientes: check-ins semanales de sus clientes → análisis con IA → alertas cuando hay riesgo de abandono. El primer producto ("Seguimiento") funciona en modo Alerta: no manda resúmenes de todos los clientes, solo avisa cuando hay riesgo real.

**Dueño/PM:** Juanmi (rol NO técnico, estratégico). Define briefs, decide producto, delega toda la implementación a Claude Code.

---

## STACK

| Capa | Herramienta |
|---|---|
| Frontend/hosting | Next.js en Vercel |
| Auth | Supabase Auth (**client-side, localStorage — NO session cookies**) |
| Base de datos | Airtable (backend; los entrenadores NO acceden a Airtable) |
| Email | Resend |
| Automatización | n8n self-hosted (InstaPods) |
| IA | Claude API (claude-sonnet-4-5) |
| Mensajería | wa.me links pre-rellenados (NO WhatsApp Business API) |
| Formularios | Tally.so |

---

## IDs Y URLS

```
App (prod):        https://retaincoach.vercel.app
Vercel project:    prj_P1t1cHVqW8EL6Tr5tMvjxRlHzO0d
Vercel team:       team_Oq8Fzs3KUNMfzHNnbFPPM9uJ

Supabase project:  jcijxhxdjabxdujldzml
Supabase URL base: https://jcijxhxdjabxdujldzml.supabase.co
Supabase dash:     https://supabase.com/dashboard/project/jcijxhxdjabxdujldzml

Airtable base:     appZ7NZWDl6haw8pK
  Tabla Entrenadores: tblo7dLrfaOxcPppY
  Tabla Clientes:     tblcpRBZbtViJzQVQ
  Tabla Reportes:     tbljT33LCBLT6NoKf
  Tabla Archivo:      tblgwKrbv6kRYqrAt
  Tabla Snapshots:              tbliaBxJa4GIYoHId
  Tabla Snapshots_entrenadores: tblEaBtZvUXyzPk8y

n8n base:          https://jolly-wolf-51.fr-1.instapods.app
  Proyecto:        .../projects/Rs4A1MS5F5SJkqLz/workflows
  Workflow Recepción entrenador: D3Jnswx0Hh5THEev

Tally form:        tally.so/r/5BYDQM
```

---

## DECISIONES DE ARQUITECTURA (NO re-litigar)

1. **Sin signup público.** Alta solo por invitación: admin genera token de 24h en `/admin`. El token incluye el email pre-rellenado.
2. **Ruta de registro real: `/signup?token=XXX&email=YYY`** (NO `/register`). El email llega pre-rellenado y read-only. Ya existe y funciona — no tocar salvo que se pida.
3. **Onboarding manual.** Juanmi añade entrenadores a Airtable a mano (no vía Tally). Más personalizado para los primeros clientes.
4. **Aprobación manual.** El workflow n8n "Recepción entrenador" solo crea un lead en Airtable (estado Prueba). NO crea usuario Supabase ni envía email automáticamente. El admin revisa, aprueba y entonces se crea la cuenta + invitación.
5. **Auth es 100% client-side** (localStorage, sin cookie de sesión). Por eso **NO hay `middleware.ts`** de Next.js — un middleware corre en servidor y no puede leer localStorage. La protección de rutas se hace client-side en cada página (incluido el gate de `/dashboard`), igual que el resto de páginas protegidas.
6. **Flujo post-login:** con plan base → `/dashboard`; sin plan base → `/planes` (página de presentación + CTA WhatsApp).
7. **"Metricas" es upsell condicional.** Requiere al menos un plan base (Seguimiento / Captación / Recuperación). En `/admin` el selector bloquea "Metricas" sin plan base (con tooltip explicativo) y la **desactiva automáticamente si le quitas el último plan base** — es decir, no puede quedar "Metricas" sola. Esta es la variante que el brief marcaba como "mejor UX" (frente a solo mostrar un error), y es la que está implementada.
8. **Dashboard = pestañas fijas.** Clientes + Marketplace siempre visibles (NO condicional if/else por plan). El badge "En uso" en la tarjeta del plan indica cuáles están activos. NO existe estructura `if (soluciones.includes('X')) <Page/>`.
9. **Los entrenadores solo acceden a la app Vercel**, nunca a Airtable. La Interface de Airtable (si existe) es herramienta interna de Juanmi.
10. **wa.me, no WhatsApp Business API.** El entrenador manda desde su propio WhatsApp.
11. **Ortografía: "Metricas" SIN tilde** en todo el código (así está en Airtable). No "Métricas".
12. **Captación y Recuperación** están en backlog, sin funcionalidad real todavía. NO construir tabs/páginas vacías para ellos.
13. **Estado del entrenador/cliente:** Activo / Pausado / Perdido (+ Prueba para leads).
14. **Riesgo de concurrencia de datos:** editar Airtable a mano mientras la app escribe vía API puede sobrescribir. Por ahora se asume que los cambios son esporádicos. Evaluar `last_modified` + validación optimista cuando haya varios usuarios escribiendo a la vez.

---

## ESTRUCTURA AIRTABLE (campos clave)

**Entrenadores** (`tblo7dLrfaOxcPppY`): Nombre, Email, Teléfono, Objetivo, Estado (Activo/Pausado/Perdido/Prueba), `Soluciones` (multiselect: Seguimiento/Captación/Metricas/Recuperación), `ia_consent_accepted` (boolean), Link_recordatorio (fórmula), campo fuente (`fldzHRb3fzV3vmQTQ` = "Vía formulario" cuando viene de Tally).

**Clientes** (`tblcpRBZbtViJzQVQ`): Nombre, Email, Teléfono (+34…), Entrenador, Objetivo (Hipertrofia/Pérdida de peso/Tonificar/Rehabilitación), Estado, Entrenamientos_objetivo, Reportes (link), Link_recordatorio (fórmula wa.me).

**Reportes** (`tbljT33LCBLT6NoKf`): Fecha (campo principal, zona Madrid), Cliente (link), Peso, Entrenamientos, Energía (Cansado/Normal/Con energía), Notas, Análisis IA (lo rellena Claude), Mensaje sugerido (lo rellena Claude), Cliente_Email (lookup), Link_alerta (fórmula wa.me).

**Archivo** (`tblgwKrbv6kRYqrAt`): backup de reportes > 60 días.

**Snapshots** (`tbliaBxJa4GIYoHId`) y **Snapshots_entrenadores** (`tblEaBtZvUXyzPk8y`): histórico mensual para métricas.

---

## WORKFLOWS n8n

- **Recepción entrenador** (`D3Jnswx0Hh5THEev`): Tally webhook → formatear → buscar en Airtable → ¿ya registrado? → crea lead en Airtable. **NO** crea user Supabase ni email todavía (decisión: aprobación manual). Email desde el workflow: pendiente de validar.
- **Seguimiento - Análisis lunes** ✅: lunes 9am → clientes activos → reportes → calcula señales duras (n8n) → Claude interpreta señales blandas → filtra alertas reales → guarda Análisis IA + Mensaje sugerido. **Importante:** el nodo "Guardar alerta" solo debe actualizar 2 campos (Análisis IA, Mensaje sugerido); si incluye otros, Airtable los sobrescribe con ceros.
- **Limpieza - Datos antiguos** ✅ (INACTIVO): día 1 mensual → reportes > 60 días → backup a Archivo → borrar.
- **Snapshot mensual** (INACTIVO): probar manualmente antes de activar.

**Lógica de señales (Seguimiento):** n8n calcula las duras (no respondió >8 días, semanas seguidas "Cansado", entrenamientos en caída, peso-contra-objetivo SOLO para "Pérdida de peso"). Claude interpreta las blandas leyendo notas (dolor recurrente, desmotivación, respuestas cada vez más cortas). Claude tiene instrucción explícita de ignorar el peso como señal salvo en "Pérdida de peso".

---

## ESTADO ACTUAL (10 ago 2026)

**~90-95% listo.** Frontend compila (tsc/eslint/next build OK).

Implementado y validado en navegador: BUG A (cambio contraseña self-service, `ChangePasswordModal.tsx`, botón 🔑 en Header), BUG D (selector Soluciones incluye Metricas), BUG E (borrar entrenador + endpoint DELETE que limpia Airtable + Supabase).

Implementado, **falta validar en navegador** (compila pero NO probado en vivo esta sesión): BUG C (modal consentimiento IA, commit `97fa2d1`) — `POST /api/entrenador/consentimiento-ia` añade "Seguimiento" a `Soluciones` sin duplicar; la tarjeta pasa a "En uso" sin recarga. Landing pública `/`, página `/planes`, gate client-side en `/dashboard`, validación de Metricas en `/admin` (commit `385e9e4`). **Todo esto último quedó sin probar en navegador igual que BUG C** — solo se confirmó que pasa tsc/eslint/next build.

**No implementado a propósito:** crear user Supabase desde n8n (endpoint inexistente + contradecía "no signup público"); BUG B reset-password (no era bug, Supabase ya lo maneja).

---

## PENDIENTES

**Validación en navegador (solo Juanmi):**
- Flujo completo: `/` → Login → sin plan → `/planes` → activar Seguimiento desde 🏪 (Marketplace → modal consentimiento → "Activar" → badge "En uso" → Airtable `Soluciones` incluye "Seguimiento") → `/dashboard` accesible.
- Email desde workflow n8n "Recepción entrenador".

**Producto (próximas sesiones):**
- Reestructuración admin en 3 páginas: `/dashboard` (solo resumen negocio), `/admin` (entrenadores + alertas + links), `/metricas` (histórico + gráficas + impacto). Header dropdown de navegación (Resumen/Gestión/Métricas, visible solo admin).
- Endpoint `GET /api/admin/alertas-stats` (total_alertas_historico, alertas_por_mes, alertas_por_entrenador).
- Probar Snapshot mensual manualmente antes de activar.
- (Post-primer-cliente) Trainer dashboard en 3 páginas: `/trainer-dashboard`, `/trainer/clientes`, `/trainer/marketplace`. Vista simple, sin gráficas (las gráficas son upsell).

**Compliance (antes de vender):**
- Política de privacidad (Termly/Iubenda, ~$15/mes) — mencionar uso de IA (Claude).
- Cláusula de onboarding: el entrenador es responsable de informar a sus clientes de que datos de salud se procesan vía IA.
- Verificar DPAs: Airtable, Resend, Anthropic.
- Límite de gasto mensual en Anthropic API (console.anthropic.com → Billing → ~$10-15/mes).

---

## CÓMO TRABAJA JUANMI

- El control viene del **brief inicial** y del **checklist de cierre**, no de revisar pasos intermedios. Juanmi acepta los pasos de Claude Code sin revisarlos uno a uno.
- Si algo del brief contradice una decisión de este archivo o es técnicamente inviable, **no lo implementes a ciegas**: corrige y explica por qué (como se hizo con "crear user Supabase desde n8n" y con el `if (soluciones.includes...)` inexistente).
- Al cerrar sesión, entrega un resumen claro: qué se hizo, qué no y por qué, commit, y qué falta validar en navegador.

---

## BACKLOG (NO construir aún)

Referidos · Captación (quiz Tally + propuesta PDF + 1 mensaje auto Instagram) · Recuperación (reutiliza motor de Seguimiento para Estado=Perdido) · Rutinas inteligentes (IA sugiere, entrenador siempre aprueba — riesgo legal).
