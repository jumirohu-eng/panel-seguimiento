# 🚀 CLAUDE.md — Dashboard Seguimiento para Entrenadores

## ESTADO ACTUAL (11 ago 2026 — noche, sesión 4)

Commit: `9931c13`

🚨 **BLOCKER URGENTE ABIERTO — requiere acción manual de Juanmi en el Dashboard de Supabase, Claude Code no tiene forma de hacerlo** — link de reset de contraseña apuntando a localhost:

**TL;DR para arreglarlo ya:** entra a `https://supabase.com/dashboard/project/jcijxhxdjabxdujldzml/auth/url-configuration`, pon **Site URL** = `https://retaincoach.com`, y en **Redirect URLs** añade `https://retaincoach.com/reset-password` y `https://retaincoach.com/signup/confirm` (NO `/auth/callback`, ver por qué abajo). Guarda. Prueba desde `retaincoach.com/login` → "¿Olvidaste tu contraseña?". Si me pides que verifique después, puedo revisar los logs de Auth para confirmar que ya no cae a localhost.

**Verificado contra la documentación oficial de Supabase en esta sesión** (`search_docs`): el template "Reset Password" por defecto usa `<a href="{{ .ConfirmationURL }}">Reset password</a>` — **no** `{{ .SiteURL }}` directamente en el href como sugería el brief. Si el template en el Dashboard ya muestra `{{ .ConfirmationURL }}`, está bien tal cual, no lo toques; solo habría que corregirlo si alguien lo editó a mano con una URL literal (localhost o cualquier otra) en vez de esa variable.

**Diagnóstico (con evidencia real, no solo teoría):**
- El código de `handleResetPassword` en `login/page.tsx` llama a `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/reset-password\` })` — **no hay ninguna URL hardcodeada a localhost en el código**, `redirectTo` se calcula dinámicamente a partir de dónde se está ejecutando la app.
- Se revisaron los logs reales de Supabase Auth (`get_logs` service=`auth`) de esta misma semana: se encontró una petición real `POST /recover` (esto es lo que dispara `resetPasswordForEmail`) con `"referer":"http://localhost:3000"`, seguida de dos peticiones `GET /verify` (una falló con "Email link is invalid or has expired", la siguiente sí completó con `status:303` y generó un evento `Login` real para `jumirohu@gmail.com`). **Conclusión: el link apuntó a localhost porque quien probó el flujo lo hizo con la app corriendo en local (`npm run dev` → `localhost:3000`) y no contra `https://retaincoach.com`** — el comportamiento del código es correcto (dinámico), simplemente no se había probado nunca desde producción
- **Corrección importante al brief**: no existe ninguna ruta `/auth/callback` en esta app (verificado listando `src/app`) — el callback real de recuperación de contraseña es `/reset-password` (maneja el evento `PASSWORD_RECOVERY` de Supabase) y el de confirmación de alta es `/signup/confirm`. Añadir `/auth/callback` a los Redirect URLs de Supabase no arreglaría nada porque esa página no existe; hay que usar las rutas reales
- **Corrección importante 2**: estos emails de "¿Olvidaste tu contraseña?" **no pasan por Resend** — es el flujo nativo de Supabase Auth (mailer + templates propios de Supabase), distinto del template Resend "Reset Contraseña" documentado en RESEND TEMPLATES (ese hoy no se usa desde ningún flujo real, ver esa sección). Y como el pendiente "Configurar SMTP en Supabase (Resend)" sigue sin hacerse, estos emails hoy salen del mailer por defecto de Supabase, no de Resend

**Por qué queda como pendiente manual (no lo pude terminar):** ninguna de las herramientas MCP disponibles en esta sesión (Airtable, n8n, Resend, ni las de Supabase — `execute_sql`, `get_logs`, `get_project`, etc.) da acceso a la configuración de Auth de Supabase (`Site URL`, `Redirect URLs`, `Email Templates`, SMTP) — eso vive solo en el Dashboard de Supabase o en la Management API con un token de acceso personal, ninguno disponible aquí. Es el mismo tipo de bloqueo ya documentado para el pendiente de `/signup/confirm` (ver abajo, ahora fusionado con este). Tampoco tengo acceso a la bandeja de `jumirohu@gmail.com` para poder clicar el link real y validar el paso 7 (prueba end-to-end) yo mismo.

**Lo que hay que hacer manualmente en el Dashboard de Supabase (`https://supabase.com/dashboard/project/jcijxhxdjabxdujldzml`), con los valores correctos para ESTE repo:**
1. Auth → URL Configuration → **Site URL** → `https://retaincoach.com`
2. Auth → URL Configuration → **Redirect URLs** → añadir `https://retaincoach.com/reset-password` y `https://retaincoach.com/signup/confirm` (mantener también `http://localhost:3000/**` si se quiere poder seguir probando en local — no hace falta `/auth/callback`, esa ruta no existe en la app)
3. Auth → Email Templates → plantilla "Reset Password" → confirmar que usa `{{ .ConfirmationURL }}` (variable estándar de Supabase, no un dominio hardcodeado) — si alguien la editó a mano con una URL literal a localhost, corregirla ahí también
4. Una vez cambiado: probar de verdad desde `https://retaincoach.com/login` → "¿Olvidaste tu contraseña?" → abrir el email → confirmar que el link apunta a `retaincoach.com/reset-password` y no a localhost. Puedo volver a revisar los logs de Auth después de esa prueba para confirmar en los datos (`referer`/`redirect_to`) que ya no aparece localhost, si se hace la prueba y se me pide verificar

✅ COMPLETADO (sesión anterior):
- **Chequeo de drift CLAUDE.md vs n8n**: comparadas las 7 entradas de la sección N8N WORKFLOWS contra el estado real de la instancia (vía `n8n_list_workflows`). **Sin drift** — las 5 activas, la 1 inactiva ("Limpieza de datos antiguos") y la no construida ("Recordatorios viernes") coinciden exactamente con la documentación (tiene sentido: en la sesión anterior se corrigieron las únicas 2 discrepancias reales que había y se actualizó la doc a la vez)
- **Limpieza de la tabla `Clientes` en Airtable**: borrados 6 registros de prueba/basura (ver PENDIENTES INMEDIATOS para el detalle exacto de cuáles). Se mantuvieron los 3 clientes documentados como fixtures intencionales (Juanmi, Carlos, Sofia) — no se tocaron por estar explícitamente listados como "de verdad" en este mismo archivo, ligados a logins reales de Supabase. Sin cambios de código en el repo (tarea puramente de datos en Airtable)

✅ COMPLETADO (sesión anterior — brief "Próximo sprint: email + check-in" + bug de tooltip):

**Nota:** el archivo del brief (`/mnt/user-data/outputs/brief-proximo-sprint-email-checkin.md`) no existía en este entorno (esa ruta no existe aquí) — se trabajó a partir de la descripción de las 2 tareas + el bug que el usuario pegó directamente en el mensaje, que era suficientemente detallada.

- **Tarea 1 (email "Recepción entrenador")**: la credencial Resend en n8n (`HKcpklE9LbcDgder`) **no era realmente un placeholder** — alguien ya había pegado una API key real (`re_XiMgBdxx...`, key "seguimiento" en Resend) pero **directamente en el header del nodo HTTP Request, no en la credencial** (que sí seguía sin valor real, y además duplicaba el header `Authorization`). Corregido: la key real se movió a la credencial (con `name: "Authorization"` + `value: "Bearer ..."` — la credencial `httpHeaderAuth` necesita AMBOS campos, ver decisión 35) y se quitó el header hardcodeado de los dos nodos de email, que ahora dependen solo de la credencial. Además se creó y publicó un nuevo template de Resend **"Cuenta existente"** (`cuenta-existente`, HTML con el mismo estilo/marca que "Bienvenida Entrenador") y el nodo "Email ya registrado" se migró de HTML inline a este template — ya no queda ningún email de este workflow con HTML embebido en el nodo. Probado end-to-end con las dos ramas reales (email nuevo → `espartakofake@gmail.com`, ya existía en Airtable; email nuevo de verdad → `jumirohu+testn8n@gmail.com`), ambos envíos confirmados con `id` de Resend devuelto (no solo "no dio error" — se verificó la respuesta real de la API). Ver N8N WORKFLOWS y decisiones técnicas 35-36
- **Tarea 2 (validación check-in semanal completa)**: creado un cliente de prueba dedicado ("Test Checkin Sprint", `test-checkin-sprint@example.com`, Objetivo="Pérdida de peso", entrenador `espartakofake@gmail.com`) y simulados 4 check-ins reales vía el webhook de "Seguimiento - Resumen&Alerta" con una tendencia de deterioro clara (peso subiendo, entrenamientos 4→1, energía cayendo a "Cansado", notas cada vez más desmotivadas). Ejecutado el workflow real "Seguimiento - Análisis Lunes" (ver más abajo, tenía dos problemas serios encontrados y corregidos en esta sesión) — el reporte más reciente del cliente de prueba quedó con `Análisis IA` y `Mensaje sugerido` poblados y `Estado semanal = ⚠️ Alerta`, confirmado directamente en Airtable (que es exactamente lo que consume la lógica de `estadoReporte.ts` para mostrar la alerta en `/dashboard`). **No verificado visualmente en el navegador** (sin acceso a la extensión de Chrome en esta sesión) — el cliente de prueba se dejó deliberadamente en Airtable (no se borró) para que el usuario pueda comprobar en 30 segundos que aparece con alerta en `/dashboard` (login como `espartakofake@gmail.com` → ficha "Test Checkin Sprint"). Ver decisión técnica 37
- **BUG ENCONTRADO (grave) en "Seguimiento - Análisis Lunes"**: el workflow **nunca había estado activo** (`active: false`, `activeVersionId: null` — nunca publicado) pese a que CLAUDE.md lo daba por bueno ("✅ ver n8n"). Es decir, el análisis semanal real de clientes **nunca se había ejecutado automáticamente en producción** — todas las alertas existentes en Airtable venían de ejecuciones manuales de sesiones anteriores. **Activado de forma permanente en esta sesión** tras validarlo end-to-end. Ver N8N WORKFLOWS
- **BUG ENCONTRADO Y CORREGIDO en "Seguimiento - Análisis Lunes"**: cuando un cliente activo no tiene ningún reporte todavía (recién dado de alta, sin check-ins), `ultimoReporteId` sale `null` desde "Calcular señales"; el prompt de Claude lo interpola como el string literal `"null"` y lo devuelve así en su JSON; el nodo "Guardar alerta" intenta entonces un `update` de Airtable con `id: "null"`, que Airtable rechaza con 422 — y como Airtable procesa el batch update de forma atómica, **ese único cliente sin reportes tumbaba el guardado de alertas de TODOS los clientes de esa semana**, no solo el suyo. Corregido añadiendo 2 condiciones al filtro "Solo alertas reales" (`ultimoReporteId` no vacío y no igual al string `"null"`), verificado con datos reales (2 clientes de prueba sin reportes se excluyeron correctamente, los otros 3 con alerta real sí se guardaron). Ver decisión técnica 37
- **BUG A (tooltip de alertas desbordado)**: el `Tooltip.tsx` genérico usaba `position: absolute` dentro de un ancestro con `overflow-hidden` (el contenedor de la lista de clientes en `ClientesLista.tsx`), así que se recortaba visualmente. Reescrito para renderizar vía `createPortal` a `document.body` con `position: fixed`, calculando la posición real con `getBoundingClientRect()` en dos pasadas (mide oculto, luego posiciona visible): decide automáticamente arriba/abajo según el espacio disponible, y clampa horizontalmente para no salirse del viewport. Se recoloca también en scroll/resize mientras está abierto. Como `StatusBadge.tsx` reutiliza el mismo componente, el fix aplica a ambos usos sin tocarlos. Ver decisión técnica 38
- Verificado con `tsc --noEmit`, `eslint` y `next build`, los tres sin errores. Cambios de n8n/Airtable/Resend verificados directamente contra las APIs reales (no solo localmente) — ver detalle en cada tarea arriba

