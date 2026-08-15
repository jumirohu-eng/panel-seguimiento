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

## DEC-2026-034 — Check-in dinámico: un objetivo con métrica nueva crea (o reutiliza) el campo de check-in automáticamente

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Producto
**Estado:** Implementada

### Contexto
Brief "Objetivos + Check-ins: integración robusta": el flujo debía pasar a ser
`Entrenador configura objetivo → sistema identifica métrica/dato → check-in muestra
campo`, no al revés. Hasta esta sesión, la única forma de que un campo existiera era que
el entrenador lo creara primero manualmente en `/checkin-config`; el modal de Objetivos
solo permitía elegir entre campos ya existentes (Parte 1.5.2).

### Auditoría previa
`resolverCamposEfectivos()`/`crearCampoCheckin()` (Parte 1) y el propio endpoint de
campos personalizados (`POST /api/entrenador/checkin-config/campos`) ya cubrían toda la
lógica de creación — no hacía falta un modelo nuevo, solo exponer esa capacidad desde el
flujo de creación de un objetivo.

### Decisión
`ObjetivoModal` añade un tercer modo de fuente ("Métrica nueva", junto a "Métrica
existente" y "Sin fuente") donde el entrenador escribe el nombre y elige tipo
(sí/no o número). `POST`/`PATCH /api/clientes/[id]/objetivos(/[objetivoId])` aceptan
`fuenteNueva: {nombre, tipo, unidad}` y, antes de crear el objetivo, llaman a la nueva
`resolverOCrearCampoCheckinParaObjetivo()` (`src/lib/airtable.ts`):
1. Busca entre los campos **activos** de ese entrenador uno del **mismo tipo** cuyo
   nombre coincida (normalizado: `trim().toLowerCase()`) — si existe, reutiliza su
   `Field_id` sin crear nada nuevo (evita duplicar la pregunta, pedido explícito del
   brief: "si varios objetivos usan la misma métrica, no duplicar la pregunta").
2. Si no existe, crea un campo personalizado nuevo con `Tipos: ['diario']` por defecto
   — la periodicidad más granular, capaz de alimentar objetivos diario/semanal/mensual
   por agregación (mismo principio que DEC-2026-026: la fuente no tiene que coincidir
   con la periodicidad del objetivo). El entrenador puede ampliarlo a otros tipos desde
   `/checkin-config` después si lo necesita — no se construyó una UI paralela para
   elegir el tipo de check-in dentro del modal de Objetivos, para no duplicar esa
   decisión en dos sitios.

### Limitación conocida y aceptada
La búsqueda-y-creación no es atómica (Airtable no ofrece transacciones vía API REST).
Dos objetivos con el mismo nombre de métrica nueva creados en un margen de milisegundos
podrían, en el peor caso, generar campos casi duplicados. Mismo tipo de riesgo ya
aceptado y documentado para `upsertCheckinTipo` (Parte 1.5) — no se resuelve con
infraestructura nueva (colas, locks) por ser un caso extremadamente improbable en el uso
real de la app (un entrenador configurando objetivos uno detrás de otro, no en paralelo).

### Verificación
Prueba E2E: crear un objetivo con métrica nueva "Pasos" (número) → aparece exactamente 1
fila nueva en `Campos_checkin`, activa, y el campo aparece automáticamente en el
check-in diario del cliente sin que nadie lo configure a mano. Crear un segundo objetivo
con el nombre "pasos" (minúsculas, para probar la normalización) → reutiliza el mismo
`Field_id`, sigue habiendo solo 1 fila en `Campos_checkin`. Un tercer objetivo apuntando
directamente al `fieldId` ya conocido también reutiliza. Un entrenador ajeno que intenta
crear un objetivo con métrica nueva sobre un cliente que no es suyo recibe 403 y **no**
llega a crear ningún campo de check-in (verificado contando filas de `Campos_checkin` de
ese entrenador tras el intento fallido).

---

## DEC-2026-035 — Modo de progreso "valor objetivo": peso y métricas de estado puntual, con dirección y valor inicial explícitos

**Fecha:** 2026-08-14
**Tipo:** Arquitectura / Modelo de datos / Producto
**Estado:** Implementada

### Contexto
El modelo de progreso existente (DEC-2026-026, "acumulado": sumar/contar registros
dentro de la ventana) es correcto para métricas de actividad (pasos, entrenamientos)
pero **no tiene sentido para el peso**: sumar los pesos registrados en una semana no
significa nada. El brief pedía tratar el peso como "indicador de progreso" (barra, no
gráfica), con dirección explícita (subir/bajar) que nunca se infiere, capaz de
retroceder si el peso vuelve a subir, y de superar la meta sin romperse.

### Decisión
Nuevo campo `Objetivos.Modo_progreso` (`'acumulado' | 'valor_objetivo'`, ausente =
`'acumulado'` — así ningún objetivo ya existente en producción cambia de comportamiento
sin que nadie lo pida, ver "compatibilidad histórica" más abajo). Nuevos
`Objetivos.Direccion` (`'subir'|'bajar'`) y `Objetivos.Valor_inicial` (número),
obligatorios solo cuando `Modo_progreso='valor_objetivo'` — validados en conjunto por
`validarConfiguracionProgreso()` (`src/lib/objetivos.ts`), que rechaza explícitamente
cualquier combinación incoherente (valor_objetivo sin dirección, con fuente no numérica,
o dirección/valor_inicial presentes en modo acumulado) en vez de ignorarlos en silencio.

Progreso (`calcularProgresoValorObjetivo()`): `actual` = último registro real de la
fuente (`obtenerUltimoValorNumerico()`, sin ventana temporal — a diferencia de
"acumulado", el peso no tiene "periodo", siempre es una foto del dato más reciente
conocido, venga de cuando venga); si todavía no hay ningún registro, `actual =
Valor_inicial` (0% de avance, nunca se inventa un dato). `porcentaje` = distancia
recorrida desde `Valor_inicial` hacia `Meta`, en la `Direccion` indicada — **puede
superar 100** (meta superada, "sobre-meta", pedido explícito del brief: "progreso
válido, UI correcta") y **puede retroceder** de una lectura a otra si el valor real se
aleja de la meta (se recalcula desde cero en cada lectura, no es un contador
acumulativo). Se recorta a un mínimo de 0 (no se muestra progreso negativo) pero no se
recorta el valor real mostrado.

### Valor inicial: nunca inferido, siempre explícito
Sección 8 del brief: "no asumir que el último valor siempre es el inicial". Se auditó
la alternativa de tomar automáticamente el registro más reciente ya existente como
referencia al crear el objetivo — **se descartó**: el entrenador introduce
`Valor_inicial` a mano en `ObjetivoModal`, como un dato más del objetivo (igual que
`Meta`), sin pre-rellenarlo desde el historial. Auditado explícitamente si "puede
utilizarse como referencia sin duplicar el registro" (sección 8): sí puede — copiar un
número a `Objetivos.Valor_inicial` no crea ninguna fila en `Registros_checkin`, no hay
riesgo de duplicación — pero se decidió no construir el auto-relleno para mantener el
alcance acotado; queda documentado como posible mejora futura, no como limitación oculta.

### Compatibilidad histórica
Ningún objetivo existente en Airtable tiene `Modo_progreso` poblado — todos siguen
leyéndose como `'acumulado'` exactamente igual que antes de esta sesión, sin backfill ni
migración de datos. **Hallazgo de auditoría:** existe 1 objetivo real en producción
(`Nombre: "peso"`, cliente `jjoossee45678@gmail.com`) con `Fuente_field_id = "peso"` —
hoy sigue calculándose como "acumulado" (suma de los pesos registrados en su ventana),
que casi con toda seguridad no es la semántica que se quiere para un objetivo de peso.
**No se ha modificado este registro real** — cambiar su modo de progreso altera lo que
ve un cliente real, y la instrucción explícita del brief es "no modificar clientes
reales durante pruebas". El entrenador puede convertirlo a "valor objetivo" él mismo
desde la ficha del cliente (editar objetivo → modo "Valor objetivo" → indicar dirección
y valor inicial) ahora que la función existe. Queda anotado en `CLAUDE.md` como
pendiente a comunicar.

### Verificación
Prueba E2E: objetivo "bajar de 70 a 65kg" sin registros → progreso = 70kg/0%; tras
registrar 67.8kg → 67.8kg/44%; tras registrar 69kg (sube) → retrocede a 69kg/20%; tras
registrar 63kg (supera la meta) → completado=true, 140% (sobre-meta, sin romperse).
Objetivo "subir de 70 a 75kg" con el mismo historial (peso real bajando) → 0% (recorte
correcto, nunca negativo). Validación cruzada: `valor_objetivo` sin dirección → 400;
con fuente sí/no → 400; `acumulado` con dirección/valor_inicial presentes → 400.

---

## DEC-2026-036 — Validación estricta de tipo/rango en el check-in: rechazo explícito, nunca conversión ni descarte en silencio

**Fecha:** 2026-08-14
**Tipo:** Seguridad / Integridad de datos
**Estado:** Implementada

### Hallazgo de auditoría
`POST /api/cliente/checkin` serializaba cada valor con `serializarValor()` y, si el
resultado era `null` (tipo incompatible, texto no numérico, etc.), simplemente **omitía
ese campo del envío sin informar de nada** — la petición podía responder `201` con éxito
mientras uno o varios valores se perdían en silencio. Contradice explícitamente el
brief: "no convertir silenciosamente texto a números ni aceptar tipos incompatibles".

### Decisión
Nueva `validarValorCampo()` (`src/lib/checkinFields.ts`), ejecutada **antes** de
serializar: si un valor está presente pero es del tipo equivocado (texto en un campo
número, string en un campo sí/no...) o fuera de rango (número negativo; escala fuera de
1-5), la petición completa se rechaza con `400` y un mensaje por campo — nunca se guarda
una parte y se descarta el resto. Un campo simplemente ausente de `valores` (no
respondido) sigue siendo válido, no es un error. `numero`/`escala` rechazan valores
negativos (dominio de la app: pasos, peso, medidas, sesiones — ninguno tiene sentido en
negativo); `escala` además exige 1-5. `CampoInput.tsx` añade `min={0}` al input numérico
como ayuda visual — el backend sigue siendo la fuente de verdad, el frontend no se
considera suficiente ("no confiar en frontend", sección 13 del brief).

### Verificación
Prueba E2E: texto en campo numérico → 400; número negativo → 400; escala=9 (fuera de
1-5) → 400; string `'si'` en campo sí/no → 400 (antes se habría descartado en silencio).

---

## DEC-2026-037 — Resiliencia ante doble envío del check-in: guard de escritura + por qué la corrección de datos sigue siendo segura incluso bajo concurrencia real

**Fecha:** 2026-08-14
**Tipo:** Seguridad / Resiliencia / Concurrencia
**Estado:** Implementada (con limitación documentada, no un locking real)

### Contexto
`Registros_checkin` es insert-only por diseño (DEC-2026-007): cada envío crea filas
nuevas, nunca sobrescribe. Esto ya protegía la **corrección** de datos (reenviar un
valor distinto el mismo día crea una fila nueva, la lectura se queda con la más
reciente), pero no protegía contra un **doble envío accidental** (doble clic, reintento
de red) con el mismo payload: cada llamada insertaba sus propias filas sin comprobar si
ya existían, multiplicando filas idénticas sin ningún beneficio.

### Decisión
Nueva `esEnvioDuplicadoReciente()` (`src/lib/checkinFields.ts`): antes de insertar,
`POST /api/cliente/checkin` compara el nuevo lote contra el **último** lote de
`Registros_checkin` de ese mismo tipo (mismos `Field_id`+`Valor`, agrupados por el
`Fecha` exacto con el que se escribieron en una única llamada anterior) — si coincide
byte a byte y se escribió hace menos de 5 segundos, no inserta nada y responde `200
{duplicado: true}` en vez de `201`. Un envío con **cualquier valor distinto** nunca se
bloquea, aunque llegue en el mismo segundo — sigue siendo insert-only para cualquier
dato nuevo real, coherente con DEC-2026-007.

### Limitación real, medida (no solo teórica)
Esta comprobación es lectura-y-decisión, no una operación atómica — Airtable no ofrece
locking vía API REST. Se probó explícitamente con **dos peticiones HTTP disparadas en
paralelo** (`Promise.all`, no secuenciales) con payload idéntico: ambas devolvieron
`201` y ambas insertaron sus filas — el guard NO evitó la duplicación bajo concurrencia
real simultánea (sí la evita, verificado, cuando las peticiones llegan una detrás de
otra con unos segundos de diferencia, el caso real de un doble clic humano).

### Por qué la integridad de los datos no depende de que este guard sea perfecto
Aunque el guard falle bajo concurrencia real, la corrección sigue siendo íntegra por una
capa distinta, ya existente: `calcularProgresoDesdeCheckins()` (modo acumulado) dedupea
por día quedándose con el registro **más reciente** de cada campo — dos filas idénticas
el mismo día nunca se suman/cuentan dos veces, se cuentan como una. `calcularProgresoVal
orObjetivo()` (modo valor objetivo) toma el registro más reciente sin ventana — dos
filas con el mismo valor dan el mismo resultado sea cual sea la que "gane" por
timestamp. Es decir: el guard de escritura reduce el ruido en `Registros_checkin`
(menos filas basura) pero la corrección del progreso mostrado **nunca depende de él** —
ya la garantizaba el diseño de lectura de DEC-2026-007/026. Documentado explícitamente
para que una sesión futura no asuma que hace falta un locking distribuido: no hace
falta, la resiliencia real vive en la capa de lectura.

### Verificación
Prueba E2E secuencial: mismo payload dos veces seguidas → 201 luego 200 `duplicado:true`,
solo 2 filas nuevas en Airtable (las del primer envío). Prueba de concurrencia real
(peticiones en paralelo, script aparte, no incluido en el commit): confirmado el
comportamiento descrito arriba en 3 ejecuciones consecutivas.

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

### 2026-08-14 — RetainCoach: Objetivos + Check-ins, integración robusta
- Añadida `DEC-2026-034`: check-in dinámico — un objetivo con métrica nueva crea (o reutiliza por nombre, sin duplicar la pregunta) su propio campo de `Campos_checkin` automáticamente, vía nueva `resolverOCrearCampoCheckinParaObjetivo()`.
- Añadida `DEC-2026-035`: nuevo modo de progreso `valor_objetivo` para objetivos tipo peso/medidas — dirección (subir/bajar) y valor inicial siempre explícitos, nunca inferidos; progreso por distancia al valor más reciente, puede superar el 100% y puede retroceder. Ningún objetivo existente cambia de comportamiento (ausencia de `Modo_progreso` = `acumulado`, igual que siempre). Auditado y documentado: 1 objetivo real de producción ("peso") sigue en modo acumulado — no se ha tocado sin confirmación del entrenador dueño.
- Añadida `DEC-2026-036`: validación estricta de tipo/rango en `POST /api/cliente/checkin` — un valor incompatible ahora se rechaza con 400 explícito en vez de descartarse en silencio.
- Añadida `DEC-2026-037`: guard de doble envío en el check-in (no atómico, limitación medida con una prueba de concurrencia real) + explicación de por qué la integridad del progreso mostrado no depende de ese guard, sino de la deduplicación de lectura ya existente desde Parte 1.5/1.5.2.
- Validado con prueba E2E de fixtures aislados (2 entrenadores + 1 cliente ficticios), 51 comprobaciones: check-in dinámico, deduplicación de métricas por nombre, un registro alimentando 3 objetivos (día/semana/mes) sin duplicar el dato, ventanas temporales correctas, objetivo booleano sin doble conteo, doble envío idempotente, validación de tipo/rango, peso subir/bajar/sobre-meta/retroceso, validación cruzada de configuración de progreso, edición limpiando campos al cambiar de modo, eliminar objetivo sin borrar registros ni afectar a otros, y seguridad (ownership, aislamiento entre entrenadores, cliente inactivo, IDs manipulados). Prueba adicional de concurrencia real (peticiones en paralelo) fuera del commit. `tsc --noEmit`, `eslint` y `next build`, los tres sin errores.

### 2026-08-14 — Auditoría puntual pre-merge + fusión a `main` y despliegue a producción
Antes de fusionar, auditoría puntual solicitada explícitamente (sin tocar código ni datos) sobre dos puntos:
- **Deduplicación/concurrencia del check-in:** confirmado que `esEnvioDuplicadoReciente()` no es atómica (lectura-y-decisión, sin transacción ni lock — Airtable no ofrece ninguna garantía de unicidad vía API REST, confirmado leyendo el esquema real de `Registros_checkin`, sin índices únicos). Verificado empíricamente con 2 peticiones HTTP disparadas en paralelo (`Promise.all`) contra el servidor de desarrollo: ambas devolvieron 201, el guard no evitó la duplicación bajo concurrencia real simultánea (sí la evita en el caso secuencial de un doble clic humano, con margen de segundos). Se documentó por qué esto no compromete la integridad del progreso mostrado: la deduplicación de lectura ya existente (por día en modo acumulado, por último valor real en modo valor objetivo, ambas desde antes de esta sesión) protege el resultado independientemente de cuántas filas duplicadas exista. Propuesta para una solución realmente atómica (no implementada, pendiente de decisión): tabla de idempotencia en Supabase Postgres con constraint único + `INSERT ... ON CONFLICT DO NOTHING` antes de escribir en Airtable.
- **Objetivo real de peso:** localizado (`recP1728cPAP3sDAo`, cliente Jose/`jjoossee45678@gmail.com`, entrenador `espartakofake@gmail.com`, Meta=70kg, Periodicidad=mensual, sin `Modo_progreso`/`Direccion`/`Valor_inicial`). Confirmado que Jose nunca ha registrado un peso real — el objetivo muestra hoy "0/70kg (0%)" bajo el modo acumulado por defecto, engañoso pero no roto. Confirmado que coexiste sin ningún riesgo con el modelo nuevo (ausencia de `Modo_progreso` = `acumulado`, sin cambio de comportamiento). No se modificó — decisión del entrenador dueño, no de esta sesión.
- **Hallazgo adicional durante la auditoría (no solicitado, relevante para producción):** 15 filas huérfanas en `Registros_checkin` (`Cliente_Email` vacío) — residuos de las pruebas E2E de esta sesión y la anterior: el cliente ficticio de fixtures se borraba al limpiar, pero las filas de check-in creadas vía el endpoint real de la API nunca se capturaron para borrarlas (Airtable no hace cascade delete en campos de enlace). No afectan a ningún cliente real (`Cliente_Email` vacío hace que ningún filtro por email las encuentre), pero son basura real en la base de producción. **No se ha limpiado** — pendiente de confirmación explícita antes de borrar filas de Airtable en producción. **Aprendizaje reutilizable para futuras pruebas E2E (ver DEC-2026-009):** cuando un test crea datos vía el endpoint real de la API (no solo vía escritura directa a Airtable), hay que capturar también los IDs de lo que ese endpoint crea internamente (aquí, cada `POST /api/cliente/checkin` genera N filas en `Registros_checkin` no devueltas como IDs en la respuesta) — no basta con borrar el registro padre (Cliente) y asumir que arrastra lo demás.

Tras la auditoría, confirmado por el usuario: **fusión a `main` (fast-forward limpio, sin conflictos) y push**, incluyendo en un único despliegue toda la cadena acumulada desde el último merge a `main` (`8eda0d2`): Parte 1.5.1 (onboarding/invitaciones), Parte 1.5.2 (Objetivos), el bugfix de `/planes`, Parte 1.5.3 (retirada de Tally, eliminación de Mis notas, programación clara) y esta sesión (Objetivos + Check-ins). Validado `next build`/`eslint` sobre `main` tras el fast-forward, sin errores, antes del push. Vercel desplegó automáticamente a producción (`retaincoach.com`, deployment `dpl_2BTtqePvEyN9ebQQjtz1SXdT2dBB`, `READY` en ~21s) — flujo normal `push a main → Vercel despliega` (DEC-2026-021), sin promoción manual.

**Pendiente real tras el despliegue:**
- ~~Limpiar las 15 filas huérfanas de `Registros_checkin`~~ — **hecho** (ver abajo).
- Decidir con el entrenador dueño si convertir el objetivo real "peso" de Jose a modo `valor_objetivo`.
- Prueba visual en navegador de todo lo desplegado (ninguna sesión de esta cadena la tuvo — todas verificadas solo contra API/Airtable/Supabase reales).

### 2026-08-14 — Limpieza de las 15 filas huérfanas de `Registros_checkin`
Confirmación explícita del usuario tras la auditoría anterior. Antes de borrar se
reconsultaron las 15 filas (`{Cliente_Email}=""`) para confirmar que la lista no había
cambiado desde la auditoría — coincidieron exactamente los mismos 15 IDs. Borradas vía
API REST de Airtable (`DELETE`, en 2 tandas de máx. 10 IDs por límite de la API).
Verificado tras el borrado: 0 filas huérfanas restantes, y los 5 registros reales de
Jose (`jjoossee45678@gmail.com`) intactos, sin tocar. No se ha modificado ningún otro
dato real.

### 2026-08-14 — Bugfix: mensaje propio cuando la cuenta no está registrada como entrenador
- Añadida `DEC-2026-038`: causa exacta demostrada con datos reales (errata de una letra entre
  el email de la fila de `Entrenadores` creada desde Admin, `esprartakofake@gmail.com`, y la
  cuenta real que inició sesión, `espartakofake@gmail.com`) — no un desajuste de mayúsculas
  (hipótesis auditada y descartada) ni una regresión del fix de `DEC-2026-028` (confirmado
  desplegado en producción). `GET /api/entrenador/perfil` devuelve ahora `404` cuando no existe
  ninguna fila de Entrenador con ese email, en vez de `200 { soluciones: [] }` — antes
  indistinguible de "entrenador real sin plan". `/dashboard` y `/planes` muestran una pantalla
  "Cuenta no registrada" en ese caso. Validado `tsc --noEmit`/`eslint`/`next build` y prueba E2E
  con fixture desechable contra el servidor real. Pendiente real: corregir a mano en Airtable el
  email con errata para desbloquear el acceso real de `espartakofake@gmail.com`.

### 2026-08-15 — Parte UX: Objetivos primero, Revisiones aparte
- Añadida `DEC-2026-039`: rediseño puramente de UX/frontend (Objetivo vs Revisión), sin tocar
  modelo de datos ni endpoints. La distinción se calcula en el cliente cruzando
  `objetivo.fuenteFieldId` contra `campo.id` de `Campos_checkin` — un campo es "de objetivo" si
  al menos un objetivo vigente del cliente lo usa como fuente; el resto son "Revisión". Nuevo
  `RevisionesEntrenador.tsx`/`RevisionModal.tsx` (hermanos de `ObjetivosEntrenador.tsx` y
  `CampoPersonalizadoModal.tsx`, que se dejan intactos) dentro de la ficha del cliente, con nota
  explícita de que las revisiones son compartidas por entrenador (no por cliente). Botón de
  configuración avanzada (`/checkin-config`, sin tocar) movido a `Header.tsx`
  (`showCheckinConfigLink`), gateado por el branch de render correcto para no repetir
  `DEC-2026-011`. Validado con prueba E2E de fixtures desechables (patrón `DEC-2026-009`): 2
  objetivos de "pasos" con periodicidad distinta comparten la misma fuente sin duplicar el
  campo, un único registro alimenta ambos progresos, y objetivo de peso (`valor_objetivo`)
  calcula correctamente la dirección. `tsc --noEmit`, `eslint` y `next build` sin errores. No
  probado visualmente en navegador (sin acceso a Chrome/Playwright en esta sesión).
- Añadida `DEC-2026-040`: corregido que el registro de un objetivo dependiera de que el
  entrenador hubiera "lanzado" el check-in de ese tipo — `GET/POST /api/cliente/checkin`
  gateaban todo el tipo por `lanzado`, no por campo. Ahora los campos que son fuente de un
  objetivo activo y vigente del cliente están siempre disponibles (lanzado o no); los campos
  de revisión siguen dependiendo del lanzamiento, sin cambios. Validado con prueba E2E de
  fixtures desechables, 22 comprobaciones: registro de objetivos sin ningún check-in lanzado,
  peso direccional (secuencia 70→68→66→69 kg dio 0→40→80→20%), cliente sin objetivo de peso
  nunca ve ni puede registrar ese campo, cliente inactivo bloqueado, aislamiento entre
  clientes, tipo incompatible rechazado con 400. `tsc --noEmit`, `eslint` y `next build` sin
  errores. No probado visualmente en navegador.
- Añadida `DEC-2026-041`: serie de ajustes de UX pedidos tras probar `DEC-2026-040` en el
  preview — registro enfocado en un único campo por objetivo (`?campo=&tipo=`); catálogo de
  revisiones estándar (Energía/Fatiga/Ánimo/Dolor/Comentario/Adherencia/Medidas) a
  `tiposDefault: ['semanal']` por defecto; Peso/Entrenamiento realizado/campos "Pasos" ocultos
  de `/checkin-config`; nuevo `DELETE /api/entrenador/checkin-config/campos/[fieldId]` con
  botón "Eliminar" (borra de verdad un campo personalizado, desactiva de forma duradera uno
  estándar); corregido que las filas "eliminadas" seguían visibles (ahora las listas solo
  muestran `activo === true`, con un desplegable "eliminadas" + Reactivar); bloque "Revisiones"
  quitado de la ficha del cliente (queda solo en config avanzada,
  `RevisionesEntrenador.tsx`/`RevisionModal.tsx` borrados por código muerto) y botón ⚙️ movido
  del `Header` al toolbar de `ClientesLista.tsx`. `tsc --noEmit`, `eslint` y `next build` sin
  errores en cada commit; E2E con fixtures desechables para los puntos de backend/catálogo. No
  probado visualmente en navegador por Claude — la validación visual la hizo el usuario en el
  preview de Vercel.
- Añadida `DEC-2026-042`: corregido que Peso/Entrenamiento realizado (ya ocultos de
  `/checkin-config` por `DEC-2026-041`, pero con `Activo=true` heredado) siguieran apareciendo
  como revisión suelta en `/cliente/checkin` para un cliente sin objetivo que los use — rompía
  "el objetivo activa la métrica" (`DEC-2026-040`). `GET/POST /api/cliente/checkin` excluyen
  ahora estos campos salvo que sean de verdad fuente de un objetivo de ese cliente concreto,
  con independencia de `Activo`/lanzamiento. Hallazgo aparte sin resolver: dos filas
  duplicadas reales en `Campos_checkin` (Peso, Medidas) en la cuenta de prueba, probable
  condición de carrera en `PUT /api/entrenador/checkin-config` no idempotente. Validado con
  fixture E2E reproduciendo el escenario real exacto. `tsc --noEmit`, `eslint` y `next build`
  sin errores.
- Añadida `DEC-2026-043`: corregido que la vista general de `/cliente/checkin` (no el modo de
  campo único) siguiera mostrando "Pasos" y títulos técnicos por tipo ("Hoy"/"Esta semana"/"Tus
  datos") pese al fix de backend de `DEC-2026-042` — causa distinta: el frontend todavía
  renderizaba un bloque completo de objetivos junto a la revisión. Ahora la vista general
  muestra únicamente un bloque "Revisión" (encabezado fijo + "Esto es una revisión de tu
  estado, no un objetivo.") con los campos que no son fuente de ningún objetivo del cliente; los
  objetivos se registran solo desde el modo de campo único enlazado desde `MisObjetivos.tsx`.
  `tsc --noEmit`, `eslint` y `next build` sin errores; E2E confirma que "Pasos" queda excluido
  de `camposRevision` y "energía" aparece correctamente como revisión. No probado visualmente
  en navegador.
- Añadida `DEC-2026-044`: corregido que un campo exclusivo de objetivo (p.ej. `Peso`, con
  `Tipos` heredado `['semanal','periodico']` de antes de `DEC-2026-041`) se considerara "de
  objetivo" en CUALQUIER tipo al que estuviera asignado, en vez de solo en el tipo que coincide
  con la periodicidad real del objetivo del cliente — causaba que, p.ej., un objetivo de peso
  semanal hiciera aparecer "Peso" también como revisión suelta en "periódico". `idsFuenteObjetivo`
  en `GET/POST /api/cliente/checkin` pasa a calcularse por tipo
  (`PERIODICIDAD_A_TIPO_CHECKIN[objetivo.periodicidad]`), no por el `Tipos` legado del campo.
  Validado con fixture E2E reproduciendo el escenario real detectado en la cuenta
  `retaincoachsolution@gmail.com`. `tsc --noEmit`, `eslint` y `next build` sin errores.
- Añadida `DEC-2026-045`, reemplaza parcialmente `DEC-2026-015`: por pedido explícito de
  Juanmi, un campo de revisión ya no puede pertenecer a varios tipos de check-in a la vez —
  `CheckinConfigView.tsx`/`CampoPersonalizadoModal.tsx` cambian de checkboxes a radio buttons
  (un único tipo por campo), reforzado en el backend (`PUT /api/entrenador/checkin-config`,
  `POST /api/entrenador/checkin-config/campos` recortan `tipos` a un elemento). Verificado que
  ningún dato real tenía más de un tipo asignado — sin migración necesaria. Validado con
  fixture E2E. `tsc --noEmit`, `eslint` y `next build` sin errores.
- Añadida `DEC-2026-046`: reporte de "en diario sigue saliendo lo del semanal" resultó ser un
  problema de presentación, no de datos — recalculado a mano con datos reales frescos, la
  separación por tipo ya era correcta tras `DEC-2026-044`/`045`. Causa real: las tres secciones
  de `/cliente/checkin` compartían el mismo título fijo "Revisión" sin indicar el tipo, y
  "periódico" desaparecía por completo cuando no tenía campos. Nuevo `TITULO_SECCION`
  ("Revisión diaria"/"semanal"/"periódica") y las tres secciones se muestran siempre (con
  mensaje de estado si no hay campos). Hallazgo aparte sin tocar: el cliente real
  `retaincoachsolution@gmail.com` tiene `Estado: 'Perdido'` ahora mismo, lo que bloquearía su
  acceso con 403 si es la cuenta con la que se está probando. Validado con fixture E2E. `tsc
  --noEmit`, `eslint` y `next build` sin errores.
- Añadida `DEC-2026-047`, corrige `DEC-2026-044`: esa decisión (restringir `idsFuenteObjetivo`
  por tipo, según la periodicidad del objetivo) era demasiado estricta — dejaba invisible en
  las tres secciones cualquier objetivo cuya periodicidad no coincidiera con el `Tipos` real de
  su campo fuente (caso real encontrado: objetivo "Pasos" semanal con campo `Tipos:['diario']`,
  patrón soportado y documentado, no un caso raro). Revertido `GET/POST
  /api/cliente/checkin` a exclusión GLOBAL (como en `DEC-2026-042`); el fix real del bug
  original de `DEC-2026-044` (Peso colándose como revisión en "periódico") era hacer el
  FRONTEND global también, no el backend local — `page.tsx` ahora calcula la exclusión de
  campos-de-objetivo como unión de las tres secciones. Nuevo `ObjetivoResuelto.fuenteTipos` +
  `MisObjetivos.tsx` usa el tipo real del campo (no la periodicidad) para el enlace
  "Registrar". Validado con fixture E2E (caso "Pasos" nuevo + caso "Peso" original, ambos
  correctos) y confirmado con una llamada real de solo lectura a la cuenta afectada. `tsc
  --noEmit`, `eslint` y `next build` sin errores.

---

## DEC-2026-038 — `/api/entrenador/perfil` distingue "no registrado" de "sin plan"

**Fecha:** 2026-08-14
**Tipo:** Bug / Autenticación / UX
**Estado:** Corregido

### Hallazgo
Reportado de nuevo el síntoma de `DEC-2026-028` ("entrenador con `Seguimiento` concedido sigue
viendo 'Solicita acceso a un plan'"), pero esta vez con un entrenador accediendo por primera
vez, no con una pestaña vieja sin recargar (la causa ya corregida en esa decisión).

### Causa exacta (demostrada con datos reales de Airtable y Supabase Auth, no hipótesis)
Dos cuentas distintas por una errata de una letra:
- Fila de `Entrenadores` creada desde Admin: email `esprartakofake@gmail.com` (con una "r" de
  más), `Soluciones=["Seguimiento"]` ya asignado, creada 2026-08-14 19:28:34.
- Cuenta de Supabase Auth que realmente inició sesión: `espartakofake@gmail.com` (sin esa "r",
  cuenta real preexistente desde 2026-08-10), `last_sign_in_at` 2026-08-14 19:29:28 — 13
  segundos después de la creación de la fila con la errata.

`getEntrenadorByEmail()` (`src/lib/airtable.ts`) filtra con `{Email} = "..."`, coincidencia
exacta — con el email distinto, no encontró ninguna fila. Confirmado además que la tabla
`Entrenadores` solo tenía, en el momento de la investigación, dos filas en total
(`jumirohu@gmail.com` y `esprartakofake@gmail.com`) — ninguna para `espartakofake@gmail.com`.

El bug de código real: `GET /api/entrenador/perfil` no distinguía "no existe ninguna fila de
Entrenador con este email" de "existe pero sin plan" — ambos casos devolvían `200 { soluciones:
[] }`. Cualquier desajuste de email (errata del admin al dar de alta, o cualquier otro motivo)
caía silenciosamente en la misma pantalla que un entrenador real sin plan pagado.

### Descartado antes de llegar a esta causa
Se auditó primero, contra datos reales, la hipótesis de un desajuste de mayúsculas/minúsculas
entre Airtable y Supabase Auth (motivada por el patrón defensivo ya existente en
`findSupabaseUserByEmail()`, `src/lib/supabase-server.ts`, que compara ambos lados en
minúsculas) — descartada: todos los emails reales están en minúsculas consistentes en ambos
sistemas. También se descartó que el bugfix de `DEC-2026-028` no estuviera desplegado —
confirmado que sí está en `main` y en el deployment real de producción de Vercel.

### Decisión
`GET /api/entrenador/perfil` devuelve `404 { error: 'Esta cuenta no está registrada como
entrenador' }` cuando `getEntrenadorByEmail()` no encuentra nada, en vez de `200 { soluciones:
[] }`. `src/app/dashboard/page.tsx` y `src/app/planes/page.tsx` (los dos puntos que redirigen
según `tienePlanBase()`) comprueban ese `404` explícitamente y muestran una pantalla "Cuenta no
registrada" con el email de la sesión activa, en vez de "Solicita acceso a un plan" (que da a
entender que sí eres entrenador) o el error genérico de carga de clientes. Los demás
consumidores del endpoint (`checkin-config`, `ClienteFicha`, `Marketplace`) ya manejaban
`!res.ok` con su propio fallback — sin cambios necesarios ahí. Sin cambios en `tienePlanBase()`,
el modelo de `Soluciones` ni ningún endpoint de Admin.

### Verificación
`tsc --noEmit`, `eslint` y `next build` sin errores. Prueba E2E contra el servidor real
(`next dev` ya activo en el puerto 3100) y Supabase real: usuario desechable
(`repro-perfil404-...@example.com`, patrón DEC-2026-009) sin ninguna fila de `Entrenadores` →
`GET /api/entrenador/perfil` devuelve `404` con el mensaje nuevo. Usuario y script de prueba
eliminados al terminar.

### Pendiente real (dato de producción, no tocado sin confirmación)
La fila de `Entrenadores` con la errata `esprartakofake@gmail.com` sigue en Airtable con
`Soluciones=["Seguimiento"]` asignado, y la cuenta real `espartakofake@gmail.com` sigue sin
ninguna fila de Entrenador propia — ese entrenador real todavía no puede acceder hasta corregir
el email a mano en Admin (o dar de baja la fila con la errata).

---

## DEC-2026-039 — Parte UX: Objetivos primero, Revisiones aparte

**Fecha:** 2026-08-15
**Tipo:** UX / Frontend
**Estado:** Implementada

### Contexto
RetainCoach se percibía como un "constructor de check-ins" (`Campos_checkin`, tipos
diario/semanal/periódico, `/checkin-config`) en vez de una app de seguimiento. El brief pidió
introducir dos conceptos claros para el entrenador y el cliente — **Objetivo** (algo que el
cliente quiere conseguir y se mide) y **Revisión** (preguntas/sensaciones que el entrenador
quiere conocer) — explícitamente **solo en la capa de presentación**: sin tocar Supabase,
Airtable, n8n, esquemas, endpoints ni el cálculo de progreso.

### Decisión
- **Objetivo** sigue siendo, sin ningún cambio, una fila de `Objetivos` (`GET/POST/PATCH/DELETE
  /api/clientes/[id]/objetivos[/[objetivoId]]`).
- **Revisión** = cualquier campo de `Campos_checkin` que **no** sea la fuente
  (`Fuente_field_id`) de ningún objetivo vigente del cliente. Se calcula en el frontend
  cruzando `objetivo.fuenteFieldId` (ya expuesto en `ObjetivoResuelto`, `src/lib/objetivos.ts`)
  contra `campo.id` — sin tabla, campo ni endpoint nuevo. Verificado con fixture real: al crear
  un objetivo con fuente "Pasos", ese campo desaparece de la lista de "campos de revisión" de
  la sección correspondiente automáticamente.
- **Revisiones se gestionan dentro de la ficha del cliente** (nuevo `RevisionesEntrenador.tsx` +
  `RevisionModal.tsx`) aunque el catálogo (`Campos_checkin`) sea por entrenador, no por cliente
  — decisión explícita del usuario tras señalar que no hay forma de que sea por cliente sin
  tocar el modelo de datos (fuera de alcance). La UI lo deja explícito: "Estas preguntas se
  aplican a todos tus clientes." `CampoPersonalizadoModal.tsx` (usado por `/checkin-config`) se
  deja intacto — `RevisionModal.tsx` es un componente hermano, mismo endpoint (`POST
  /api/entrenador/checkin-config/campos`), copy simplificado y periodicidad en lenguaje humano
  vía `describirRecurrencia()` (ya existía, `src/lib/checkinFields.ts`, usado hasta ahora por
  `ProgramacionTipo.tsx`) en vez de checkboxes técnicos "Diario/Semanal/Periódico".
- **Acceso avanzado** (`/checkin-config`, sin tocar su página ni componentes) se sacó de
  `ClientesLista.tsx` y de la ficha del cliente, y pasó a un icono en `Header.tsx`
  (`showCheckinConfigLink`, nuevo prop). Se pasa explícitamente solo desde el branch de
  `dashboard/page.tsx` que ya se renderiza igual para un entrenador real y para un admin en "Ver
  como entrenador" — **a propósito no se gatea por `isAdmin`**, decisión explícita del usuario
  para no repetir el bug de `DEC-2026-011` (el botón desaparecía en "Ver como entrenador" cuando
  se gateaba por `isAdmin`).
- **Objetivos `valor_objetivo` (peso)** obtienen tarjeta y copy propios ("objetivo: X kg / Actual:
  Y kg" + barra lineal dirigida) tanto en la ficha del entrenador como en el dashboard/check-in
  del cliente (etiqueta "¿Cuánto pesas?" cuando el campo `peso` alimenta un objetivo así) —
  reutilizando `ProgresoObjetivo.direccion/valorInicial/porcentaje` y `formatearProgresoTexto()`
  ya calculados por `calcularProgresoValorObjetivo()`, sin tocar `objetivos.ts`.
- **Deep-link "Registrar"** desde `/cliente/dashboard` (`MisObjetivos.tsx`) a
  `/cliente/checkin?campo={fuenteFieldId}` + `scrollIntoView()` al montar — puramente frontend
  (query param + DOM), no requiere ninguna API nueva.
- `ObjetivoModal.tsx` reordena el formulario ("qué mide → meta → frecuencia → guardar") y
  sustituye el selector de fuente por chips con nombres humanos de los campos ya existentes +
  "Otra métrica" (antes "Métrica nueva") + un enlace secundario para el caso sin fuente (antes
  un radio de igual peso visual que los demás) — misma lógica de estado y `handleSubmit`, cero
  cambios de comportamiento al guardar.

### Por qué no se tocó backend
Cada pieza de información que la nueva UX necesita ya la devuelven los endpoints existentes
(`fuenteFieldId` en `ObjetivoResuelto`, `describirRecurrencia()`/`proximaAperturaGenerica()` en
`checkinFields.ts`, `ProgresoObjetivo` completo desde `resolverObjetivo()`) — el trabajo de esta
fase fue enteramente de derivación y presentación en el cliente.

### Verificación
Prueba E2E con fixtures desechables (patrón `DEC-2026-009`, entrenador+cliente `@example.com`,
borrados al terminar) contra el servidor real:
- Objetivo diario "10.000 pasos" con métrica nueva "Pasos" (numérica) → campo creado una vez
  (`custom_pasos_...`).
- Objetivo semanal "60.000 pasos" con el mismo nombre de métrica → **no** duplicó el campo (1
  solo `Pasos` en el catálogo tras el segundo objetivo) — confirma el dedup de `DEC-2026-034`
  sigue intacto y es justo lo que la nueva UX necesita para "el cliente registra una vez,
  alimenta ambos objetivos".
- `POST /api/cliente/checkin` con `pasos=8500` (una sola llamada) → `GET` posterior mostró
  progreso diario `8500/10000 (85%)` **y** semanal `8500/60000 (14%)` desde el mismo dato.
- Partición objetivo/revisión: en la sección diaria, el campo "pasos" quedó excluido de la
  lista de "campos de revisión" (que sí incluyó `entrenamiento_realizado`/`energia`/`fatiga`/
  `animo`/`dolor`) — exactamente el cálculo que usa el nuevo `/cliente/checkin`.
- Objetivo de peso (`valor_objetivo`, bajar, inicial 80, meta 75) tras registrar `peso=78` →
  `porcentaje: 40` (coincide con `(80-78)/(80-75)=40%`, cálculo ya existente sin modificar).
- `tsc --noEmit`, `eslint` y `next build`, los tres sin errores.

**No probado visualmente en navegador** (sin Chrome/Playwright disponibles en esta sesión) — se
verificó la forma y corrección de los datos que las pantallas nuevas consumen, no su
renderizado real.

### Pendiente real (adaptación técnica, explícitamente fuera de alcance de esta fase)
- Revisiones por cliente (hoy por entrenador) requeriría relacionar `Campos_checkin` con
  `Clientes` — cambio de modelo de datos.
- Un registro verdaderamente inline en `/cliente/dashboard` (sin navegar a `/cliente/checkin`)
  requeriría extraer `CampoInput` a un flujo de guardado propio.
- Prueba visual real en navegador de todas las pantallas nuevas.

---

## DEC-2026-040 — Registro de objetivos independiente del lanzamiento de check-ins/revisiones

**Fecha:** 2026-08-15
**Tipo:** Bug de arquitectura / Backend
**Estado:** Corregido

### Hallazgo
Tras `DEC-2026-039` (Objetivos primero, Revisiones aparte), el botón "Registrar" de un objetivo
seguía pudiendo terminar en "Tu entrenador todavía no ha activado este check-in" — contradice
la decisión de producto: un objetivo activo debe poder registrarse exista o no una
revisión/check-in lanzada. Objetivos y Revisiones son conceptos independientes; solo compartían
almacenamiento (`Registros_checkin`) y catálogo (`Campos_checkin`), no debían compartir el gate
de lanzamiento.

### Causa exacta
`GET/POST /api/cliente/checkin` (`src/app/api/cliente/checkin/route.ts`) gateaban **todo un
tipo** (diario/semanal/periódico) por `programacion.lanzado`, sin distinguir si el campo en
cuestión era la fuente de un objetivo o una pregunta de revisión:
- `GET`: si `!lanzado`, devolvía `campos: []` y `objetivos: []` sin excepción — el objetivo no
  aparecía en absoluto, aunque estuviera activo y vigente.
- `POST`: `if (!lanzado) return 403` bloqueaba toda la petición, incluidos los campos de
  objetivo enviados en el mismo envío.

### Decisión
Se calcula, tanto en `GET` como en `POST`, el conjunto `idsFuenteObjetivo` = `Field_id` que son
`Fuente_field_id` de un objetivo del cliente autenticado con `Activo === true` y vigente hoy
(`esVigenteHoy()`, ya existente en `src/lib/objetivos.ts`) — derivado siempre de la ficha del
cliente resuelta por `getClienteActivoAutenticado()` (email del JWT), nunca de un ID que mande
el frontend.

- **`GET`**: cuando un tipo no está lanzado, `campos` pasa de `[]` a
  `campos.filter(c => idsFuenteObjetivo.has(c.id))` — los campos de objetivo siguen visibles;
  los de revisión, no. `objetivos` (y su progreso) se resuelve siempre igual, lanzado o no —
  se quitó el `return` anticipado que los vaciaba. `yaEnviado`/`ultimosValores` se recalculan
  también solo sobre los campos visibles, para no mostrar "ya registrado" sobre contenido que
  el cliente ni siquiera puede ver.
- **`POST`**: se quitó el `403` global. `camposAEnviar` acepta un campo si `lanzado` es `true`
  (comportamiento de antes, sin cambios) **o** si ese campo está en `idsFuenteObjetivo`. Los
  campos de revisión enviados con el tipo sin lanzar se ignoran en silencio (mismo patrón ya
  existente para la regla "No he entrenado", `campoDisponible()`) — no se rechaza toda la
  petición para no bloquear también los campos de objetivo del mismo envío. Si tras el filtro
  no queda ningún campo válido, sigue devolviendo el mismo `400` que ya existía ("No hay
  valores válidos para los campos activos de este tipo").
- **`src/app/cliente/checkin/page.tsx`**: ya no sustituye la sección entera por "no disponible"
  cuando el tipo no está lanzado — solo lo hace si `estado.campos.length === 0` de verdad. La
  partición objetivo/revisión de `DEC-2026-039` no necesitó cambios: como la API ya solo
  devuelve campos de revisión cuando están lanzados, el bloque "Revisión" queda vacío por
  construcción cuando corresponde.
- **`src/app/cliente/dashboard/page.tsx`** (tarjeta "Revisión"): se quitó el aviso "No
  disponible todavía" para un tipo no lanzado — esa tarjeta es solo de revisiones, y el aviso
  podía aparecer sobre un tipo que en realidad tenía un objetivo perfectamente registrable
  desde "Mis objetivos". Ahora simplemente omite la fila si no hay revisión real pendiente.

### Por qué no se reescribió el modelo
`Registros_checkin` (EAV insert-only, `DEC-2026-007`), el cálculo de progreso
(`resolverObjetivo()`/`calcularProgresoDesdeCheckins()`/`calcularProgresoValorObjetivo()`) y el
dedup de métrica compartida (`DEC-2026-034`) no se tocaron — la única pieza que estaba mal era
la condición de acceso (`lanzado`), no el almacenamiento ni el cálculo. `/checkin-config`,
`Checkin_tipos`, `resolverLanzamientoPorTipo()` y el resto de la programación de revisiones
siguen exactamente igual.

### Seguridad
`idsFuenteObjetivo` se deriva siempre server-side de la ficha del cliente autenticado — nunca
de un id de objetivo o de cliente que llegue en el body. El gate de cliente activo/inactivo
(`getClienteActivoAutenticado`) no cambió y sigue evaluándose antes que cualquier lógica nueva.
Un objetivo desactivado (`Activo=false`) o fuera de vigencia deja de desbloquear su campo de
inmediato — no hay forma de que un objetivo "eliminado" (que `getObjetivosByClienteEmail()` ya
excluye centralmente, `DEC-2026-032`) reaparezca. La validación de tipo/rango
(`validarValorCampo()`) no cambió: sigue rechazando con `400` explícito, nunca en silencio.

### Verificación
`tsc --noEmit`, `eslint` y `next build`, los tres sin errores. Prueba E2E con fixtures
desechables (2 entrenadores + 2 clientes ficticios, `@example.com`, patrón `DEC-2026-009`,
borrados al terminar), 22 comprobaciones, todas OK:
- Objetivo diario "10.000 pasos" + objetivo semanal "60.000 pasos" (misma fuente) creados y
  registrados **sin lanzar ningún check-in** — antes devolvía `403`, ahora `201`; progreso
  diario `8500/10000`, semanal `8500/60000`, desde un único registro.
- Reenvío idéntico inmediato sigue respondiendo `200 duplicado=true` (guard de doble envío
  intacto, ver `DEC-2026-037` sobre su límite conocido bajo concurrencia real).
- Objetivo de peso (`valor_objetivo`, bajar, inicial 70, meta 65): secuencia de registros
  70→68→66→69 kg dio porcentajes `0→40→80→20`, exactamente el cálculo esperado (avanza y
  retrocede correctamente).
- Cliente sin objetivo de peso: el campo `peso` no aparece en ningún tipo sin lanzar, y un
  intento directo de `POST` con `valores: {peso: X}` sin objetivo ni check-in lanzado se
  rechaza con `400` (no crea el registro).
- Cliente inactivo (`Estado='Perdido'`) sigue bloqueado con `403`.
- Aislamiento entre dos clientes de fixtures distintos: ninguno ve los objetivos del otro.
- Valor de tipo incompatible (`peso: "no-soy-un-numero"`) rechazado con `400` explícito.

**No probado visualmente en navegador** (sin Chrome/Playwright disponibles en esta sesión) —
verificado el comportamiento real de la API contra Supabase/Airtable reales.

### Limitación documentada (no resuelta a propósito)
La distinción "campo de objetivo vs de revisión" no es una propiedad fija guardada en
`Campos_checkin` — se recalcula en cada request cruzando `Fuente_field_id` de los objetivos
activos del cliente contra el catálogo del entrenador. Si el entrenador desactiva un objetivo
después de que su campo ya estuviera disponible como revisión (tipo lanzado), ese campo sigue
siendo registrable por el cliente como revisión normal — comportamiento correcto y ya
existente, no una regresión de este fix, mencionado aquí para que quede explícito el modelo
mental correcto en sesiones futuras.

---

## DEC-2026-041 — Objetivos independientes de Revisiones: ajustes de UX y catálogo

**Fecha:** 2026-08-15
**Tipo:** UX / Frontend / Backend menor
**Estado:** Implementada

### Contexto
Tras probar `DEC-2026-040` en el preview de Vercel de la rama
`fix-objetivos-independientes-revisiones`, surgieron cinco ajustes puntuales sobre el mismo
tema (Objetivos independientes de Revisiones). Se agrupan en una sola decisión por ser
iteraciones de la misma sesión, no decisiones arquitectónicas nuevas.

### 1. Registro enfocado en un único campo
"Registrar" en un objetivo llevaba a `/cliente/checkin` y mostraba **todos** los campos de
objetivo de esa sección (p. ej. peso junto a pasos), aunque el cliente solo quisiera registrar
uno. `MisObjetivos.tsx` construye ahora el link con `?campo={fuenteFieldId}&tipo={tipo}` (tipo
calculado vía `PERIODICIDAD_A_TIPO_CHECKIN[objetivo.periodicidad]`, ya existente en
`src/lib/objetivos.ts`). `src/app/cliente/checkin/page.tsx` detecta esos dos parámetros y
renderiza un formulario enfocado en ese único campo (con su barra de progreso si el objetivo es
`valor_objetivo`), en vez de la sección completa. `enviarCampoUnico()` manda solo el valor de
ese campo al `POST`, no el resto de valores prellenados de la sección. El flujo de Revisión (sin
esos parámetros en la URL) no cambia.

### 2. Revisiones semanales por defecto; Peso/Entrenamiento realizado/Pasos fuera de config avanzada
Decisión explícita del usuario (confirmada con `AskUserQuestion` antes de tocar el catálogo,
dado que afecta a cuentas reales sin config propia): `CAMPOS_ESTANDAR`
(`src/lib/checkinFields.ts`) — Energía, Fatiga, Ánimo, Dolor, Comentario, Adherencia y Medidas
pasan de `tiposDefault` repartidos entre diario/semanal/periódico a `['semanal']` únicamente,
consistente con "Revisión semanal" como el flujo por defecto ahora que los objetivos llevan el
registro diario/frecuente. Peso y Entrenamiento realizado (`tiposDefault` sin tocar, siguen
funcionando igual como fuente de objetivo) y cualquier campo personalizado llamado "Pasos" dejan
de listarse en `/checkin-config` — nueva `esCampoOcultoEnConfigAvanzada()`, usada solo para
filtrar el render de `CheckinConfigView.tsx`, sin tocar el catálogo, `Registros_checkin` ni el
endpoint `GET /api/entrenador/checkin-config` (que otros consumidores como `ObjetivoModal`
siguen necesitando sin filtrar).

### 3. Botón "Eliminar" en revisiones
Nuevo `borrarCampoCheckin()` (`src/lib/airtable.ts`) y `DELETE
/api/entrenador/checkin-config/campos/[fieldId]` (nueva ruta). Campo **personalizado**: se borra
la fila de Airtable de verdad (no existe en código, no hay a qué revertir). Campo **estándar**:
no se puede borrar del catálogo (vive en `CAMPOS_ESTANDAR`) — se desactiva de forma duradera
(`Activo=false`, creando la fila de override si todavía no existía) para que quede fuera de las
pantallas de revisión igual que si se hubiera borrado. Botón "Eliminar" con confirmación inline
(mismo patrón que `ObjetivosEntrenador.tsx`) añadido en `CheckinConfigView.tsx` y en la ficha
del cliente.

### 4. Bug real corregido: "Eliminar" no hacía desaparecer la fila
**Hallazgo:** para campos estándar, "Eliminar" solo desactivaba (`Activo=false`), pero ambas
listas (config avanzada y ficha del cliente) seguían mostrando las filas inactivas junto a las
activas — solo cambiaba el badge a "Inactivo"/"Inactiva". Desde la perspectiva del usuario,
parecía que el botón no hacía nada. **Fix:** ambas listas filtran ahora por `campo.activo`
(solo se muestran activos); las filas eliminadas/desactivadas quedan en un desplegable "Campos
eliminados (N)" / "Revisiones eliminadas (N)" al final, con botón "Reactivar" (reutiliza el
`PUT /api/entrenador/checkin-config` ya existente) — para no perder la reversibilidad. El
toggle "Activo/Inactivo" suelto dentro de la fila (redundante con Eliminar, mismo efecto visual
una vez filtrada la lista) se quitó.

### 5. Revisiones solo en config avanzada; botón ⚙️ junto a "+ Registrar cliente"
El bloque "Revisiones" se quitó de la ficha del cliente por completo — decisión explícita del
usuario, con la config avanzada (`/checkin-config`) como único lugar de gestión.
`RevisionesEntrenador.tsx` y `RevisionModal.tsx` (introducidos en `DEC-2026-039`) quedaron sin
ningún consumidor y se borraron como código muerto. El botón ⚙️ "Check-ins avanzados" (que
`DEC-2026-039` había movido al `Header`, gateado por el branch de render correcto para evitar
`DEC-2026-011`) se mueve ahora al toolbar de `ClientesLista.tsx`, a la izquierda de "+
Registrar cliente" — mismo componente que ya se renderiza igual para un entrenador real y para
un admin en "Ver como entrenador" (sin condicionar por `isAdmin`), así que sigue sin repetir
`DEC-2026-011`. Tooltip nativo (`title`) con el nombre y un resumen breve de para qué sirve.

### Verificación
`tsc --noEmit`, `eslint` y `next build` sin errores en cada uno de los 5 commits. Prueba E2E
con fixtures desechables para los puntos 2-4: catálogo por defecto confirmado en `['semanal']`
para un entrenador sin overrides; Peso/Entrenamiento realizado confirmados intactos en el
catálogo (no borrados) tras ocultarse de la config avanzada; `DELETE` de un campo personalizado
borra la fila de verdad; `DELETE` de un campo estándar sin override crea uno con
`Activo=false`, y repetir el `DELETE` sobre un override ya existente sigue funcionando; un
entrenador no puede borrar un campo personalizado de otro (`404`, aislado por email del JWT);
tras `DELETE`, el campo queda fuera de la lista que filtra por `activo` (lo que realmente ve la
UI). Los puntos 1 y 5 son cambios de frontend/navegación puros, validados por build + inspección
de código.

**No probado visualmente en navegador por Claude** (sin Chrome/Playwright disponibles en esta
sesión) — la validación visual de los 5 puntos la hizo el usuario directamente en el preview de
Vercel de esta rama, y de ahí surgieron los puntos 1, 4 y 5 de esta misma decisión.

---

## DEC-2026-042 — Campos exclusivos de objetivo nunca aparecen como revisión suelta

**Fecha:** 2026-08-15
**Tipo:** Bug / Backend
**Estado:** Corregido

### Hallazgo (datos reales)
En la cuenta de prueba `espartakofake@gmail.com` se comprobó que `Peso` y `Entrenamiento
realizado`, ya ocultos de `/checkin-config` por `DEC-2026-041` (punto 2), seguían con
`Activo=true` en Airtable (config heredada de antes de ese cambio). La ocultación de
`DEC-2026-041` solo actuaba sobre la pantalla de configuración del entrenador —
`GET/POST /api/cliente/checkin` seguían tratándolos como cualquier otro campo activo. Un
cliente sin objetivo de peso seguía viendo "Peso" como pregunta de revisión suelta en
`/cliente/checkin`, contradiciendo la regla explícita de `DEC-2026-040`: "el objetivo activa la
métrica; si no existe objetivo de peso, el cliente no debe ver un campo de peso".

### Decisión
`src/app/api/cliente/checkin/route.ts`: los campos que `esCampoOcultoEnConfigAvanzada()`
identifica como "exclusivos de objetivo" (peso, entrenamiento_realizado, cualquier
personalizado llamado "Pasos") se excluyen ahora de `camposVisibles` en el `GET` salvo que sean
de verdad la fuente (`Fuente_field_id`) de un objetivo vigente **de ese cliente concreto**
(`idsFuenteObjetivo`) — con independencia de `Activo` o de si el tipo está lanzado. El `POST`
aplica el mismo criterio: `campoDisponible(...) && (idsFuenteObjetivo.has(id) || (lanzado &&
!esCampoOcultoEnConfigAvanzada(campo)))` — un intento directo de registrar `peso` sin objetivo
se rechaza con `400` aunque el tipo esté lanzado y el campo tenga `Activo=true`. No basta con
ocultar en frontend (`DEC-2026-041`); la regla se aplica también en el backend, por petición
manipulada o no.

### Hallazgo aparte, no resuelto (dato real, pendiente de confirmación)
La misma cuenta tiene **dos filas duplicadas** en `Campos_checkin` para `Peso`
(`rec53eqbp0CJRxcWQ` y `recZAuu25lDMOpRMS`) y para `Medidas` (`recWJjmSjvJvpXRSh` y
`recalEbRIpRqsq0LD`), creadas con segundos de diferencia el 2026-08-14. Hipótesis más probable:
`PUT /api/entrenador/checkin-config` no es idempotente frente a dos peticiones casi simultáneas
para el mismo `fieldId` sin override previo — ambas pueden leer "no existe fila" antes de que
la primera termine de crearla, y cada una crea la suya (`crearCampoCheckin`, sin ningún lock ni
constraint de unicidad). `resolverCamposEfectivos()` no rompe con esto (usa un `Map` por
`Field_id`, se queda con la última fila procesada), pero dos filas reales para el mismo campo
son basura de producción. **No se ha limpiado ni arreglado la causa** — anotado para una sesión
futura si se confirma que molesta o se repite.

### Verificación
Prueba E2E con fixture desechable reproduciendo el escenario real exacto: `PUT` deja `peso` y
`entrenamiento_realizado` con `Activo=true` y tipos asignados, se lanzan los tres tipos de
check-in, y **sin ningún objetivo** para ese cliente — `GET /api/cliente/checkin` no devuelve
ni `peso` ni `entrenamiento_realizado` en ningún tipo (pero sí `energia`, revisión normal);
`POST` con `valores: {peso: 80}` se rechaza con `400`. Se crea después un objetivo de peso para
ese mismo cliente — `peso` reaparece en `GET` y el `POST` pasa a aceptarse (`201`). `tsc
--noEmit`, `eslint` y `next build` sin errores.

**No probado visualmente en navegador.**

---

## DEC-2026-043 — `/cliente/checkin` (vista general): solo "Revisión", sin bloque de objetivos ni títulos técnicos por tipo

**Fecha:** 2026-08-15
**Tipo:** Bug / Frontend
**Estado:** Corregido

### Hallazgo
Tras el fix de backend de `DEC-2026-042`, Juanmi reportó que "Pasos" seguía apareciendo en
`/cliente/checkin`, junto con títulos de sección "Esta semana"/"Tus datos". La causa no era una
repetición del bug de `DEC-2026-042` (el backend ya no servía `peso`/`entrenamiento_realizado`/
"Pasos" como revisión suelta) sino un problema de presentación separado: la vista general
(no la de registro de un solo campo) todavía renderizaba, dentro de cada sección
diario/semanal/periódico, un bloque completo "Objetivos de hoy/esta semana/el periodo" con el
nombre técnico de cada objetivo (incluido "Pasos") mezclado con la "Revisión", y usaba
`TITULOS`/`TITULOS_OBJETIVOS` con etiquetas por tipo ("Hoy", "Esta semana", "Tus datos") en vez
de una única palabra "Revisión".

### Decisión
`src/app/cliente/checkin/page.tsx`: la vista general deja de mostrar ningún contenido de
objetivos — los objetivos se registran exclusivamente desde el modo de campo único
(`?campo=&tipo=`, ya enlazado desde `MisObjetivos.tsx` desde `DEC-2026-041`). Por sección se
calcula `camposRevision = estado.campos.filter(c => !idsFuenteDeObjetivos(estado.objetivos).has(c.id))`
y se renderiza un único bloque con encabezado fijo "Revisión" y el texto "Esto es una revisión
de tu estado, no un objetivo.", listando solo `camposRevision`. Si una sección no tiene ningún
campo de revisión (todo lo configurado son fuentes de objetivo, como "diario" en el caso real
reportado), se muestra igualmente el encabezado "Revisión" con un mensaje de estado
(disponible desde / "tu entrenador todavía no ha activado ninguna revisión") en vez de ocultar
la sección entera, para que el cliente nunca vea una pantalla en blanco sin explicación.
Eliminadas las constantes `TITULOS`/`TITULOS_OBJETIVOS`; el `<h1>` de la página pasa de "Tu
seguimiento" a "Revisión". `enviar()`/`enviarCampoUnico()` se unificaron en `enviarCampos(seccion,
campoIds, recargar?)`, que envía exactamente los `campoIds` indicados — la vista general envía
`camposRevision.map(c => c.id)`, el modo de campo único sigue enviando solo ese campo. Sin
cambios en `GET/POST /api/cliente/checkin` (el criterio de qué es objetivo vs revisión ya lo
resuelve el backend desde `DEC-2026-040`/`DEC-2026-042`; este fix es puramente de qué subconjunto
del payload ya recibido se pinta en pantalla).

### Por qué no se ocultó la sección cuando no hay revisiones
Elegido explícitamente sobre la alternativa de devolver `null`: un cliente con **todos** sus
campos configurados como objetivo (como en el caso real) se quedaría con "diario" completamente
invisible sin ninguna pista de por qué — más confuso que un mensaje corto. Coherente con el
patrón ya usado para "sin lanzar" en el resto del archivo.

### Verificación
Prueba E2E con fixture desechable: entrenador con un objetivo de pasos diario (`Fuente_field_id`
propio) y `energia` activado como revisión semanal, ambos tipos lanzados. `GET
/api/cliente/checkin` (mismo payload que consume la página): en "diario", el único campo
(`Pasos`) queda excluido de `camposRevision` (0 campos de revisión, correcto — es 100% objetivo);
en "semanal", `energia` aparece como revisión y no hay ningún objetivo colado. `tsc --noEmit`,
`eslint` y `next build` sin errores.

**No probado visualmente en navegador** — verificado por inspección de código (JSX) + los mismos
datos que consume la página, siguiendo el mismo criterio de validación ya usado para cambios
puramente frontend anteriores en esta sesión (`DEC-2026-041`, punto 5).

---

## DEC-2026-044 — Campo exclusivo de objetivo solo cuenta como tal en el tipo de la periodicidad real del objetivo

**Fecha:** 2026-08-15
**Tipo:** Bug / Backend
**Estado:** Corregido

### Hallazgo (datos reales)
Juanmi reportó que las revisiones diaria/semanal/periódica mostraban "lo mismo" repetido en
vez de solo los campos que el entrenador marcó para cada periodo. Se encontró el caso real en
la cuenta `retaincoachsolution@gmail.com` (cliente de `espartakofake@gmail.com`): `Peso` tiene
en `Campos_checkin` un `Tipos: ['semanal', 'periodico']` heredado de antes de que `DEC-2026-041`
lo ocultara de `/checkin-config` (el entrenador ya no puede editar ese `Tipos`), pero el objetivo
de peso real del cliente es `periodicidad: 'semanal'` únicamente. `idsFuenteObjetivo` en
`GET/POST /api/cliente/checkin` se calculaba de forma global (cualquier objetivo con
`Fuente_field_id = 'peso'`, sin mirar su periodicidad) y se reutilizaba igual en las tres
secciones — así que `Peso` se consideraba "de objetivo" tanto en "semanal" (correcto) como en
"periódico" (incorrecto: ahí no hay ningún objetivo de peso mensual). Al no reconocerse como
objetivo en "periódico", el frontend (`DEC-2026-043`) lo mostraba ahí como pregunta de revisión
suelta — literalmente "lo mismo" (Peso) apareciendo en dos secciones distintas.

### Decisión
`src/app/api/cliente/checkin/route.ts`: `idsFuenteObjetivo` pasa a calcularse **por tipo**
(`idsFuenteObjetivoPorTipo: Map<FrecuenciaCheckin, Set<string>>`), agrupando cada
`objetivo.fuenteFieldId` según `PERIODICIDAD_A_TIPO_CHECKIN[objetivo.periodicidad]` — no según
el `Tipos` legado del campo en `Campos_checkin`. Un campo exclusivo de objetivo (peso,
entrenamiento_realizado, "Pasos") solo se trata como "de objetivo" en el tipo que corresponde a
la periodicidad real de ESE objetivo concreto; en cualquier otro tipo en el que el campo
aparezca por su `Tipos` heredado, sigue tratándose como `esCampoOcultoEnConfigAvanzada()` y
queda excluido por completo (no aparece ni como objetivo ni como revisión). Mismo criterio
aplicado en el `POST`: un intento directo de registrar `peso` contra un tipo que no coincide con
la periodicidad del objetivo real se rechaza con `400`, aunque el campo tenga ese tipo asignado
en su config legada.

### Por qué no se tocó `Campos_checkin.Tipos` de los campos exclusivos existentes
Se consideró limpiar directamente el `Tipos` heredado de las filas reales (dejar solo el tipo
que coincide con el objetivo), pero se descartó: son datos reales de producción y el criterio
correcto (periodicidad del objetivo, no `Tipos` del campo) ya cubre el caso sin necesitar tocar
Airtable — y sigue siendo correcto automáticamente si en el futuro el mismo campo se reutiliza
como fuente de un objetivo con otra periodicidad.

### Verificación
Prueba E2E con fixture desechable reproduciendo el escenario real exacto: fila `Peso` creada
directamente con `Tipos: ['semanal', 'periodico']` (igual que en producción) + objetivo de peso
`periodicidad: 'semanal'` — `GET /api/cliente/checkin` no devuelve `peso` ni en `diario` ni en
`periodico` (solo en `semanal`, ni como objetivo ni como revisión en las otras dos); `POST
peso` contra `periodico` se rechaza (`400`); contra `semanal` se acepta (`201`). `energia`
(revisión normal, sin exclusividad) sigue apareciendo solo en su tipo configurado, sin cambios.
`tsc --noEmit`, `eslint` y `next build` sin errores.

**No probado visualmente en navegador.**

---

## DEC-2026-045 — Un campo de revisión pertenece a un único tipo de check-in, nunca a varios a la vez

**Fecha:** 2026-08-15
**Tipo:** Producto / Arquitectura — reemplaza parcialmente `DEC-2026-015`
**Estado:** Implementada

### Decisión anterior que reemplaza
`DEC-2026-015` permitía explícitamente que un campo de revisión perteneciera a varios tipos de
check-in a la vez (ej. Energía → Diario + Semanal), modelado como `Campos_checkin.Tipos`
(multiSelect) con checkboxes en `/checkin-config`. Juanmi pidió ahora explícitamente lo
contrario: "que lo del checkin diario no aparezca en el checkin semanal ni periódico y
viceversa" — confirmado explícitamente (ver pregunta de aclaración) que quiere quitar la
capacidad multi-tipo, no solo verificar que no hay solape accidental.

### Decisión
Un campo de revisión editable desde `/checkin-config` pertenece a un único tipo de check-in.
`CheckinConfigView.tsx` cambia sus checkboxes por radio buttons (`seleccionarTipo()`, reemplaza
`toggleTipo()`) — un campo solo puede tener un tipo marcado a la vez.
`CampoPersonalizadoModal.tsx` cambia igual: un `<input type=radio>` por campo nuevo en vez de
checkboxes, estado `tipoCheckin: Frecuencia` en vez de `tipos: Frecuencia[]`. Reforzado también
en el backend (defensa en profundidad, no solo cosmético en frontend): `PUT
/api/entrenador/checkin-config` y `POST /api/entrenador/checkin-config/campos` recortan
`tipos` a como mucho un elemento (`.slice(0, 1)`) antes de guardar, aunque llegue una petición
manipulada con varios.

### Por qué no se tocó el esquema de Airtable
`Campos_checkin.Tipos` sigue siendo `multipleSelects` en Airtable — cambiar el tipo de campo
implicaría migrar datos y no aporta nada que la app no garantice ya escribiendo siempre como
mucho un valor. Los campos exclusivos de objetivo (`peso`, `entrenamiento_realizado`, "Pasos")
no pasan por esta pantalla (ver `DEC-2026-041`) y no se tocan aquí — su solapamiento entre tipos
ya se resolvió por otra vía en `DEC-2026-044` (se resuelven por la periodicidad real del
objetivo, no por su `Tipos`).

### Migración de datos real
Verificado contra los datos reales de `Campos_checkin`: ningún campo de revisión editable
(no oculto) tenía más de un tipo asignado en ninguna cuenta real antes de este cambio — no hizo
falta ninguna migración/backfill.

### Verificación
Prueba E2E con fixture desechable: `PUT` con `tipos: ['diario', 'semanal']` para un campo
estándar se normaliza a `['diario']` (el primero); `POST` de un campo personalizado con
`tipos: ['semanal', 'periodico']` se normaliza a `['semanal']`; `GET /api/cliente/checkin`
confirma que cada campo aparece únicamente en su tipo, nunca en los otros dos. `tsc --noEmit`,
`eslint` y `next build` sin errores.

**No probado visualmente en navegador.**

---

## DEC-2026-046 — Secciones de `/cliente/checkin` sin etiqueta de tipo: confusión, no bug de datos

**Fecha:** 2026-08-15
**Tipo:** Bug / UX
**Estado:** Corregido

### Hallazgo
Juanmi reportó, probando con una cuenta real en producción: "en diario me sigue saliendo lo del
semanal y al revés". Se recalculó a mano, con datos reales frescos (`Campos_checkin`,
`Objetivos`, `Registros_checkin`, `Checkin_tipos` de `espartakofake@gmail.com` /
`retaincoachsolution@gmail.com`), exactamente la misma lógica que ejecuta `GET
/api/cliente/checkin` tras `DEC-2026-044`/`DEC-2026-045` — **la separación por tipo ya era
correcta**: diario mostraba solo Energía/Fatiga/Ánimo/Dolor (todos con `Tipos:['diario']`),
semanal solo Adherencia/Comentario/Peso-objetivo (todos `semanal`), sin ningún cruce. Aclarado
explícitamente con Juanmi (pregunta de aclaración): el problema no está en `/checkin-config`
sino en `/cliente/checkin`. Causa real encontrada por inspección de `page.tsx`: las tres
secciones (diario/semanal/periódico) tenían el mismo título fijo, literalmente "Revisión", sin
ningún indicador de a qué tipo pertenecía cada una (herencia de `DEC-2026-043`) — así que aunque
los datos ya estaban bien separados, el cliente no podía saber a simple vista cuál sección era
cuál. Además, la sección "periódico" desaparecía por completo (`return null`) cuando no tenía
ningún campo configurado, sumando a la sensación de que algo no cuadraba.

### Decisión
`src/app/cliente/checkin/page.tsx`: nuevo `TITULO_SECCION` (`'Revisión diaria'`, `'Revisión
semanal'`, `'Revisión periódica'`), usado en el `<h2>` de cada sección en vez del `'Revisión'`
genérico. Las tres secciones se muestran siempre (antes "periódico" con 0 campos y ya lanzado
desaparecía sin más) — cuando no hay campos de revisión configurados, la sección se sigue
mostrando con su título y un mensaje de estado ("no ha activado ninguna revisión de este tipo" /
"no ha configurado ninguna pregunta de revisión para este tipo" / fecha de disponibilidad).

### Aprendizaje
Un reporte de "los datos se mezclan entre tipos" puede tener causa raíz en la presentación (no
poder distinguir visualmente las secciones) en vez de en el cálculo — verificar primero con
datos reales recalculados a mano antes de asumir dónde está el bug, y preguntar explícitamente
dónde lo ve el usuario (`/checkin-config` vs `/cliente/checkin`) cuando la ambigüedad podría
llevar a arreglar la pantalla equivocada.

### Hallazgo aparte, no resuelto — cuenta de prueba con `Estado: 'Perdido'`
Al investigar se encontró que el cliente real `retaincoachsolution@gmail.com` (email de nombre
"retaincoach", el más probable candidato a "la cuenta de retaincoach" mencionada) tiene
`Clientes.Estado = 'Perdido'` en este momento — con ese estado, `getClienteActivoAutenticado()`
bloquea con `403` cualquier acceso a `/cliente/checkin` (ver `DEC-2026-019`). No se tocó (dato
real, cambia el acceso de una cuenta real) — si Juanmi confirma que está probando con esa cuenta
y no consigue entrar en absoluto, el problema sería este estado, no la separación por tipo.

### Verificación
Prueba E2E con fixture desechable: "energia" (config explícita a diario) no aparece en
semanal/periódico; "fatiga"/"medidas" (default de catálogo a semanal) no aparecen en
diario/periódico; periódico sin nada configurado devuelve 0 campos en los tres tipos, consistente
con lo recalculado a mano sobre los datos reales. `tsc --noEmit`, `eslint` y `next build` sin
errores.

**No probado visualmente en navegador.**

---

## DEC-2026-047 — `DEC-2026-044` era demasiado estricta: revertida a exclusión global, corregido el deep-link "Registrar"

**Fecha:** 2026-08-15
**Tipo:** Bug / Backend — corrige `DEC-2026-044`
**Estado:** Corregido

### Hallazgo (dato real, cuenta `retaincoachsolution@gmail.com`)
Tras confirmar con Juanmi que `DEC-2026-046` no era el problema, se hizo una llamada real de
solo lectura (`generateLink`/`verifyOtp`, sin escribir nada) a `GET /api/cliente/checkin` para
esa cuenta y se comparó con los datos crudos de Airtable. La separación por tipo era correcta,
pero se encontró un objetivo real, "Pasos" (`periodicidad: 'semanal'`, fuente
`custom_pasos_c5rmjf`), cuyo campo en `Campos_checkin` tiene `Tipos: ['diario']` — creado así por
`resolverOCrearCampoCheckinParaObjetivo()`, que siempre asigna `['diario']` a una métrica nueva
sin importar la periodicidad del objetivo (comportamiento documentado y deliberado: permite
registrar a diario y agregar en ventana semanal/mensual, ver `resolverObjetivo()` en
`objetivos.ts`, que agrega `Registros_checkin` **sin filtrar por `Tipo_registro`**). Con la
restricción por tipo introducida en `DEC-2026-044` (`idsFuenteObjetivoPorTipo`, que solo
reconocía un campo como "de objetivo" en el tipo que coincide con la periodicidad del objetivo),
este campo dejó de reconocerse como objetivo en "diario" (porque el objetivo es "semanal") y a
la vez nunca vivió en "semanal" (su `Tipos` es solo `diario`) — quedó **invisible en las tres
secciones**, ni como objetivo ni como revisión. El enlace "Registrar" de `MisObjetivos.tsx`
(`?campo=X&tipo=semanal`, derivado de la periodicidad) apuntaba además al tipo equivocado, así
que aunque el campo hubiera sido visible en otro sitio, el enlace nunca habría llegado a él.

### Decisión
1. **`src/app/api/cliente/checkin/route.ts` (GET y POST):** revertida la restricción por tipo de
   `DEC-2026-044` — `idsFuenteObjetivo` vuelve a calcularse de forma GLOBAL (cualquier objetivo
   activo y vigente con esa fuente, de cualquier periodicidad), igual que en `DEC-2026-042`. Es
   correcto porque el progreso de un objetivo se calcula sobre TODOS los registros de ese
   `Field_id` sin filtrar por `Tipo_registro` — no hay ninguna razón funcional para exigir que el
   tipo de la sección coincida con la periodicidad del objetivo.
2. **`src/lib/objetivos.ts`:** nuevo campo `ObjetivoResuelto.fuenteTipos` (los `Tipos` reales del
   campo fuente, `campoFuente?.tipos ?? []`) — expone al frontend dónde vive de verdad el campo,
   independientemente de la periodicidad del objetivo.
3. **`src/components/MisObjetivos.tsx`:** `linkRegistrar()` usa ahora `objetivo.fuenteTipos[0] ??
   PERIODICIDAD_A_TIPO_CHECKIN[periodicidad]` (fallback solo para un campo huérfano sin `Tipos`
   resuelto) en vez de derivar el tipo de la periodicidad — el enlace "Registrar" siempre apunta
   al tipo donde el campo realmente vive.
4. **`src/app/cliente/checkin/page.tsx`:** la exclusión de campos-de-objetivo en la vista general
   (`camposRevision`) y la búsqueda del objetivo en el modo enfocado pasan de ser locales a
   `estado[seccion].objetivos` a ser GLOBALES (unión de `diario`/`semanal`/`periodico`) — porque
   un objetivo puede estar filed bajo un tipo (según su periodicidad) mientras su campo fuente
   vive y se muestra en otro tipo distinto (según su propio `Tipos`), y ambos lados deben
   coincidir con el criterio global del backend.

### Por qué `DEC-2026-044` estaba mal enfocada
Esa decisión resolvía el caso real de `Peso` (Tipos legado `['semanal','periodico']`, objetivo
solo semanal) colándose como revisión en "periódico" — pero la causa real de ESE bug era que el
FRONTEND comparaba contra `estado[seccion].objetivos` (local), mientras el BACKEND ya calculaba
`idsFuenteObjetivo` de forma global — un frontend local + backend global es lo que producía el
desajuste. `DEC-2026-044` "arregló" el síntoma haciendo el backend también local, pero eso rompe
cualquier objetivo cuya periodicidad no coincide con el tipo real del campo (el caso "Pasos"
semanal con campo diario, que es un patrón soportado y documentado, no un caso raro). El fix
correcto era hacer el FRONTEND global para igualar al backend, no al revés.

### Verificación
Prueba E2E con fixture desechable reproduciendo el caso "Pasos" real (objetivo con métrica nueva,
periodicidad semanal, campo creado con `Tipos:['diario']`): el objetivo expone
`fuenteTipos:['diario']`; el campo SÍ existe en `diario.campos` (antes ausente de las tres
secciones); `POST` contra `diario` (el tipo real) se acepta con `201`. Repetida también la prueba
original de `DEC-2026-044` (Peso con `Tipos` legado `['semanal','periodico']`, objetivo solo
semanal): simulando la lógica exacta del frontend (exclusión global), `peso` sigue sin aparecer
como revisión suelta ni en "semanal" ni en "periódico" — el caso original sigue arreglado.
Confirmado además con una llamada real de solo lectura a la cuenta `retaincoachsolution@gmail.com`
tras el fix: `custom_pasos_c5rmjf` aparece en `diario.campos` y `semanal.objetivos` expone
`fuenteTipos:['diario']`. `tsc --noEmit`, `eslint` y `next build` sin errores.

**No probado visualmente en navegador.**

---

## DEC-2026-048 — Registrar revisión debe mostrar únicamente la periodicidad seleccionada

**Fecha:** 2026-08-15
**Tipo:** Bug / Frontend + Backend
**Estado:** Corregido (en preview, pendiente de merge a `main`)

### Causa exacta
El botón "Registrar"/"Ver-actualizar" de cada fila de la tarjeta "Revisión" del dashboard del
cliente (`src/app/cliente/dashboard/page.tsx`), uno por tipo (Diario/Semanal/Periódico),
navegaba los tres a la misma URL sin ningún parámetro: `router.push('/cliente/checkin')`. El
tipo pulsado nunca llegaba a la página de destino, así que `/cliente/checkin` siempre caía en
el modo general (las tres secciones a la vez), sin importar cuál se pulsó. El backend (`GET
/api/cliente/checkin`) ya separaba los campos correctamente por tipo internamente — la pérdida
del tipo era exclusivamente ese `router.push` sin parámetros.

### Decisión
- **`src/app/cliente/dashboard/page.tsx`:** el botón pasa a `router.push(\`/cliente/checkin?tipo=${tipo}\`)`.
- **`src/app/api/cliente/checkin/route.ts` (`GET`):** nuevo parámetro opcional
  `?tipo=diario|semanal|periodico`. Si se indica, el servidor responde **solo** con los datos
  de ese tipo (`ClienteCheckinTipoResponse`, nuevo en `src/lib/types.ts`) — no calcula ni envía
  los otros dos. Valor inválido → `400`. Sin el parámetro, comportamiento sin cambios (usado por
  el dashboard para el resumen de los tres tipos y por el modo enfocado de objetivos, que
  necesita poder buscar el objetivo en cualquiera de los tres, ver `DEC-2026-047`).
- **`src/app/cliente/checkin/page.tsx`:** nuevo modo "solo esta revisión" (`?tipo=X` sin
  `campo`) — pide al servidor únicamente ese tipo y renderiza una única tarjeta. Extraído
  `TarjetaRevision` como componente compartido entre este modo y el modo general de respaldo
  (sin parámetros, ya no enlazado desde ningún sitio pero mantenido por robustez) para no
  duplicar el marcado. El modo de objetivos (`?campo=X&tipo=Y`) no se tocó.

### Por qué un query param opcional y no tres endpoints/páginas
Pedido explícito: no duplicar páginas, no crear APIs independientes, no cambiar el modelo de
datos. Un parámetro opcional y compatible hacia atrás resuelve el requisito de que "el servidor
no debe devolver todas las revisiones si se pide una" sin tocar el contrato existente que usan
el dashboard y el modo de objetivos.

### Verificación
Prueba E2E con fixtures desechables (28 comprobaciones), reproduciendo el ejemplo exacto del
brief (Diario: Energía+Fatiga · Semanal: Adherencia+Comentario · Periódico: Dolor+Medidas):
`?tipo=diario/semanal/periodico` devuelve exclusivamente sus propios campos, sin las claves de
los otros dos tipos en la respuesta; tipo inválido → `400`; guardar cada revisión se registra
correctamente; un objetivo se registra con éxito aunque su tipo esté sin lanzar, mientras una
revisión normal en el mismo tipo sin lanzar se rechaza con `400` (confirma que el fix no mezcló
objetivos con revisiones); aislamiento confirmado entre dos clientes de distintos entrenadores;
sin token → `401`. Confirmado además, con una llamada real de solo lectura, que `GET
/api/cliente/checkin` sin `?tipo=` sigue devolviendo la respuesta completa de siempre (dashboard
y modo objetivo intactos). `tsc --noEmit`, `eslint` (todo `src/`) y `next build` sin errores.

**No probado visualmente en navegador.**

---

## DEC-2026-049 — Check-ins pendientes, historial con eliminación y garantía de recálculo de progreso en la ficha del cliente

**Fecha:** 2026-08-15
**Tipo:** Feature / Backend + Frontend
**Estado:** Implementado, pendiente de revisión del usuario (sin commit)

### Contexto y auditoría previa
Brief de Juanmi: en la ficha del cliente (entrenador), añadir "Check-ins pendientes" (diario/
semanal/periódico), renombrar el historial existente a "Historial de check-ins" con botón
Eliminar por envío (con confirmación), y garantizar que el progreso de cualquier objetivo que
use ese registro como fuente se recalcula correctamente tras el borrado. Auditado `CLAUDE.md`
completo y las decisiones relacionadas con check-ins/objetivos/progreso (`DEC-2026-007/026/032/
034/035/036/037/040` a `048`) antes de tocar código. **Ninguna decisión existente contradice
esta tarea** — al contrario: el diseño ya vigente (progreso de `Objetivos` siempre agregado en
caliente desde `Registros_checkin`, nunca cacheado ni duplicado — `DEC-2026-026`/`DEC-2026-032`)
significa que borrar filas de `Registros_checkin` y volver a leer es, por construcción,
suficiente para que el progreso se recalcule sin ninguna lógica de recálculo adicional. No hizo
falta ninguna decisión de "romper" nada existente.

### Arquitectura reutilizada
- **Historial:** ya existía casi completo en `GET /api/checkins` + la sección "Check-ins
  recientes (app)" de `ClienteFicha.tsx` (agrupación por `Fecha` exacta en "envíos", sin
  exponer `Field_id`/ids de Airtable) — solo le faltaba pendientes + Eliminar. Renombrada a
  "Historial de check-ins" (copy del brief).
- **Patrón DELETE con ownership:** mismo patrón que `DELETE
  /api/clientes/[id]/objetivos/[objetivoId]` y `DELETE
  /api/entrenador/checkin-config/campos/[fieldId]` (`getClienteById` → 404 → `cliente.fields.
  Entrenador !== email` → 403 → acción), y mismo patrón de borrado real vía Airtable REST que
  `borrarCampoCheckin`.
- **Confirmación antes de eliminar:** mismo patrón visual que `ObjetivosEntrenador.tsx`
  (`confirmandoEliminar`/`eliminando` por id, sin modal).

### Cálculo de pendientes y de la ventana correspondiente
Extraída a `resolverEstadoCheckinTipo()` (nuevo, `src/lib/objetivos.ts`) la lógica que antes
vivía inline como `estadoPara()` dentro de `GET /api/cliente/checkin` — movida tal cual (mismo
comportamiento), parametrizada para reutilizarse también desde el nuevo cálculo de pendientes
de la ficha del entrenador. Un tipo cuenta como "pendiente" cuando: `programacion.lanzado`
(corresponde actualmente, misma función `resolverProgramacionTipo` ya existente) **y** existe
al menos un campo de **revisión** activo para ese tipo (excluyendo campos que son fuente de un
objetivo vigente — Objetivos y Revisiones siguen siendo independientes, no se tocó esa
separación) **y** `!estado.yaEnviado` para la ventana actual (`ventanaPeriodoActual`/
`inicioDeHoyUTC`/`inicioDePeriodoSemanalUTC`, sin ventana para periódico, ya existentes). Un
cliente con `Estado !== 'Activo'` nunca tiene pendientes (cortocircuito explícito en
`GET /api/checkins`, antes de calcular nada). No se crea ningún registro artificial — el
cálculo es 100% derivado de `Checkin_tipos` + `Campos_checkin` + `Objetivos` +
`Registros_checkin` existentes, igual que ya hacía `GET /api/cliente/checkin` para el propio
cliente. Misma lógica exacta usada por ambas pantallas (ficha del entrenador y check-in/
dashboard del cliente) — ninguna de las dos tiene ahora su propia copia del cálculo.

### DELETE de Registros_checkin (real, no soft-delete)
Nuevo `borrarRegistrosCheckin()` (`src/lib/airtable.ts`), mismo patrón `fetchWithRetry(...,
{method:'DELETE'})` que `borrarCampoCheckin`. `DELETE /api/checkins` (mismo route ya existente
para el histórico, método nuevo) recibe `{clienteId, fecha, tipo}` — **nunca un id de Airtable
del frontend**: la ficha del cliente nunca ha expuesto ids de `Registros_checkin` (ver brief,
punto "no mostrar IDs de Airtable"), así que no había ningún id que aceptar. Las filas a borrar
se derivan siempre de `getRegistrosCheckinByClienteEmail(cliente.fields.Email)` — una consulta
ya scoped por ownership real (cliente pertenece al entrenador autenticado) — filtradas por
`Fecha === fecha exacta`, `Tipo_registro === tipo` y, como defensa en profundidad adicional,
`Cliente` (link real) incluye el id del cliente del path. Borrado real de fila (no
`Eliminado=true`): a diferencia de `Objetivos` (que sí necesita soft-delete para conservar la
fila de configuración auditable), `Registros_checkin` no tiene ningún consumidor que necesite
"recordar" un registro borrado — el progreso se recalcula íntegramente desde lo que queda.
0 filas encontradas → `404` (cubre tanto un id/fecha manipulados como una segunda petición
DELETE idéntica — idempotente sin duplicar ni fallar de forma confusa).

### Recálculo de progreso tras el DELETE
No se implementó ninguna lógica de "recálculo" explícita — no hacía falta. `resolverObjetivo()`
y sus funciones (`calcularProgresoDesdeCheckins`, `calcularProgresoValorObjetivo`,
`obtenerUltimoValorNumerico`) ya escaneaban `Registros_checkin` completo en cada llamada, sin
caché ni estado derivado persistido (confirmado leyendo el código antes de tocar nada). Borrar
la fila y esperar a la siguiente lectura es suficiente. En la UI, `ObjetivosEntrenador.tsx`
gana una prop opcional `refreshToken` (número, añadido a su dependencia de `useEffect`) — sin
esto, el componente no se habría refrescado solo hasta una recarga manual de página, aunque el
backend ya tuviera el dato correcto. `ClienteFicha.tsx` la incrementa tras cada DELETE exitoso.

### Verificación
Fixture desechable (`@example.com`, patrón `DEC-2026-009`: 2 entrenadores + 3 clientes —
incluido uno `Estado: 'Perdido'` —, borrados al terminar), 34 comprobaciones contra el servidor
real (`next dev`) y Airtable/Supabase reales:
- Caso obligatorio del brief: diario 10.000 + semanal 60.000 pasos, misma fuente; 8.000
  registrados → `8000/10000` y `8000/60000`; eliminado → `0/10000` y `0/60000` (sin fantasma).
- Acumulación semanal (lunes 8.000/martes 7.000/miércoles 5.000 → `20000/60000`); eliminar
  martes → `13000/60000`; eliminar lunes → `5000/60000`.
- Un mismo registro alimentando diario+semanal+mensual a la vez, sin duplicar; tras eliminarlo
  los tres recalculan a `0`.
- Peso (`valor_objetivo`, bajar): `70→68→66` → último `66`; eliminar el registro intermedio de
  `66` → vuelve a `68` (no se queda "atascado" en el valor borrado); registrar `69` (retroceso)
  → `69`; eliminar `69` (último de la lista) → vuelve a `68`.
- Booleano (`entrenamiento_realizado`): visible en el historial, desaparece tras eliminar.
- Pendientes: diario/semanal/periódico `true` con revisión lanzada sin registrar; registrar la
  revisión diaria → deja de estar pendiente (semanal sigue pendiente, independiente); eliminar
  ese registro → vuelve a estar pendiente. Cliente inactivo → los tres siempre `false`.
- Seguridad: entrenador A elimina registro de su cliente A → `200`; entrenador B intenta
  eliminar registro de cliente de entrenador A → `403`; un cliente autenticado llamando al
  mismo endpoint → rechazado; fecha manipulada/inexistente → `404` sin borrar nada; sin token →
  `401`.
- Doble DELETE idéntico consecutivo: primero `200`, segundo `404` (idempotente, sin doble
  borrado ni crash).
- Historial: orden cronológico correcto (más reciente primero); la respuesta completa no
  contiene ningún `Field_id` ni id de Airtable (`rec...`).

`tsc --noEmit`, `eslint` (todo `src/`) y `next build` sin errores.

**No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta sesión) —
verificado el comportamiento real de las APIs (pendientes, historial, DELETE, recálculo de
progreso) contra Supabase/Airtable reales, no el renderizado de "Check-ins pendientes" ni del
botón Eliminar en el navegador.

### Riesgos y límites conocidos, no resueltos a propósito
- La confirmación de dos pasos y el badge visual de "Pendiente" no se han visto en un
  navegador real — solo se verificó por lectura de código + comportamiento de la API.
- `dashboard/page.tsx` (tarjeta "Revisión" del propio cliente) sigue calculando su exclusión
  objetivo/revisión de forma LOCAL por tipo (`estado.objetivos`), no global — el mismo patrón
  que `DEC-2026-047` corrigió en `checkin/page.tsx`. No se ha tocado (fuera de alcance de esta
  tarea, y no hay caso real reportado que lo dispare todavía), pero el nuevo cálculo de
  pendientes de la ficha del entrenador usa deliberadamente la exclusión GLOBAL (la correcta,
  según `DEC-2026-047`) — si algún día se corrige `dashboard/page.tsx` del mismo modo, ambas
  pantallas quedarán consistentes; hasta entonces, es teóricamente posible un caso límite muy
  raro (objetivo cuya fuente vive en un tipo distinto al de su periodicidad) donde la ficha del
  entrenador y el dashboard del cliente discreparan sobre si ese tipo concreto está "pendiente".
- Recarga tras eliminar un check-in siempre vuelve a la página 0 del historial (no conserva la
  página en la que estaba el entrenador) — aceptable dado que la paginación de check-ins es
  poco profunda (7 por página) y evita bugs de desplazamiento de páginas tras un borrado.

---

## DEC-2026-050 — Bug real confirmado y corregido: exclusión objetivo/revisión LOCAL en dashboard/page.tsx (riesgo señalado en DEC-2026-049)

**Fecha:** 2026-08-15
**Tipo:** Bug / Frontend
**Estado:** Corregido, pendiente de revisión del usuario (sin commit)

### Pedido de Juanmi
Verificar, con fixtures reales, si el riesgo documentado en `DEC-2026-049` (dashboard del
cliente usando exclusión objetivo/revisión LOCAL por tipo, distinta de la GLOBAL que ya usan
`checkin/page.tsx` desde `DEC-2026-047` y la ficha del entrenador desde `DEC-2026-049`) causaba
de verdad una discrepancia observable, probando explícitamente: objetivo sin revisión, revisión
sin objetivo, misma métrica como fuente y como revisión, objetivo+revisión mismo tipo (diario y
semanal) y objetivo+revisión con periodicidad distinta.

### Comparación exacta de lógica
- `checkin/page.tsx` (general y `?tipo=X`) y la ficha del entrenador (`GET /api/checkins`,
  `resolverEstadoCheckinTipo`): excluyen de "revisión" cualquier campo que sea `Fuente_field_id`
  de **cualquier objetivo activo/vigente del cliente**, sin importar su periodicidad (GLOBAL).
- `dashboard/page.tsx` (antes de este fix, línea ~236): calculaba `idsObjetivo` solo con
  `estado.objetivos` — los objetivos de ESE tipo de check-in (`objetivosPorTipo`, agrupados por
  `PERIODICIDAD_A_TIPO_CHECKIN`), no los de los otros dos (LOCAL).
- Ambas coinciden siempre que la periodicidad del objetivo coincide con el tipo donde vive su
  campo fuente — solo divergen cuando NO coincide (un objetivo semanal alimentado por un campo
  cuyo `Tipos` es `['diario']`, patrón ya conocido y resuelto para el backend en `DEC-2026-044`/
  `047`, pero nunca aplicado a `dashboard/page.tsx`).

### Fixture y resultado (6 escenarios pedidos, cliente/entrenador desechables `@example.com`)
- **A) objetivo sin revisión** (mismo tipo): sin divergencia.
- **B) revisión sin objetivo**: sin divergencia.
- **C) misma métrica como fuente Y revisión, misma periodicidad**: sin divergencia — el campo
  se excluye correctamente en ambas lógicas.
