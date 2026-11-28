import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AdminUser } from '../src/lib/adminStore';
import type { EstructuraTym, PlanTym } from '../src/modules/tym/tipos';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
});
const w = dom.window;
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'localStorage', 'MouseEvent', 'Event', 'navigator']) {
  Object.defineProperty(globalThis, key, {
    value: key === 'window' ? w : Reflect.get(w, key), configurable: true, writable: true,
  });
}
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });

const dev = (id: string, name: string, patch: Partial<AdminUser> = {}): AdminUser => ({
  id, name, email: `${id}@example.test`, role: 'developer', projectIds: ['DEMO'],
  active: true, initials: id, avatarColor: '#0d9488', ...patch,
});
const ana = dev('ana', 'Ana');
const bob = dev('bob', 'Bob', { role: 'tech_lead' });
const pm = dev('pm', 'PM', { role: 'pm' });
const lt = dev('lt', 'LT', { role: 'tech_lead' });
const equipo = [ana, bob, pm, lt, dev('inactivo', 'Inactivo', { active: false }),
  dev('externo', 'Externo', { projectIds: ['OTRO'] }), dev('elevado', 'Elevado')];
w.localStorage.setItem('timia_admin_users', JSON.stringify(equipo));
w.localStorage.setItem('timia_project_roles', JSON.stringify({ 'bob:DEMO': 'developer', 'elevado:DEMO': 'tech_lead' }));
w.localStorage.setItem('timia_admin_projects', JSON.stringify([
  { id: 'DEMO', name: 'Proyecto de prueba', client: 'Demo', active: true, tipo: 'tym' },
]));
const original: PlanTym = {
  projectId: 'DEMO', bloques: ['Compartido', 'Vacío'],
  tareas: [
    { id: 'a1', nombre: 'Trabajo Ana', bloque: 'Compartido', responsable: 'Ana', pct: 25, estado: 'in-progress', creada: '2026-01-01' },
    { id: 'b1', nombre: 'Trabajo Bob', bloque: 'Compartido', responsable: 'Bob', pct: 60, estado: 'in-progress', creada: '2026-01-01' },
    { id: 'u1', nombre: 'Tarea sin asignar', bloque: 'General', pct: 100, estado: 'done', creada: '2026-01-01' },
  ],
  historial: {
    a1: [{ fecha: '2026-01-02', de: 0, a: 25, quien: 'Demo' }],
    b1: [{ fecha: '2026-01-02', de: 0, a: 60, quien: 'Bob' }],
  },
};
const inicial: EstructuraTym = { projectId: 'DEMO', entregables: [
  { id: 'e1', label: 'Entrega de Bob', responsableId: 'bob', activities: [
    { id: 'a1', label: 'Trabajo Ana', etapas: [
      { id: 's1', label: 'Etapa Ana', peso: 40, responsableId: 'ana' },
      { id: 's2', label: 'Etapa Bob', peso: 60, responsableId: 'bob' },
    ] },
    { id: 'b1', label: 'Trabajo Bob', responsableId: 'bob', etapas: [
      { id: 's3', label: 'Etapa de Ana en actividad ajena', peso: 100, responsableId: 'ana' },
    ] },
  ] },
  { id: 'e2', label: 'Entrega sin asignar', activities: [{ id: 'u1', label: 'Tarea sin asignar', etapas: [] }] },
  { id: 'e3', label: 'Entrega vacía Ana', responsableId: 'ana', activities: [] },
  { id: 'e4', label: 'Entrega solo Bob', responsableId: 'bob', activities: [{ id: 'local', label: 'Local sin seguimiento', responsableId: 'bob', etapas: [] }] },
] };
const closed = { projectId: 'CERRADO', totalWeeks: 4, generatedAt: '2026-01-01', entregables: [
  { id: 'c1', label: 'Entrega cerrada', activities: [{ label: 'Trabajo cerrado', startWeek: 1, endWeek: 4 }] },
] };
w.localStorage.setItem('timia_tym_planes', JSON.stringify({ DEMO: original }));
w.localStorage.setItem('timia_plan_configs', JSON.stringify({ DEMO: inicial, CERRADO: closed }));