✅ COMPLETADO (brief "Tareas Inmediatas" de sesión anterior):
- **Tarea 1 (verificación)**: las 5 piezas de la reestructuración admin ya existían y funcionan (`/dashboard`, `/admin`, `/metricas`, `GET /api/admin/alertas-stats`, `AdminNavDropdown`) — no se tocó nada
- **Tarea 5**: filtro de `ClientesLista` ahora tiene 4 opciones en orden Alertas/Activos/Inactivos/Todos (antes solo Activos/Inactivos/Todos), default sigue siendo Activos. "Alertas" = `tieneAlerta`
- **Tarea 4**: tooltip real (no `title` nativo) sobre el icono ⚠️ de la lista de clientes, con resumen de hasta 100 caracteres de `Análisis IA` del último reporte con alerta (fallback a `Mensaje sugerido` si el análisis viniera vacío). Nuevo campo `alertaResumen` en `Cliente` y helper `truncateResumen()` en `lib/format.ts`
- **Tarea 3**: el link de Tally de alta ahora se genera **server-side** en `POST /api/clientes` (antes se generaba en el cliente, en `RegistrarClienteModal`) y se guarda en el nuevo campo Airtable `Link_tally_alta`. Se muestra en `ClienteFicha` con botón "Copiar", así el entrenador puede reenviarlo sin pasar por el modal de alta. Verificado en n8n que "Seguimiento - Alta cliente" → nodo "Actualizar cliente" hace un `update` directo (sobrescribe, nunca acumula) — sin cambios necesarios en el workflow
- **Tarea 6**: nueva sección "Métricas de entrenadores" en `/metricas` (total histórico, evolución mensual Total/Activos/Prueba, desglose por Estado, entrenadores por plan) — sin tocar las métricas de clientes que ya existían. Nuevo tipo `MetricasEntrenadores`, ampliado `/api/admin/metricas-negocio`
- **Tarea 2**: optimistic locking en `PATCH /api/clientes/[id]` y `PUT /api/admin/entrenadores/[email]`. Ver decisión técnica 31 (por qué no es un campo "Last modified time" nativo) y 32 (patrón de conflicto)
- Verificado con `tsc --noEmit`, `eslint` y `next build`, los tres sin errores. **No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta sesión, igual que en sesiones anteriores)

✅ COMPLETADO (sesión anterior):
- Feature 3: Registro de clientes con Tally pre-rellenado (modal + link + Airtable + webhook)
- Feature 1: Mensaje sugerido como dropdown
- Feature 2: Notas del entrenador en ficha cliente
- Feature 4: Botón "Dar de baja" → Estado=Perdido
- Feature 5: Filtro Activos/Inactivos (ver Tarea 5 arriba, ampliado en esta sesión)
- Cambios /planes: puramente informativa + CTA WhatsApp
- Sección "Tus planes" en /dashboard
- Workflow "Snapshot mensual" activado (verificado vía API n8n: `active: true`)
- **Bug fix workflow n8n "Seguimiento - Alta cliente"**: el nodo "Formatear datos" no extraía `objetivo`/`entrenamientos_objetivo`/`notas_iniciales` porque Tally envía el texto literal de la pregunta como `label`, no un slug (y `objetivo` es tipo `DROPDOWN`, no `MULTIPLE_CHOICE`). Corregido con mapeo de labels + resolución genérica de campos tipo choice, y probado end-to-end con datos reales (ejecuciones n8n 54/55/56, sin campos nulos). Ver N8N WORKFLOWS y decisión técnica 30
- Verificado que "Recepción entrenador" está realmente **ACTIVO** en n8n (ya no era solo drift de documentación) — con la credencial Resend aún en placeholder, cualquier submission real fallaría al enviar el email

✅ PENDIENTES MANUALES (completados):
- Crear Tally ODq4kK (verificado: ejecuciones reales del webhook con `formId: "ODq4kK"`, `formName: "Alta de cliente"`)
- Conectar webhook n8n (verificado: workflow "Seguimiento - Alta cliente" activo, procesando submissions reales end-to-end)
- Rellenar `NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL` (`https://tally.so/r/ODq4kK`) en `.env.local` y en Vercel (confirmado por el usuario que ya está puesta en Vercel)

---

## CONTEXTO DEL NEGOCIO

**Negocio:** Automatizaciones con IA para entrenadores personales / nutricionistas online.
**Producto:** Sistema de seguimiento semanal de clientes (check-in + análisis IA + alertas).
**Modelo:** Empezar con soluciones individuales, validar, después unificar en SaaS.
**Precio objetivo:** $99-149/mes por Seguimiento.

---

## STACK TÉCNICO ACTUAL
Frontend: Next.js 16.3.0 (App Router, TypeScript, Tailwind v4)
Auth: Supabase Auth (nativo, sin JWT casero)
Backend: Vercel API Routes (Next.js)
Datos: Airtable (base appZ7NZWDl6haw8pK)
Hosting: Vercel (plan Hobby)
Gráficas: Recharts (solo en ficha de entrenador `/admin/entrenador/[email]`, sparkline de clientes activos)
IA: Claude API (claude-sonnet-4-5)
Formularios: Tally.so (tally.so/r/5BYDQM)
Automatización: n8n self-hosted (InstaPods)
Repo: github.com/jumirohu-eng/panel-seguimiento


---

## IDs Y CREDENCIALES

### Airtable
Base ID: appZ7NZWDl6haw8pK
Tabla Clientes: tblcpRBZbtViJzQVQ
Tabla Reportes: tbljT33LCBLT6NoKf
Tabla Archivo (backup): tblgwKrbv6kRYqrAt
Tabla Invitaciones: tblzr50mLzLgnIsVg
Tabla Entrenadores: tblo7dLrfaOxcPppY
Tabla Snapshots: tbliaBxJa4GIYoHId
Tabla Snapshots_entrenadores: tblEaBtZvUXyzPk8y
Token: [en Vercel env vars, NO en repo]


### Supabase
URL: https://jcijxhxdjabxdujldzml.supabase.co
Keys: [en .env.local + Vercel env vars]
Estructura Auth: Tabla auth.users (nativa de Supabase)
Tabla profiles (opcional): Para datos de usuario adicionales


