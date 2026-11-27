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
actividades y etapas en paneles desplegables. Es posible agregarlos y editar sus
nombres y los pesos de etapas como una simulación visual: estos cambios viven
solo en la pantalla y se descartan al salir, cambiar de proyecto o recargar.
No se envían a la API ni modifican el cronograma de proyectos cerrados.

La acción **Actualizar avance** de las tareas existentes mantiene el guardado
real de porcentaje, estado, responsable e historial. Los pesos simulados no
recalculan ese avance. Las actividades nuevas no se guardan como tareas.

Comprobación enfocada: `npm run verif:tym`.
