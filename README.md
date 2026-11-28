<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/17df0b3a-76d2-449b-b2ca-ce2b637397d3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Detalle de proyectos abiertos (T&M)

Desde Dashboard, al entrar a un proyecto abierto se muestran entregables,
actividades y etapas en dos pestañas:

- **Tareas Activas** (inicial): paneles desplegables para crear y editar la estructura.
  Conserva todas las actividades, incluidas las finalizadas.
- **Reporte Histórico**: la misma estructura actual, completamente desplegada y
  solo lectura, sin controles de edición ni actualización de avance. Refleja el
  contenido actual, no versiones históricas almacenadas.

Al alternar pestañas se conservan la estructura y la expansión de Tareas Activas.
No se muestran las tarjetas globales de avance real ni tareas cerradas.
Los entregables, actividades, nombres y pesos de etapas se guardan automáticamente
en **localStorage**, bajo `timia_plan_configs`, reutilizando la estructura anidada
de proyectos cerrados (`label`, `activities`, `etapas`, `peso`). Se conservan al
salir, cambiar de proyecto o recargar, sin agregar fechas ni semanas a T&M.
Los campos adicionales son el `id` opcional de actividad, que conserva el vínculo
con las tareas existentes al renombrarlas, y `responsableId` opcional
en cada entregable, actividad y etapa T&M para identificar a su dueño por id.
Entregables y etapas también guardan su `estado`; el de las actividades reutiliza
el seguimiento existente, sin duplicarlo en la estructura.
El campo `resp` de los cronogramas conserva su significado Timia/BBVA/mixto.

Esta estructura es **exclusiva de este navegador**: su backend está pendiente.
No se envía en los snapshots de configuraciones cerradas ni se reemplaza al cargar
datos remotos. No modifica `public/db.json` ni se comparte entre dispositivos.
Los fallos de lectura o guardado se muestran en pantalla; los datos inválidos no
se sobrescriben automáticamente.

El alcance depende del **rol efectivo en el proyecto**, incluidas las asignaciones
de Gestionar equipo:

- **Developer:** por defecto ve y edita solo sus elementos. Los contenedores ajenos necesarios
  para llegar a sus actividades o etapas se muestran como contexto no editable.
  Sus selectores de responsable únicamente permiten elegirse a sí mismo.
- **Consulta ampliada:** quienes tengan `tym.developers.view_all` disponen de **Visualizar trabajo de**, con los developers
  activos asociados al proyecto. Seleccionar una persona permite editar lo suyo y
  asignar cada nivel a otro developer del mismo proyecto si su rol operativo es
  de gestión. Para un developer este permiso solo amplía la consulta: vuelve a
  **Mi trabajo** para editar, sin edición ni reasignación de trabajo ajeno.
- **Panorama General** (inicial para otros roles): muestra todas las ramas una sola
  vez, sin edición de estructura o avance. Solo permite asignar los elementos
  **Sin asignar** desde Tareas Activas para gestores. El **LT efectivo del proyecto**
  puede cambiar responsables de los tres niveles, incluso ya asignados, desde
  cualquier alcance visible de Tareas Activas, incluido Panorama General.
  Esta excepción no permite renombrar estructura ajena ni actualizar avances desde
  Panorama General. Reporte Histórico nunca permite editar o reasignar.

Los elementos nuevos se preasignan al developer de la vista actual y requieren
seleccionar un estado antes de crearlos; cancelar no guarda nada. Un responsable
distinto en una etapa no cambia el de su actividad ni concede acceso a su avance.
Los contadores incluyen los contenedores visibles de contexto. La suma de pesos
corresponde a todas las etapas de la actividad, aunque el filtro oculte algunas.
Las asignaciones antiguas por nombre se reconocen solo si identifican de forma
inequívoca a un developer del proyecto; los demás elementos quedan Sin asignar.

**Actualizar avance** mantiene porcentaje, estado e historial por actividad en
`timia_tym_planes`, con su sincronización actual si la API está activa. Las
actividades nuevas nacen con avance 0% y seguimiento usando el mismo id de la
estructura. Las actividades locales anteriores **Sin seguimiento** lo inicializan
al guardar su primer avance o cambiar su estado, no al consultarlas. Los pesos de etapas no recalculan
el avance ni se agregan avances independientes para entregables o etapas.

Editar una vista personal conserva los elementos de las otras personas. Si falla
alguna escritura, se conserva la edición visible y se ofrece **Reintentar guardado**;
el selector de persona se bloquea mientras hay cambios pendientes. La estructura
y el seguimiento, junto con las tarjetas vinculadas, no constituyen una transacción atómica.
Estos controles delimitan la experiencia del frontend: el aislamiento real de
lecturas y escrituras por persona en el servidor continúa pendiente. No se
modifican permisos de otros módulos ni de proyectos cerrados.

Comprobación enfocada: `npm run verif:tym`.

