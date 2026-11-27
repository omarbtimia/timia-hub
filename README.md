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
El único campo adicional es el `id` opcional de actividad, que conserva el vínculo
con las tareas existentes al renombrarlas.

Esta estructura es **exclusiva de este navegador**: su backend está pendiente.
No se envía en los snapshots de configuraciones cerradas ni se reemplaza al cargar
datos remotos. No modifica `public/db.json` ni se comparte entre dispositivos.
Los fallos de lectura o guardado se muestran en pantalla; los datos inválidos no
se sobrescriben automáticamente.

La acción **Actualizar avance** de las tareas existentes mantiene el guardado
real de porcentaje, estado, responsable e historial. Los pesos simulados no
recalculan ese avance. Las actividades nuevas se guardan en la estructura, pero no
se convierten en tareas de seguimiento: se indican como **Sin seguimiento**.

Comprobación enfocada: `npm run verif:tym`.
