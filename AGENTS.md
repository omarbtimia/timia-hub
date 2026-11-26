# Reglas del Frontend (`timia-hub/`)

## Rol y stack real

- SPA **React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS v4**, servida en producción por nginx (`Dockerfile`, `docker/nginx.conf`); backend hermano: `../timia-hub-api` (FastAPI + Mongo).
- **No hay React Router, Redux, Zustand, React Query ni axios.** Enrutado manual con `history.pushState`/`popstate` y cliente HTTP propio con `fetch`.
- Dos modos de ejecución: **API** (cookie httpOnly + `/api/state`) o **local** (`public/db.json` + `localStorage`). Se resuelven en `src/lib/persist.ts` y `src/lib/adminStore.ts`.

## Estructura y responsabilidades

- `src/main.tsx`: aplica la densidad antes del primer render y espera a `seedFromRemote()` antes de montar `<App/>`.
- `src/App.tsx`: `switch` de vistas, guards por permiso y composición `AuthProvider → ProtectedRoute → Layout → vista`. La ruta pública `/tr` se resuelve **antes** del `AuthProvider`.
- `src/lib/routes.ts`: `VIEW_PATHS`, `pathFor`, `parsePath` (URLs limpias `/tablero`, `/plan`, `/admin/roles`, etc.).
- `src/components/`: 35 `.tsx` que mezclan pantallas y primitivas (no existen `pages/`, `ui/`, `hooks/` ni `store/`). Principales: `PlanDeTrabajo`, `Estimaciones`, `KanbanBoard`, `Fabrica`, `AdminPanel`, `ImputacionesJira`, `Bitacora`, `Notas`, `Inventario`, `Layout`, `Login`, `ProtectedRoute`, `TimiaLogo`.
- `src/lib/` (24 módulos): dominio y persistencia. Claves: `adminStore.ts` (tipos + fachada `getX/saveX`), `persist.ts` (HTTP), `permissions.ts` (matriz vigente), `routes.ts`, `avance.ts`, `businessDays.ts`, `planTablero.ts`, `historialPlan.ts`, `plantillas.ts`, `fabrica.ts`, `trPlan.ts`, `imagenesNota.ts`, `imgLocal.ts` (IndexedDB), `densidad.ts`, `utils.ts`.
- `src/contexts/AuthContext.tsx`: único Context global; expone `useAuth`. El único otro hook propio es `useDashboardData` en `src/components/PMDashboard.tsx`.
- `src/types.ts`: tipos legacy (`Task`, `Column`, `User`, `ProjectTemplate`). **El modelo de dominio real vive en `src/lib/adminStore.ts`** (`AdminProject`, `KanbanTask`, `PlanConfig`, `PlanIssue`, `Nota`, `TrEntry`, ...). No dupliques conceptos sin motivo.

## Convenciones de código

- Componentes en `PascalCase.tsx`, normalmente `export default function`; módulos `lib/` en camelCase; imports relativos (el alias `@/*` existe en `tsconfig.json` y `vite.config.ts` pero el código no lo usa). Nombres y UI en español, con términos técnicos en inglés.
- Tipado estricto alineado al JSON del backend: `ApiUser`/`ApiAuthConfig` en `persist.ts`, `AuthUser` en `AuthContext.tsx`, uniones literales para estados, fechas ISO `string`, `Partial<Record<...>>` para mapas de horas. Evita `any`; hay ~90 usos heredados en componentes antiguos que **no** deben replicarse.
- Persistencia: toda clave lleva prefijo `timia_`. Leer con `load<T>`/`persistGet`; escribir siempre con `adminStore.saveX` o `persistSet` (nunca `localStorage.setItem` directo, salvo sesión/navegación y el seed).
- Compatibilidad hacia atrás: `normalizeRole`, `LEGACY_ROLE_MAP`, `LEGACY_ALIASES`, `normalizaTarea`, `issueImpacts` y claves de plan `projectId::cronoId`. Los datos viejos se normalizan al leer, no se descartan.
- Estilos: Tailwind en el shell (`Layout`, `ProtectedRoute`, `App`) y objetos `React.CSSProperties` inline en los módulos de negocio. `cn()` (`clsx` + `tailwind-merge`) está en `src/lib/utils.ts` pero aún no se usa. Iconos `lucide-react`, animaciones `motion`, drag & drop `@hello-pangea/dnd`, logo propio en `TimiaLogo.tsx`. Paleta roja `#dc2626`/`#ff0000`, UI muy compacta; la densidad global se aplica con `document.body.style.zoom` (`lib/densidad.ts`). Respeta estos patrones antes de introducir otra librería visual.