### Estados y tablero Kanban

Entregables, actividades y etapas usan **Backlog**, **En Progreso**, **Revisión** y
**Finalizado**, el mismo catálogo del tablero de proyectos cerrados. Cada elemento
tiene su propio estado: cambiarlo no actualiza padres, hijos ni hermanos. Estado
y porcentaje son independientes, incluso al crear una actividad en **Finalizado** con
avance inicial 0%.

Al abrir un proyecto T&M o el tablero se reconcilian sus tarjetas: una por nodo,
identificadas como **Entregable T&M**, **Actividad T&M** o **Etapa T&M**, con el
responsable individual y el contexto de la rama. Se reutiliza
`timia_kanban_tasks`, con un vínculo mínimo `tym: { tipo, nodoId }` y el proyecto
existente; no se agregan claves, cronogramas ni fechas de entrega ficticias.
La reconciliación es idempotente y conserva comentarios y enlaces.

Cambiar un estado en **Tareas Activas** actualiza su tarjeta; moverla de columna
o usar su selector de estado actualiza el elemento del proyecto, también si ambas
pantallas están montadas. El movimiento requiere `tasks.update_status`, acceso
al proyecto y capacidad de editar ese trabajo T&M. Un developer solo mueve sus
propias tarjetas, aunque tenga consulta ampliada. Los nodos sin asignar no son
trabajo de otro developer. Nombre, jerarquía, responsable y eliminación de
tarjetas vinculadas se gestionan desde el proyecto, no desde el tablero.
**Reporte Histórico** permanece de solo lectura y los contadores de estado del
Dashboard T&M siguen considerando únicamente actividades.

Los registros anteriores se migran conservando IDs, porcentaje e historial:
**En curso → En Progreso**, **Finalizada → Finalizado**, **En espera / No se
requiere → Backlog**. Entregables y etapas sin estado comienzan en Backlog, así
como actividades locales sin seguimiento. La migración no crea movimientos
ficticios ni deduce un estado a partir del porcentaje. Las antiguas tareas No se
requiere dejan de excluirse de los cálculos que utilizaban esa exclusión.
El alta inicial de tareas también exige el estado del bloque cuando crea un
entregable nuevo; agregar tareas a un bloque existente no modifica su estado.

La jerarquía continúa siendo local a este navegador. La sincronización existente
de tarjetas con la API no equivale a compartir esa jerarquía entre dispositivos:
si llega una tarjeta sin su estructura local, se muestra una advertencia y no se
permite actualizar su origen ni reconstruirlo parcialmente a partir de ella.
La API y sus controles de autorización no se modifican.

Comprobación de integración: `npm run verif:tym-tablero`.

## Dashboard T&M

En **Planeación → Dashboard T&M** (`/dashboard-tym`) se muestran los proyectos
abiertos activos accesibles al usuario, con tarjetas por proyecto, filtros de
proyecto y developer, contadores de estructura, actividades por estado y último
movimiento del seguimiento. No calcula avance esperado, cronograma, desviación,
riesgo ni semáforos, ni agrega tarjetas de Avance real o Tareas cerradas.
El dashboard anterior se mantiene sin cambios.

En **Admin → Roles y Permisos → Proyectos T&M** se administran:

- **Ver Dashboard T&M** (`tym.dashboard.view`): acceso a la nueva pantalla. Su entrada
  solo aparece si además existe al menos un proyecto T&M accesible con ese permiso.
  No elimina el acceso previo al detalle del proyecto desde otras pantallas.
- **Ver todos los desarrolladores** (`tym.developers.view_all`): habilita filtros por
  persona y Panorama General en dashboard y detalle. Sin él solo se ve lo propio.

Developer recibe acceso al dashboard y consulta propia por defecto; PM, LT y gerente
reciben ambos permisos. Se respeta el rol efectivo de cada proyecto y las matrices
guardadas, incluidos roles personalizados. El administrador de plataforma no gana
permisos operativos por su rol global. El gerente conserva todos los permisos,
según la regla existente de la matriz.

Si un usuario gestiona un proyecto y en otro es developer, el filtro ampliado solo
se aplica donde tenga permiso; las demás tarjetas siguen en **Mi trabajo**.
Los contadores del dashboard excluyen ancestros ajenos de contexto, y los estados
y el último movimiento solo consideran actividades del alcance, no actividades
ajenas que contienen una etapa propia. Los elementos Sin seguimiento se distinguen
sin inventar datos. Los fallos de lectura se muestran por proyecto y excluyen ese
proyecto del total, identificando el resumen como parcial.

Son **permisos de frontend** en esta entrega: se reutiliza el guardado actual de
la matriz, pero el catálogo de la API y su aplicación en servidor no se modifican.
La estructura sigue siendo local; consultar, filtrar o navegar no crea registros.
Comprobación enfocada: `npm run verif:dashboard-tym`.