- **D) objetivo diario + revisión diaria** (campos distintos, mismo tipo): sin divergencia.
- **E) objetivo semanal + revisión semanal** (campos distintos, mismo tipo): sin divergencia.
- **F) objetivo semanal alimentado por un campo `Tipos: ['diario']`**: **divergencia real
  confirmada** — con el código anterior, `dashboard.tieneRevision('diario') = true` (mostraba
  "Diario: Pendiente", invitando al cliente a responder algo) mientras `checkin/page.tsx` y la
  ficha del entrenador ya decían `false` (0 preguntas de revisión reales en diario, todo era
  fuente de un objetivo semanal). Un cliente que pulsara "Registrar" en esa fila del dashboard
  aterrizaba en `/cliente/checkin?tipo=diario` y no encontraba ninguna pregunta que responder
  ("Tu entrenador no ha configurado ninguna pregunta de revisión para este tipo").

Solo A-E fueron pedidos como "deberían ser consistentes" y lo eran; F confirmó el riesgo.

### Corrección
`idsFuenteDeObjetivos()` (antes función local no exportada dentro de `checkin/page.tsx`) se
mueve a `src/lib/objetivos.ts` como export compartido — única fuente de verdad de "qué campos
son fuente de un objetivo", reutilizada ahora por `checkin/page.tsx` (import, sin cambio de
comportamiento) y por `dashboard/page.tsx` (antes tenía su propio cálculo LOCAL inline). En
`dashboard/page.tsx`, la tarjeta "Revisión" calcula ahora `idsObjetivoGlobal` una sola vez (unión
de `checkin.diario/semanal/periodico.objetivos`, igual que el modo general de `checkin/page.tsx`
y que `GET /api/checkins`) y lo usa para las tres filas, en vez de recalcular un set distinto
por fila. No se tocó el resto de la lógica (gate por `estado.lanzado`, textos, navegación).

