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

## DEC-2026-013 — Lanzamiento del check-in desacoplado de la configuración de campos

**Fecha:** 2026-08-13
**Tipo:** Arquitectura / Producto
**Estado:** Implementada

### Contexto
Hasta ahora, un campo de check-in se hacía visible al cliente en cuanto el
entrenador lo activaba en `/checkin-config` — no había forma de preparar la
configuración sin que ya estuviera en producción para el cliente, ni de
programar una fecha de apertura.

### Decisión
Nuevo campo `Entrenadores.Checkin_disponible_desde` (DateTime, opcional),
independiente de `Campos_checkin`. Semántica de un único campo cubre los tres
estados pedidos:
- vacío → borrador (cliente no ve nada, aunque haya campos `Activo=true`);
- fecha pasada/presente → lanzado;
- fecha futura → programado, se abre solo al llegar esa fecha.

Se resuelve con una función pura (`resolverLanzamiento()`,
`src/lib/checkinFields.ts`) que compara la fecha contra `Date.now()` en cada
request — **sin cron ni workflow de n8n nuevo**. El "auto-abrir" en la fecha
programada es simplemente que la próxima vez que el cliente cargue la página,
la comparación ya da `true`.

### Por qué un campo separado y no un estado dentro de `Campos_checkin`
El lanzamiento es una propiedad del check-in del entrenador como conjunto, no
de un campo individual — vive naturalmente en `Entrenadores` (que ya tiene
otros flags de estado del entrenador, como `Consentimiento_IA`), no en
`Campos_checkin` (que es la config de CADA campo). Evita tener que propagar
un "lanzado" a las 11+ filas de campos de cada entrenador.

### Compatibilidad con uso real ya existente
`jumirohu@gmail.com` tenía check-ins reales de su cliente (mismo email,
cuenta multi-rol) desde antes de este cambio (ver actividad detectada en
DEC-2026-010). Para no romper esa continuidad, se hizo un backfill puntual:
`Checkin_disponible_desde` = timestamp del momento del deploy, solo en su fila
de `Entrenadores`. El resto de entrenadores no tenían uso real de
`Registros_checkin`, así que arrancan en borrador (comportamiento nuevo por
defecto) sin que nadie pierda datos ni acceso.

### Endpoints
`PUT /api/entrenador/checkin-config/lanzamiento` (`{fecha: string|null}`,
gate de rol-entrenador). `GET/POST /api/cliente/checkin` ahora resuelven
`lanzado` antes de exponer campos o aceptar envíos — en borrador/programado
sin llegar la fecha, el GET devuelve `lanzado:false` con campos vacíos (nunca
se filtra qué campos tiene configurados el entrenador) y el POST responde
`403`.

### Verificación
Prueba E2E con fixtures aislados (mismo patrón que DEC-2026-009): borrador
bloquea GET/POST (403 confirmado), programar con fecha futura mantiene
bloqueado, "lanzar ahora" abre de inmediato, una fecha ya pasada se resuelve
como lanzado sin ninguna acción manual adicional (confirma el mecanismo de
auto-apertura), "volver a borrador" revierte todo correctamente.

---

## DEC-2026-014 — Tres tipos de check-in independientes, con programación y lanzamiento propios

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Modelo de datos
**Estado:** Implementada

### Contexto
En Parte 1, diario/semanal/periódico compartían un único lanzamiento
(`Entrenadores.Checkin_disponible_desde`) y cada campo tenía una única
frecuencia. El brief de Parte 1.5 exige que los tres tipos sean completamente
independientes: cada uno con su propia disponibilidad, próxima fecha y
programación.

### Decisión
Nueva tabla Airtable `Checkin_tipos` (`tblsiRHYa7SFro2Th`): una fila por
`(Entrenador, Tipo)`, creada de forma perezosa (igual que los overrides de
`Campos_checkin`) solo cuando el entrenador configura ese tipo por primera
vez. Contiene `Disponible_desde` (mismas 3 semánticas borrador/programado/
lanzado que el campo legacy, pero por tipo), `Dia_semana` (solo semanal),
y `Modo_periodico`/`Fecha_inicio_periodico`/`Intervalo_dias_periodico`/
`Dia_mes_periodico` (solo periódico).

### Migración sin pérdida
`Entrenadores.Checkin_disponible_desde` se deja intacto (deprecado, no
borrado). Si un tipo no tiene fila propia en `Checkin_tipos`, hereda ese
campo legacy — el día del deploy, los tres tipos siguen viendo exactamente
el mismo estado que tenían antes (compartido), y cada uno se independiza
solo cuando el entrenador lo toca desde la UI nueva. Ningún cliente pierde
acceso ni ve un cambio de comportamiento sin que el entrenador actúe.

### Limitación documentada (no se inventa una solución compleja)
`Dia_mes_periodico` en un mes más corto que el día configurado (p.ej. día 31
en febrero) cae al último día válido de ese mes — no hay lógica de
"reprogramar al mes siguiente".

### Verificación
Prueba E2E con fixtures aislados (patrón DEC-2026-009): lanzar diario y
periódico dejando semanal en borrador confirma independencia real (el
cliente ve `diario.lanzado=true`, `semanal.lanzado=false`,
`periodico.lanzado=true` simultáneamente); `periodico.proximaFecha` se
calcula correctamente según el día del mes configurado.

---

## DEC-2026-015 — Un campo puede pertenecer a varios tipos a la vez, sin tabla intermedia

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Modelo de datos
**Estado:** Implementada

### Contexto
El modelo de Parte 1 limitaba cada campo a una única frecuencia
(`Campos_checkin.Frecuencia`, singleSelect). El brief pide que un campo
pueda asignarse a Diario, Semanal, Periódico o varios simultáneamente
(ej. Energía → Diario + Semanal), y pide explícitamente auditar si hace
falta una entidad intermedia para modelar esa relación N:M.

### Decisión — auditoría: no hace falta tabla intermedia
`Campos_checkin` ya es "una fila = un campo de un entrenador". La relación
N:M campo↔tipo se resuelve con un `multipleSelects` en esa misma fila
(`Campos_checkin.Tipos`, choices `diario`/`semanal`/`periodico`) — una tabla
intermedia solo se justificaría si la relación necesitara datos propios
(p.ej. fecha de asignación por tipo), y no es el caso.
`Campos_checkin.Frecuencia` (el `singleSelect` viejo) se deja intacto y
deprecado: `resolverCamposEfectivos()` (`src/lib/checkinFields.ts`) lee
`Tipos` primero, y si esa fila todavía no lo tiene (overrides creados en
Parte 1), cae a `[Frecuencia]` — así ningún campo pierde silenciosamente su
asignación al migrar.

### Migración de datos aplicada
Backfill puntual sobre las 11 filas reales de `Campos_checkin` (todas de
`jumirohu@gmail.com`, único entrenador con config real): las 8 filas que
corresponden a ids todavía activos en el catálogo (fatiga, peso, ánimo,
medidas, comentario, entrenamiento_realizado, energía, adherencia) recibieron
`Tipos = [Frecuencia]` explícito. Las 3 filas de ids retirados
(`dolor_nivel`, `dolor_zona`, `reflexion_semanal`, ver DEC-2026-016) se
dejaron sin tocar — nunca se leen desde el catálogo activo, así que
backfillear `Tipos` en ellas no tendría efecto y no aporta valor.

### `Registros_checkin.Tipo_registro`: auditado, sin cambios necesarios
Un *envío* ocurre siempre dentro de un tipo concreto (el cliente rellena la
sección diaria o la semanal en un momento dado), aunque el *campo* pueda
pertenecer también a otro tipo. Un mismo `Field_id` puede aparecer con
`Tipo_registro='diario'` un día y `'semanal'` otro — ya soportado por el
modelo EAV sin cambios de esquema.

### Verificación
Prueba E2E: reasignar `energia` de `[diario, semanal]` (default) a
`[diario, periodico]` la mueve de la sección semanal a la periódica del
cliente sin afectar a otros campos, confirmado contra la API real.

---

## DEC-2026-016 — Catálogo estándar Parte 1.5: `dolor` compuesto, `comentario` unificado, ids retirados con fallback histórico

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Modelo de datos
**Estado:** Implementada

### Decisión
- `dolor_nivel` + `dolor_zona` se unifican en un único campo lógico `dolor`
  (nuevo valor de `TipoCampoCheckin`, compuesto `{nivel, zona}` serializado
  a JSON en `Registros_checkin.Valor`). Exclusivo de campos estándar — un
  entrenador nunca puede crear un campo personalizado de tipo `dolor`
  (`CampoPersonalizadoModal.tsx` no lo ofrece).