let sesion: AdminUser | null = pm;
const requests: { url: string; method: string; body: unknown }[] = [];
let remoteConfigs: Record<string, unknown> = { CERRADO: closed };
let denyNextWrite = false;
let denyNextKanban = false;
let remoteCards: unknown[] = [];
const previousFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith('/api/auth/config')) return Response.json({ demo: true, google: false, allowedDomains: [] });
  if (url.endsWith('/api/auth/me')) return Response.json({ user: sesion });
  requests.push({ url, method: init?.method ?? 'GET', body: init?.body });
  if (url.endsWith('/api/state') && !init?.method) return Response.json({ timia_plan_configs: remoteConfigs });
  if (url.endsWith('/api/state/timia_plan_configs')) {
    if (init?.method !== 'PUT') return Response.json(remoteConfigs);
    if (denyNextWrite) {
      denyNextWrite = false;
      return Response.json({ detail: 'Prueba de permisos' }, { status: 403 });
    }
    return Response.json({ ok: true });
  }
  if (url.endsWith('/api/state/timia_role_permissions') && init?.method === 'PUT') return Response.json({ ok: true });
  if (url.endsWith('/api/state/timia_kanban_tasks')) {
    if (init?.method !== 'PUT') return Response.json(remoteCards);
    if (denyNextKanban) {
      denyNextKanban = false;
      return Response.json({ detail: 'Prueba de permisos Kanban' }, { status: 403 });
    }
    remoteCards = JSON.parse(String(init.body)).value;
    return Response.json({ ok: true });
  }
  assert.equal(init?.method, 'PUT', `Solicitud inesperada: ${url}`);
  assert.ok(url.endsWith('/api/state/timia_tym_planes'), `Clave inesperada: ${url}`);
  return Response.json({ ok: true });
};

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { AuthProvider } = await import('../src/contexts/AuthContext');
const { probeApi, persist, loadStateFromApi, persistRefresh } = await import('../src/lib/persist');
const { adminStore } = await import('../src/lib/adminStore');
const { leerEstructura, guardarEstructura, leerPlan } = await import('../src/modules/tym/almacen');
const { developersDelProyecto, estructuraConResponsables } = await import('../src/modules/tym/responsables');
const { currentMatrix, saveMatrix } = await import('../src/lib/permissions');
const ProyectoTym = (await import('../src/modules/tym/ProyectoTym')).default;
const CrearTareas = (await import('../src/modules/tym/CrearTareas')).default;
const KanbanBoard = (await import('../src/components/KanbanBoard')).default;
await probeApi();
assert.equal(persist.mode, 'api');
requests.length = 0;
const container: HTMLElement = w.document.getElementById('root')!;
const root = createRoot(container);
const errors: unknown[] = [];
const previousError = console.error;
console.error = (...args: unknown[]) => { errors.push(args); previousError(...args); };
const snapshot = () => w.localStorage.getItem('timia_plan_configs');
const stored = (): EstructuraTym => JSON.parse(snapshot()!).DEMO;
const tracking = (): PlanTym => JSON.parse(w.localStorage.getItem('timia_tym_planes')!).DEMO;
const waitWrites = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 450)); });
const select = (label: string) => {
  const el = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  assert.ok(el, `Falta selector ${label}`);
  return el;
};
const input = (label: string) => {
  const el = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  assert.ok(el, `Falta campo ${label}`);
  return el;
};
async function click(label: string, scope: ParentNode = container) {
  const b = Array.from(scope.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label);
  assert.ok(b, `Falta botón ${label}`);
  await act(async () => { b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); });
  if (label.startsWith('Agregar ')) {
    const estado = container.querySelector<HTMLSelectElement>('select[aria-label="Estado del nuevo elemento"]');
    if (estado) {
      assert.equal(estado.value, '', 'El estado no se preselecciona');
      assert.equal(container.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')?.disabled, true);
      await change(estado, 'backlog');
      await act(async () => { container.querySelector('form')!.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); });
    }
  }
}
async function change(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype
    : el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    el.dispatchEvent(new w.Event('change', { bubbles: true }));
  });
}
async function render(user: AdminUser | null = pm, projectId = 'DEMO') {
  await act(async () => { root.render(null); });
  sesion = user;
  await act(async () => { root.render(<AuthProvider><ProyectoTym projectId={projectId}/></AuthProvider>); });
}
const section = (label: string) => {
  const el = container.querySelector<HTMLElement>(`section[aria-label="${label}"]`);
  assert.ok(el, `Falta sección ${label}`);
  return el;
};
async function report() {
  await click('Reporte Histórico');
  const panel = container.querySelector<HTMLElement>('#tym-panel-historico')!;
  assert.equal(panel.querySelectorAll('input, select, textarea, button, [contenteditable]').length, 0);
  return panel;
}

