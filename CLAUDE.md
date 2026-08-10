# 🚀 CLAUDE.md — Dashboard Seguimiento para Entrenadores

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
Gráficas: Recharts
PDF: html2canvas + jspdf
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
Tabla Snapshots_entrenadores: [pendiente de crear, ver sección "Tabla Snapshots_entrenadores" más abajo]
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
| Teléfono | Texto | +34... formato |
| Entrenador | Texto | **EMAIL del entrenador** (no nombre, no Colaborador) — fuente de verdad para resolver el entrenador de un cliente |
| Objetivo | Select | Hipertrofia / Pérdida de peso / Tonificar / Rehabilitación |
| Estado | Select | Activo / Pausado / Perdido |
| Entrenamientos_objetivo | Número | Cuántos/semana planificados |
| Reportes | Link | Auto a tabla Reportes |
| Link_recordatorio | Fórmula | Link de WhatsApp (wa.me) con mensaje de recordatorio semanal precargado. Distinto de `Reportes.Link_alerta` (ese usa el Mensaje sugerido) |
| Entrenador_nuevo | Colaborador único | **Vestigial, no usar.** Casi nunca está poblado en datos reales (solo 1 de 4 clientes de prueba). No es fuente fiable de entrenador — usar siempre el campo `Entrenador` (texto) |

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
| Link_alerta | Fórmula | Link de WhatsApp (wa.me) con el `Mensaje sugerido` precargado, solo si ese campo no está vacío. Consumido directamente por el botón WhatsApp en `/dashboard` (vista de cliente) — no reconstruir el link a mano en el código |
| Cliente_Estado | Lookup | Estado (Activo/Pausado/Perdido) del cliente, para la Interface de Airtable "Resumen lunes". No se usa desde esta app |
| Estado semanal | Fórmula | Badge calculado (Pendiente/Alerta/Bien) para la Interface de Airtable, replica la lógica de `StatusBadge.tsx`. No se usa desde esta app |
| Cliente_Entrenador | Lookup (vía `Entrenador_nuevo`) | **No fiable, no usar para agrupar por entrenador.** Depende del campo vestigial `Entrenador_nuevo` de Clientes, casi nunca poblado. Para resolver el entrenador de un reporte, cruzar `Cliente_Email` contra `Clientes.Entrenador` |

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
| Soluciones | Multi-select | Seguimiento / Captación / Recuperación / Referidos |
| Estado | Select | Activo / Prueba / Inactivo |
| Fecha_alta | Date | Formato europeo D/M/YYYY |
| Precio_mensual | Currency | € precisión 0 |
| Notas | Texto largo | Histórico manual + observaciones |
| Link_whatsapp | Formula | `https://wa.me/<tel sin símbolos>?text=<mensaje>` a partir de Teléfono + Nombre |
| Último_login | DateTime | Europe/Madrid. Se actualiza desde código (POST /api/admin/log-activity), NO es fórmula |
| Permite_marketing | Checkbox | Consentimiento para usar métricas en agregados de marketing. Default desmarcado |

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
│ │ ├── page.tsx # "/" redirect a /login
│ │ ├── login/
│ │ │ └── page.tsx # Login page (Supabase)
│ │ ├── signup/
│ │ │ └── page.tsx # Signup vía token (NEW)
│ │ ├── reset-password/
│ │ │ └── page.tsx # Reset password
│ │ ├── dashboard/
│ │ │ └── page.tsx # Entrenador: sus clientes. Admin: AdminResumenView (resumen del negocio)
│ │ ├── admin/
│ │ │ ├── page.tsx # Lista de entrenadores + alta (solo jumirohu@gmail.com). ?nuevo=1 abre el form
│ │ │ └── entrenador/[email]/page.tsx # Ficha: editar, sparkline, invitación, WhatsApp, resetear contraseña
│ │ └── api/
│ │ ├── clientes/route.ts # GET clientes filtrados por entrenador
│ │ ├── reportes/route.ts # GET reportes del cliente
│ │ └── admin/
│ │ ├── invite/route.ts # POST generar invitación
│ │ ├── invitaciones/route.ts # GET historial invitaciones
│ │ ├── regenerate/route.ts # POST regenerar token
│ │ ├── cancel/route.ts # POST cancelar invitación
│ │ ├── create-user/route.ts # POST crear usuario Supabase directo (evita rate limit)
│ │ ├── reset-password/route.ts # POST genera password temporal y la aplica en Supabase
│ │ ├── log-activity/route.ts # POST actualiza Último_login (fire-and-forget desde login)
│ │ ├── resumen-negocio/route.ts # GET métricas de negocio, alertas y métricas de impacto
│ │ └── entrenadores/
│ │ ├── route.ts # GET lista + POST crear entrenador
│ │ └── [email]/route.ts # GET ficha (clientes activos, snapshots, invitación) + PUT actualizar
│ ├── components/
│ │ ├── EnergyChart.tsx
│ │ ├── WorkoutsChart.tsx
│ │ ├── WeightChart.tsx
│ │ ├── StatusBadge.tsx
│ │ ├── SuggestedMessage.tsx
│ │ ├── AIAnalysis.tsx
│ │ ├── ClientSelector.tsx
│ │ ├── Header.tsx
│ │ ├── AdminResumenView.tsx # Tarjetas, gráficas, alertas y accesos rápidos del /dashboard admin
│ │ └── ExportPDF.tsx
│ └── lib/
│ ├── supabase.ts # Cliente Supabase (anon key)
│ ├── supabase-server.ts # Cliente Supabase servidor (service role key)
│ ├── auth-server.ts # Lógica de auth backend
│ ├── admin.ts # Constante ADMIN_EMAIL (NEXT_PUBLIC_ADMIN_EMAIL con fallback)
│ └── airtable.ts # Helpers para Airtable API
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