- `comentario` + `reflexion_semanal` se unifican en un único `comentario`,
  ahora asignable a varios tipos (`semanal` + `periodico` por defecto).
- Los tres ids retirados (`dolor_nivel`, `dolor_zona`, `reflexion_semanal`)
  **no se borran de Airtable ni se reescriben**. Pasan a
  `CAMPOS_ESTANDAR_DEPRECADOS` (`src/lib/checkinFields.ts`), usada solo por
  el path de lectura histórica (`resolverNombreTipoHistorico()`, consumida
  por `GET /api/checkins`) para que envíos antiguos con esos ids sigan
  resolviendo nombre/valor legible. Nunca se ofrecen en `CheckinConfigView`
  ni en el formulario del cliente.

### Por qué
Instrucción explícita del brief: "Dolor/molestias + zona es un único campo
lógico" y "Eliminar Comentario/reflexión; queda solo Comentario" — pero
también "no borres datos" y "no cambies silenciosamente el significado
histórico" (sección 14). Retirar el id del catálogo activo sin destruir las
filas históricas satisface ambos requisitos a la vez.

### Verificación
`GET /api/checkins` sobre un cliente de prueba con envíos que incluían
`energia` (id activo) tras desactivarlo sigue devolviendo nombre/valor
correctos — mismo mecanismo que cubre los ids retirados.

---

## DEC-2026-017 — Regla "No he entrenado": mecanismo genérico, sin campos dependientes aplicados hoy

**Fecha:** 2026-08-14
**Tipo:** Producto / Modelo de datos
**Estado:** Implementada (mecanismo), sin aplicar a ningún campo

### Contexto
El brief pide que "si el cliente marca No he entrenado, los campos
dependientes del entrenamiento deben deshabilitarse", pero también advierte
explícitamente "no inventes dependencias" que no existan.

### Hallazgo de la auditoría
Revisado el catálogo estándar definitivo (9 campos: Entrenamientos
realizados, Energía, Fatiga, Dolor/molestias, Estado de ánimo, Adherencia,
Peso, Medidas, Comentario) — **ninguno depende estructuralmente de haber
entrenado**. Energía/Fatiga/Ánimo se miden como estado general del día, no
específicamente del entrenamiento; Dolor puede registrarse sin haber
entrenado; Peso/Medidas/Comentario/Adherencia tampoco. Confirmado
explícitamente con Juanmi antes de implementar cualquier dependencia.

### Decisión
Se construyó el mecanismo completo y reutilizable — `CampoCheckinDef.dependeDe?:
{ campoId, valorRequerido }`, deshabilitado visual en `CampoInput.tsx` (prop
`disabled`), y rechazo real en backend (`campoDisponible()` en
`checkinFields.ts`, aplicado en `POST /api/cliente/checkin` antes de
serializar cada campo) — pero **no se asignó a ningún campo del catálogo
actual**. Queda listo para cuando se añada un campo de detalle de sesión de
entrenamiento (fuera de alcance de Parte 1.5) que sí dependa genuinamente de
`entrenamiento_realizado`.

### Verificación
El backend ignora silenciosamente cualquier valor de un campo con
`dependeDe` no satisfecha, aunque la petición lo incluya manipulada
directamente — verificado por inspección de código (`route.ts` filtra antes
de `serializarValor`); no hay campo real hoy para reproducirlo end-to-end.

---

## DEC-2026-018 — Notas privadas del cliente: tabla nueva en Supabase Postgres, aislada por completo de Airtable/IA

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Privacidad
**Estado:** Implementada

### Contexto
El brief pide una libreta personal del cliente ("Mis notas") con una regla
absoluta: el entrenador nunca puede verla, ninguna IA la lee, no pertenece a
`Registros_checkin`, no genera señales/alertas/predicciones, y no se envía a
proveedores de IA. Se preguntó explícitamente a Juanmi dónde debía vivir
este dato — respuesta: Supabase Postgres, no Airtable.

### Decisión
Primera tabla Postgres propia del proyecto (hasta ahora Supabase solo se
usaba como IdP, nunca `.from()` sobre una tabla propia): `notas_privadas`
(`user_id` referenciando `auth.users`, `contenido`, `updated_at`), con RLS
(`auth.uid() = user_id`) en las cuatro operaciones. Nuevo helper
`createSupabaseUserClient(accessToken)` (`src/lib/supabase-server.ts`) que
usa la clave anónima + el JWT del propio usuario — `GET/PUT
/api/cliente/notas` nunca usan `supabaseAdmin` (service role) para esta
tabla, así la RLS aplica de verdad contra `auth.uid()` en vez de depender de
que el código de la API recuerde siempre filtrar por usuario.

### Por qué Postgres y no una tabla Airtable nueva
Una tabla Airtable nueva habría sido más rápida de construir (reutilizando
`airtable.ts`), pero la exclusión de IA/entrenador dependería de que el
código nunca la consultara desde esos flujos — una garantía de convención,
no estructural. Con Postgres + RLS, la exclusión es estructural: ningún
flujo de Airtable/n8n/IA puede llegar a esta tabla aunque alguien lo
intentara por error, porque literalmente no está en Airtable y la RLS
bloquea cualquier usuario que no sea el dueño de la fila.

### Verificación
Prueba E2E: el cliente escribe y relee su propia nota correctamente; una
consulta REST directa a Supabase con el token del **entrenador** (usuario
distinto) sobre `notas_privadas` devuelve 0 filas — RLS confirmada, no solo
la ausencia de una ruta de API para el entrenador.

---

## DEC-2026-019 — Cliente activo/inactivo: `Perdido` reutilizado, gate real en backend, reactivación sin pérdida de historial

**Fecha:** 2026-08-14
**Tipo:** Seguridad / Autorización / Producto
**Estado:** Implementada

### Hallazgo de la auditoría
`Clientes.Estado` (singleSelect `Activo`/`Pausado`/`Perdido`) ya modelaba
exactamente "Activo → Inactivo/perdido" — no hacía falta ningún campo ni
estado nuevo. El hueco real: **ningún endpoint de cliente comprobaba
`Estado`** antes de conceder acceso. Un cliente dado de baja (`Estado =
'Perdido'`) seguía pudiendo loguearse, ver su dashboard y enviar check-ins
sin ningún bloqueo backend.

### Decisión
Nueva función `getClienteActivoAutenticado()` (`src/lib/auth-server.ts`,
mismo patrón que `getAuthenticatedAdminEmail()`), devuelve un resultado
discriminado (`{ok:true, cliente} | {ok:false, status: 401|403|404}`) para
seguir distinguiendo no-autenticado / sin-ficha / inactivo. Aplicada en
`GET/POST /api/cliente/checkin`, `GET /api/cliente/perfil` y `GET/PUT
/api/cliente/notas` — las tres devuelven `403` a un cliente `Perdido`.
Nuevo botón "Reactivar" en `ClienteFicha.tsx` (visible solo si `estado ===
'Perdido'`), mismo patrón de `PATCH` con optimistic locking que "Dar de
baja". `ClientesLista.tsx` ya ocultaba `Perdido` de la vista por defecto
(`filtroEstado = 'activos'`) y ya tenía un filtro "Inactivos" para
encontrarlo — no hizo falta ningún cambio ahí.

### Por qué no se creó un estado nuevo
"Inactivo/perdido" no equivale a eliminado — `Perdido` ya representaba
exactamente eso desde antes de esta tarea. Añadir un estado paralelo habría
duplicado semántica sin necesidad.

### Verificación
Prueba E2E: tras dar de baja al cliente de prueba, `GET /api/cliente/perfil`,
`GET/POST /api/cliente/checkin` y `GET /api/cliente/notas` devuelven `403`
los cuatro; reactivar devuelve el acceso (`200`) sin alterar el historial de
`Registros_checkin` ya guardado (verificado leyendo `GET /api/checkins`
tras la reactivación).

---

## DEC-2026-020 — Dashboard cliente: limpieza de piezas del sistema Tally antiguo, X/Y de entrenamientos con limitación documentada

**Fecha:** 2026-08-14
**Tipo:** Producto / UX
**Estado:** Implementada

### Decisión
Eliminadas del dashboard del cliente tres piezas que leían del sistema Tally
antiguo (`Reportes`) pero se mostraban sin distinguirse del check-in nuevo,
repitiendo el problema ya corregido en DEC-2026-010 para otra tarjeta:
gráfica "Peso (últimos 3 meses)", "Mensaje de tu entrenador" (IA) y la
métrica independiente de energía de 30 días. No se tocó ningún dato
subyacente en Airtable — solo UI. La tarjeta "Próximo check-in semanal
(Tally)" ya estaba correctamente etiquetada (DEC-2026-010) y se dejó igual.