### Vercel
Proyecto: dashboard-seguimiento
URL: https://dashboard-seguimiento-two.vercel.app
Environment Variables: [configuradas en Vercel UI]
- ADMIN_EMAIL (server-side, ya existía) → usado por API routes para autorizar /api/admin/*
- NEXT_PUBLIC_ADMIN_EMAIL (NEW) → mismo valor, expuesto al frontend para mostrar el botón "Admin" en el Header. Añadir en Vercel si no está.
- NEXT_PUBLIC_JUANMI_WHATSAPP (NEW) → número de WhatsApp de Juanmi en formato internacional, solo dígitos (ej. 34600000000), usado por el botón "Activar ahora" del Marketplace. **Pendiente: añadir el valor real en Vercel** (en `.env.local` está vacío, ver PENDIENTES INMEDIATOS).
Framework: Next.js (detectado automáticamente)


### Clientes de prueba en Airtable
Juanmi:

Email: jumirohu@gmail.com
Entrenador: espartakofake@gmail.com
Estado: Activo
Objetivo: Hipertrofia
ID: reccN567mhDPMes36
Carlos:

Entrenador: maria@example.com
ID: recEvMum2OlV7Wchv
Sofia:

Entrenador: maria@example.com
ID: recmIIxHLVhql0yvJ

### Usuarios Supabase creados
espartakofake@gmail.com → ve a Juanmi
maria@example.com → ve a Carlos y Sofia
jumirohu@gmail.com → admin del dashboard


---

## ESTRUCTURA DE AIRTABLE

### Tabla "Clientes" (tblcpRBZbtViJzQVQ)
| Campo | Tipo | Notas |
|-------|------|-------|
| Nombre | Texto (PRIMARY) | Cliente |
| Email | Texto | Del cliente |
| Teléfono | Texto | +34... formato. Consumido por la app solo indirectamente vía `Link_recordatorio` (no se reconstruye el link a mano en el código) |
| Entrenador | Texto | **EMAIL del entrenador** (no nombre, no Colaborador) — fuente de verdad para resolver el entrenador de un cliente. Los registros de prueba deben usar el email exacto, no el nombre (se detectó y corrigió un caso real: Carlos/Sofia tenían "María" en vez de "maria@example.com") |
| Objetivo | Select | Hipertrofia / Pérdida de peso / Tonificar / Rehabilitación |
| Estado | Select | Activo / Pausado / Perdido |
| Entrenamientos_objetivo | Número | Cuántos/semana planificados |
| Reportes | Link | Auto a tabla Reportes |
| Link_recordatorio | Fórmula | Link de WhatsApp (wa.me) con mensaje de recordatorio semanal precargado. Distinto de `Reportes.Link_alerta` (ese usa el Mensaje sugerido). Usado como fallback del botón WhatsApp en la ficha de cliente (`/dashboard`) cuando el último reporte no tiene alerta activa — no reconstruir el link a mano en el código |
| Entrenador_nuevo | Colaborador único | **Vestigial, no usar.** Casi nunca está poblado en datos reales (solo 1 de 4 clientes de prueba). No es fuente fiable de entrenador — usar siempre el campo `Entrenador` (texto) |
| Notas_entrenador | Texto largo (NEW) | Notas privadas del entrenador sobre el cliente, editable desde la ficha de cliente (`/dashboard`), autoguardado con debounce. No es analizado por IA |
| Notas_iniciales | Texto largo (NEW) | Lo que el cliente escribe al registrarse, vía el Tally nuevo de alta (ver N8N WORKFLOWS → "Seguimiento - Alta cliente"). Se muestra de solo lectura en la ficha de cliente |
| Link_tally_alta | URL (NEW) | Link de Tally de alta pre-rellenado (nombre/email/telefono/entrenador), generado **server-side** en `POST /api/clientes` y guardado en el registro al crearlo. Se muestra en la ficha de cliente con botón "Copiar" para reenviarlo si el cliente necesita rellenar el formulario de nuevo (ver decisión técnica 33) |
| Last_modified | Fórmula `DATETIME_FORMAT(LAST_MODIFIED_TIME(), 'YYYY-MM-DDTHH:mm:ss.SSS')` (NEW) | Timestamp de última modificación del registro, cualquier campo. Usado para optimistic locking (ver decisión técnica 31). No es un campo "Last modified time" nativo — ver por qué en esa decisión |

### Tabla "Reportes" (tbljT33LCBLT6NoKf)
| Campo | Tipo | Notas |
|-------|------|-------|
| Fecha | DateTime (PRIMARY) | Formato europeo, zona Madrid |
| Cliente | Link | A tabla Clientes |
| Peso | Número | 1 decimal |
| Entrenamientos | Número | Entero |
| Energía | Select | Cansado / Normal / Con energía |
| Notas | Texto largo | Entrada del cliente |
| Análisis IA | Texto largo | Rellenado por n8n/Claude |
| Mensaje sugerido | Texto largo | Rellenado por n8n/Claude (solo si alerta) |
| Cliente_Email | Lookup | Del campo Email de Clientes (para filtrado fiable) |
| Cliente_Teléfono | Lookup | Teléfono del cliente, traído desde Clientes. Usado como insumo de `Link_alerta` |
| Link_alerta | Fórmula | Link de WhatsApp (wa.me) con el `Mensaje sugerido` precargado, solo si ese campo no está vacío. Consumido directamente por el botón WhatsApp en la ficha de cliente de `/dashboard` cuando el último reporte tiene alerta activa (si no, fallback a `Clientes.Link_recordatorio`) — no reconstruir el link a mano en el código |
| Cliente_Estado | Lookup | Estado (Activo/Pausado/Perdido) del cliente, para la Interface de Airtable "Resumen lunes". No se usa desde esta app |
| Estado semanal | Fórmula | Badge calculado (Pendiente/Alerta/Bien) para la Interface de Airtable, replica la lógica de `StatusBadge.tsx`. No se usa desde esta app |
| Cliente_Entrenador | Lookup (vía `Entrenador_nuevo`) | **No fiable, no usar para agrupar por entrenador.** Depende del campo vestigial `Entrenador_nuevo` de Clientes, casi nunca poblado. Para resolver el entrenador de un reporte, cruzar `Cliente_Email` contra `Clientes.Entrenador` |
| Last_modified | Fórmula (NEW, mismo patrón que Clientes/Entrenadores) | Timestamp de última modificación. Añadido por consistencia con las otras dos tablas afectadas por concurrencia (ver decisión técnica 31), pero **la app no escribe nunca en Reportes** (solo n8n), así que no hay optimistic locking real aplicado aquí — no hace falta, no hay endpoint de escritura en esta tabla desde la app |

### Tabla "Invitaciones" (tblzr50mLzLgnIsVg)
| Campo | Tipo | Notas |
|-------|------|-------|
| Token | Texto (PRIMARY) | inv_abc123xyz... (UUID) |
| Email_entrenador | Texto | Email a registrar |
| Estado | Select | Activo / Usado / Expirado / Cancelado |
| Creado | DateTime | Timestamp creación |
| Expira | DateTime | Creado + 24 horas |

### Tabla "Archivo" (tblgwKrbv6kRYqrAt)
Backup de reportes antiguos (>60 días). Campos: Fecha, Cliente_Email, Peso, Entrenamientos, Energía, Notas, Análisis_IA, Mensaje_sugerido.

### Tabla "Entrenadores" (tblo7dLrfaOxcPppY)
| Campo | Tipo | Notas |
|-------|------|-------|
| Email | Texto (PRIMARY) | Clave que conecta con Clientes.Entrenador e Invitaciones.Email_entrenador |
| Nombre | Texto | |
| Teléfono | Teléfono | +34... formato |
| Soluciones | Multi-select | Seguimiento / Captación / Recuperación / Referidos / Metricas. **"Metricas" se añadió por código de la app (`lib/productos.ts`, `calcularEstadoProducto`) pero NO se pudo añadir como choice del campo vía API** — ninguna herramienta MCP disponible permite editar opciones de un campo `multipleSelects` existente (`update_field` de Airtable solo edita `name`/`description`/fórmula). Añadirla manualmente en Airtable → campo Soluciones → editar opciones → añadir "Metricas" (5 min, no bloquea nada mientras tanto: la lógica de la app funciona igual, simplemente nadie puede tener esa solución asignada hasta entonces) |
| Estado | Select | Activo / Prueba / Inactivo |
| Fecha_alta | Date | Formato europeo D/M/YYYY |
| Precio_mensual | Currency | € precisión 0 |
| Notas | Texto largo | Histórico manual + observaciones |
| Link_whatsapp | Formula | `https://wa.me/<tel sin símbolos>?text=<mensaje>` a partir de Teléfono + Nombre |
| Último_login | DateTime | Europe/Madrid. Se actualiza desde código (POST /api/admin/log-activity), NO es fórmula |
| Permite_marketing | Checkbox | Consentimiento para usar métricas en agregados de marketing. Default desmarcado |
| Consentimiento_IA | Checkbox (NEW) | Confirmación del entrenador de que informará a sus clientes sobre el uso de IA, al activar Seguimiento. Se guarda desde `POST /api/entrenador/consentimiento-ia` |
| Consentimiento_IA_fecha | DateTime (NEW) | Europe/Madrid. Timestamp de cuándo se aceptó el consentimiento |
| Last_modified | Fórmula (NEW) | Timestamp de última modificación del registro. Usado para optimistic locking en `PUT /api/admin/entrenadores/[email]` (ver decisión técnica 31) |

### Tabla "Snapshots" (tbliaBxJa4GIYoHId)
| Campo | Tipo | Notas |
|-------|------|-------|
| Entrenador_email | Texto (PRIMARY) | |
| Fecha | Date | Formato europeo, un registro por mes por entrenador |
| Clientes_activos | Number | Precisión 0, usado para el sparkline en la ficha de entrenador y para "Evolución de clientes" en /metricas |

### Tabla "Snapshots_entrenadores" (agregado global, no por entrenador)
| Campo | Tipo | Notas |
|-------|------|-------|
| Fecha | DateTime (PRIMARY) | Un registro por mes (agregado de todos los entrenadores) |
| Total_entrenadores | Número | Precisión 0 |
| Total_activos | Número | Precisión 0, entrenadores con Estado=Activo |
| Total_prueba | Número | Precisión 0, entrenadores con Estado=Prueba |

Usada para la gráfica "Evolución de entrenadores" en `/dashboard`. Poblada mensualmente por el workflow n8n "Snapshot mensual" (ver sección N8N WORKFLOWS). Empieza vacía.

---

## ESTRUCTURA DEL REPOSITORIO
panel-seguimiento/
├── CLAUDE.md # Este archivo
├── .env.local # NO commitar
├── .env.example # Copiar a .env.local
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── src/
│ ├── app/
│ │ ├── layout.tsx # Dark mode, Inter font
│ │ ├── page.tsx # "/" landing pública (hero + PlanesCards + Login + CTA WhatsApp), sin auth. Antes era un redirect a /login (NEW)
│ │ ├── login/
│ │ │ └── page.tsx # Login page (Supabase)
│ │ ├── planes/
│ │ │ └── page.tsx # Para logueados sin plan base: mismo PlanesCards + CTA "Solicita acceso" por WhatsApp. Header completo (incluye 🏪 Marketplace, desde donde SÍ se puede autoactivar Seguimiento) (NEW)
│ │ ├── signup/
│ │ │ ├── page.tsx # Signup vía token (`/signup?token=...`, email prefetched y read-only desde el token — no confundir con "/register", esa ruta no existe en este proyecto)
│ │ │ └── confirm/page.tsx # Callback de confirmación de email de Supabase. emailRedirectTo del signUp() apunta aquí
│ │ ├── reset-password/
│ │ │ └── page.tsx # Reset password
│ │ ├── dashboard/
│ │ │ └── page.tsx # Entrenador: gate de plan base al entrar (si no tiene Seguimiento/Captación/Recuperación → redirect a /planes) (NEW), luego tabs Clientes (lista+ficha, sin gráficas) / Marketplace. Admin: DashboardResumenView (resumen ejecutivo)
│ │ ├── admin/
│ │ │ ├── page.tsx # Lista de entrenadores + alta + AlertasPanel + AplicacionesPanel (solo jumirohu@gmail.com). ?nuevo=1 abre el form
│ │ │ └── entrenador/[email]/page.tsx # Ficha: editar, sparkline, invitación, WhatsApp, resetear contraseña
│ │ ├── metricas/
│ │ │ └── page.tsx # MetricasView: histórico (solo jumirohu@gmail.com)
│ │ ├── trainer/
│ │ │ └── metricas/[clienteId]/page.tsx # Placeholder "Próximamente" (NEW). Destino del botón "Ver métricas" de ClienteFicha, gateado por Soluciones incluye "Metricas"
│ │ └── api/
│ │ ├── clientes/route.ts # GET clientes filtrados por entrenador (incluye telefono, linkRecordatorio, tieneAlerta, alertaResumen, notasEntrenador, notasIniciales, linkTallyAlta, lastModified) + POST crea cliente (Nombre/Email/Teléfono, Entrenador=logueado, Estado=Activo) y genera+guarda Link_tally_alta server-side (NEW)
│ │ ├── clientes/[id]/route.ts # PATCH notasEntrenador y/o estado, verifica ownership (Entrenador===email autenticado) + optimistic locking por lastModified (409 si no coincide) (NEW)
│ │ ├── reportes/route.ts # GET reportes paginados del cliente ({reportes, offset}, pageSize=7, ?offset= para "Ver más")
│ │ ├── entrenador/perfil/route.ts # GET soluciones contratadas del entrenador logueado (consumido por Marketplace)
│ │ ├── entrenador/consentimiento-ia/route.ts # POST guarda Consentimiento_IA + Consentimiento_IA_fecha del entrenador logueado
│ │ └── admin/
│ │ ├── invite/route.ts # POST generar invitación
│ │ ├── invitaciones/route.ts # GET historial invitaciones
│ │ ├── regenerate/route.ts # POST regenerar token
│ │ ├── cancel/route.ts # POST cancelar invitación
│ │ ├── create-user/route.ts # POST crear usuario Supabase directo (evita rate limit)
│ │ ├── reset-password/route.ts # POST genera password temporal y la aplica en Supabase. Usa findSupabaseUserByEmail (lib/supabase-server.ts)
│ │ ├── log-activity/route.ts # POST actualiza Último_login (fire-and-forget desde login)
│ │ ├── resumen-negocio/route.ts # GET tarjetas + evolución entrenadores + soluciones (consumido por /dashboard)
│ │ ├── alertas/route.ts # GET alertas "requiere tu atención" (consumido por /admin)
│ │ ├── metricas-negocio/route.ts # GET clientes históricos + evolución clientes + métricas de impacto + métricas de entrenadores (total histórico, evolución mensual, por estado, por plan) (consumido por /metricas) (NEW: bloque de entrenadores)
│ │ ├── alertas-stats/route.ts # GET histórico de alertas: total, por mes, por entrenador (consumido por /metricas)
│ │ └── entrenadores/
│ │ ├── route.ts # GET lista + POST crear entrenador
│ │ └── [email]/route.ts # GET ficha (clientes activos, snapshots, invitación, lastModified) + PUT actualizar (optimistic locking por lastModified, 409 si no coincide) + DELETE (borra Airtable + usuario Supabase si existe) (NEW: locking)
│ ├── components/
│ │ ├── ClientesLista.tsx # Vista entrenador: buscador + filtro Alertas/Activos/Inactivos/Todos (default Activos) + filas (Nombre/Objetivo/Estado/alerta con tooltip de resumen), click abre ficha + botón "+ Registrar cliente" (NEW: filtro Alertas + tooltip)
│ │ ├── ClienteFicha.tsx # Vista entrenador: info + botón "Dar de baja" (confirmación inline, Estado→Perdido) + notas del entrenador (autoguardado, con optimistic locking) + notas iniciales del cliente (solo lectura) + link de Tally de alta (botón Copiar) + últimos 7 reportes + "Ver más" + botón WhatsApp + botón "Ver métricas" (si Soluciones incluye Metricas). Banner de conflicto con botón "Recargar" si otro proceso modificó el registro entretanto (NEW)
│ │ ├── RegistrarClienteModal.tsx # Modal Nombre/Email/Teléfono → POST /api/clientes (genera y guarda Link_tally_alta server-side) → "Copiar al portapapeles" (NEW: link ya no se genera client-side)
│ │ ├── Marketplace.tsx # Grid de productos, cruce con Soluciones del entrenador, modal "Más información". "Activar ahora" oculto si en_uso; para Seguimiento abre el modal de consentimiento IA en vez de WhatsApp. Solo accesible desde `/dashboard` (ver decisión 27)
│ │ ├── PlanesActivosResumen.tsx # Primera sección de `/dashboard` (vista entrenador): tarjetas de PRODUCTOS (sin Referidos) con copy de content/plans-copy.ts, badge "En uso" o CTA WhatsApp (nunca self-service) (NEW)
│ │ ├── StatusBadge.tsx # Badge con tooltip (motivo de la alerta) cuando estado=alerta. Usa lib/estadoReporte.ts
│ │ ├── SuggestedMessage.tsx # Colapsable (igual que AIAnalysis), botón Copiar visible sin necesidad de expandir (NEW)
│ │ ├── AIAnalysis.tsx # Badge colapsable "💡 Análisis IA disponible", fondo destacado si tieneAlerta=true (NEW prop)
│ │ ├── Header.tsx # Incluye AdminNavDropdown si el usuario es admin. Botón 🏪 (no-admin) abre modal con <Marketplace />, controlado por prop `showMarketplace` (default true; `/planes` pasa false, ver decisión 27) (NEW). Botón 🔑 (todos) abre <ChangePasswordModal />
│ │ ├── ChangePasswordModal.tsx # Self-service: pide contraseña actual (revalida con signInWithPassword) + nueva + confirmar, updateUser() (NEW)
│ │ ├── PlanesCards.tsx # Grid de PRODUCTOS con copy persuasivo de content/plans-copy.ts (problema/features/resultados) + badge "Requiere plan base" en Metricas, sin auth ni acciones — usado por "/" y "/planes". Distinto de Marketplace.tsx (ese sí es interactivo/autenticado) (NEW)
│ │ ├── AdminNavDropdown.tsx # Dropdown de navegación admin: Resumen/Gestión/Métricas, resalta la página activa
│ │ ├── Tooltip.tsx # Tooltip genérico reutilizable (hover/focus)
│ │ └── admin/
│ │ ├── DashboardResumenView.tsx # Tarjetas + evolución entrenadores + soluciones (/dashboard)
│ │ ├── AlertasPanel.tsx # Sección "Requiere tu atención" (/admin)
│ │ ├── AplicacionesPanel.tsx # Links a Airtable/n8n/Supabase (/admin)
│ │ └── MetricasView.tsx # Tarjetas + evolución clientes + alertas por mes + métricas de impacto + sección "Métricas de entrenadores" (total histórico, evolución mensual, desglose por estado, por plan) (/metricas) (NEW: sección entrenadores)
│ ├── content/
│ │ └── plans-copy.ts # PLANES_COPY: headline/subheadline, copy por producto (problema/features/resultados), comparativa sin-vs-con automatización, pricingNote. Fuente única usada por PlanesCards.tsx y PlanesActivosResumen.tsx (NEW)
│ └── lib/
│ ├── supabase.ts # Cliente Supabase (anon key)
│ ├── supabase-server.ts # Cliente Supabase servidor (service role key) + findSupabaseUserByEmail() (paginación sobre listUsers, compartido por reset-password y el DELETE de entrenadores) (NEW)
│ ├── auth-server.ts # Lógica de auth backend
│ ├── admin.ts # Constante ADMIN_EMAIL (NEXT_PUBLIC_ADMIN_EMAIL con fallback)
│ ├── alertas.ts # calcularAlertasNegocio() — lógica pura, compartida por /api/admin/alertas
│ ├── estadoReporte.ts # calcularEstadoReporte() — pendiente/alerta/bien, compartida por StatusBadge, ClienteFicha y /api/clientes (NEW)
│ ├── productos.ts # Catálogo del Marketplace (PRODUCTOS) + calcularEstadoProducto() (en_uso/disponible/proximamente) + SOLUCIONES_BASE/tienePlanBase() (NEW, ver decisión 24)
│ └── airtable.ts # Helpers para Airtable API. borrarEntrenador() (DELETE) usado por /api/admin/entrenadores/[email]. crearCliente()/actualizarCliente() (NEW, POST/PATCH tabla Clientes)
└── public/
└── [favicons, etc.]


---

## DECISIONES TÉCNICAS INAMOVIBLES

1. **Airtable token NUNCA en frontend** → solo en Vercel API Routes (backend)
2. **Campo Entrenador = EMAIL del entrenador** (no nombre, no Colaborador)
3. **Filtrar reportes por `Cliente_Email` lookup** (no por record ID)
4. **Usar nuevas Supabase keys** (`sb_publishable_` / `sb_secret_`), no legacy
5. **Login protege con JWT de Supabase** (verificado en cada API call)
6. **Admin dashboard accesible SOLO a** `jumirohu@gmail.com`
7. **Tokens de invitación válidos 24h**
8. **Token se marca "Usado" solo cuando signup se completa**
9. **Regenerar token = borra anterior + crea nuevo**
10. **NO hay signup pública** (solo vía token)
11. **Campo Email en Entrenadores/Snapshots.Entrenador_email = email texto** (mismo patrón que Clientes.Entrenador, NO linked record — es la clave que conecta Entrenadores, Clientes, Invitaciones y Snapshots)
12. **Para resolver el entrenador de un cliente o reporte, usar siempre `Clientes.Entrenador` (texto) o `Cliente_Email` cruzado contra `getAllClientes()`** — nunca `Entrenador_nuevo` (Clientes) ni `Cliente_Entrenador` (Reportes), son campos vestigiales de un experimento de colaboradores que casi nunca están poblados
13. **Páginas admin separadas por responsabilidad** (todas solo accesibles a `jumirohu@gmail.com`): `/dashboard` = resumen ejecutivo (tarjetas + evolución entrenadores + soluciones), `/admin` = gestión operativa (lista de entrenadores, alertas que requieren atención, accesos a apps externas), `/metricas` = histórico (clientes históricos, alertas históricas, métricas de impacto). Navegación entre ellas vía dropdown en el Header, no vía botones sueltos en cada página
14. **Vista entrenador de `/dashboard` sin gráficas**: lista de clientes (buscador + alerta) → ficha de cliente (últimos 7 reportes + "Ver más" paginado) → Marketplace. Se quitaron `EnergyChart`/`WorkoutsChart`/`WeightChart`/`ClientSelector`/`ExportPDF` (y las deps `recharts` para esta vista, `html2canvas-pro`, `jspdf`) por no tener ya consumidores
15. **"Alerta reciente sin resolver"** = mismo criterio que `StatusBadge` (último reporte ≤8 días y con `Mensaje sugerido` no vacío), centralizado en `lib/estadoReporte.ts`. No hay campo de "resuelto" en Airtable — la alerta deja de mostrarse cuando llega un reporte nuevo sin mensaje sugerido
16. **Botón WhatsApp de la ficha de cliente**: usa `Reportes.Link_alerta` del último reporte si su estado es "alerta"; si no, usa `Clientes.Link_recordatorio` (nunca reconstruir el link de Teléfono a mano)
17. **Marketplace**: catálogo fijo en `lib/productos.ts` con un flag `lanzado` por producto (hoy solo `true` para Seguimiento). Estado de cada tarjeta = "En uso" si está en `Entrenadores.Soluciones`, si no "Disponible" cuando `lanzado`, si no "Próximamente". Para lanzar Captación/Referidos/Recuperación en el futuro basta con cambiar su `lanzado` a `true`, no hace falta tocar el resto de la lógica
18. **Botón "Activar ahora" del Marketplace** abre WhatsApp a `NEXT_PUBLIC_JUANMI_WHATSAPP` con "Quiero activar [Producto]" — preparado para sustituirse por un link de checkout el día que exista plataforma de pago (`linkActivarAhora()` en `Marketplace.tsx` es el único punto a cambiar). **Excepción: para el producto "Seguimiento"**, "Activar ahora" no abre WhatsApp — abre el modal de consentimiento IA (decisión 19); WhatsApp sigue siendo el flujo para el resto de productos
19. **Consentimiento IA (Seguimiento)**: al hacer click en "Activar ahora" sobre el producto Seguimiento (solo si no está ya en uso), se muestra un modal con checkbox obligatorio antes de poder continuar. Al confirmar, `POST /api/entrenador/consentimiento-ia` guarda `Consentimiento_IA`/`Consentimiento_IA_fecha` **y además añade "Seguimiento" a `Entrenadores.Soluciones`** (merge con lo que ya tuviera, sin duplicar) — es decir, este modal SÍ activa el producto de verdad, es autoservicio completo. (Revisión de la decisión original de esta misma sesión, que dejaba la asignación de Soluciones como manual-solo-admin; el PM confirmó que el modal debe activar directamente). El endpoint devuelve `soluciones` actualizado y el frontend actualiza su estado local antes de navegar a `/dashboard`, para que la tarjeta pase a "En uso" sin esperar a un refetch. No toca `Precio_mensual` (eso sigue siendo manual)
20. **Botón "Ver métricas" (ficha de cliente) y producto "Métricas y Estadísticas" (Marketplace)**: ambos gateados por `Entrenadores.Soluciones` incluye `"Metricas"` (sin acento, así está en Airtable). Hoy ningún entrenador la tiene — la funcionalidad real (gráficas, ranking, MRR, retención) no está implementada, solo el gating y el placeholder (`/trainer/metricas/[clienteId]`, "Próximamente")
21. **NO se crea usuario Supabase automáticamente desde el webhook de Tally** ("Recepción entrenador" en n8n) — decisión confirmada explícitamente en esta sesión, reafirma la decisión 10. El alta real de Supabase sigue siendo: Tally → Airtable (Estado="Prueba") → admin revisa manualmente → genera invitación desde `/admin/entrenador/[email]` → el entrenador crea su propia cuenta/contraseña vía `/signup?token=...`. No poner claves de Supabase (`service_role`, admin API) en nodos de n8n
22. **Borrar entrenador** (`/admin/entrenador/[email]`, sección "Zona de peligro"): borra el registro de Airtable y, si existe, el usuario de Supabase (busca por email vía `findSupabaseUserByEmail`, paginando `listUsers`). **No borra sus Clientes ni Reportes** — fuera de alcance intencionalmente, evita borrados en cascada accidentales
23. **Cambiar contraseña (self-service)**: botón 🔑 en el Header (`ChangePasswordModal.tsx`), disponible para cualquier usuario logueado (admin o entrenador). Revalida la contraseña actual reintentando `signInWithPassword` antes de llamar a `updateUser` — no hay endpoint backend nuevo, todo client-side con la sesión de Supabase ya autenticada. Distinto del flujo "¿Olvidaste tu contraseña?" de `/login` (ese es por email, para cuando no puedes entrar; este es para cambiarla estando ya dentro)
24. **Modelo freemium con gate de "plan base"**: `SOLUCIONES_BASE = ['Seguimiento', 'Captación', 'Recuperación']` (`lib/productos.ts`). `/dashboard` (vista entrenador) exige tener al menos uno de estos en `Soluciones` — si no, redirige a `/planes`. **Sin middleware.ts**: la app usa Supabase 100% client-side (localStorage, sin cookies de sesión), así que un `middleware.ts` de Next.js no tendría forma de leer la sesión — el gate vive en el `useEffect` de `/dashboard/page.tsx`, mismo patrón que ya usan todas las páginas protegidas de este proyecto (comprobar `supabase.auth.getUser()` y hacer `router.push` si no cumple). Si en el futuro se migra a `@supabase/ssr` con cookies, ahí sí tendría sentido un middleware real
25. **Métricas requiere plan base** (admin, ficha de entrenador): el botón "Metricas" del selector de Soluciones se deshabilita (con tooltip) si no hay ya un plan base seleccionado. Si se quita el último plan base estando Metricas activa, se desactiva automáticamente junto con él — el estado guardado nunca puede ser "solo Metricas, sin plan base". Se optó por esta variante (bloquear en el propio selector) en vez de un toast de error al guardar, por ser la alternativa de mejor UX
26. **"Referidos" en `PlanesCards`**: se muestra en `/` y `/planes` igual que el resto del catálogo (una sola fuente de verdad, `PRODUCTOS`), aunque no estuviera pedido explícitamente en el brief de la landing — evita mantener dos listas de productos que puedan desincronizarse
27. **Marketplace (con su self-service de Seguimiento, decisión 19) solo vive en `/dashboard`**: prop `showMarketplace` en `Header.tsx` (default `true`) controla el botón 🏪; solo `/planes` pasa `false`. Como `/planes` es la única página que ven entrenadores con 0 planes (gate `tienePlanBase()` en `/dashboard`) y `/dashboard` solo lo alcanzan quienes ya tienen ≥1 plan, esto cierra el hueco por el que un entrenador sin plan podía llegar al self-service de Seguimiento desde `/planes` — sin tocar la lógica de decisión 19. La nueva sección "Tus planes" de `/dashboard` (`PlanesActivosResumen.tsx`) es deliberadamente **siempre WhatsApp** para planes no contratados (nunca abre el modal de consentimiento), distinta del tab "Marketplace" que sigue siendo self-service para Seguimiento
28. **"Dar de baja" cliente = `Estado` → `Perdido`, no "Inactivo"**: el campo `Clientes.Estado` es un `singleSelect` con solo Activo/Pausado/Perdido como choices, y ninguna herramienta MCP disponible permite añadir un choice nuevo a un select existente (mismo límite que el pendiente histórico de "Metricas" en `Entrenadores.Soluciones`). Se reusa `Perdido`, que además ya es el estado sobre el que `lib/productos.ts` define que actuará el futuro producto Recuperación — "dar de baja" y "candidato a recuperación" son el mismo estado. El filtro Activos/Inactivos de `ClientesLista.tsx` es `estado === 'Activo'` vs `estado !== 'Activo'` (cubre Pausado+Perdido), sin campos nuevos en Airtable
29. **Alta de cliente vía Tally**: el Tally existente (`tally.so/r/5BYDQM`) es el check-in semanal (Peso/Entrenamientos/Energía/Notas → crea un `Reporte`) — no se reutiliza para altas. El flujo de alta usa un Tally **nuevo**, ya creado (`tally.so/r/ODq4kK`, formId `ODq4kK`, ver N8N WORKFLOWS): la app crea el `Cliente` en Airtable (Nombre/Email/Teléfono) desde `RegistrarClienteModal.tsx`, genera un link a ese Tally con esos 3 datos precargados como campos ocultos + `entrenador`, y el cliente solo rellena `Objetivo`/`Entrenamientos_objetivo`/`Notas_iniciales` — el workflow n8n "Seguimiento - Alta cliente" hace PATCH al `Cliente` ya existente (nunca crea uno nuevo)
31. **`Last_modified` es un campo fórmula `DATETIME_FORMAT(LAST_MODIFIED_TIME(), 'YYYY-MM-DDTHH:mm:ss.SSS')`, no un campo nativo "Last modified time"**: la Metadata API de Airtable (usada por las herramientas MCP disponibles) no permite crear campos de tipo `lastModifiedTime`/`createdTime` — el enum de tipos creables vía API no los incluye (mismo tipo de límite ya documentado para el choice "Metricas" y el estado "Perdido", ver decisiones 20/28). Workaround: un campo `formula` con `LAST_MODIFIED_TIME()` tiene exactamente el mismo comportamiento (se actualiza automáticamente ante cualquier edición del registro, sea desde la app, n8n o el UI de Airtable) y **sí** es creable vía API. Se envolvió en `DATETIME_FORMAT(...)` para forzar salida como texto ISO con milisegundos — sin esto, el campo se crea con formato de solo-fecha (`M/D/YYYY`) y perdería la precisión necesaria para detectar ediciones dentro del mismo día. Verificado leyendo un registro real tras crear el campo: devuelve `"2026-08-10T09:21:10.000"`. Aplicado a Clientes, Reportes y Entrenadores (tablas del brief de concurrencia)
32. **Optimistic locking (concurrencia)**: `PATCH /api/clientes/[id]` y `PUT /api/admin/entrenadores/[email]` aceptan un campo `lastModified` en el body (el valor que el frontend leyó al cargar la ficha). Antes de escribir, el backend relee el registro (ya lo hacía para el chequeo de ownership/existencia) y compara su `Last_modified` actual contra el recibido — si ambos existen y difieren, responde `409` con `{ error: 'Este registro fue modificado por otra persona. Recarga e intenta de nuevo.' }` sin llegar a escribir. Si cualquiera de los dos valores está vacío (registro creado antes de que existiera el campo, o frontend que aún no lo tiene) se omite el chequeo y se permite escribir — evita bloquear registros antiguos sin histórico. Las respuestas de éxito devuelven el `lastModified` actualizado, que el frontend guarda en su estado (en `ClienteFicha` vía `onUpdated` → `dashboard/page.tsx` recalcula el cliente seleccionado desde la lista; en la ficha de entrenador vía `loadEntrenador()` tras cada guardado) para que la siguiente escritura de la misma sesión compare contra el valor correcto. En conflicto: `ClienteFicha` muestra un banner con botón "Recargar" (no hay endpoint de refetch de un único cliente); la ficha de entrenador refresca automáticamente (`loadEntrenador()`) porque sí tiene ese GET. **No aplica a Reportes** (la app no tiene ningún endpoint de escritura sobre esa tabla, solo n8n escribe ahí)
33. **Link de Tally de alta ahora se genera server-side, no client-side**: antes `RegistrarClienteModal.tsx` construía el link con `NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL` + query params después de recibir la respuesta del POST. Ahora `POST /api/clientes` genera el mismo link (usando `process.env.NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL`, que también está disponible server-side pese al prefijo) y lo guarda en `Clientes.Link_tally_alta` en la misma escritura de creación — así queda persistido en Airtable y se puede reenviar desde la ficha del cliente sin depender de que el modal siga abierto. Efecto colateral: la prop `entrenadorEmail` de `RegistrarClienteModal`/`ClientesLista` quedó sin uso (ya no hace falta para construir el link) y se eliminó de los tres componentes de la cadena (`RegistrarClienteModal` → `ClientesLista` → `dashboard/page.tsx`)
35. **Credenciales `httpHeaderAuth` en n8n necesitan los campos `name` Y `value`, no solo `value`**: al editar la credencial "Resend API (Header Auth)" vía `n8n_manage_credentials` (action `update`), pasar solo `{"value": "Bearer ..."}` no genera ningún error pero deja la credencial inservible — sin `name` (el nombre del header, en este caso `"Authorization"`), n8n no sabe qué header enviar y la petición sale sin cabecera de autenticación (`401 Missing API Key` en Resend, mensaje distinto a un 401 de key inválida). Descubierto al depurar por qué el fix de la Tarea 1 seguía fallando tras "arreglar" la credencial — el error decía literalmente "Missing API Key", no "invalid". Fix: pasar siempre `{"name": "Authorization", "value": "Bearer <key>"}` juntos al crear/actualizar una credencial de este tipo
36. **Nunca hardcodear el valor de una API key en los parámetros de un nodo (`headerParameters`) cuando el nodo ya tiene `authentication: genericCredentialType` apuntando a una credencial** — se encontró exactamente este patrón roto en "Recepción entrenador": los nodos "Email ya registrado"/"Email bienvenida" tenían AMBAS cosas a la vez (una credencial `httpHeaderAuth` configurada Y un header `Authorization` hardcodeado en `headerParameters` con una API key real de Resend, `re_XiMgBdxx...`, la key llamada "seguimiento" en el dashboard de Resend). Esto es ambiguo/redundante y probablemente la razón por la que la credencial nunca se completó correctamente (alguien pegó la key donde parecía "funcionar" en vez de en el sitio correcto). Fix: la key real ya generada se movió a la credencial (ver decisión 35) y se eliminó el `headerParameters` de ambos nodos — no hizo falta rotar la key en Resend, seguía siendo válida, solo estaba mal ubicada. Si en el futuro se encuentra un patrón similar (header manual + credencial genérica a la vez), tratarlo como bug de configuración, no como "ya está resuelto porque envía"
37. **Filtro "Solo alertas reales" en "Seguimiento - Análisis Lunes" exige `ultimoReporteId` válido, no solo `alerta == true`**: ver detalle completo en N8N WORKFLOWS → "Seguimiento - Análisis Lunes". Resumen: un cliente activo sin ningún `Reporte` todavía produce `ultimoReporteId` = string `"null"` (por interpolación de template string sobre un valor `null` real), y sin este filtro el batch `update` de "Guardar alerta" fallaba entero (Airtable es atómico) bloqueando las alertas de TODOS los clientes de la semana, no solo del cliente sin historial. Cualquier cambio futuro a este workflow debe mantener esta doble condición (`!= "null"` y `!= ""`) en el filtro, o el bug reaparece
38. **`Tooltip.tsx` usa `createPortal` a `document.body` con `position: fixed`, no `position: absolute` dentro del propio árbol**: el motivo es que varios contenedores que lo envuelven (p. ej. la lista de clientes en `ClientesLista.tsx`) tienen `overflow-hidden`, y un tooltip `absolute` queda recortado por el ancestro posicionado más cercano con overflow — clásico bug de "el tooltip se mete dentro de la interfaz". La solución no es solo subir el z-index (eso no arregla el recorte por `overflow-hidden`), es sacar el tooltip del flujo/stacking context de sus ancestros por completo vía portal. Posicionamiento calculado en dos pasadas con `useLayoutEffect` + `getBoundingClientRect()`: se monta oculto para medir su tamaño real, luego se decide arriba/abajo según el espacio disponible y se clampa horizontalmente para no salirse del viewport; se recalcula en scroll/resize mientras está abierto. Como `StatusBadge.tsx` reutiliza este mismo componente, el fix cubre ambos usos sin tocar sus llamadas
39. **Matching de campos Tally por `label`, no por slug exacto**: en Tally, el "Reference ID" fijable a un slug corto (`nombre`, `email`, `telefono`, `entrenador`) solo existe para **Hidden Fields**. Los campos visibles que rellena el usuario (`objetivo`, `entrenamientos_objetivo`, `notas_iniciales`) llegan con el **texto literal de la pregunta** como `label` (p. ej. `"¿Cuál es tu objetivo?"`), no con el slug — descubierto al depurar el bug del nodo "Formatear datos" de "Seguimiento - Alta cliente" (ver N8N WORKFLOWS). Por eso el Code node matchea cada campo contra una lista de labels aceptados (slug + texto real de la pregunta), en vez de un único string exacto — sobrevive a que se reformule la pregunta en Tally sin tocar código, y sigue funcionando si en el futuro se le pone un slug real. Aplica al patrón general de cualquier workflow que lea un Tally por `label` (`Seguimiento - Resumen&Alerta` incluido, no auditado todavía con este mismo criterio)

---

## RESEND TEMPLATES

Dominio verificado: `retaincoach.com` (ID `f6663f78-c119-4bce-b426-f80184ea2620`, región eu-west-1). From por defecto de los templates: `RetainCoach <hola@retaincoach.com>`.

| Template | ID | Alias | Variables | Uso |
|----------|----|----|-----------|-----|
| Bienvenida Entrenador | `f69bc00d-259b-4146-9f70-79276c23490d` | `bienvenida-entrenador` | `NOMBRE` (fallback "entrenador"), `EMAIL` (reservada, automática) | n8n "Recepción entrenador" al crear registro nuevo en Entrenadores |
| Reset Contraseña | `7ba271b2-1f0a-423c-91d4-26e4c9848b12` | `reset-contrasena` | `NOMBRE` (fallback "usuario"), `RESET_LINK` (obligatoria) | Disponible para flujo de reset (hoy `/api/admin/reset-password` genera password temporal directo en Supabase; no envía email — usar este template si se añade notificación por email a ese flujo) |
| Cuenta existente | `4b6efac2-b355-4a59-8b0b-94a39500819e` | `cuenta-existente` | `NOMBRE` (fallback "entrenador") | n8n "Recepción entrenador", nodo "Email ya registrado", cuando el email de un submission de Tally ya existe en Entrenadores (antes era HTML inline en el propio nodo, migrado a template en esta sesión) |

Los tres publicados (no en draft). Variables se pasan al enviar con `{{{NOMBRE}}}` etc. — usar `resend:send-email` con `templateId` (o alias) + `variables`.

---

## N8N WORKFLOWS

### "Seguimiento - Resumen&Alerta" ✅ ACTIVO
Webhook Tally (path `Tallyseguimiento`) → Formatear datos → Buscar cliente → Crear reporte (Airtable)

### "Seguimiento - Análisis Lunes" ✅ ACTIVO (id `EfmcTyLfWEKQino0`) — activado de verdad en esta sesión
**Corrección de un drift de documentación real:** este workflow figuraba aquí como "✅ (ver n8n)" pero en realidad **nunca había sido activado** (`active: false`, `activeVersionId: null` — sin versión publicada nunca). El análisis semanal real de clientes nunca se había disparado automáticamente en producción; todo lo que había en Airtable venía de ejecuciones manuales sueltas de sesiones anteriores. **Activado de forma permanente en esta sesión** tras validarlo end-to-end (ver Tarea 2 en ESTADO ACTUAL) — a partir de ahora sí correrá solo cada lunes 9am.

Cron (Schedule Trigger, lunes 9am) → Clientes activos (Airtable search, Estado=Activo) → Reportes del cliente (Airtable search, últimos reportes por email de cliente) → Calcular señales (Code: no_respondio_esta_semana, semanas_cansado_seguidas, entrenamientos_en_caida, peso_contra_objetivo — solo para Objetivo="Pérdida de peso") → Analizar con Claude (HTTP Request a `api.anthropic.com/v1/messages`, modelo `claude-sonnet-4-5`, credencial `httpHeaderAuth` "Header Auth account" id `wiDyr81cfHSKRr5S`) → Parsear respuesta (Code, `JSON.parse` de la respuesta de Claude) → Solo alertas reales (Filter) → Guardar alerta (Airtable update sobre `tbljT33LCBLT6NoKf` por `id`=`ultimoReporteId`, escribe `Análisis IA` + `Mensaje sugerido`).

**BUG ENCONTRADO Y CORREGIDO en esta sesión (grave — bloqueaba el guardado de TODAS las alertas de la semana, no solo una):** cuando un cliente `Activo` no tiene ningún `Reporte` todavía (recién dado de alta, sin check-ins), "Calcular señales" produce `ultimoReporteId: null`. El prompt a Claude interpola ese valor con template string (`` `"ultimoReporteId": "${$json.ultimoReporteId}"` ``), así que Claude lo recibe y lo devuelve como el **string literal `"null"`**, no como ausencia de valor. El nodo "Guardar alerta" hace entonces un batch `update` a Airtable incluyendo un registro con `id: "null"`, que la API de Airtable rechaza con 422 (`INVALID_RECORDS`) — y como el batch update de Airtable es atómico (todo o nada), **ese único cliente sin historial tumbaba el guardado de las alertas de absolutamente todos los demás clientes de esa semana**, en silencio (sin que nadie lo notara hasta revisar la ejecución en n8n). Reproducido con datos reales: 2 clientes de prueba sin ningún reporte causaron el fallo completo del nodo.

**Fix aplicado:** se añadieron 2 condiciones (AND) al filtro "Solo alertas reales", además de la ya existente `alerta == true`: `ultimoReporteId != "null"` y `ultimoReporteId != ""`. Así los clientes sin historial simplemente no llegan a "Guardar alerta" (no hay nada que actualizar para ellos, correcto — no tienen ningún Reporte al que asociar el análisis), sin bloquear al resto. Verificado con datos reales tras el fix: de 6 clientes activos analizados, 2 sin reportes se excluyeron correctamente y los 3 con alerta real (con historial) se guardaron sin error. Ver decisión técnica 37

**Nota para el futuro:** si se quiere dar seguimiento a clientes que llevan mucho tiempo sin responder NINGÚN check-in (caso "no_respondio_esta_semana" sin `ultimo`), habría que diseñar un mecanismo distinto (p. ej. un campo en `Clientes` en vez de en `Reportes`, ya que hoy `Mensaje sugerido`/`Análisis IA` solo existen en la tabla `Reportes`) — fuera de alcance de este fix, que solo evita que rompan el resto del batch.

### "Seguimiento - Limpieza de datos antiguos" ⏸️ INACTIVO
Backup de reportes >60 días, mantener inactivo.

### "Recepción entrenador" ✅ ACTIVO (id D3Jnswx0Hh5THEev)
**Verificado en esta sesión vía API n8n que está realmente `active: true`.** Credencial Resend ya funcional de verdad (ver más abajo) — cualquier submission real de Tally crea/detecta el entrenador en Airtable Y envía el email correspondiente con éxito.

Webhook Tally (path `TallyEntrenadores`) → Formatear datos → Buscar entrenador (Airtable search por Email) → Comprobar existencia (Code, normaliza a 1 item con `existe: boolean` — necesario porque Airtable Search devuelve 0 items si no hay match, y un IF con 0 items de entrada no ejecuta ninguna rama) → IF "¿Ya registrado?":
- **true** (ya existe) → Email ya registrado (HTTP Request a Resend, template `cuenta-existente` — antes HTML inline, migrado a template en esta sesión)
- **false** (no existe) → Crear entrenador (Airtable, Estado="Prueba" fijo, sin Precio_mensual, sin invitación automática) → Email bienvenida (HTTP Request a Resend, template `bienvenida-entrenador`)

Extrae del formulario: Nombre, Email, Teléfono, Soluciones_interes, Num_clientes_actual, Como_conocio.

Los dos nodos de email usan HTTP Request directo a `https://api.resend.com/emails` (no el nodo comunitario "Resend" — sus propiedades de operación "send" no están bien indexadas en n8n-mcp, así que se optó por la API REST documentada para no adivinar nombres de campo). Autenticación: credencial `httpHeaderAuth` "Resend API (Header Auth)" (id `HKcpklE9LbcDgder`), **arreglada de verdad en esta sesión** — ver decisiones técnicas 35-36 para el detalle del problema real (no era un placeholder sin más, era un header duplicado con la key en el sitio equivocado) y la solución.

**Probado end-to-end en esta sesión con las dos ramas y credencial real** (ver ESTADO ACTUAL para el detalle) — ambos envíos confirmaron `id` de mensaje devuelto por Resend, no solo ausencia de error. Registro de prueba de la rama "nuevo entrenador" (`jumirohu+testn8n@gmail.com`) creado y borrado de Airtable tras la prueba.

**Bug encontrado y corregido en sesión anterior:** cuando `Buscar entrenador` no encuentra coincidencias, Airtable Search devuelve 0 items, y n8n no ejecuta ningún nodo aguas abajo con 0 items de entrada (ni siquiera un Code en modo "runOnceForAllItems") — así que `Comprobar existencia` nunca llegaba a correr. Fix: `alwaysOutputData: true` en `Buscar entrenador` (fuerza 1 item vacío si no hay resultados) + `Comprobar existencia` ahora detecta existencia por presencia de `item.json.id` en vez de por longitud del array.

**Pendiente:** crear el formulario en Tally con esos labels de campo exactos y conectarlo al webhook — manual (todo el resto ya está verificado end-to-end con payloads simulados con la forma real de Tally).

### Workflow "Recordatorios viernes" ⏳ NO CONSTRUIDO
Pendiente para después.

### Workflow "Snapshot mensual" ✅ ACTIVO (id h8L4RfQg8nXp4ve7)
Cron día 1 de cada mes a las 3am → Leer entrenadores (tblo7dLrfaOxcPppY) → Contar por estado (Code: Total_entrenadores/Total_activos/Total_prueba) → Crear snapshot entrenadores (Snapshots_entrenadores, retryOnFail) → Leer clientes activos (Clientes, filterByFormula Estado=Activo, una sola llamada) → Agrupar por entrenador (Code) → Crear snapshots por entrenador (Snapshots, un registro por entrenador, retryOnFail).

**Validación estructural OK** (`validate_workflow`: 0 errores, 7 nodos, 6 conexiones válidas). **Activado en esta sesión** (verificado vía API n8n: `active: true`). La credencial Airtable que lo bloqueaba (compartida con "Recepción entrenador") ya está arreglada. El trigger es un Schedule Trigger, así que `n8n_test_workflow` no puede dispararlo por API — solo desde el botón "Test workflow" en el editor de n8n o esperando a la próxima ejecución automática (día 1 de mes, 3am). **Pendiente real: verificar el conteo de la primera ejecución real contra Airtable y documentar el resultado aquí.**

### Workflow "Seguimiento - Alta cliente" ✅ ACTIVO (id `e0DrzrSqRryaJloc`)
Webhook (path `TallyAltaCliente`, conectado al Tally real `tally.so/r/ODq4kK`, formId `ODq4kK`, formName "Alta de cliente") → Formatear datos (Code, lee `body.data.fields` por `label`) → Buscar cliente (Airtable search por Email) → Actualizar cliente (Airtable update: `Objetivo`, `Entrenamientos_objetivo`, `Notas_iniciales`, matching por `id` del registro encontrado). Ver decisión técnica 29 — nunca crea un `Cliente` nuevo, solo completa el que la app ya creó vía `POST /api/clientes`.

**El Tally ya existe y está conectado** (ya no es el pendiente que documentaba esta sección antes) — visto directamente en ejecuciones reales del webhook (n8n executions 54, 55). Estructura real que envía Tally, para referencia (distinta de lo que se había asumido originalmente):
- 4 campos ocultos (Hidden Fields, `label` = slug exacto): `nombre`, `email`, `telefono`, `entrenador`
- 3 campos visibles, con `label` = **texto literal de la pregunta**, no un slug: `"¿Cuál es tu objetivo?"` (`type: "DROPDOWN"`, valor = array de IDs de opción a resolver contra `field.options`), `"¿Cuántos entrenamientos por semana?"` (`type: "INPUT_NUMBER"`), `"Notas iniciales"` (`type: "TEXTAREA"`)

**Bug encontrado y corregido en esta sesión:** el nodo "Formatear datos" original buscaba las etiquetas `objetivo`/`entrenamientos_objetivo`/`notas_iniciales` tal cual (y solo resolvía a texto los campos `type: "MULTIPLE_CHOICE"`), así que con el payload real de Tally esos 3 campos —y `nombre`/`telefono`/`entrenador`, que ni se leían— salían `null`. Fix aplicado:
- Mapeo `LABELS` por campo de salida: acepta tanto el slug como el texto real de la pregunta (ver decisión técnica 30)
- Resolución de valor generalizada a cualquier campo con `options` (no solo `MULTIPLE_CHOICE`), cubre también `DROPDOWN`
- Ahora también extrae `nombre`, `telefono`, `entrenador`
- `telefono` se recorta con `.trim()` (Tally lo manda con un espacio inicial)

**Probado end-to-end con datos reales**: `validate_workflow` (0 errores) + ejecución de prueba (n8n execution 56, payload real capturado) → `Formatear datos` devolvió los 7 campos correctos sin nulos (`objetivo: "Hipertrofia"` resuelto correctamente desde el DROPDOWN). `Buscar cliente` no encontró coincidencia con el email de prueba, así que `Actualizar cliente` no llegó a ejecutarse (sin efectos secundarios reales en Airtable).

`NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL` ya está rellenada (`https://tally.so/r/ODq4kK`) en `.env.local` y, según confirma el usuario, en Vercel.

**Verificado en esta sesión (Tarea 3 del brief de concurrencia/Tally) que el workflow sobrescribe, no acumula**: el nodo "Actualizar cliente" es una operación `update` de Airtable con los 3 campos mapeados directamente a los valores de la última submission (`$('Formatear datos').item.json...`) — no hay ninguna lógica de concatenación/append, así que si el cliente rellena el Tally más de una vez, `Objetivo`/`Entrenamientos_objetivo`/`Notas_iniciales` quedan con los valores de la última vez, tal como pedía el brief. No hizo falta tocar el workflow.

---

## FLUJO DE TRABAJO (Claude Code vs Este Chat)

**Este chat (estrategia):**
- Definir qué construir
- Decidir arquitectura
- Resolver bugs de concepto
- Evaluar tradeoffs

**Claude Code (implementación):**
- Leer CLAUDE.md de entrada
- Escribir código
- Pushear a GitHub
- Reportar cualquier cambio en estructura

---

## PENDIENTES INMEDIATOS

- [x] Credencial Airtable en n8n (`airtableTokenApi`, id `rPj3DVDABuqwIv24`) devolvía 401 desde ~2026-08-09 — **arreglada en esta sesión** (el usuario regeneró el token). Verificado con una ejecución de prueba de "Recepción entrenador" tras el fix: Airtable OK de nuevo.
- [x] Admin dashboard: generar invitaciones + historial
- [x] Login/signup vía token
- [x] Admin: tabla Entrenadores + Snapshots, ficha completa por entrenador, dark mode, logout
- [x] Reset de contraseña + registro de Último_login + botón WhatsApp
- [x] /dashboard admin: resumen del negocio (tarjetas, gráficas, alertas, métricas de impacto) — **reestructurado en esta sesión en 3 páginas** (`/dashboard`, `/admin`, `/metricas`), ver decisión técnica 13
- [x] Workflow n8n "Recepción entrenador" (creado inactivo en su momento; confirmado ACTIVO en esta sesión, ver N8N WORKFLOWS)
- [x] Bugs de vista de cliente: exportar PDF, orden Análisis IA/Mensaje sugerido, botón WhatsApp directo, tooltip en badge Alerta
- [x] Endpoint `/api/admin/alertas-stats` (histórico de alertas para /metricas)
- [x] Tabla Airtable "Snapshots_entrenadores" + workflow n8n "Snapshot mensual" (creado inactivo en su momento; activado en esta sesión, ver N8N WORKFLOWS) que la puebla
- [x] Vista entrenador de `/dashboard`: lista de clientes + ficha + Marketplace (reemplaza vista de gráficas)
- [x] Bugfix "null es inaccesible" en confirmación de email: `/signup/confirm` maneja el callback de Supabase de forma defensiva (hash implicit + params de error), `signUp()` pasa `emailRedirectTo` explícito
- [x] Revisado un brief que pedía crear usuario Supabase directo desde n8n (webhook Tally) — **rechazado deliberadamente**: el endpoint propuesto no existe en la API real de Supabase, `$randomString()` no existe en n8n, y contradecía la decisión 10 (no signup pública). Se mantiene el flujo de invitación manual. Ver decisión técnica 21
- [x] Bug real en el modal de consentimiento IA: el botón "Activar" se quedaba en "Guardando…" sin terminar (confirmado probando en navegador). Fix: `AbortController` con timeout de 15s en el fetch, error mostrado dentro del propio modal (antes usaba el `error` global de Marketplace, que sustituía toda la vista), y cierre garantizado del modal en el camino de éxito antes del `router.push`
- [x] Segundo fix sobre el mismo modal: el guardado "funcionaba" (ya no se colgaba) pero no activaba Seguimiento de verdad — solo guardaba el consentimiento, no tocaba `Soluciones`. Corregido para que también añada "Seguimiento" a `Entrenadores.Soluciones`. Ver decisión técnica 19 (revisada)
- [x] BUG D: añadido "Metricas" al array hardcodeado `SOLUCIONES` de `/admin/entrenador/[email]/page.tsx` (antes solo tenía las 4 originales)
- [x] BUG E: botón "Borrar entrenador" + `DELETE /api/admin/entrenadores/[email]` (borra Airtable + usuario Supabase si existe). Ver decisión técnica 22
- [x] BUG A: cambio de contraseña self-service (`ChangePasswordModal.tsx`, botón 🔑 en Header). Ver decisión técnica 23
- [x] Landing pública "/" + página "/planes" + gate de plan base en "/dashboard" + validación Métricas-requiere-plan-base en admin. Ver decisiones técnicas 24-26. Correcciones sobre el brief original: la ruta de registro por token ya existente es `/signup` (no `/register`, esa no existe); no se creó `middleware.ts` (incompatible con el modelo de auth 100% client-side de este proyecto, ver decisión 24); no se crearon `<SeguimientoTab>`/`<CaptacionTab>`/`<RecuperacionTab>` porque Captación y Recuperación no tienen ninguna funcionalidad construida todavía (siguen en BACKLOG PRODUCTOS) — la pestaña "Clientes" ya existente sigue siendo la única funcionalidad real (Seguimiento). **No probado en navegador**
- [ ] Configurar SMTP en Supabase (Resend) — manual, fuera de Claude Code. Mientras no se haga, los emails de Supabase Auth (confirmación de alta, reset de contraseña) salen del mailer por defecto de Supabase, no de Resend
- [ ] **Supabase Auth → URL Configuration: Site URL debe ser `https://retaincoach.com` y Redirect URLs debe incluir `https://retaincoach.com/signup/confirm` Y `https://retaincoach.com/reset-password`** (fusionado con el pendiente de "link de reset apuntando a localhost", ver ESTADO ACTUAL para el diagnóstico completo con evidencia de logs) — manual, fuera de Claude Code, ninguna herramienta MCP disponible da acceso a esta configuración. Sin esto, tanto `emailRedirectTo` (alta) como `redirectTo` (reset de contraseña) caen al Site URL por defecto en vez de a las páginas reales de la app. **No confundir con `/auth/callback`** — esa ruta no existe en este repo, las rutas reales son `/signup/confirm` y `/reset-password`
- [ ] **Rellenar `NEXT_PUBLIC_JUANMI_WHATSAPP` con el número real** en `.env.local` y en Vercel (hoy vacío) — el botón "Activar ahora" del Marketplace no hace nada sin este valor
- [x] Templates de email en Resend: "Bienvenida Entrenador" y "Reset Contraseña" creados y publicados — ver sección RESEND TEMPLATES
- [x] Workflow n8n "Recepción entrenador" completado (búsqueda + rama existe/no existe + emails) y probado end-to-end con payload simulado — ver N8N WORKFLOWS
- [x] **Credencial Resend arreglada de verdad** en `HKcpklE9LbcDgder` ("Resend API (Header Auth)") — resuelto en esta sesión, no era un simple placeholder por pegar sino un header duplicado mal configurado (ver decisiones técnicas 35-36). Los emails de "Recepción entrenador" se envían correctamente, verificado con envíos reales
- [ ] Ejecutar manualmente el workflow n8n "Snapshot mensual" desde el editor de n8n (Schedule Trigger, no se puede disparar por API) y documentar el resultado aquí — manual
- [ ] **Añadir "Metricas" como opción del campo `Entrenadores.Soluciones`** en Airtable UI — ninguna herramienta MCP disponible permite editar choices de un select existente. No bloquea nada (la lógica de la app ya la contempla), simplemente nadie puede tener esa solución asignada hasta entonces — manual
- [x] Cambios UX: badge "💡 Análisis IA disponible" + botón "Ver métricas" en ficha de cliente, botón marketplace en Header, ocultar "Activar ahora" si en_uso, producto "Métricas y Estadísticas", modal de consentimiento IA para Seguimiento — ver decisiones técnicas 19-20. **No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta sesión) — solo verificado con `tsc --noEmit`, `eslint` y `next build`, los tres sin errores. Probar el golden path manualmente: login como `espartakofake@gmail.com`, abrir ficha de cliente, expandir el badge de análisis IA, click en 🏪 del Header, y si algún entrenador de prueba tuviera Soluciones=Metricas, el botón "Ver métricas"
- [ ] Cambiar password de María (`maria@example.com`) desde el panel admin — manual, no lo hizo Claude Code por ser dato sensible (ver Bloque 4.3 del brief)
- [ ] Verificar Bloque 6 del brief manualmente: valores de `Clientes.Estado`/`Entrenadores.Estado` sin residuos antiguos, nombre de la base Airtable (no "Untitled Base") — manual, checklist rápido
- [ ] Privacidad + política (Termly/Iubenda)
- [ ] Cláusula onboarding (DPA, procesamiento IA)
- [ ] Pre-venta con 3 entrenadores reales
- [ ] Limite de gasto Claude API ($10-15/mes)
- [x] Brief "/planes + Features dashboard/clientes + Admin check" (commit `b47ba23`, pusheado a `main`): `/planes` informativa-solo (Header sin Marketplace, headline/comparativa persuasivos de `content/plans-copy.ts`) + `/dashboard` con nueva sección "Tus planes" (WhatsApp CTA, nunca self-service) + 5 features en clientes (mensaje sugerido colapsable, notas del entrenador, registrar cliente con Tally pre-rellenado, dar de baja, filtro Activos/Inactivos) + verificado que la reestructuración admin previa ya existía (no se tocó). Ver decisiones técnicas 27-29. **No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta sesión) — solo verificado con `tsc --noEmit`, `eslint` y `next build`, los tres sin errores
- [x] Tally nuevo de alta de cliente creado (`tally.so/r/ODq4kK`) y webhook conectado a "Seguimiento - Alta cliente" — verificado con ejecuciones reales. La estructura real difiere de la spec original (los campos visibles llegan con el texto de la pregunta, no un slug) — ver N8N WORKFLOWS y decisión técnica 30
- [x] `NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL` rellenada en `.env.local` (`https://tally.so/r/ODq4kK`) y en Vercel (confirmado por el usuario)
- [x] Bug en nodo "Formatear datos" de "Seguimiento - Alta cliente": no extraía `objetivo`/`entrenamientos_objetivo`/`notas_iniciales`/`nombre`/`telefono`/`entrenador` — corregido y probado end-to-end con datos reales en esta sesión. Ver N8N WORKFLOWS y decisión técnica 30
- [x] Workflow n8n "Snapshot mensual" activado — verificado vía API n8n (`active: true`). Sigue pendiente verificar el conteo de su primera ejecución real contra Airtable (ver N8N WORKFLOWS)
- [x] Nota de drift resuelta: "Recepción entrenador" está confirmado **activo** en n8n (no era solo desactualización de docs) — riesgo real: la credencial Resend sigue siendo un placeholder, así que los emails de ese workflow fallarían hoy con submissions reales (ver pendiente de API key arriba)
- [x] Brief "Tareas Inmediatas" (6 tareas, esta sesión): Tarea 1 verificada sin cambios, Tarea 5 (filtro Alertas), Tarea 4 (tooltip resumen de alerta), Tarea 3 (link Tally guardado server-side + botón Copiar en ficha, verificado que n8n sobrescribe), Tarea 6 (métricas de entrenadores en /metricas), Tarea 2 (optimistic locking con campo `Last_modified` fórmula en Clientes/Reportes/Entrenadores). Ver decisiones técnicas 31-33. **No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta sesión) — solo verificado con `tsc --noEmit`, `eslint` y `next build`, los tres sin errores. Pendiente de probar manualmente: filtro Alertas, tooltip de resumen, botón Copiar del link Tally, gráficas nuevas de /metricas, y el flujo de conflicto 409 (editar el mismo cliente/entrenador desde Airtable UI mientras la app tiene la ficha abierta)
- [x] Brief "Próximo sprint: email + check-in" + bug de tooltip (esta sesión): Tarea 1 (credencial Resend arreglada de verdad + template HTML nuevo "Cuenta existente" + probado end-to-end con envíos reales confirmados), Tarea 2 (check-in semanal validado end-to-end con cliente y datos de prueba reales, alerta confirmada en Airtable) + 2 bugs graves encontrados y corregidos en "Seguimiento - Análisis Lunes" (nunca había estado activo; un cliente sin reportes bloqueaba el guardado de alertas de toda la semana) + BUG A del tooltip arreglado con portal. Ver ESTADO ACTUAL, N8N WORKFLOWS y decisiones técnicas 35-38. Verificado con `tsc --noEmit`, `eslint` y `next build` sin errores; cambios de n8n/Airtable/Resend verificados contra las APIs reales, no solo localmente
- [x] **Limpieza de la tabla `Clientes` en Airtable** (sesión siguiente): borrados 6 registros de prueba/basura — "Test Checkin Sprint" (+ sus 4 Reportes asociados), "gato"/`gatopaco@gmail.com`, "gato"/`gato@gmail.com`, "Juan"/`juan@example.com` (duplicado x2, Estado Perdido) y el registro corrupto sin Nombre/Email (`recIO8ikpWQFlJ9hr`, `#ERROR!` en Last_modified). **Se mantuvieron** los 3 clientes documentados como fixtures intencionales en la sección "Clientes de prueba en Airtable" de este mismo archivo (Juanmi, Carlos, Sofia) — son los que usan los logins reales de Supabase (`espartakofake@gmail.com`, `maria@example.com`) para probar la vista de entrenador, no basura. Tabla `Clientes` queda con exactamente esos 3 registros. **Sigue pendiente** (fuera de alcance de esta limpieza, que era solo sobre `Clientes`): el registro corrupto `recyqm5KowgHopbp5` en la tabla `Reportes` (sin Cliente vinculado, `#ERROR!` en Last_modified) — huérfano, no afecta a nada pero conviene borrarlo en algún momento
- [ ] Crear formulario en Tally para "Recepción entrenador" y conectar al webhook — manual (única pieza real que falta de ese workflow; todo el resto ya está verificado end-to-end)

---

## BACKLOG PRODUCTOS

1. **Referidos** — links únicos, tracking conversiones
2. **Captación** — quiz Tally + propuesta PDF
3. **Recuperación** — mensajes a clientes "Perdido"
4. **Dashboard mejorado** — más gráficas, predicciones
5. **Admin completo** — usuarios, facturación, reportes

---

## CONTACTO / PREGUNTAS

Si hay ambigüedad o necesitas context del negocio, pregunta en el chat principal.
