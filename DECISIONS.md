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

## DEC-2026-006 — Modelo de datos del check-in: solo capa cruda en Parte 1

**Fecha:** 2026-08-13
**Tipo:** Arquitectura / Modelo de datos
**Estado:** Implementada (parcial, a propósito)

### Contexto
El brief "RetainCoach MVP Parte 1" pedía separar claramente datos del cliente,
señales calculadas, análisis IA, alertas, acciones/intervenciones y resultado.
El criterio de terminado de esa Parte 1, sin embargo, solo exige que el cliente
registre datos y el entrenador los vea estructurados — no pide calcular señales
ni alertas nuevas todavía.

### Decisión
Se implementaron únicamente las tablas de datos crudos: `Campos_checkin` (config
por entrenador de qué campos están activos, con qué frecuencia, orden, y
definiciones de campos personalizados) y `Registros_checkin` (lo que registra el
cliente). Las tablas/lógica de Señales, Análisis IA, Alertas, Acciones y Resultado
quedan deliberadamente diferidas a Parte 2 — no se crearon tablas vacías ni lógica
sin pipeline real detrás.

### Por qué
Confirmado explícitamente por Juanmi: crear estructura sin el pipeline que la usa
añade complejidad sin valor. Ese modelo se diseñará junto con el motor de señales
en Parte 2.

### Importante
`Registros_checkin` no debe usarse nunca para almacenar análisis/alertas — ver
DEC-2026-007 (modelo EAV) y no reproducir el patrón de `Reportes` (que sí mezcla
datos crudos con `Análisis IA`/`Mensaje sugerido` en la misma fila; ese patrón
antiguo no se toca ni se reutiliza para el modelo nuevo).

### Siguiente paso
Parte 2: motor de señales + análisis longitudinal + alertas + acciones/intervenciones
sobre `Registros_checkin`.

---

## DEC-2026-007 — `Registros_checkin` es un modelo EAV insert-only

**Fecha:** 2026-08-13
**Tipo:** Arquitectura / Modelo de datos
**Estado:** Implementada

### Decisión
Una fila de `Registros_checkin` = un valor de un campo de un envío (Cliente,
Field_id, Tipo_registro, Valor, Fecha), no un envío completo con todos sus campos
en columnas fijas. Varias filas comparten la misma `Fecha` exacta cuando pertenecen
al mismo envío — se agrupan por esa coincidencia al leer (`GET /api/checkins`).
La tabla es **insert-only**: un cliente que corrige o repite su check-in del mismo
día crea filas nuevas, nunca sobrescribe las anteriores.

### Por qué
Instrucción explícita de Juanmi: "debe existir historial; no sobrescribir
simplemente el último valor". Un modelo EAV, además, permite campos personalizados
por entrenador sin tener que añadir columnas a una tabla Airtable cada vez (algo
que además es limitado por la propia API de Airtable, ver DEC-2026-008).

### Trade-off aceptado (watch-item, no resuelto)
Este modelo genera más filas que `Reportes` (una por campo activo por envío, no una
por envío). A la escala actual de RetainCoach es intrascendente. Si el volumen de
clientes/campos crece mucho, revisar límites de plan de Airtable — mismo tipo de
watch-item consciente que ya existe para `getClientesActivosPorEntrenador()`
(ver historial de decisiones previas en git, sesión "Auditoría multi-entrenador").

### Bug encontrado y corregido durante la implementación
`Registros_checkin.Valor` se guarda siempre como texto serializado (número,
booleano y arrays de selección múltiple incluidos) y se interpreta con el `Tipo`
del campo correspondiente en `Campos_checkin` al leer (`src/lib/checkinFields.ts`,
`serializarValor`/`deserializarValor`) — necesario porque una sola columna `Valor`
no puede ser simultáneamente número/booleano/texto/opción según el campo.

---

## DEC-2026-008 — Interpretar checkboxes de Airtable: comparar contra `=== true`, no `!== false`

**Fecha:** 2026-08-13
**Tipo:** Bug / Airtable API
**Estado:** Corregido

### Hallazgo
Durante la prueba E2E de `PUT /api/entrenador/checkin-config` (desactivar un campo
estándar), desactivar `dolor_zona` no se reflejaba: seguía apareciendo activo tanto
en la config del entrenador como en el formulario del cliente.

### Causa
La API de Airtable **omite los campos `checkbox` de la respuesta cuando su valor es
`false`** (no los devuelve como `false`, simplemente no aparecen en `fields`). El
código de `resolverCamposEfectivos()` (`src/lib/checkinFields.ts`) leía
`override.fields.Activo !== false` para decidir si un campo estaba activo — con el
campo omitido, `undefined !== false` evalúa `true`, así que un override desactivado
se interpretaba como activo.

### Fix
Cambiado a `override.fields.Activo === true` (y el mismo patrón para campos
personalizados) — un valor omitido/`undefined` ahora se interpreta correctamente
como `false`. La escritura (`PATCH`/`POST` con `Activo: false`) ya funcionaba bien;
el bug estaba solo en la lectura.

