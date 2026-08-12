# Registro de Decisiones Técnicas — RetainCoach

> Registro compartido de decisiones de ingeniería y contexto operativo relevante para el desarrollo de RetainCoach.
> Fuente de contexto para Claude Code y otros agentes que trabajen sobre este repositorio.
>
> **Estrategia/producto/mercado:** se registra en Airtable → `Registro Maestro`.
> **Ingeniería/implementación:** se registra aquí.

## Cómo usar este archivo

Antes de tomar una decisión técnica relevante:
1. Revisar este archivo.
2. Comprobar si existe una decisión anterior relacionada.
3. Si una nueva propuesta contradice una decisión anterior, explicitar el motivo y la evidencia antes de cambiarla.
4. Registrar aquí decisiones técnicas relevantes, bugs con aprendizaje reutilizable, cambios de arquitectura, seguridad e infraestructura.

No registrar cada cambio trivial de código. Registrar aquello que pueda afectar decisiones futuras o evitar repetir un error.

---

## DEC-2026-001 — Registro técnico compartido

**Fecha:** 2026-08-13  
**Tipo:** Proceso  
**Estado:** Activa

### Decisión
Mantener `DECISIONS.md` en la raíz del repositorio para que Claude Code pueda encontrarlo y leerlo al iniciar nuevas sesiones.

### Contexto
RetainCoach se desarrolla en este repositorio y Claude Code realiza cambios y commits sobre él. La memoria persistente del proyecto no está disponible, por lo que GitHub actúa como memoria técnica versionada.

### División de responsabilidades
- **GitHub / `DECISIONS.md`:** decisiones técnicas, arquitectura, implementación, seguridad, infraestructura, bugs relevantes y aprendizajes técnicos.
- **Airtable / `Registro Maestro`:** estrategia, mercado, validaciones comerciales, pricing, hipótesis de negocio y decisiones de producto.
- **Documentos del proyecto:** fuente de verdad para evidencia y contexto documentado.

### Regla
Una decisión estratégica puede tener una consecuencia técnica. En ese caso se registra la decisión estratégica en Airtable y la decisión de implementación derivada aquí, enlazándolas cuando sea posible.

### Importante
`DECISIONS.md` no sustituye al código ni a la evidencia. Si el código, las pruebas o la documentación contradicen una entrada antigua, hay que investigar la discrepancia antes de asumir que la entrada sigue vigente.

---

## DEC-2026-002 — Estado multi-rol y tabla Admins

**Fecha:** 2026-08-12  
**Tipo:** Arquitectura / Autenticación  
**Estado:** Implementada

El rol `admin` dejó de depender de un email fijo en variables de entorno y pasó a resolverse mediante la tabla `Admins` de Airtable. Esto permite que una misma identidad pueda tener múltiples roles. El detalle histórico y las pruebas están documentados en `CLAUDE.md` y en las decisiones técnicas previas del proyecto.

---

## DEC-2026-003 — Supabase Auth compartido para clientes

**Fecha:** 2026-08-12  
**Tipo:** Autenticación  
**Estado:** Implementada

Los clientes utilizan el mismo Supabase Auth que entrenadores/admin; no existe una tabla de credenciales `clientes_login` separada. El rol se resuelve contra Airtable. Esta decisión evita duplicar el sistema de autenticación y mantiene una identidad común para los distintos roles.

---

## DEC-2026-004 — Crear clientes requiere rol de entrenador

**Fecha:** 2026-08-13  
**Tipo:** Seguridad / Autorización  
**Estado:** Implementada

### Hallazgo
Durante la auditoría de arquitectura y seguridad se detectó que `POST /api/clientes` solo comprobaba que existiera un usuario autenticado. Eso permitía potencialmente que cualquier usuario autenticado intentara crear clientes, aunque la capacidad corresponde a un entrenador.

### Decisión
`POST /api/clientes` debe exigir que el email autenticado exista en `Entrenadores`. Los usuarios admin que además tengan una fila en `Entrenadores` pueden crear clientes por el modelo multi-rol.

### Acción
Añadido el gate mediante `getEntrenadorByEmail(email)` en `src/app/api/clientes/route.ts`.

### Commit
`488ab44448e593506d5bba751601423022a0daba`

### Aprendizaje
Autenticación (`usuario logueado`) no equivale a autorización (`capacidad para ejecutar la acción`). Cada endpoint de escritura debe comprobar explícitamente el rol/ownership requerido.

---

## DEC-2026-005 — Criterio para cerrar la migración

**Fecha:** 2026-08-13  
**Tipo:** Proceso / Calidad  
**Estado:** Activa

La migración no se considera cerrada hasta completar, en este orden:
1. auditoría de arquitectura antigua → actual;
2. auditoría n8n ↔ Airtable ↔ Supabase;
3. auditoría de seguridad/multirol;
4. pruebas reales de navegador;
5. corrección de hallazgos;
6. actualización de `CLAUDE.md` y `DECISIONS.md`;
7. declaración explícita de migración cerrada.

La documentación por sí sola no cuenta como validación. Cuando sea posible, se debe comprobar el comportamiento contra el código, APIs/datos reales y navegador.

---

## Estado de la auditoría 2026-08-13

### Arquitectura
- Migración de admin fijo → `Admins` + multirol implementada.
- Supabase Auth compartido para admin/entrenador/cliente implementado.
- Se endureció `POST /api/clientes` durante esta auditoría.

### n8n ↔ Airtable ↔ Supabase
- Los workflows principales están documentados como activos, salvo `Recordatorios viernes`, que no está construido.
- `Seguimiento - Análisis Lunes` tiene el filtro contra `ultimoReporteId` nulo documentado en decisiones anteriores.
- `Seguimiento - Alta cliente` actualiza el cliente existente en lugar de crear duplicados.
- La app tiene retry ante 429 de Airtable.
- La auditoría específica de todos los workflows contra el esquema actual todavía debe completarse directamente en n8n.

### Seguridad
- Los endpoints revisados verifican JWT y ownership donde corresponde.
- Queda pendiente una matriz sistemática de pruebas de autorización por rol.

### Navegador
- Quedan pruebas visuales/funcionales reales de los flujos principales y multirol.

---

## Historial de cambios

### 2026-08-13
- Creado `DECISIONS.md` como registro técnico compartido.
- Establecida la separación entre decisiones estratégicas (Airtable) y técnicas (GitHub).
- Añadida la decisión de mantener este archivo en la raíz para facilitar su lectura por Claude Code.
- Añadida `DEC-2026-004`: crear clientes requiere rol de entrenador.
- Añadida `DEC-2026-005`: criterios para declarar cerrada la migración.
- Actualizado el estado de la auditoría de migración.