Nueva sección "Entrenamientos esta semana: X/Y":
**Y** = `Clientes.Entrenamientos_objetivo` (campo ya existente, configurado
por el entrenador, descrito en Airtable como objetivo semanal) — única
fuente real hoy, reutilizada tal cual (pedido explícito del brief: "no
dupliques el modelo"). **Limitación documentada:** es un objetivo fijo, no
varía semana a semana; no existe hoy un sistema de asignación semanal
variable, y construir uno queda fuera de alcance de esta parte. **X** =
días distintos con `entrenamiento_realizado=true` en `Registros_checkin`
dentro de la semana en curso, resolviendo correcciones del mismo día
(insert-only) quedándose con el envío más reciente por día
(`contarEntrenamientosSemana()`, `src/lib/checkinFields.ts`).

### Verificación
Prueba E2E: cliente marca "No he entrenado" (false) en su check-in diario;
`entrenamientosSemana` responde `{realizados: 0, asignados: 4}` — coincide
con `Entrenamientos_objetivo=4` del fixture y 0 días entrenados esa semana.

---

## DEC-2026-021 — Parte 1.5 fusionada a `main` y en producción tras promoción manual desde Vercel

**Fecha:** 2026-08-14
**Tipo:** Proceso / Despliegue
**Estado:** Aplicada

### Contexto
El plan original de Parte 1.5 (ver contexto de esta sesión) indicaba explícitamente
no fusionar a `main` ni desplegar a producción hasta revisión. Juanmi promovió un
deployment intermedio de la rama `retaincoach-checkin-parte-1.5` (commit `0d8b1a3`)
directamente a producción desde el panel de Vercel ("Promote to Production"), sin
pasar por `main` en git — probado desde `retaincoach.com` con una cuenta de cliente
real, donde detectó que faltaba el botón "Cambiar contraseña" (añadido después, en
el commit `7a4e929`).

### Decisión
Confirmado explícitamente con Juanmi: se hizo fast-forward merge de `main` a la
punta de la rama (`main` → `7a4e929`, sin conflictos) y push. Esto deja `main` y lo
que ya estaba en producción consistentes, y restablece el flujo normal de despliegue
de Vercel (push a `main` → build → producción) en vez de depender de una promoción
manual de un commit de rama que quedaría fuera de sincronía con `main` para siempre.

### Aprendizaje
Una "promoción a producción" manual desde el panel de Vercel puede desacoplar lo que
sirve `retaincoach.com` de lo que dice `main` en git, sin que quede ningún rastro en
el historial de commits — solo visible consultando el historial de deployments de
Vercel (`target: "production"` en un deployment cuyo `githubCommitRef` no es
`main`). Si en una sesión futura algo en producción no coincide con lo esperado por
`main`, comprobar el historial de deployments de Vercel antes de asumir que el
código no llegó a desplegarse.

---

## DEC-2026-022 — "Pendiente de activación" es un estado derivado, no un valor nuevo de `Clientes.Estado`

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Autenticación
**Estado:** Implementada

### Contexto
El brief de Parte 1.5.1 pide respetar cuatro estados: "pendiente de activación",
"activo", "inactivo/perdido" y "reactivado", y explícitamente prohíbe "crear una segunda
lógica de estados". `Clientes.Estado` (Airtable, singleSelect) solo tiene tres opciones
reales: `Activo`/`Pausado`/`Perdido` (ver DEC-2026-019) — no existe ni existía un cuarto
valor para "pendiente".

### Decisión
No se añade un valor `Pendiente` a `Clientes.Estado`. Un cliente creado por su entrenador
recibe `Estado: 'Activo'` exactamente igual que hoy (sin cambios en `POST /api/clientes`).
"Pendiente de activación" se calcula en el momento de pintar la ficha del entrenador
(`GET /api/clientes/[id]/invitacion`) comprobando si existe un usuario de Supabase con el
email del cliente y `email_confirmed_at` presente (`findSupabaseUserByEmail`, ya existía
en `supabase-server.ts`) — no se guarda en Airtable. "Reactivado" tampoco es un estado
nuevo: sigue siendo la transición `Perdido → Activo` ya implementada en DEC-2026-019.

### Por qué
El acceso real de un cliente nunca dependió de `Clientes.Estado` para la fase "no ha
completado el registro todavía" — un cliente sin cuenta de Supabase confirmada
simplemente no puede iniciar sesión, con independencia de lo que diga `Estado`. Guardar
un segundo campo de "activación de cuenta" en Airtable duplicaría una verdad que ya vive
en Supabase Auth (`email_confirmed_at`) y crearía la posibilidad de que ambos se
desincronizasen. `getClienteActivoAutenticado()` (el gate real de activo/inactivo, ver
DEC-2026-019) no se tocó.

### Verificación
Prueba E2E: un cliente recién creado por el entrenador aparece con `cuentaActiva: false`
en `GET /api/clientes/[id]/invitacion` antes de completar el registro, `true` justo
después de confirmar el email (simulado vía Admin API, ver DEC-2026-024), y el login con
`signInWithPassword` falla mientras el email no está confirmado — sin que `Clientes.Estado`
cambiara en ningún momento de esa secuencia.

---

## DEC-2026-023 — Eliminado `POST /api/clientes/[id]/crear-acceso` (generaba contraseñas temporales)

**Fecha:** 2026-08-14
**Tipo:** Seguridad / Producto
**Estado:** Implementada (reemplazo, no solo eliminación)

### Contexto
Antes de Parte 1.5.1, la única forma de dar acceso web a un cliente era que el
entrenador pulsara "Crear acceso" en `ClienteFicha.tsx`, que llamaba a
`POST /api/clientes/[id]/crear-acceso`: generaba una contraseña aleatoria en el servidor
y la mostraba una vez al entrenador para que se la pasara al cliente por su cuenta. El
brief de esta parte prohíbe explícitamente ese patrón: "no generar ni enviar contraseñas
iniciales" — el cliente debe crear su propia contraseña.

### Decisión
Se elimina el endpoint y el botón "Crear acceso" por completo (no se deja como código
muerto: seguía permitiendo generar contraseñas server-side, lo cual contradice
directamente la política nueva). Se sustituye por el flujo de invitación (token → el
cliente crea su propia contraseña en `/cliente/signup`). No había ninguna decisión previa
registrada en `DECISIONS.md` sobre `crear-acceso`, así que esto no reemplaza una entrada
anterior de este archivo, pero sí un comportamiento que llevaba en producción desde antes
de las decisiones documentadas aquí.

### Verificación
`grep` confirma que ningún otro archivo del repo referenciaba `crear-acceso` tras
eliminarlo; `next build`/`tsc`/`eslint` sin errores tras el borrado.

---

## DEC-2026-024 — Bug de filtro de Airtable: un campo "link to record" en `filterByFormula` no se puede comparar contra el id del registro enlazado

**Fecha:** 2026-08-14
**Tipo:** Bug / Airtable API
**Estado:** Corregido

### Hallazgo
Durante la prueba E2E de regeneración de invitación de cliente, regenerar no invalidaba
el token anterior (`GET /api/signup/cliente/validate` sobre el token viejo seguía
devolviendo `valid: true` en vez de `410`).

### Causa
`getInvitacionClienteActivaByClienteId()` filtraba con
`FIND("<clienteId>", ARRAYJOIN({Cliente})) > 0`, donde `Cliente` es un campo "link to
another record" hacia `Clientes`. Dentro de una fórmula de Airtable, `ARRAYJOIN()` sobre
un campo enlazado se resuelve contra el **valor del campo primario del registro enlazado**
(`Clientes.Nombre`), no contra su `record id`. La fórmula buscaba el id del cliente dentro
de una lista de nombres de cliente, así que nunca encontraba coincidencia — la invitación
activa anterior nunca se localizaba ni se cancelaba.

### Fix
Se filtra por `Entrenador` (campo de texto plano, sí es fiable en `filterByFormula` — el
llamador ya comprobó ownership antes de llegar aquí) y se afina en JavaScript comparando
`record.fields.Cliente` — que, a diferencia de una fórmula, sí es un array de record ids
reales cuando se lee vía la API REST normal — contra el `clienteId` buscado.

### Aprendizaje
Un campo "link to another record" nunca debe usarse dentro de `FIND()`/`ARRAYJOIN()` en
`filterByFormula` para comparar contra un record id — solo sirve para comparar contra el
valor mostrado (campo primario) del registro enlazado. Para filtrar por record id de un
campo enlazado, filtrar por otro campo fiable en la fórmula (texto/email) y afinar en
código con el array de ids que sí devuelve la API. Revisar si este patrón aparece en
cualquier `filterByFormula` futuro que toque un campo `multipleRecordLinks`.

### Verificación
Prueba E2E dedicada: generar invitación A (token1), regenerar (token2 ≠ token1),
`validate(token1)` → `410` (Cancelado), `validate(token2)` → `200 valid:true`. Antes del
fix, `validate(token1)` devolvía `200` incorrectamente.

---

## DEC-2026-025 — CORRECCIÓN: el SMTP de Supabase Auth sí está configurado; el 500 anterior era el rechazo del dominio `@example.com`, no un fallo de infraestructura

**Fecha:** 2026-08-14
**Tipo:** Corrección de diagnóstico / Infraestructura
**Estado:** Confirmada

### Decisión anterior que se reemplaza
DEC de la sesión de Parte 1.5.1 (documentada en `CLAUDE.md`, sin número propio en este
archivo) afirmaba: "el SMTP de Supabase Auth no está configurado — `supabase.auth.signUp()`
falla con 500 y no crea el usuario [...] afecta igual al signup de entrenador". **Esa
afirmación era incorrecta** y queda reemplazada por esta decisión.

### Motivo del cambio
Juanmi revisó los logs de Auth del proyecto (`jcijxhxdjabxdujldzml`) y encontró el error
subyacente real detrás del 500: `gomail: could not send email 1: 550 "Invalid \`to\`
field. Please use our testing email address instead of domains like example.com..."`. Es
decir, el proveedor SMTP rechazaba específicamente el dominio de pruebas `example.com`
(una restricción propia del entorno de pruebas de Supabase, documentada por Supabase para
evitar que proyectos en el plan gratuito/pruebas envíen a dominios reservados), no un
fallo general de configuración.

### Evidencia recogida en esta sesión
1. **Comparación de código:** `src/app/signup/page.tsx` (entrenador) y
   `src/app/cliente/signup/page.tsx` (cliente) llaman a `supabase.auth.signUp()` de forma
   idéntica (mismo cliente `@/lib/supabase`, mismo shape `{email, password, options:
   {emailRedirectTo}}`). `/api/signup/complete` y `/api/signup/cliente/complete` son
   estructuralmente paralelos (mismo patrón, solo cambian los helpers de
   `Invitaciones`/`Invitaciones_cliente`). No hay diferencia de código entre ambos flujos
   que explique un comportamiento distinto.
2. **Prueba con email real:** `supabase.auth.signUp({ email:
   'jumirohu+retaincoach-diag-<ts>@gmail.com', password })` (alias `+tag` de una bandeja
   real y controlable, dominio `gmail.com`, no `example.com`) — **sin error**, usuario
   creado sin confirmar (pendiente de activación real), tal como se espera.
3. **Logs de Auth de Supabase** (vía `query_logs`) para esa misma petición: `POST /signup`
   → `status:200`, evento `user_confirmation_requested` — ninguna traza de
   `gomail`/`could not send`/500 en ningún punto del flujo (búsqueda explícita, 0
   resultados), a diferencia del caso `@example.com` que sí deja ese error en los logs.
4. **Flujo completo de punta a punta con ese email real**, contra la app real
   (`next dev` + Airtable real + Supabase real): cliente creado por el entrenador →
   invitación generada → `signUp()` real sin error → `POST /api/signup/cliente/complete`
   (200, invitación marcada Usada) → login rechazado antes de confirmar (`400 email_not_
   confirmed`, correcto) → confirmación (link de confirmación válido generado vía Admin
   API para el mismo usuario ya creado por `signUp()`, ejercitando el endpoint real
   `/verify` de Supabase tal como lo haría el click del email) → login normal funciona →
   `GET/PUT /api/cliente/onboarding` funciona, onboarding completado y persistido. 13/13
   comprobaciones OK. Confirmado también en los logs de Auth: `/token` con
   `grant_type=password` devuelve `400 email_not_confirmed` antes de confirmar y `200`
   después.

### Límite de lo demostrado
No se hizo click en el email realmente recibido en la bandeja (sin acceso a esa bandeja
en esta sesión) — el paso de "confirmación" se completó generando un segundo link válido
para el mismo usuario vía Admin API y consumiéndolo contra el endpoint real de Supabase,
en vez de extraer el token del email efectivamente entregado. El envío real por SMTP se
verificó de forma independiente y suficiente contra los logs de Auth (sin error), pero la
entrega final a la bandeja de Gmail no se confirmó visualmente.

### Decisión
1. El signup de cliente (Parte 1.5.1) y el de entrenador comparten el mismo mecanismo y
   ambos funcionan correctamente contra un dominio de email real — no hay bug de código.
2. No se cambia nada en la configuración de Supabase ni de SMTP — no había nada que
   arreglar.
3. **No se implementa ningún workaround para `@example.com`** (instrucción explícita) —
   los fixtures de pruebas E2E de este proyecto deben seguir usando `@example.com` salvo
   que se necesite ejercitar específicamente el envío real de email (caso en el que debe
   usarse un alias `+tag` de un email real y controlable, nunca un dominio inventado).
4. Se retira "Configurar el SMTP de Supabase Auth" de los bloqueantes de
   `CLAUDE.md` — no era un bloqueante real.

### Aprendizaje
Un 500 en una prueba automatizada con emails ficticios (`@example.com`,
`test@test.com`, etc.) contra un proveedor de email real puede ser el proveedor
rechazando el dominio de prueba, no un fallo de infraestructura. Antes de diagnosticar
"servicio mal configurado" a partir de un error así, hay que mirar el mensaje de error
completo del proveedor subyacente (aquí, los logs de Auth de Supabase lo decían
explícitamente) y, si es posible, repetir la prueba con un dominio real antes de darlo
por confirmado. La sesión anterior no llegó a mirar el log subyacente y asumió la causa
más genérica a partir del código HTTP (500) y el mensaje corto de la SDK
("Error sending confirmation email"), sin desglosar el motivo real del rechazo.

---

## DEC-2026-026 — Objetivos: el progreso se agrega por `Field_id` sin exigir que la fuente esté asignada al mismo tipo de check-in que la periodicidad del objetivo

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Modelo de datos
**Estado:** Implementada (corrige un diseño intermedio de esta misma sesión, nunca llegó a commitearse)

### Contexto
Parte 1.5.2 pide objetivos configurables por cliente (nombre, periodicidad diario/semanal/
mensual, meta, unidad, fecha de vigencia, fuente de progreso) con progreso calculado desde
`Registros_checkin`, usando como ejemplo explícito: "Entrenamientos — semanal — 4 —
sesiones".

### Diseño inicial (descartado antes de terminar la sesión)
La primera implementación exigía que el campo fuente estuviera asignado
(`Campos_checkin.Tipos`) al mismo tipo de check-in que correspondería a la periodicidad del
objetivo (diario→diario, semanal→semanal, mensual→periódico), y filtraba
`Registros_checkin` también por `Tipo_registro` al calcular el progreso.

### Por qué se descartó
Auditando los datos reales del proyecto se confirmó que `entrenamiento_realizado` (el campo
que da progreso al ejemplo "Entrenamientos" del propio brief) solo tiene `Tipos: ['diario']`
para el único entrenador con override real (`jumirohu@gmail.com`) — y el catálogo estándar
en código (`CAMPOS_ESTANDAR`) tampoco lo asigna a `semanal` por defecto. Con el diseño
inicial, crear el objetivo "Entrenamientos — semanal" tal como lo describe el propio brief
habría sido **imposible** (la validación lo habría rechazado) o, si se hubiera saltado la
validación, el progreso siempre habría dado 0 (ningún `Registros_checkin` real tiene
`Tipo_registro='semanal'` para ese campo, porque el cliente solo lo rellena en el check-in
diario).

### Decisión
El progreso de un objetivo se calcula agregando `Registros_checkin` por `Field_id` dentro de
la ventana de tiempo de la periodicidad del objetivo (hoy/semana/mes), **sin filtrar por
`Tipo_registro`** — un campo que el cliente solo rellena en el check-in diario puede
alimentar perfectamente un objetivo semanal o mensual (se suman/cuentan sus envíos dentro de
esa ventana, venga del check-in que venga). `validarFuenteObjetivo()` solo exige que el
campo exista, esté activo y sea de tipo `si_no`/`numero` — ya no exige coincidencia de tipo.

`PERIODICIDAD_A_TIPO_CHECKIN` (diario→diario, semanal→semanal, mensual→periódico) se
mantiene, pero pasa a tener un único propósito: decidir en qué sección de
`/cliente/checkin` se muestra el objetivo (UX), no de dónde sale su progreso.

### Por qué no es un problema de doble contabilización
`calcularProgresoDesdeCheckins()` agrupa por día (quedándose con el envío más reciente de
ese día, igual que ya hacía Parte 1.5 para "Entrenamientos esta semana") antes de contar/
sumar — así que si el mismo `Field_id` llegara a rellenarse dos veces el mismo día desde
tipos de check-in distintos, solo cuenta una vez.

### Verificación
Prueba E2E: objetivo "Entrenamientos" (semanal, meta 3, fuente `entrenamiento_realizado`,
que solo vive en el check-in diario) — tras 3 envíos diarios en la misma semana (uno vía
`POST /api/cliente/checkin` real, dos backdateados directamente en Airtable para simular
días anteriores), el progreso pasa de 0/3 a 3/3 y `completado=true`. El objetivo aparece en
`checkin.semanal.objetivos` y explícitamente NO en `checkin.diario.objetivos`, confirmando
que la periodicidad del objetivo (no la del campo fuente) decide dónde se muestra.

---

## DEC-2026-027 — Retirada de Tally alcanza solo a "clientes nuevos", no al flujo semanal existente

**Fecha:** 2026-08-14
**Tipo:** Producto / Infraestructura
**Estado:** Implementada (parcial, a propósito)

### Contexto
El brief de Parte 1.5.2 pide auditar y retirar la dependencia de Tally, con el objetivo
final explícito: "Clientes + onboarding + check-ins + objetivos + progreso dentro de
RetainCoach, **sin dependencia de Tally para nuevos clientes ni check-ins**" — y advierte
explícitamente "no borrar históricos de Reportes ni tablas antiguas a ciegas" y "si algo
requiere migración, documentarlo y no romperlo".

### Auditoría (antes de tocar nada)
Vía `n8n_list_workflows`/`n8n_get_workflow`: los 5 workflows ya documentados en `CLAUDE.md`
siguen activos (`Recepción entrenador`, `Seguimiento - Análisis Lunes`,
`Seguimiento - Resumen&Alerta`, `Seguimiento - Alta cliente`, `Snapshot mensual`), más un
sexto no documentado hasta ahora: `Seguimiento - Limpieza de datos antiguos` (**inactivo**,
archiva `Reportes` a `Archivo` antes de borrarlos — no se activó, no se tocó).

De estos, la única dependencia que afecta a **clientes nuevos** es
`Seguimiento - Alta cliente` (webhook del formulario Tally al que apuntaba
`Clientes.Link_tally_alta`, generado por `POST /api/clientes`) — el resto
(`Seguimiento - Resumen&Alerta` + `Seguimiento - Análisis Lunes`) es el flujo semanal de
`Reportes`, que **no depende del check-in in-app** (nunca lo hizo, desde Parte 1.5, ver
DEC-2026-006) y sigue en uso real por clientes existentes (`jumirohu@gmail.com`/
`reccN567mhDPMes36`, ver actividad real documentada en DEC-2026-010).

### Decisión
Se retira únicamente la generación del enlace de alta por Tally para clientes nuevos —
`POST /api/clientes` ya no genera `Link_tally_alta` (lo que antes recogía ese formulario:
objetivo, notas iniciales, entrenamientos por semana, ahora lo cubren el onboarding nativo
de Parte 1.5.1 y los Objetivos de esta parte). El webhook `Seguimiento - Alta cliente` en
n8n **no se desactiva** — simplemente deja de recibir tráfico nuevo porque ya no se
distribuye el link que lo dispara; un cliente antiguo que todavía tenga ese link guardado
seguiría pudiendo usarlo sin error.

El flujo Tally semanal → `Reportes` → `Seguimiento - Análisis Lunes` **no se toca** —
seguirá activo para quien lo use. Apagarlo es la migración mayor que ya dejó explícitamente
abierta DEC-2026-006 ("decidir si/cuándo migrar Tally → check-in in-app"); esta sesión no
la resuelve porque haría eso, sin haberlo pedido explícitamente, rompería el uso real de
hoy de al menos un cliente real.

### Por qué no se borra nada de `Reportes`
No se tocó el workflow inactivo de limpieza/archivado ni se borró ninguna fila de
`Reportes`/`Archivo` — la instrucción del brief es explícita ("no borrar históricos... a
ciegas") y esta sesión no tenía ningún motivo nuevo para hacerlo.

### Verificación
Prueba E2E: `POST /api/clientes` ya no devuelve `linkTallyAlta` en la respuesta ni escribe
`Link_tally_alta` en Airtable para un cliente nuevo. Lectura directa de n8n confirma que
ningún workflow fue modificado ni (des)activado durante esta sesión.

---

## DEC-2026-028 — `/planes` no re-comprobaba el acceso: página sin salida tras conceder un plan

**Fecha:** 2026-08-14
**Tipo:** Bug / UX / Routing
**Estado:** Corregido

### Hallazgo
Reportado: un entrenador de prueba con `Seguimiento` concedido desde Admin seguía viendo
"Solicita acceso a un plan" en su dashboard.

### Investigación
Se auditó el flujo completo antes de tocar nada: `tienePlanBase()` (`src/lib/productos.ts`),
`PUT /api/admin/entrenadores/[email]` (escribe `Soluciones` en Airtable), `GET
/api/entrenador/perfil` (lee `Soluciones` del entrenador autenticado) y el gate de
`src/app/dashboard/page.tsx` (`if (!tienePlanBase(perfil.soluciones)) router.push('/planes')`).
Se reprodujo el ciclo completo contra la API real y Airtable real con un fixture aislado:
crear entrenador sin soluciones → `perfil.soluciones=[]` → admin concede `Seguimiento` vía
el mismo PUT que usa la ficha de Admin → Airtable confirma `Soluciones: ["Seguimiento"]` →
`GET /api/entrenador/perfil` ya devuelve `["Seguimiento"]` → `tienePlanBase()` da `true`.
**Todo el ciclo de datos funciona correctamente** — no hay bug de persistencia, lectura,
identificación de entrenador, nombre del producto ni en `tienePlanBase()` en sí.

El bug real está en `src/app/planes/page.tsx`: la página a la que `/dashboard` redirige
cuando `tienePlanBase()` es `false` **nunca vuelve a comprobar nada** — no llama a
`/api/entrenador/perfil`, no llama a `tienePlanBase()`, no tiene ningún `router.push` salvo
el de "sin sesión → `/login`". Un entrenador que aterriza ahí porque en ese momento no
tenía plan se queda viendo esa página para siempre, aunque el admin le conceda un plan
segundos después — recargar `/planes` no cambia nada porque la página es estática respecto
al plan. La única forma de "arreglarlo" sin tocar código era navegar manualmente a
`/dashboard` (URL directa) o cerrar sesión y volver a entrar (que sí pasa por `/dashboard`
y sí revalúa). Esto explica exactamente el síntoma reportado: el dato en Airtable ya era
correcto, pero la pantalla en la que se quedó la cuenta de prueba nunca lo llegó a
consultar de nuevo.

### Decisión
`src/app/planes/page.tsx` replica ahora, al cargar, el mismo chequeo que ya hace
`src/app/dashboard/page.tsx` (rol `admin` → `/dashboard`; `tienePlanBase(soluciones)` →
`/dashboard`; si ninguno aplica, se queda mostrando la página). No se cambió
`tienePlanBase()`, no se tocó el modelo de `Soluciones` ni ningún endpoint de Admin, no se
concedió acceso manualmente a ninguna cuenta real.

### Por qué esta y no otra causa
Se descartaron explícitamente, con evidencia, las demás causas posibles pedidas en el
brief: persistencia (Airtable confirma el valor tras el PUT), lectura (`GET
/api/entrenador/perfil` devuelve el valor recién escrito, sin desfase), identificación del
entrenador (mismo `email` de principio a fin, `getEntrenadorByEmail` resuelve el mismo
registro para el PUT de Admin y el GET del propio entrenador), nombre/ID del producto
(`'Seguimiento'` coincide exactamente entre `SOLUCIONES_BASE`, el choice real del campo
`Soluciones` en Airtable, y el botón de la ficha de Admin), y `tienePlanBase()` (lógica
trivial y correcta, probada). No se encontraron entrenadores duplicados en Airtable
(comprobado por email normalizado) que pudieran causar una lectura/escritura desalineada.

### Verificación
Prueba E2E contra la API real: sin `Seguimiento` → `tienePlanBase=false`; se concede →
`true`; se quita → `false`; se vuelve a conceder → `true`; se comprueba que `Referidos`
solo y `Captación` sola no interfieren entre sí (otros planes/productos intactos).
`tsc --noEmit`, `eslint` y `next build` sin errores.

---

## DEC-2026-029 — Retirada completa de Tally (reemplaza a DEC-2026-027)

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Infraestructura / Producto
**Estado:** Implementada

### Decisión anterior que se reemplaza
DEC-2026-027 acotó la retirada de Tally solo a "clientes nuevos", dejando activo a
propósito el flujo semanal `Seguimiento - Resumen&Alerta` → `Reportes` →
`Seguimiento - Análisis Lunes` porque la cuenta real del usuario (`jumirohu@gmail.com`)
lo usaba activamente y esa sesión no tenía "confirmación explícita" para apagarlo.

### Motivo del cambio
El brief de Parte 1.5.3 pidió explícitamente retirar Tally por completo. Antes de tocar
nada se señaló la contradicción con DEC-2026-027 (regla de `CLAUDE.md`) y se preguntó
directamente: el usuario confirmó "no tengo clientes activos y no necesito conservar el
flujo semanal Tally → Reportes → Análisis Lunes IA como funcionalidad operativa", y
aceptó explícitamente perder el análisis IA semanal sin sustituto hasta que exista un
motor de señales propio en Parte 2.

### Auditoría previa a borrar (vía `n8n_list_workflows`/`n8n_get_workflow`)
6 workflows confirmados: `Recepción entrenador` (alta de entrenadores vía Tally, sin
relación con clientes/check-ins), `Seguimiento - Análisis Lunes` (IA sobre `Reportes`),
`Seguimiento - Resumen&Alerta` (webhook Tally semanal → `Reportes`),
`Seguimiento - Alta cliente` (webhook Tally de alta de cliente, ya huérfano desde
DEC-2026-027), `Snapshot mensual` (lee Airtable directamente, sin Tally) y
`Seguimiento - Limpieza de datos antiguos` (inactivo, archiva `Reportes`→`Archivo`, sin
relación con Tally).

### Decisión
1. **Eliminados permanentemente de n8n** (no solo desactivados, `n8n_delete_workflow`):
   `Recepción entrenador`, `Seguimiento - Análisis Lunes`, `Seguimiento - Resumen&Alerta`,
   `Seguimiento - Alta cliente`. `Recepción entrenador` se incluyó en el alcance aunque no
   toca clientes/check-ins, por decisión explícita del usuario al preguntarse.
2. **Se mantienen intactos**: `Snapshot mensual` (no depende de Tally) y
   `Seguimiento - Limpieza de datos antiguos` (inactivo, sigue sin activarse — no se
   activó ni se tocó en esta sesión).
3. **Código de la app**: `linkTallyAlta`/`tieneAlerta`/`alertaResumen` eliminados de
   `Cliente` (tipo, `GET /api/clientes`, UI). `StatusBadge.tsx` (nunca se importaba
   desde ningún sitio — código muerto real, no relacionado con Tally per se pero
   descubierto durante esta limpieza) y `estadoReporte.ts` eliminados. `ClienteFicha`
   ya no calcula el botón de WhatsApp a partir del último `Reporte`/alerta — usa
   siempre `Clientes.Link_recordatorio`. `Link_tally_alta` se quitó de `ClienteFields`
   (la app deja de leerlo; la columna de Airtable no se toca). Variable de entorno
   `NEXT_PUBLIC_TALLY_ALTA_CLIENTE_URL` (ya sin ningún uso en código, confirmado por
   grep antes de tocarla) retirada de `.env.example`.
4. **Datos históricos: conservados como solo lectura, decisión explícita.** `Reportes` y
   `Archivo` no se borran. `GET /api/reportes` sigue funcionando (lectura, gate de
   ownership sin cambios). `getReportesConMensajeSugerido()`/
   `getArchivoConMensajeSugerido()` (usadas por `/api/admin/alertas-stats` y
   `/api/admin/metricas-negocio`, métricas de negocio del admin) no se tocan — el
   usuario eligió explícitamente conservarlas para esos dashboards. La sección de
   `ClienteFicha` se relabeled a "Reportes semanales (histórico Tally)" con una nota
   ("ya no llegan reportes nuevos") y solo se renderiza si el cliente tiene reportes
   (para no mostrar una sección vacía a clientes que nunca usaron Tally).

### Por qué no se tocó `Reportes`/`Archivo` en sí
Instrucción explícita: "no borres datos históricos si son necesarios para auditoría o
integridad, pero sí elimina la lógica operativa que ya no utilizamos". Los dashboards de
negocio del admin siguen necesitando ese histórico para calcular métricas ya existentes
(alertas históricas, MRR, etc.) — borrar los datos habría roto esas métricas sin
necesidad, cuando lo que había que eliminar era la generación de nuevos datos vía Tally,
no lo ya recogido.

### Verificación
`grep -rni tally src` tras el cambio solo devuelve un comentario histórico explicativo
(`api/cliente/onboarding/route.ts`, sin funcionalidad) y las dos referencias intencionales
de `ClienteFicha` ("histórico Tally"). `n8n_list_workflows` tras el cambio confirma 2
workflows activos + 1 inactivo, ninguno de los 4 borrados. `tsc --noEmit`, `eslint` y
`next build` sin errores. Prueba E2E confirma que `/api/reportes` no se tocó (fuera del
alcance de la prueba, sin cambios de código) y que ninguna ruta de Tally sigue
respondiendo desde la app.

---

## DEC-2026-030 — "Mis notas": interfaz eliminada por completo, tabla Postgres conservada por decisión explícita

**Fecha:** 2026-08-14
**Tipo:** Producto / Privacidad
**Estado:** Implementada (parcial, a propósito)

### Contexto
El brief pedía auditar "Mis notas" (UI, rutas, API, tabla/modelo, RLS) y, si no tenía
uso real, eliminarla de forma completa — "no simplemente ocultarla".

### Hallazgo antes de borrar la tabla
Antes de ejecutar un `DROP TABLE` sobre `notas_privadas` se comprobó su contenido real
(sin leer el texto de las notas, solo metadatos — la tabla es privada por diseño, ver
DEC-2026-018): 1 fila, escrita el mismo día de esta sesión (2026-08-14), perteneciente a
`jumirohu@gmail.com` (la cuenta real del usuario, en su rol de cliente). No era un dato
de prueba desechable.

### Decisión
Se preguntó explícitamente antes de proceder. El usuario pidió: eliminar la interfaz de
la aplicación (cliente, y confirmar que no existía nada equivalente para
entrenador/admin — no existía, `notasEntrenador` en `ClienteFicha` es una función
distinta y no se toca), pero **no borrar la tabla ni sus datos**.

Eliminado por completo: `src/app/cliente/notas/page.tsx`, `src/app/api/cliente/notas/
route.ts`, el bloque "Mis notas" de `/cliente/dashboard`, y `createSupabaseUserClient()`
en `supabase-server.ts` (quedó sin ningún otro consumidor tras borrar la ruta que lo
usaba). **No tocado**: la tabla `notas_privadas` en Supabase Postgres, su RLS, ni su
única fila real.

### Estado resultante (documentado a propósito)
`notas_privadas` queda como una tabla huérfana: existe en Supabase, tiene RLS y 1 fila
real, pero ningún endpoint de la app la usa ya. Esto es una excepción deliberada a la
regla general "no dejar un sistema medio vivo sin función" — aquí la tabla no representa
un flujo operativo a medio retirar, sino el único contenedor de un dato privado real que
el usuario pidió expresamente conservar. Si en el futuro se decide borrar esta tabla,
debe volver a confirmarse explícitamente antes (mismo criterio que cualquier
`DROP TABLE`/`DROP` de datos reales).

### Verificación
`grep -rn "notas_privadas\|cliente/notas\|createSupabaseUserClient" src` tras el cambio
no devuelve nada. Prueba E2E: `GET /api/cliente/notas` → 404, `GET /cliente/notas` → 404.
Consulta directa a Supabase tras todos los cambios de código confirma `count(*) = 1` en
`notas_privadas` (sin alteración). `tsc --noEmit`, `eslint` y `next build` sin errores.

---

## DEC-2026-031 — Programación de check-ins en lenguaje claro, sin añadir hora del día

**Fecha:** 2026-08-14
**Tipo:** Producto / UX
**Estado:** Implementada

### Contexto
El brief pedía expresar la programación de check-ins en lenguaje claro ("Cada lunes",
"Cada 7 días", "El día 1 de cada mes") y mostrar siempre la próxima apertura, con
ejemplos que incluían una hora concreta ("Hora: 09:00").

### Decisión
Nuevas funciones puras en `checkinFields.ts`: `describirRecurrencia()` (texto humano
según tipo/programación) y `proximaAperturaGenerica()`/`proximaAperturaSemanal()`
(próxima apertura calculada de forma genérica — no ligada a si un cliente concreto ya
envió su check-in, a diferencia de `calcularProximaFecha()` que sí lo está y se sigue
usando tal cual para la vista del cliente). Se muestran en `ProgramacionTipo.tsx` y
`CheckinConfigView.tsx` (vista de configuración del entrenador). Reutiliza el modelo de
`Checkin_tipos` (Parte 1.5, DEC-2026-014) sin ningún cambio de esquema ni de campos.

**No se añadió un campo de hora del día.** El modelo de disponibilidad (`Disponible_desde`
para lanzamiento, `Dia_semana`/`Modo_periodico`/etc. para recurrencia) es y sigue siendo
día-granular en UTC — nunca ha programado por hora exacta, y el check-in es insert-only
(DEC-2026-007): nunca bloquea el envío, así que una "hora" no tendría ningún efecto
funcional real, solo cosmético. Añadirla habría sido inventar una capacidad no pedida
por el modelo existente ni necesaria para el criterio de terminado del brief
("reutilizar el modelo existente si ya soporta estas capacidades").

### Aprendizaje
Mismo patrón que la limitación ya documentada del día 31 en meses cortos (DEC-2026-014):
cuando un ejemplo del brief sugiere más precisión de la que el modelo actual soporta y
esa precisión no tiene efecto funcional real, se documenta la limitación en vez de
construir una capacidad nueva sin necesidad genuina.

### Verificación
Prueba E2E: tras programar semanal (lunes) y periódico (cada 7 días desde una fecha),
`GET /api/cliente/checkin` sigue resolviendo `lanzado`/`proximaFecha` correctamente
(sin cambios en esa lógica, ya existente). `tsc --noEmit`, `eslint` y `next build` sin
errores.

---

## DEC-2026-032 — Objetivos: `Eliminado` (soft-delete) distinto de `Activo` (desactivar)

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Modelo de datos / Seguridad
**Estado:** Implementada

### Contexto
Hasta ahora `Objetivos` solo distinguía Activo/Desactivado (DEC-2026-019 usa el mismo
patrón para `Clientes.Estado`). El brief pedía añadir "Eliminar" como estado distinto:
deja de aparecer en configuración y no se asigna a nuevos check-ins, sin poder
reactivarse — a diferencia de Desactivar, que sí conserva esa posibilidad.

### Decisión
Nuevo campo Airtable `Objetivos.Eliminado` (checkbox, creado vía Airtable MCP). Nunca se
borra la fila: es soft-delete real. `getObjetivosByClienteEmail()`
(`src/lib/airtable.ts`) filtra `{Eliminado} != TRUE()` de forma centralizada en el
`filterByFormula` — un único punto de exclusión que cubre automáticamente la ficha del
entrenador, el dashboard del cliente y el check-in, sin que cada consumidor tenga que
acordarse de filtrar. Se usa `!= TRUE()`, nunca `= FALSE()` (un checkbox omitido/`false`
no viaja en la respuesta de Airtable — ver DEC-2026-008 — así que `= FALSE()` excluiría
incorrectamente los objetivos existentes sin el campo poblado).

Nuevo `DELETE /api/clientes/[id]/objetivos/[objetivoId]`: mismo gate de ownership que
`PATCH` (cliente del entrenador autenticado + objetivo perteneciente a ese cliente,
patrón DEC-2026-024), luego `actualizarObjetivo(id, {Eliminado: true, Activo: false})`.
`PATCH` gana además una comprobación: si `objetivo.fields.Eliminado === true`, responde
404 igual que si no existiera — un objetivo eliminado no puede reactivarse ni editarse
manipulando la API directamente, aunque se conozca su id real.

### Por qué no hace falta tocar `Registros_checkin` para "reconstruir progreso"
El progreso de un objetivo se agrega por `Field_id` desde `Registros_checkin`
(DEC-2026-007/026), nunca se copia ni depende del propio registro de `Objetivos` — así
que eliminar (u ocultar) la fila del objetivo no pierde ningún dato de progreso
histórico; ese historial vive por completo en `Registros_checkin`, que esta sesión no
toca en ningún punto.

### Verificación
Prueba E2E: crear objetivo → eliminar → ya no aparece en la lista del entrenador ni se
asigna en `GET /api/cliente/checkin` → `PATCH` posterior sobre ese id → 404 (no
reactivable por API). Aislamiento entre entrenadores probado también sobre `DELETE`
(entrenador ajeno → 403) y sobre un `objetivoId` real pero de otro cliente del mismo
entrenador (path/id cruzados → 404). `tsc --noEmit`, `eslint` y `next build` sin errores.

---

## DEC-2026-033 — Verificado sin bugs: integración objetivo↔check-in, recurrencia y múltiples objetivos con la misma fuente ya funcionaban desde Parte 1.5.2

**Fecha:** 2026-08-14
**Tipo:** Verificación / Modelo de datos
**Estado:** Confirmada, sin cambios de arquitectura

### Contexto
El brief de Parte 1.5.3 (secciones 4-7) pedía que un objetivo creado por el entrenador
quedara disponible automáticamente en el check-in correspondiente sin duplicarlo
manualmente, que existieran objetivos diario/semanal/mensual, y que pudieran coexistir
varios objetivos con la misma fuente sin fusionarse ni interferir entre sí.

### Verificación (no se encontró ningún bug, no se cambió arquitectura)
Auditado el código de Parte 1.5.2 antes de tocar nada: `GET /api/cliente/checkin`
(`src/app/api/cliente/checkin/route.ts`) ya agrupaba y exponía `objetivos` resueltos por
tipo (diario/semanal/periódico) sin escribir nada nuevo en `Registros_checkin` — el
progreso siempre se deriva, nunca se duplica (DEC-2026-026). `ObjetivoFields` ya
almacena cada objetivo como una fila Airtable independiente con su propio id/meta/
periodicidad/vigencia, así que dos objetivos con la misma `Fuente_field_id` nunca se
fusionan por construcción. Confirmado con la prueba E2E de esta sesión: crear "Pasos
diarios" (meta 10.000/día) y "Pasos semanales" (meta 60.000/semana) con la misma fuente,
enviar un check-in de pasos=4.000, y comprobar que ambos objetivos muestran progreso=4.000
cada uno con su propia meta — sin sobrescribirse ni mezclar sus ventanas de tiempo.

### Cambios de UX aplicados (sin tocar el modelo)
Cabecera "Objetivos de hoy"/"Objetivos de esta semana"/"Objetivos de este periodo" en
`/cliente/checkin` (antes la lista de objetivos no tenía título propio dentro de cada
sección). En `ObjetivoModal`, el selector de fuente ya usaba el nombre real del campo
(nunca `Field_id`, ver `resolverCamposEfectivos()`) — se añadió una frase explicando
cómo se calcula el progreso según el tipo de campo (sí/no → cuenta de días con "Sí";
número → suma de lo registrado).

### Verificación
40 aserciones cruzadas dentro de la prueba E2E de esta sesión (ver DEC-2026-032 y
resumen en `CLAUDE.md`). `tsc --noEmit`, `eslint` y `next build` sin errores.

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
- Añadida `DEC-2026-013`: lanzamiento del check-in desacoplado de la configuración de campos (`Entrenadores.Checkin_disponible_desde`, borrador/programado/lanzado, sin cron), con backfill de continuidad para `jumirohu@gmail.com`.

### 2026-08-14 — RetainCoach MVP Parte 1.5
- Añadida `DEC-2026-014`: tres tipos de check-in independientes con programación/lanzamiento propios (`Checkin_tipos`), migración por herencia del campo legacy sin pérdida de continuidad.
- Añadida `DEC-2026-015`: un campo puede pertenecer a varios tipos a la vez (`Campos_checkin.Tipos`, multiSelect) sin tabla intermedia — auditado explícitamente. Backfill de las 8 filas reales afectadas.
- Añadida `DEC-2026-016`: catálogo estándar Parte 1.5 — `dolor` unificado (compuesto), `comentario` unificado, ids retirados (`dolor_nivel`/`dolor_zona`/`reflexion_semanal`) con fallback de lectura histórica, sin borrar ni reescribir filas.
- Añadida `DEC-2026-017`: regla "No he entrenado" — mecanismo genérico construido (frontend+backend), sin aplicarlo a ningún campo del catálogo actual (auditado: ninguno depende estructuralmente de entrenar).
- Añadida `DEC-2026-018`: notas privadas del cliente en tabla nueva de Supabase Postgres con RLS — primera tabla Postgres propia del proyecto, aislamiento estructural de Airtable/IA/entrenador.
- Añadida `DEC-2026-019`: cliente activo/inactivo — reutilizado `Clientes.Estado='Perdido'`, gate real en backend (`getClienteActivoAutenticado`) antes ausente, botón Reactivar.
- Añadida `DEC-2026-020`: limpieza del dashboard cliente (peso/mensaje IA/energía del sistema Tally antiguo eliminados de la UI, sin tocar datos) y nueva métrica X/Y de entrenamientos semanales con limitación documentada de la fuente de Y.
- Validado con prueba E2E de fixtures aislados (entrenador+cliente ficticios, creados y borrados en la sesión) cubriendo los 20 puntos de la sección 16 del brief de Parte 1.5, `tsc --noEmit`, `eslint` y `next build`, los tres sin errores.
- Ajustes tras revisión del preview: botón "Programar" apilado debajo de la fecha, dashboard cliente reordenado (Entrenamientos → Mis notas → Tus check-ins), eliminada la tarjeta "Próximo check-in semanal (Tally)" del dashboard cliente, añadido botón "Cambiar contraseña" en `/cliente/dashboard`.
- Añadida `DEC-2026-021`: fusión de `retaincoach-checkin-parte-1.5` a `main` (fast-forward, sin conflictos) tras confirmación explícita de Juanmi — producción ya servía un commit intermedio de la rama, promovido manualmente desde Vercel.

### 2026-08-14 — RetainCoach Parte 1.5.1
- Añadida `DEC-2026-022`: "pendiente de activación" es un estado derivado (Supabase Auth `email_confirmed_at`), no un valor nuevo de `Clientes.Estado` — evita una segunda lógica de estados.
- Añadida `DEC-2026-023`: eliminado `POST /api/clientes/[id]/crear-acceso` (generaba contraseñas temporales), sustituido por el flujo de invitación con token.
- Añadida `DEC-2026-024`: bug de Airtable corregido — un campo "link to record" en `filterByFormula` no se puede comparar contra el record id del registro enlazado (solo contra su campo primario); afectaba a la invalidación del token al regenerar una invitación de cliente.
- Nueva tabla Airtable `Invitaciones_cliente` (mismo patrón que `Invitaciones` de entrenador) y campos nuevos `Clientes.Objetivos_adicionales`/`Clientes.Dias_disponibles` para el onboarding nativo — auditado antes de crear campos: el objetivo principal reutiliza `Objetivo` y el comentario reutiliza `Notas_iniciales`, ya existentes.
- Validado con prueba E2E de fixtures aislados (patrón DEC-2026-009) cubriendo los 12 puntos de la sección 7 del brief, `tsc --noEmit`, `eslint` y `next build`, los tres sin errores.

### 2026-08-14 — Diagnóstico signup cliente / Supabase Auth
- Añadida `DEC-2026-025`, que **corrige** el diagnóstico de la entrada anterior ("SMTP no configurado"): el SMTP sí funciona con dominios reales; el 500 en las pruebas E2E era el rechazo de Supabase al dominio `@example.com` en su entorno de pruebas. Confirmado comparando código (signup de entrenador y cliente usan el mismo mecanismo, sin diferencias), logs de Auth de Supabase, y una prueba de punta a punta con un email real (`gmail.com`) sin errores. Retirado de los bloqueantes de `CLAUDE.md`. Sin cambios de código ni de configuración.

### 2026-08-14 — RetainCoach Parte 1.5.2: Objetivos, progreso y retirada de Tally
- Nueva tabla Airtable `Objetivos` (`tbl0IwhFmKLc0MolG`): objetivos configurables por cliente (nombre, periodicidad diario/semanal/mensual, meta, unidad, fuente de progreso opcional, vigencia, activo), sustituyendo al indicador fijo `Clientes.Entrenamientos_objetivo` en el dashboard (el campo Airtable no se borra, solo deja de leerse).
- Añadida `DEC-2026-026`: el progreso se agrega por `Field_id` en la ventana de la periodicidad del objetivo, sin exigir que la fuente esté asignada al mismo tipo de check-in — corrige un diseño intermedio de esta misma sesión que habría hecho imposible el propio ejemplo del brief ("Entrenamientos — semanal" desde un campo que solo se pregunta a diario).
- Añadida `DEC-2026-027`: retirada de Tally acotada a clientes nuevos (deja de generarse `Link_tally_alta`) — el flujo semanal Tally→`Reportes`→Análisis Lunes no se toca, sigue en uso real por clientes existentes; auditados los 6 workflows de n8n (5 activos ya documentados + `Seguimiento - Limpieza de datos antiguos`, inactivo, descubierto en esta auditoría) sin modificar ninguno.
- `GET /api/cliente/checkin` expone `objetivos` por tipo (diario/semanal/periodico) para integrar Objetivos con el check-in, respetando la configuración de campos de Parte 1.5. Dashboard cliente: nueva sección "Mis objetivos" (agrupada Hoy/Esta semana/Este mes) sustituye a "Entrenamientos esta semana". Ficha entrenador: nueva sección "Objetivos" (crear/editar/desactivar + progreso) junto a check-ins e historial.
- Backfill de continuidad: 4 clientes reales con `Entrenamientos_objetivo` > 0 recibieron un `Objetivo` "Entrenamientos" equivalente (mismo patrón que backfills anteriores del proyecto), sin tocar el campo Airtable original.
- Validado con prueba E2E de fixtures aislados (patrón DEC-2026-009), 46 comprobaciones, cubriendo los puntos de la sección 9 del brief. `tsc --noEmit`, `eslint` y `next build`, los tres sin errores.

### 2026-08-14 — Bugfix: `/planes` no se autocorregía tras conceder un plan
- Añadida `DEC-2026-028`: investigado el bug reportado ("entrenador con Seguimiento concedido sigue viendo 'Solicita acceso a un plan'"). Todo el ciclo de datos (Admin PUT → Airtable → `GET /api/entrenador/perfil` → `tienePlanBase()`) funciona correctamente, verificado con una prueba E2E contra la API real. La causa real es que `src/app/planes/page.tsx` nunca comprobaba el plan ni redirigía de vuelta a `/dashboard` — página sin salida una vez que un entrenador aterrizaba ahí, aunque el admin le concediera un plan después. Corregido replicando en `/planes` el mismo chequeo que ya hace `/dashboard`. Sin cambios en `tienePlanBase()`, el modelo de `Soluciones` ni ningún endpoint de Admin.

### 2026-08-14 — RetainCoach Parte 1.5.3: limpieza, programación clara y objetivos integrados
- Añadida `DEC-2026-029`, que **reemplaza** a `DEC-2026-027`: retirada completa de Tally, confirmada explícitamente por el usuario tras señalar la contradicción con la decisión anterior. 4 workflows n8n eliminados permanentemente (`Recepción entrenador`, `Seguimiento - Análisis Lunes`, `Seguimiento - Resumen&Alerta`, `Seguimiento - Alta cliente`); `Snapshot mensual` y `Seguimiento - Limpieza de datos antiguos` (inactivo) intactos. Código: `linkTallyAlta`/`tieneAlerta`/`alertaResumen` eliminados de `Cliente`, `StatusBadge.tsx` y `estadoReporte.ts` borrados (código muerto). `Reportes`/`Archivo` se conservan como histórico de solo lectura por decisión explícita (siguen alimentando los dashboards de negocio del admin).
- Añadida `DEC-2026-030`: "Mis notas" eliminada por completo de la app (UI, rutas, API, `createSupabaseUserClient()`) — pero la tabla Postgres `notas_privadas` **no se ha tocado**, por decisión explícita del usuario tras descubrirse que tenía 1 fila real (no de prueba) de su propia cuenta.
- Añadida `DEC-2026-031`: programación de check-ins en lenguaje claro (`describirRecurrencia()`, `proximaAperturaGenerica()`) sin añadir un campo de hora del día — el modelo sigue siendo día-granular a propósito, documentado como limitación deliberada.
- Añadida `DEC-2026-032`: nuevo campo `Objetivos.Eliminado` (soft-delete real, distinto de `Activo`/desactivar) + `DELETE /api/clientes/[id]/objetivos/[objetivoId]`, mismo patrón de ownership que el resto de la ruta.
- Añadida `DEC-2026-033`: verificado sin bugs que la integración objetivo→check-in, la recurrencia diario/semanal/mensual y la coexistencia de varios objetivos con la misma fuente ya funcionaban correctamente desde Parte 1.5.2 — solo se aplicaron mejoras de UX (cabeceras "Objetivos de hoy/esta semana/este periodo", explicación de cómo se calcula el progreso por fuente).
- Validado con prueba E2E de fixtures aislados (patrón DEC-2026-009, 2 entrenadores + 2 clientes ficticios), 40 comprobaciones cubriendo check-ins, objetivos, integración y seguridad (ownership, aislamiento entre entrenadores, IDs manipulados, cliente inactivo). `tsc --noEmit`, `eslint` y `next build`, los tres sin errores.