### Aprendizaje
Cualquier campo `checkbox` de Airtable leído desde código debe compararse con
`=== true`, nunca con `!== false` — la ausencia del campo en la respuesta es un
valor legítimo (`false`), no un caso "no sé". Revisar si este patrón aparece en
otro sitio del código si se toca lógica de checkboxes en el futuro (`Activo`,
`Es_estandar`, `Consentimiento_IA`, `Permite_marketing`, etc.).

### Verificación
Reproducido y confirmado corregido con la prueba E2E aislada de DEC-2026-009 (antes
del fix: assertion "dolor_zona debería quedar inactivo" fallaba dos veces; después
del fix, la misma prueba completa pasa sin fallos).

---

## DEC-2026-009 — Prueba E2E con fixtures aislados y desechables, no cuentas reales

**Fecha:** 2026-08-13
**Tipo:** Proceso / Validación
**Estado:** Aplicada

### Decisión
Para validar el check-in configurable end-to-end no se usaron clientes/entrenadores
reales (ni las fichas históricas de Juanmi/Carlos/Sofia/`espartakofake@gmail.com`/
`maria@example.com`) ni se tocó `Reportes`. Se creó un entrenador y un cliente
ficticios (`test-checkin-mvp1@example.com` / `test-checkin-mvp1-cliente@example.com`),
con usuarios Supabase obtenidos vía `generateLink`/`verifyOtp` (sin contraseña real,
mismo patrón ya usado en sesiones anteriores), se ejecutó el flujo completo contra
`next dev` local y las APIs reales de Airtable/Supabase, y se borró todo
(Entrenador, Cliente, filas de `Campos_checkin`/`Registros_checkin`, usuarios
Supabase) al terminar. Verificado post-limpieza que las 4 tablas afectadas quedaron
en su estado original.

### Por qué
Instrucción explícita de Juanmi: no generar datos de prueba sobre cuentas reales
para luego borrarlos, y no tocar `Reportes` histórico.

### Aprendizaje reutilizable
El script de prueba usado (creación de fixtures vía API REST de Airtable + tokens
Supabase vía `generateLink`/`verifyOtp` + llamadas HTTP contra `next dev` local) es
un patrón reproducible para futuras pruebas E2E de endpoints protegidos por
Supabase Auth sin necesitar contraseñas reales ni tocar datos de producción. No se
dejó como archivo en el repo (era un script temporal fuera de `src/`, borrado tras
la prueba) — si se repite a menudo, valdría la pena promoverlo a un script de
testing versionado.

---

## DEC-2026-010 — "Próximo check-in" contradictorio: causa real era una tarjeta del sistema antiguo, no un bug de cálculo del nuevo

**Fecha:** 2026-08-13
**Tipo:** Bug / UX
**Estado:** Corregido

### Hallazgo
Tras completar un check-in diario nuevo, `/cliente/dashboard` mostraba "próximo
check-in en ~3 días" — contradictorio con una frecuencia diaria.

### Causa
La tarjeta "Próximo check-in" de esa página nunca perteneció al sistema nuevo
(`Campos_checkin`/`Registros_checkin`, ver DEC-2026-006/007). Leía
`proximoCheckinDias` de `GET /api/cliente/perfil`, calculado sobre `Reportes`
(el Tally semanal antiguo, ciclo fijo de 7 días desde el último `Reporte`).
Ambos sistemas conviven en la misma página (por diseño, ver DEC-2026-006) pero
sin distinguirse visualmente, así que el conteo de un sistema totalmente
distinto se leía como si fuera del check-in que el cliente acababa de rellenar.

### Fix
- `calcularProximaDisponibilidad()` (`src/lib/checkinFields.ts`), función pura:
  diario → +1 día desde el inicio del día si ya se envió; semanal → +7 días
  desde el inicio de la semana si ya se envió; periódico → siempre `null` (sin
  cadencia fija). Nunca bloquea el envío — `Registros_checkin` sigue
  insert-only, esto es solo informativo.
- `GET /api/cliente/checkin` expone `proximaDisponibilidad` por frecuencia.
- `/cliente/dashboard` reemplaza el banner efímero (que desaparecía al
  completar el check-in, sin decir cuándo volver) por una sección persistente
  "Tu check-in" con estado real por frecuencia.
- La tarjeta antigua de Tally se relabeled a "Próximo check-in semanal
  (Tally)" con nota aclaratoria — no se tocó su lógica, sigue siendo correcta
  para lo que mide (el Tally semanal), solo estaba mal etiquetada en contexto.

### Aprendizaje
Cuando dos sistemas conviven a propósito en la misma pantalla (ver DEC-2026-006,
"convive en paralelo"), cualquier texto/estado que pueda leerse como
perteneciente a "el check-in" en general debe dejar explícito a cuál de los
dos sistemas pertenece. Un bug reportado como "cálculo incorrecto" puede tener
causa raíz en absencia de esa distinción, no en el cálculo en sí — verificar el
código real antes de asumir dónde está el número equivocado.