## HTTP, sesión y permisos

- **Un solo cliente HTTP:** `src/lib/persist.ts` (`fetchWithTimeout`, `headers()`, `${state.base}/api/...`, siempre `credentials: 'include'`, `X-API-Key` opcional). Endpoints de auth, `GET /api/state`, `PUT /api/state/{key}` y sincronización. Los fetch directos (`imagenesNota.ts`, `TrPublico.tsx`, `ParchePermisos.tsx`) son excepciones puntuales (binarios, ruta pública, verificación).
- URL base: `window.TIMIA_API_URL` (runtime, inyectado por `public/config.js`, que se carga antes del bundle) > `VITE_API_URL` (build-time). `''` = mismo origen con `/api`; `'none'` = modo local. No hardcodear hosts. En dev, `vite.config.ts` proxía `/api` a `API_PROXY ?? http://localhost:8000`; en Docker, nginx proxía a `api:8000`.
- Escrituras optimistas: `persistSet` debouncea 300 ms por clave; `flush` reintenta con backoff, distingue 401 (revalida sesión) y 403 (resincroniza la colección), y vacía la cola con `sendBeacon` en `beforeunload`. Los errores se publican en `persist.lastError`/`failures` y el UI reacciona con `persist.onChange`; no lances excepciones nuevas desde la capa de red.
- Autenticación delegada al backend: sesión en cookie httpOnly; Firebase solo entrega un `idToken` efímero (`src/lib/firebaseAuth.ts`, SDK cargado con `import()` dinámico) que se envía a `POST /api/auth/firebase`. La config de Firebase/Google/demo viene de `GET /api/auth/config`, con fallback a `window.TIMIA_FIREBASE`. Existen login demo y Google GIS.
- Permisos: la matriz vigente está en `src/lib/permissions.ts` (`hasPermission`, `canInProject`, `effectiveRole`, `saveMatrix`); `ROLE_PERMISSIONS` en `AuthContext.tsx` es solo referencia histórica. Roles por proyecto en `timia_project_roles`; el servidor vuelve a validar cada escritura.

## Scripts y verificación

- `npm run dev`: Vite en el puerto 3000; `npm run api:dev`: `python dev_mock.py` en `../timia-hub-api`; `npm run preview`: preview de Vite.
- `npm run build` (= `build:client`): `tsx scripts/verif-tipos.ts && vite build`. `npm run seed:sync` copia `public/db.json` a `../timia-hub-api/seed.json`.
- `npm run lint` es `tsc --noEmit` y **está rojo por diseño** (23 errores heredados: 16 `key` de React 19, 3 casts de `CSSStyleDeclaration`, 4 usos de `import.meta.env` sin `vite-env.d.ts`). No lo uses como gate; usa `npm run verif:tipos`, que fija esa foto y falla solo si aparece un error nuevo.
- `npm run lint:real`: `tsc` filtrando falsos positivos conocidos; `npm run check`: `verif:tipos + lint:real + vite build + smoke` (gate recomendado antes de terminar).
- `npm run smoke`: monta `PlanDeTrabajo`, `Estimaciones`, `Bitacora`, `ActivityReport` y `PMDashboard` en jsdom con `public/db.json` y datos viejos, para cada cuenta demo, y simula clics.
- `npm run e2e:api`: ejercita el código real (`persist`, `adminStore`, `permissions`) contra la API en `:8000` (override con `API_URL`); requiere el mock del repo hermano. Úsalo si cambias auth, permisos o sincronización.
- `scripts/verif-*.ts`: regresiones de reglas de negocio (avance, esperado, real-fase, pct, issues, pasos, historial, replan, rol, tablero, fábrica, Q4.2/Q4.3, TR, menú, simulación). Si modificas esas reglas, añade o actualiza el script correspondiente.
- `tsconfig.json`: ES2022, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit`, alias `@/*`. No hay script `typecheck`; el equivalente es `lint`/`verif:tipos`.
- Flujo git (`CONTRIBUTING.md`): `feature/*` y `fix/*` desde `develop`, PR a `develop`, probar en Docker y luego PR a `main`. Commits `feat:`, `fix:`, `chore:`, `docs:`.

## Antes de terminar

1. Ejecuta `npm run check` (o mínimo `npm run verif:tipos`). Si faltan dependencias, `npm install` primero.
2. Si el cambio afecta a la API o permisos, ejecuta también `npm run e2e:api` con el backend disponible.
3. No cambies la foto de errores heredados en `scripts/verif-tipos.ts` salvo que hayas corregido esos errores realmente.
