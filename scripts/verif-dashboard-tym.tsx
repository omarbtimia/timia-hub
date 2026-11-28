import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AdminUser } from '../src/lib/adminStore';
import type { EstructuraTym, PlanTym } from '../src/modules/tym/tipos';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
const w = dom.window;
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'localStorage', 'MouseEvent', 'Event', 'navigator']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' ? w : Reflect.get(w, key), configurable: true, writable: true });
}
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
w.TIMIA_API_URL = 'none';
const usuario = (id: string, role: AdminUser['role'], projectIds = ['A', 'B']): AdminUser => ({
  id, name: id.toUpperCase(), role, projectIds, active: true, email: `${id}@example.test`, initials: id, avatarColor: '#0d9488',
});
const ana = usuario('ana', 'developer');
const bob = usuario('bob', 'developer', ['A']);
const pm = usuario('pm', 'pm');
const admin = usuario('admin', 'platform_admin');
const users = [ana, bob, pm, admin, usuario('lt', 'tech_lead'), usuario('externo', 'developer', ['X'])];
const projects = ['A', 'B', 'X', 'CERRADO', 'INACTIVO'].map(id => ({
  id, name: `Proyecto ${id}`, active: id !== 'INACTIVO', tipo: id === 'CERRADO' ? 'cerrado' : 'tym', client: 'Demo', color: '#0d9488',
}));
w.localStorage.setItem('timia_admin_users', JSON.stringify(users));
w.localStorage.setItem('timia_admin_projects', JSON.stringify(projects));
w.localStorage.setItem('timia_project_roles', JSON.stringify({ 'pm:B': 'developer', 'admin:A': 'tech_lead' }));
const plan: PlanTym = { projectId: 'A', bloques: [], tareas: [
  { id: 'a', nombre: 'Trabajo Ana', bloque: '', responsable: 'ANA', estado: 'en-curso', pct: 25, creada: '2026-01-01' },
  { id: 'b', nombre: 'Trabajo Bob', bloque: '', responsable: 'BOB', estado: 'en-espera', pct: 80, creada: '2026-01-01' },
], historial: {
  a: [{ fecha: '2026-01-02T10:00:00Z', de: 0, a: 25, quien: 'ANA' }],
  b: [{ fecha: '2026-11-27T10:00:00Z', de: 20, a: 80, quien: 'BOB' }],
} };
const estructura: EstructuraTym = { projectId: 'A', entregables: [
  { id: 'e', label: 'Entrega Bob', responsableId: 'bob', activities: [
    { id: 'a', label: 'Trabajo Ana', etapas: [{ id: 's1', label: 'Etapa Ana', responsableId: 'ana', peso: 100 }] },
    { id: 'b', label: 'Trabajo Bob', responsableId: 'bob', etapas: [{ id: 's2', label: 'Etapa Ana ajena', responsableId: 'ana', peso: 100 }] },
    { id: 'local', label: 'Sin seguimiento', responsableId: 'ana', etapas: [] },
  ] },
  { id: 'empty', label: 'Vacío Ana', responsableId: 'ana', activities: [] },
  { id: 'unassigned', label: 'Sin asignar', activities: [] },
] };
w.localStorage.setItem('timia_tym_planes', JSON.stringify({ A: plan }));
w.localStorage.setItem('timia_plan_configs', JSON.stringify({
  A: estructura, CERRADO: { projectId: 'CERRADO', totalWeeks: 2, generatedAt: '2026-01-01', entregables: [] },
}));
const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { AuthProvider, useAuth, normalizeRole } = await import('../src/contexts/AuthContext');
const { resumenesDashboardTym } = await import('../src/modules/tym/resumenDashboard');
const { proyectosDashboardTym, consultaAmpliadaTym } = await import('../src/modules/tym/responsables');
const { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, currentMatrix, saveMatrix } = await import('../src/lib/permissions');
const { menuDe, esGrupo } = await import('../src/components/Layout');
const { pathFor, parsePath } = await import('../src/lib/routes');
const DashboardTym = (await import('../src/modules/tym/DashboardTym')).default;
const RolesPermissions = (await import('../src/components/RolesPermissions')).default;
const container: HTMLElement = w.document.getElementById('root')!;
const root = createRoot(container);
const errors: unknown[] = [];
const previousError = console.error;
console.error = (...args) => { errors.push(args); previousError(...args); };
const snapshot = () => JSON.stringify(Object.fromEntries(
  Array.from({ length: w.localStorage.length }, (_, i) => w.localStorage.key(i)!).sort().map(k => [k, w.localStorage.getItem(k)]),
));
const navigation: string[] = [];
let current: AdminUser = pm;
function Session({ adminView = false }: { adminView?: boolean }) {
  const { login } = useAuth();
  React.useEffect(() => { login(current); }, []);
  return adminView ? <RolesPermissions/> : <DashboardTym onViewChange={(view, param) => navigation.push(`${view}:${param}`)}/>;
}
async function render(user = pm, adminView = false) {
  await act(async () => { root.render(null); });
  current = user;
  await act(async () => { root.render(<AuthProvider><Session adminView={adminView}/></AuthProvider>); });
}
async function change(label: string, value: string) {
  const el = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  assert.ok(el, `Falta selector ${label}`);
  await act(async () => { el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); });
}
const menuViews = (u: AdminUser) => menuDe(u.role, u).flatMap(e => esGrupo(e) ? e.items.map(i => i.view) : [e.view]);
try {
  assert.deepEqual(proyectosDashboardTym(ana).map(p => p.id), ['A', 'B']);
  assert.equal(consultaAmpliadaTym(pm, 'A'), true);
  assert.equal(consultaAmpliadaTym(pm, 'B'), false);
  assert.equal(consultaAmpliadaTym(admin, 'A'), true);
  assert.equal(consultaAmpliadaTym(admin, 'B'), false);
  assert.equal(menuViews(ana).includes('dashboard-tym'), true);
  assert.equal(menuViews(usuario('nadie', 'developer', ['CERRADO', 'INACTIVO'])).includes('dashboard-tym'), false);
  assert.equal(menuViews(usuario('nadie', 'developer', [])).includes('dashboard-tym'), false);
  for (const u of users) {
    const menu = menuDe(u.role, u);
    assert.ok(menu.length <= 6, 'Dashboard T&M no agrega exceso de entradas superiores');
    assert.ok(menu.filter(esGrupo).every(g => g.items.length > 0));
  }
  assert.equal(parsePath(pathFor('dashboard-tym')).view, 'dashboard-tym');
  assert.equal(parsePath(pathFor('proyecto-tym', 'A')).param, 'A');

  const own = resumenesDashboardTym(ana)[0];
  assert.deepEqual([own.entregables, own.actividades, own.etapas, own.contenedores, own.sinSeguimiento], [1, 2, 2, 2, 1]);
  assert.equal(own.estados['en-curso'], 1);
  assert.equal(own.estados['en-espera'], 0, 'Actividad ajena con etapa propia no filtra su estado');
  assert.equal(own.ultimoMovimiento, plan.historial.a[0].fecha, 'No filtra ultima fecha ajena');
  const all = resumenesDashboardTym(pm)[0];
  assert.deepEqual([all.entregables, all.actividades, all.etapas, all.contenedores], [3, 3, 2, 0]);
  assert.equal(all.ultimoMovimiento, plan.historial.b[0].fecha);
  const mixed = resumenesDashboardTym(pm, '', 'bob');
  assert.deepEqual(mixed.map(r => [r.proyecto.id, r.alcance]), [['A', 'BOB'], ['B', 'Mi trabajo']]);
  assert.equal(resumenesDashboardTym(pm, 'A', 'externo').length, 0);
  assert.equal(resumenesDashboardTym(ana, '', 'bob')[0].alcance, 'Mi trabajo', 'Filtro inyectado no amplia permiso');
  assert.equal(resumenesDashboardTym(ana)[1].ultimoMovimiento, null);
  assert.ok(all.lideres.includes('LT') && all.lideres.includes('ADMIN'), 'Lideres por rol efectivo');

  const matrix = currentMatrix();
  const legado = Object.fromEntries(Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, perms]) =>
    [role, perms.filter(p => !p.startsWith('tym.'))]));
  w.localStorage.setItem('timia_role_permissions', JSON.stringify(legado));
  assert.ok(currentMatrix().developer.includes('tym.dashboard.view'));
  assert.ok(currentMatrix().tech_lead.includes('tym.developers.view_all'));
  assert.equal(currentMatrix().developer.includes('tym.developers.view_all'), false);
  saveMatrix({ ...matrix, developer: matrix.developer.filter(p => !p.startsWith('tym.')) });
  assert.equal(proyectosDashboardTym(ana).length, 0);
  assert.equal(menuViews(ana).includes('dashboard-tym'), false);
  assert.ok(JSON.parse(w.localStorage.getItem('timia_role_permissions')!)._catalog.includes('tym.dashboard.view'));
  saveMatrix(matrix);
  w.localStorage.setItem('timia_custom_roles', JSON.stringify([{
    id: 'visor_tym', name: 'Visor T&M', permissions: ['tym.dashboard.view', 'tym.developers.view_all'],
  }]));
  const visor = usuario('visor', normalizeRole('visor_tym'), ['A']);
  assert.deepEqual(proyectosDashboardTym(visor).map(p => p.id), ['A']);
  assert.equal(consultaAmpliadaTym(visor, 'A'), true);
  assert.equal(consultaAmpliadaTym(visor, 'B'), false, 'Rol personalizado no obtiene proyectos ajenos');
  assert.equal(menuViews(visor).includes('dashboard-tym'), true);
  w.localStorage.removeItem('timia_custom_roles');
  console.log('OK: resumen personal/multiproyecto, rol efectivo, matriz heredada/revocada y rutas/menu');

  await render(ana);
  assert.equal(container.querySelector('select[aria-label="Developer T&M"]'), null);
  const before = snapshot();
  await change('Proyecto T&M', 'A');
  assert.ok(container.textContent?.includes('Mi trabajo'));
  const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Abrir proyecto abierto')!;
  await act(async () => { button.click(); });
  assert.deepEqual(navigation, ['proyecto-tym:A']);
  assert.equal(snapshot(), before, 'Consultar, filtrar y abrir no escribe');
  for (const texto of ['Avance real', 'Tareas cerradas', 'esperado', 'semáforo', 'riesgo']) {
    assert.equal(container.textContent?.includes(texto), false, texto);
  }
  await render(pm);
  assert.ok(container.textContent?.includes('Las demás tarjetas conservan «Mi trabajo»'));
  await change('Developer T&M', 'bob');
  assert.equal(container.querySelectorAll('article').length, 2);
  await change('Proyecto T&M', 'B');
  assert.equal(container.querySelector('select[aria-label="Developer T&M"]'), null);
  assert.equal(container.querySelectorAll('article').length, 1);
  await render(ana);
  await act(async () => { saveMatrix({ ...matrix, developer: [...matrix.developer, 'tym.developers.view_all'] }); });
  assert.equal(container.querySelector<HTMLSelectElement>('select[aria-label="Developer T&M"]')!.value, '__mio');
  await change('Developer T&M', 'bob');
  assert.equal(container.querySelectorAll('article').length, 1);
  await act(async () => { saveMatrix(matrix); });
  assert.equal(container.querySelector('select[aria-label="Developer T&M"]'), null);
  assert.equal(container.querySelectorAll('article').length, 2, 'Revocar vuelve a propios proyectos sin filtro ajeno');
  await act(async () => { saveMatrix({ ...matrix, developer: [] }); });
  assert.ok(container.querySelector('[role="alert"]'));
  assert.equal(container.querySelectorAll('article').length, 0, 'Ruta directa respeta permiso');
  await act(async () => { saveMatrix(matrix); });
  console.log('OK: dashboard, filtros, apertura, revocacion inmediata y ausencia de escrituras de consulta');

  const tracking = w.localStorage.getItem('timia_tym_planes')!;
  w.localStorage.setItem('timia_tym_planes', JSON.stringify({ A: { ...plan, historial: { a: {} } } }));
  await render(pm);
  assert.equal(container.querySelectorAll('article [role="alert"]').length, 1, 'Error de un proyecto no oculta otros');
  assert.ok(container.textContent?.includes('Resumen parcial'));
  const corrupted = snapshot();
  assert.equal(resumenesDashboardTym(pm)[0].error !== undefined, true);
  assert.equal(snapshot(), corrupted);
  w.localStorage.setItem('timia_tym_planes', tracking);
  const configs = w.localStorage.getItem('timia_plan_configs')!;
  w.localStorage.setItem('timia_plan_configs', '{');
  await render(pm);
  assert.equal(container.querySelectorAll('article [role="alert"]').length, 2);
  assert.equal(w.localStorage.getItem('timia_plan_configs'), '{');
  w.localStorage.setItem('timia_plan_configs', configs);
  await render(usuario('nadie', 'developer', []));
  assert.ok(container.querySelector('[role="alert"]'));
  await render(pm, true);
  assert.ok(container.textContent?.includes('Proyectos T&M'));
  assert.ok(container.textContent?.includes('Ver todos los desarrolladores'));
  assert.equal(container.querySelectorAll('button[aria-pressed]').length, ALL_PERMISSIONS.length * 5);
  const permisoDeveloper = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Ver todos los desarrolladores (sin este permiso, solo lo propio) · Desarrollador"]',
  )!;
  assert.equal(permisoDeveloper.getAttribute('aria-pressed'), 'false');
  await act(async () => { permisoDeveloper.click(); });
  const guardar = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Guardar cambios'))!;
  await act(async () => { guardar.click(); });
  assert.equal(currentMatrix().developer.includes('tym.developers.view_all'), true, 'Admin guarda permiso del nuevo modulo');
  assert.equal(errors.length, 0);
  console.log('OK: errores visibles por proyecto, sin sobrescritura, seccion Admin y limite frontend');
} finally {
  await act(async () => { root.unmount(); });
  console.error = previousError;
  dom.window.close();
}