### Verificación
Prueba E2E dedicada con fixtures aislados (ver DEC-2026-012): tras un envío
diario, `proximaDisponibilidad` cae dentro de las siguientes 24-48h, nunca
~72h; tras un envío semanal, dentro de los siguientes 7 días; periódico nunca
tiene `proximaDisponibilidad`.

---

## DEC-2026-011 — Navegación a `/checkin-config`: mover el punto de entrada a `ClientesLista`, no al Header

**Fecha:** 2026-08-13
**Tipo:** Bug / UX / Navegación
**Estado:** Corregido

### Hallazgo
El entrenador no encontraba ningún acceso visible a `/checkin-config` pese a
que la página existía y funcionaba.

### Causa
El único punto de entrada era un botón en `Header.tsx` con la condición
`!isAdmin`. Un admin usando "Ver como entrenador" (decisión 45) mantiene
`isAdmin === true` en esa vista a propósito (para seguir viendo
`AdminNavDropdown`) — así que el botón nunca se mostraba en ese modo, que es
justo cómo Juanmi (admin+entrenador+cliente multi-rol) prueba la vista de
entrenador en la práctica.

### Fix
Botón "⚙️ Configurar check-in" movido al toolbar de `ClientesLista.tsx` (junto
a "+ Registrar cliente"). Ese componente se renderiza igual para un entrenador
real y para un admin en "Ver como entrenador" (mismo código, mismos props, ver
decisión 45) — un solo punto de entrada, visible en ambos casos, sin lógica
condicional de rol nueva que mantener. Se quitó el botón del Header para no
dejar dos puntos de entrada con condiciones de visibilidad distintas.

### Aprendizaje
Cualquier nueva navegación pensada "para el entrenador" debe verificarse
también contra el modo "Ver como entrenador" del admin (decisión 45) antes de
darla por completa — son dos rutas de código que comparten vista pero no
necesariamente el mismo `isAdmin`.

---

## DEC-2026-012 — Verificado sin bugs: frecuencia por campo y preservación de historial al reconfigurar

**Fecha:** 2026-08-13
**Tipo:** Verificación / Modelo de datos
**Estado:** Confirmada, sin cambios de código

### Contexto
El brief de corrección pedía revisar explícitamente si (a) el sistema soporta
frecuencias distintas por campo dentro de un mismo check-in (p. ej. Peso
semanal mientras Energía es diario) y (b) si desactivar/reactivar/reordenar/
cambiar la frecuencia de un campo destruye el historial en `Registros_checkin`.

### Verificación (no se encontró ningún bug, no se cambió código)
Probado con una prueba E2E dedicada (fixtures aislados, ver patrón de
DEC-2026-009):
- Cambiar la frecuencia de `peso` de periódico a semanal por `PUT
  /api/entrenador/checkin-config` lo mueve de sección sin afectar a
  `energia`/`entrenamiento_realizado`, que permanecen en diario — confirma que
  `agruparPorFrecuencia()` ya resuelve la frecuencia por campo de forma
  independiente, tal como estaba diseñado desde Parte 1 (ver DEC-2026-006/007).
- Desactivar `energia` (con historial ya existente) la quita del formulario del
  cliente pero `GET /api/checkins` sigue devolviendo el envío histórico con
  `energia` resuelto correctamente (nombre y valor) — porque `camposPorId` en
  esa ruta usa la lista completa de `resolverCamposEfectivos()`, sin filtrar
  por `activo`. Reactivar el campo lo devuelve al formulario sin alterar el
  historial. Reordenar (`Orden`) y cambiar `Frecuencia` tampoco tocan
  `Registros_checkin` en ningún punto del código — ambos viven exclusivamente
  en `Campos_checkin`.

### Por qué no hizo falta ningún fix
El modelo EAV insert-only (DEC-2026-007) y la separación config/datos crudos
(DEC-2026-006) ya garantizaban esto por diseño desde la implementación
original de Parte 1 — la tarea de esta sesión era confirmarlo con evidencia
real, no repararlo.

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
- Añadida `DEC-2026-006`: modelo de datos del check-in, solo capa cruda en Parte 1 (Señales/IA/Alertas/Acciones diferidas a Parte 2).
- Añadida `DEC-2026-007`: `Registros_checkin` como modelo EAV insert-only.
- Añadida `DEC-2026-008`: bug de interpretación de checkboxes de Airtable (`=== true`, no `!== false`), encontrado y corregido.
- Añadida `DEC-2026-009`: patrón de prueba E2E con fixtures aislados y desechables, sin tocar cuentas reales ni `Reportes`.
- Añadida `DEC-2026-010`: fix real del "próximo check-in" contradictorio (causa: tarjeta del sistema Tally antiguo, no un bug de cálculo del sistema nuevo).
- Añadida `DEC-2026-011`: navegación a `/checkin-config` movida de `Header.tsx` a `ClientesLista.tsx` (el gate `!isAdmin` la ocultaba en modo "Ver como entrenador" del admin).
- Añadida `DEC-2026-012`: verificado sin bugs que la frecuencia por campo y la preservación de historial al reconfigurar ya funcionaban correctamente por diseño.