### Por qué no se duplicó lógica
Antes de este fix había DOS copias de la misma idea (`idsFuenteDeObjetivos` local en
`checkin/page.tsx`, cálculo inline distinto en `dashboard/page.tsx`) — la corrección elimina una
copia entera moviendo la función a `lib/` en vez de escribir una tercera versión. Con esto, el
frontend del cliente tiene un único punto de verdad para "qué campos cuentan como objetivo",
igual que el backend ya tenía uno solo (`idsFuenteObjetivo` en `GET /api/cliente/checkin`,
reutilizado desde `DEC-2026-049` por `resolverEstadoCheckinTipo`).

### Verificación
Reproducido el fixture del escenario F contra el servidor real ANTES del fix (confirma la
divergencia) y DESPUÉS del fix (confirma que dashboard, `checkin/page.tsx` y la ficha del
entrenador coinciden los tres en `false`) — 13 comprobaciones, todas OK en ambas pasadas
(divergencia confirmada antes, ausencia de divergencia confirmada después). `tsc --noEmit`,
`eslint` (todo `src/`) y `next build` sin errores.

**No probado visualmente en navegador** (sin acceso a la extensión de Chrome en esta sesión) —
verificado mediante réplica exacta en JavaScript de la expresión JSX real de `dashboard/page.tsx`
(antes y después del cambio) contra las respuestas reales de la API, no el renderizado.

### Riesgo actualizado
El riesgo "exclusión local en `dashboard/page.tsx`" que quedaba abierto en `DEC-2026-049` queda
**cerrado**. Grep de `idsFuenteDeObjetivos`/`idsFuenteObjetivo` en todo `src/` confirma el estado
final: en el **frontend** (`checkin/page.tsx`, `dashboard/page.tsx`) ambas pantallas importan
ahora la misma `idsFuenteDeObjetivos()` de `src/lib/objetivos.ts` — un único punto, sin copias.
En el **backend**, `GET /api/cliente/checkin` y `GET /api/checkins` siguen calculando
`idsFuenteObjetivo` cada uno por su lado (operan sobre `AirtableRecord<ObjetivoFields>` crudos,
antes de resolver `ObjetivoResuelto`, así que no pueden compartir literalmente la misma función
que el frontend) — pero ambos ya eran GLOBAL desde su origen (`DEC-2026-047` y `DEC-2026-049`
respectivamente) y coinciden entre sí; no había divergencia ahí y esta sesión no encontró
ninguna. La única duplicación real detectada y corregida era la del frontend.
