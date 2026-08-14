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