---

## N8N WORKFLOWS

### "Seguimiento - Resumen&Alerta" ✅ ACTIVO
Webhook Tally (path `Tallyseguimiento`) → Formatear datos → Buscar cliente → Crear reporte (Airtable)

### "Seguimiento - Análisis Lunes" ✅ (ver n8n)
Cada lunes 9am → Clientes activos → Claude analiza → actualiza Análisis IA + Mensaje sugerido

### "Seguimiento - Limpieza de datos antiguos" ⏸️ INACTIVO
Backup de reportes >60 días, mantener inactivo.

### "Recepción entrenador" ⏸️ INACTIVO (NEW, id D3Jnswx0Hh5THEev)
Webhook Tally (path `TallyEntrenadores`) → Formatear datos → Crear entrenador (Airtable, tabla Entrenadores)
Crea el registro con Estado="Prueba" fijo, sin Precio_mensual, sin generar invitación automática. Extrae del formulario: Nombre, Email, Teléfono, Soluciones_interes, Num_clientes_actual, Como_conocio.
**Pendiente:** crear el formulario en Tally con esos labels de campo exactos y conectarlo al webhook. Activar manualmente cuando esté listo.

### Workflow "Recordatorios viernes" ⏳ NO CONSTRUIDO
Pendiente para después.

### Workflow "Snapshot mensual" ⏳ pendiente en esta sesión
Cron día 1 de cada mes 9am (revisar hora exacta al crearlo) → lee Entrenadores → cuenta por Estado (Activo/Prueba) → crea registro en Snapshots_entrenadores (Fecha, Total_entrenadores, Total_activos, Total_prueba) → lee Clientes activos (una sola llamada, agrupados por Entrenador) → crea un registro en Snapshots por entrenador (Entrenador_email, Fecha, Clientes_activos). Se crea INACTIVO, sin activarlo.

---

## CONVENCIONES DE CÓDIGO

### Componentes React
```typescript
// Nombrado PascalCase, props tipadas, siempre exportar default
export default function MyComponent({ prop1, prop2 }: Props) {
  return <div>...</div>;
}

interface Props {
  prop1: string;
  prop2?: number;
}
```

### API Routes
```typescript
// Ubicación: src/app/api/[ruta]/route.ts
// GET, POST, etc. como exports

export async function POST(request: Request) {
  // Validar auth (JWT de Supabase)
  // Validar body
  // Llamar Airtable / Supabase
  // Devolver JSON
}
```

### Rutas protegidas
```typescript
// Verificar `Authorization: Bearer <token>` 
// Devolver 401 si no válido
// Verificar permisos (email === admin, etc.)
```

### Error handling
```typescript
try {
  // operación
} catch (error) {
  return Response.json(
    { error: error.message },
    { status: 500 }
  );
}
```

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

- [x] Admin dashboard: generar invitaciones + historial
- [x] Login/signup vía token
- [x] Admin: tabla Entrenadores + Snapshots, ficha completa por entrenador, dark mode, logout
- [x] Reset de contraseña + registro de Último_login + botón WhatsApp
- [x] /dashboard admin: resumen del negocio (tarjetas, gráficas, alertas, métricas de impacto) — **reestructurado en esta sesión en 3 páginas** (`/dashboard`, `/admin`, `/metricas`), ver decisión técnica 13
- [x] Workflow n8n "Recepción entrenador" (queda INACTIVO)
- [x] Bugs de vista de cliente: exportar PDF, orden Análisis IA/Mensaje sugerido, botón WhatsApp directo, tooltip en badge Alerta
- [x] Endpoint `/api/admin/alertas-stats` (histórico de alertas para /metricas)
- [x] Tabla Airtable "Snapshots_entrenadores" + workflow n8n "Snapshot mensual" (INACTIVO) que la puebla
- [ ] Configurar SMTP en Supabase (Resend) — manual, fuera de Claude Code
- [ ] Crear formulario en Tally para "Recepción entrenador" y conectar al webhook — manual
- [ ] Privacidad + política (Termly/Iubenda)
- [ ] Cláusula onboarding (DPA, procesamiento IA)
- [ ] Pre-venta con 3 entrenadores reales
- [ ] Limite de gasto Claude API ($10-15/mes)

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
