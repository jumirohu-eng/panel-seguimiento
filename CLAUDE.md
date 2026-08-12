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

Auth/API:
- Las API routes deben verificar el JWT de Supabase.
- Los endpoints de admin usan `getAuthenticatedAdminEmail()`.
- Los endpoints que modifican datos de un entrenador/cliente deben comprobar ownership/rol explícitamente.
- Los secretos nunca deben estar en frontend, Git o nodos de n8n.

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
