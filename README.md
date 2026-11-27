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
  Conserva todas las actividades, incluidas las finalizadas y las no requeridas.
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
El campo `resp` de los cronogramas conserva su significado Timia/BBVA/mixto.

Esta estructura es **exclusiva de este navegador**: su backend está pendiente.
No se envía en los snapshots de configuraciones cerradas ni se reemplaza al cargar
datos remotos. No modifica `public/db.json` ni se comparte entre dispositivos.
Los fallos de lectura o guardado se muestran en pantalla; los datos inválidos no
se sobrescriben automáticamente.

El alcance depende del **rol efectivo en el proyecto**, incluidas las asignaciones
de Gestionar equipo:

- **Developer:** ve y edita solo sus elementos. Los contenedores ajenos necesarios
  para llegar a sus actividades o etapas se muestran como contexto no editable.
  Sus selectores de responsable únicamente permiten elegirse a sí mismo.
- **Otros roles operativos:** disponen de **Visualizar trabajo de**, con los developers
  activos asociados al proyecto. Seleccionar una persona permite editar lo suyo y
  asignar cada nivel a otro developer del mismo proyecto.
- **Panorama General** (inicial para otros roles): muestra todas las ramas una sola
  vez, sin edición de estructura o avance. Solo permite asignar los elementos
  **Sin asignar** desde Tareas Activas; Reporte Histórico nunca permite editar.

Los elementos nuevos se preasignan al developer de la vista actual. Un responsable
distinto en una etapa no cambia el de su actividad ni concede acceso a su avance.
Los contadores incluyen los contenedores visibles de contexto. La suma de pesos
corresponde a todas las etapas de la actividad, aunque el filtro oculte algunas.
Las asignaciones antiguas por nombre se reconocen solo si identifican de forma
inequívoca a un developer del proyecto; los demás elementos quedan Sin asignar.

**Actualizar avance** mantiene porcentaje, estado e historial por actividad en
`timia_tym_planes`, con su sincronización actual si la API está activa. Las
actividades nuevas nacen con avance 0% y seguimiento usando el mismo id de la
estructura. Las actividades locales anteriores **Sin seguimiento** lo inicializan
al guardar su primer avance, no al consultarlas. Los pesos de etapas no recalculan
el avance ni se agregan avances independientes para entregables o etapas.

Editar una vista personal conserva los elementos de las otras personas. Si falla
alguna escritura, se conserva la edición visible y se ofrece **Reintentar guardado**;
el selector de persona se bloquea mientras hay cambios pendientes. La estructura
y el seguimiento usan dos claves y no constituyen una transacción atómica.
Estos controles delimitan la experiencia del frontend: el aislamiento real de
lecturas y escrituras por persona en el servidor continúa pendiente. No se
modifican permisos de otros módulos ni de proyectos cerrados.

Comprobación enfocada: `npm run verif:tym`.