try {
  assert.deepEqual(developersDelProyecto('DEMO').map(u => u.id), ['ana', 'bob']);
  const ambiguous = estructuraConResponsables(inicial.entregables, original, [ana, dev('duplicada', 'Ana'), bob]);
  assert.equal(ambiguous[0].activities[0].responsableId, undefined, 'Nombre duplicado no inventa responsable');
  await render();
  assert.equal(select('Visualizar trabajo de').value, '');
  assert.deepEqual(Array.from(select('Visualizar trabajo de').options).map(o => o.textContent), ['Panorama General', 'Ana', 'Bob']);
  const before = snapshot();
  assert.equal(container.querySelectorAll('input').length, 0, 'Panorama sin edición de nombres/pesos');
  assert.equal(container.querySelector('[aria-label^="Actualizar avance"]'), null);
  await click('Desplegar entregable 2');
  assert.ok(select('Responsable del entregable 2'));
  await change(select('Responsable del entregable 2'), 'ana');
  assert.equal(stored().entregables[1].responsableId, 'ana');
  assert.equal(container.querySelector('select[aria-label="Responsable del entregable 2"]'), null, 'Asignado: ya no editable en panorama');
  await change(select('Responsable de la actividad 2.1'), 'ana');
  assert.equal(tracking().tareas.find(t => t.id === 'u1')?.responsable, 'Ana');
  await waitWrites();
  assert.ok(requests.every(r => !r.url.endsWith('timia_plan_configs')), 'Estructura nunca se envía al servidor');
  requests.length = 0;
  const afterAssignment = snapshot();
  const tab = container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
  await act(async () => { tab.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
  assert.equal(w.document.activeElement, container.querySelector('#tym-tab-historico'));
  await act(async () => {
    container.querySelector('#tym-tab-historico')!.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  });
  assert.equal(w.document.activeElement, container.querySelector('#tym-tab-activas'));
  const panel = await report();
  assert.equal(panel.querySelectorAll('section[aria-label^="Entregable "]').length, 4);
  assert.equal(panel.querySelectorAll('section[aria-label^="Actividad "]').length, 4);
  assert.equal(snapshot(), afterAssignment);
  assert.ok(panel.textContent?.includes('Peso: 60%'));
  assert.ok(panel.textContent?.includes('no versiones históricas guardadas'));
  await click('Tareas Activas');
  await change(select('Visualizar trabajo de'), 'ana');
  assert.equal(input('Nombre del entregable 2').value, 'Entrega sin asignar');
  assert.equal(container.querySelector('input[aria-label="Nombre del entregable 1"]'), null, 'Contenedor de Bob no editable');
  assert.equal(input('Nombre de la actividad 1.1').value, 'Trabajo Ana');
  assert.equal(container.querySelector('input[aria-label="Nombre de la actividad 1.2"]'), null, 'Actividad ajena solo contexto');
  assert.equal(container.querySelectorAll('section[aria-label^="Entregable "]').length, 3, 'No muestra entrega exclusiva de Bob');
  await click('Desplegar actividad 1.1');
  assert.equal(input('Nombre de la etapa 1.1.1').value, 'Etapa Ana');
  assert.equal(container.querySelector('input[aria-label="Nombre de la etapa 1.1.2"]'), null);
  assert.ok(container.textContent?.includes('Suma correcta: 100%'));
  assert.ok(container.textContent?.includes('total de toda la actividad'));
  const bobOriginal = structuredClone(stored().entregables[0].activities[1]);
  const foreignStage = structuredClone(stored().entregables[0].activities[0].etapas![1]);
  await change(input('Nombre de la actividad 1.1'), 'Trabajo Ana renombrado');
  await change(input('Peso de la etapa 1.1.1'), '35');
  assert.deepEqual(stored().entregables[0].activities[1], bobOriginal);
  assert.deepEqual(stored().entregables[0].activities[0].etapas![1], foreignStage);
  assert.equal(tracking().tareas.find(t => t.id === 'a1')?.nombre, 'Trabajo Ana renombrado');
  assert.deepEqual(tracking().historial.b1, original.historial.b1);
  await waitWrites();
  requests.length = 0;
  await change(input('Nombre de la etapa 1.1.1'), 'Etapa propia editada');
  await waitWrites();
  assert.ok(requests.every(r => r.url.endsWith('timia_kanban_tasks')), 'Renombrar estructura solo sincroniza su tarjeta, no envía la jerarquía');
  const current = snapshot();
  await report();
  await change(select('Visualizar trabajo de'), 'bob');
  assert.equal(container.querySelectorAll('#tym-panel-historico input, #tym-panel-historico select, #tym-panel-historico button').length, 0);
  await change(select('Visualizar trabajo de'), '');
  assert.equal(snapshot(), current, 'Filtrar y consultar no guarda');
  assert.notEqual(current, before);
  console.log('OK: equipo por rol efectivo, panorama, regularización, filtros y contenedores mixtos');

  await render(ana);
  assert.equal(container.querySelector('select[aria-label="Visualizar trabajo de"]'), null);
  assert.equal(container.querySelector('input[aria-label="Nombre del entregable 1"]'), null);
  assert.equal(input('Nombre de la actividad 1.1').value, 'Trabajo Ana renombrado');
  assert.deepEqual(Array.from(select('Responsable de la actividad 1.1').options).map(o => o.value), ['ana']);
  await change(select('Responsable de la actividad 1.1'), 'bob');
  assert.equal(stored().entregables[0].activities[0].responsableId, 'ana', 'No acepta reasignar fuera de opciones');
  assert.equal(section('Actividad 1.2').querySelector('[aria-label^="Actualizar avance"]'), null, 'Etapa propia no permite avance de actividad ajena');
  await click('Desplegar actividad 1.2');
  assert.equal(input('Nombre de la etapa 1.2.1').value, 'Etapa de Ana en actividad ajena');
  await change(input('Nombre de la etapa 1.2.1'), 'Etapa propia bajo Bob');
  await click('Agregar etapa', section('Actividad 1.2'));
  assert.equal(stored().entregables[0].activities[1].etapas!.at(-1)!.responsableId, 'ana');
  assert.equal(stored().entregables[0].activities[1].responsableId, 'bob', 'Crear etapa propia no cambia dueño de actividad ajena');
  await click('Actualizar avance de Trabajo Ana renombrado');
  const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
  const responsibleProgress = dialog.querySelector<HTMLSelectElement>('#tym-resp2')!;
  assert.deepEqual(Array.from(responsibleProgress.options).map(o => o.value), ['ana']);
  await click('75%', dialog);
  await change(dialog.querySelector('textarea')!, 'Avance conservado');
  await click('Guardar avance', dialog);
  assert.equal(tracking().tareas.find(t => t.id === 'a1')?.pct, 75);
  assert.equal(tracking().historial.a1[0].nota, 'Avance conservado');
  assert.equal(tracking().historial.a1[0].de, 25);
  assert.deepEqual(tracking().historial.b1, original.historial.b1);

  await click('Agregar entregable');
  const nuevo = stored().entregables.at(-1)!;
  assert.equal(nuevo.responsableId, 'ana');
  const entregaNueva = section('Entregable 4');
  await click('Agregar actividad', entregaNueva);
  const actNueva = stored().entregables.at(-1)!.activities[0];
  assert.equal(actNueva.responsableId, 'ana');
  assert.equal(tracking().tareas.find(t => t.id === actNueva.id)?.pct, 0);
  assert.equal(tracking().tareas.find(t => t.id === actNueva.id)?.responsable, 'Ana');
  await click('Agregar etapa', section('Actividad 4.1'));
  assert.equal(stored().entregables.at(-1)!.activities[0].etapas![0].responsableId, 'ana');
  assert.equal(input('Peso de la etapa 4.1.1').value, '100');
  assert.deepEqual(Object.keys(stored()).sort(), ['entregables', 'projectId']);
  assert.deepEqual(Object.keys(stored().entregables.at(-1)!).sort(), ['activities', 'estado', 'id', 'label', 'responsableId']);
  assert.deepEqual(Object.keys(actNueva).sort(), ['etapas', 'id', 'label', 'responsableId']);
  assert.equal(JSON.stringify(stored()).includes('startWeek'), false);
  assert.equal(JSON.stringify(stored()).includes('tareaId'), false);
  await click('Actualizar avance de Nueva actividad');
  await click('50%', container.querySelector('[role="dialog"]')!);
  await click('Guardar avance');
  assert.equal(tracking().tareas.find(t => t.id === actNueva.id)?.pct, 50);
  assert.equal(tracking().historial[actNueva.id!][0].de, 0);
  const persisted = snapshot();
  await render(ana);
  assert.equal(snapshot(), persisted);
  await report();
  assert.ok(container.textContent?.includes('50%'));
  assert.equal(container.textContent?.includes('Entrega solo Bob'), false);
  assert.equal(container.textContent?.includes('Avance real'), false);
  assert.equal(container.textContent?.includes('Tareas cerradas'), false);
  console.log('OK: developer solo propio, responsables restringidos, creación, avance e historial tras recarga');

  await render(lt);
  await change(select('Visualizar trabajo de'), 'bob');
  await click('Desplegar entregable 2');
  await click('Actualizar avance de Local sin seguimiento');
  await click('25%', container.querySelector('[role="dialog"]')!);
  await click('Guardar avance');
  assert.equal(tracking().tareas.filter(t => t.id === 'local').length, 1);
  assert.equal(tracking().tareas.find(t => t.id === 'local')?.pct, 25);
  await click('Desplegar actividad 1.1');
  await change(select('Responsable de la etapa 1.1.1'), 'ana');
  assert.equal(stored().entregables[0].activities[0].etapas![1].responsableId, 'ana');
  assert.equal(stored().entregables[0].responsableId, 'bob');
  assert.equal(stored().entregables[0].activities[0].responsableId, 'ana');
  await change(select('Responsable de la actividad 1.1'), 'ana');
  assert.equal(stored().entregables[0].activities[1].responsableId, 'ana');
  assert.equal(tracking().tareas.find(t => t.id === 'b1')?.responsable, 'Ana');
  assert.equal(container.querySelector('section[aria-label="Actividad 1.1"]'), null);
  await waitWrites();
  assert.ok(requests.every(r => r.url.endsWith('timia_tym_planes') || r.url.endsWith('timia_kanban_tasks')));
  requests.length = 0;
  console.log('OK: LT por developer, inicialización de seguimiento local y reasignación sin perder contexto');

  const expectedLocal = stored();
  const originalClosed = structuredClone(closed);
  await act(async () => { await loadStateFromApi(); });
  assert.deepEqual(stored(), expectedLocal);
  assert.deepEqual(adminStore.getPlanConfigs(), { CERRADO: closed });
  assert.equal(adminStore.getPlanConfig('DEMO'), null);
  assert.equal(adminStore.getProjectCronogramas('DEMO').length, 0);
  assert.throws(() => guardarEstructura('CERRADO', []), /cronograma existente/);
  await act(async () => { await persistRefresh('timia_plan_configs'); });
  assert.deepEqual(stored(), expectedLocal);
  await act(async () => { adminStore.savePlanConfig('CERRADO', { ...closed, totalWeeks: 5 }); });
  await waitWrites();
  assert.deepEqual(Object.keys(JSON.parse(String(requests.find(r => r.method === 'PUT')!.body)).value), ['CERRADO']);
  assert.deepEqual(stored(), expectedLocal);
  assert.equal(adminStore.getPlanConfig('CERRADO')?.totalWeeks, 5);
  const beacons: Blob[] = [];
  Object.defineProperty(w.navigator, 'sendBeacon', { configurable: true, value: (_url: string, body: Blob) => { beacons.push(body); return true; } });
  await act(async () => { adminStore.savePlanConfigs({ CERRADO: closed }); });
  w.dispatchEvent(new w.Event('beforeunload'));
  assert.equal(beacons.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(await beacons[0].text()).value), ['CERRADO']);
  await waitWrites();
  denyNextWrite = true;
  await act(async () => { adminStore.savePlanConfig('CERRADO', closed); });
  await waitWrites();
  assert.deepEqual(stored(), expectedLocal);
  await act(async () => { persist.clearError(); });
  assert.deepEqual(closed, originalClosed);
  const realActual = leerPlan('DEMO');
  w.localStorage.setItem('timia_tym_planes', JSON.stringify({ DEMO: {
    ...realActual, tareas: [...realActual.tareas, { id: 'posterior', nombre: 'Agregada después', bloque: 'General', pct: 0, estado: 'in-progress', creada: '2026-01-01' }],
  } }));
  const reconciliada = leerEstructura(leerPlan('DEMO'));
  assert.equal(reconciliada.entregables.flatMap(e => e.activities).filter(a => a.id === 'posterior').length, 1);
  guardarEstructura('DEMO', reconciliada.entregables);
  assert.deepEqual(leerEstructura(leerPlan('DEMO')), reconciliada);
  console.log('OK: API activa, refresh, guardado cerrado, beacon y recuperación 403 conservan estructura local');

  await render(ana);
  const backup = snapshot()!;
  const storagePrototype = w.Storage.prototype;
  const originalSet = storagePrototype.setItem;
  try {
    storagePrototype.setItem = function(key, value) {
      if (key === 'timia_plan_configs') throw new w.DOMException('Almacenamiento lleno', 'QuotaExceededError');
      originalSet.call(this, key, value);
    };
    await change(input('Nombre de la actividad 1.1'), 'Edición pendiente');
    assert.ok(container.querySelector('[role="alert"]')?.textContent?.includes('Almacenamiento lleno'));
    assert.equal(input('Nombre de la actividad 1.1').value, 'Edición pendiente');
    assert.equal(snapshot(), backup);
  } finally { storagePrototype.setItem = originalSet; }
  await click('Reintentar guardado');
  assert.equal(container.querySelector('[role="alert"]'), null);
  assert.equal(stored().entregables[0].activities[0].label, 'Edición pendiente');
  assert.equal(tracking().tareas.find(t => t.id === 'a1')?.nombre, 'Edición pendiente');

  await render(pm);
  await change(select('Visualizar trabajo de'), 'ana');
  const count = tracking().tareas.length;
  try {
    storagePrototype.setItem = function(key, value) {
      if (key === 'timia_tym_planes') throw new w.DOMException('Seguimiento lleno', 'QuotaExceededError');
      originalSet.call(this, key, value);
    };
    await click('Agregar actividad', section('Entregable 1'));
    assert.ok(container.querySelector('[role="alert"]')?.textContent?.includes('Seguimiento lleno'));
    assert.equal(select('Visualizar trabajo de').disabled, true, 'No pierde pendiente cambiando developer');
    assert.equal(tracking().tareas.length, count);
  } finally { storagePrototype.setItem = originalSet; }
  const pendingId = stored().entregables[0].activities.at(-1)!.id;
  await click('Reintentar guardado');
  assert.equal(tracking().tareas.filter(t => t.id === pendingId).length, 1);
  assert.equal(tracking().tareas.length, count + 1);
  assert.equal(select('Visualizar trabajo de').disabled, false);
  const historyCount = tracking().historial.a1.length;
  await click('Actualizar avance de Edición pendiente');
  await change(container.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!, 'Nota con reintento');
  try {
    storagePrototype.setItem = function(key, value) {
      if (key === 'timia_tym_planes') throw new w.DOMException('Seguimiento lleno', 'QuotaExceededError');
      originalSet.call(this, key, value);
    };
    await click('Guardar avance');
    assert.equal(container.querySelector('[role="dialog"]'), null, 'El reintento se realiza fuera del panel, sin repetir la nota');
    assert.equal(tracking().historial.a1.length, historyCount);
  } finally { storagePrototype.setItem = originalSet; }
  await click('Reintentar guardado');
  assert.equal(tracking().historial.a1.length, historyCount + 1);
  assert.equal(tracking().historial.a1[0].nota, 'Nota con reintento');
  assert.equal(w.localStorage.getItem('timia_tym_planes')!.includes('responsableId'), false);
  await waitWrites();
  const valid = snapshot()!;
  for (const corrupto of ['{', '[]', JSON.stringify({ DEMO: { projectId: 'DEMO', entregables: [{ id: 'x', label: 'Mal', responsableId: 2, activities: [] }] } })]) {
    w.localStorage.setItem('timia_plan_configs', corrupto);
    await render(pm);
    assert.ok(container.querySelector('[role="alert"]'));
    assert.equal(container.querySelector('input'), null);
    assert.equal(snapshot(), corrupto);
    await report();
    assert.equal(snapshot(), corrupto);
  }
  w.localStorage.setItem('timia_plan_configs', valid);
  const originalGet = storagePrototype.getItem;
  try {
    storagePrototype.getItem = function(key) {
      if (key === 'timia_plan_configs') throw new w.DOMException('Acceso denegado', 'SecurityError');
      return originalGet.call(this, key);
    };
    await render(pm);
    assert.ok(container.querySelector('[role="alert"]')?.textContent?.includes('Acceso denegado'));
  } finally { storagePrototype.getItem = originalGet; }
  console.log('OK: cuota, escritura parcial, reintento idempotente y datos corruptos sin sobrescritura silenciosa');

  await render(null);
  assert.ok(container.querySelector('[role="alert"]')?.textContent?.includes('No tienes acceso'));
  await render(equipo.find(u => u.id === 'externo')!);
  assert.ok(container.querySelector('[role="alert"]')?.textContent?.includes('No tienes acceso'));
  await render(pm, 'INEXISTENTE');
  assert.ok(container.querySelector('[role="alert"]'));
  await render({ ...pm, role: 'developer' });
  assert.equal(container.querySelector('select[aria-label="Visualizar trabajo de"]'), null);
  assert.equal(container.querySelectorAll('section[aria-label^="Entregable "]').length, 0);
  await act(async () => { root.render(null); });
  sesion = bob;
  await act(async () => { root.render(<AuthProvider><CrearTareas projectId="DEMO" onListo={() => {}}/></AuthProvider>); });
  assert.ok(container.querySelector('[role="alert"]')?.textContent?.includes('gestión inicial'));
  assert.equal(container.querySelectorAll('input, select, button').length, 0, 'Developer no accede al editor inicial de todo el proyecto');
  await act(async () => { root.render(null); });
  sesion = pm;
  await act(async () => { root.render(<AuthProvider><CrearTareas projectId="DEMO" onListo={() => {}}/></AuthProvider>); });
  const opcionesIniciales = Array.from(container.querySelectorAll<HTMLOptionElement>('#tym-resp option')).map(o => o.value);
  assert.deepEqual(opcionesIniciales, ['', 'Ana', 'Bob']);
  await render(lt);
  assert.equal(select('Visualizar trabajo de').value, '');
  const ultima = stored().entregables[0].activities[0];
  await change(select('Responsable del entregable 1'), 'ana');
  await change(select('Responsable de la actividad 1.1'), 'bob');
  await click('Desplegar actividad 1.1');
  await change(select('Responsable de la etapa 1.1.1'), 'bob');
  assert.equal(stored().entregables[0].responsableId, 'ana');
  assert.equal(stored().entregables[0].activities[0].responsableId, 'bob');
  assert.equal(stored().entregables[0].activities[0].etapas![0].responsableId, 'bob');
  assert.equal(stored().entregables[0].activities[0].etapas![1].responsableId, ultima.etapas![1].responsableId, 'Reasignacion no propaga a hermanos');
  assert.equal(tracking().tareas.find(t => t.id === 'a1')?.responsable, 'Bob');
  assert.equal(container.querySelectorAll('input').length, 0, 'LT en panorama no edita nombres o pesos');
  assert.equal(container.querySelector('[aria-label^="Actualizar avance"]'), null);
  await report();
  await click('Tareas Activas');
  await waitWrites();

  await render(ana);
  const matrix = currentMatrix();
  const conConsulta = { ...matrix, developer: [...matrix.developer, 'tym.developers.view_all'] };
  await act(async () => { saveMatrix(conConsulta); });
  assert.ok(select('Visualizar trabajo de'));
  await change(select('Visualizar trabajo de'), 'bob');
  assert.equal(container.querySelectorAll('input').length, 0, 'Developer no edita trabajo ajeno aunque pueda consultarlo');
  assert.equal(container.querySelector('select[aria-label^="Responsable"]'), null);
  assert.equal(Array.from(container.querySelectorAll('button')).some(b => b.textContent?.includes('Agregar')), false);
  await change(select('Visualizar trabajo de'), '__todos');
  assert.equal(container.querySelectorAll('input, select[aria-label^="Responsable"]').length, 0);
  await report();
  await click('Tareas Activas');
  await change(select('Visualizar trabajo de'), '');
  assert.ok(input('Nombre del entregable 1'), 'Regresa a Mi trabajo editable');
  await change(select('Visualizar trabajo de'), 'bob');
  await act(async () => { saveMatrix(matrix); });
  assert.equal(container.querySelector('select[aria-label="Visualizar trabajo de"]'), null, 'Revocacion inmediata elimina el filtro');
  assert.equal(input('Nombre del entregable 1').value, stored().entregables[0].label);
  await act(async () => { saveMatrix(conConsulta); });
  assert.equal(select('Visualizar trabajo de').value, '', 'Rehabilitar no recupera seleccion ajena revocada');
  await waitWrites();
  const matrixWrite = requests.filter(r => r.url.endsWith('timia_role_permissions') && r.method === 'PUT').at(-1)!;
  assert.ok(JSON.parse(String(matrixWrite.body)).value.developer.includes('tym.developers.view_all'));
  assert.ok(JSON.parse(String(matrixWrite.body)).value._catalog.includes('tym.dashboard.view'));

  await render(pm);
  await change(select('Visualizar trabajo de'), 'bob');
  await act(async () => { saveMatrix({ ...matrix, pm: matrix.pm.filter(p => p !== 'tym.developers.view_all') }); });
  assert.equal(container.querySelector('select[aria-label="Visualizar trabajo de"]'), null, 'PM sin permiso solo ve lo propio');
  assert.equal(container.querySelectorAll('section[aria-label^="Entregable "]').length, 0);
  await render(lt);
  await act(async () => { saveMatrix({ ...matrix, tech_lead: matrix.tech_lead.filter(p => p !== 'tym.developers.view_all') }); });
  assert.equal(container.querySelector('select[aria-label="Visualizar trabajo de"]'), null);
  assert.equal(container.querySelectorAll('section[aria-label^="Entregable "]').length, 0, 'LT restringido no salta filtro de consulta');
  await waitWrites();
  assert.equal(persist.pendingWrites, 0, 'No quedan escrituras pendientes al finalizar');
  await act(async () => { root.render(null); saveMatrix(matrix); });
  await waitWrites();
  const planAntesDeRechazo = leerPlan('DEMO');
  w.localStorage.setItem('timia_tym_planes', JSON.stringify({ DEMO: {
    ...planAntesDeRechazo, tareas: planAntesDeRechazo.tareas.map((t, i) => i ? t : { ...t, estado: t.estado === 'review' ? 'backlog' : 'review' }),
  } }));
  requests.length = 0;
  denyNextKanban = true;
  sesion = ana;
  await act(async () => { root.render(<AuthProvider><KanbanBoard userRole="developer" setUserRole={() => {}}/></AuthProvider>); });
  await waitWrites();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)); });
  assert.equal(requests.filter(r => r.url.endsWith('timia_kanban_tasks') && r.method === 'PUT').length, 1, 'Rechazo 403 no inicia un bucle de reconciliación/escrituras');
  assert.equal(persist.lastError?.key, 'timia_kanban_tasks');
  assert.equal(persist.pendingWrites, 0);
  for (const r of requests.filter(r => r.url.endsWith('timia_kanban_tasks') && r.method === 'PUT')) {
    const payload = JSON.parse(String(r.body)).value;
    assert.ok(payload.every((t: Record<string, unknown>) => !('entregables' in t) && !('activities' in t) && !('etapas' in t)));
  }
  await act(async () => { persist.clearError(); });
  assert.equal(errors.length, 0, 'Sin errores React');
  console.log('OK: LT reasigna tres niveles en panorama, consulta developer sin edición, matriz API y revocacion inmediata');
  console.log('OK: sesiones sin acceso, proyectos inexistentes y usuario sin elementos');
} finally {
  await act(async () => { root.unmount(); });
  console.error = previousError;
  globalThis.fetch = previousFetch;
  dom.window.close();
}
