import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AdminUser, KanbanTask } from '../src/lib/adminStore';
import type { EstructuraTym, PlanTym } from '../src/modules/tym/tipos';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
});
const w = dom.window;
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Node', 'Element',
  'localStorage', 'MouseEvent', 'Event', 'navigator', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  Object.defineProperty(globalThis, key, {
    value: key === 'window' ? w : typeof Reflect.get(w, key) === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key)
      ? Reflect.get(w, key).bind(w) : Reflect.get(w, key), configurable: true, writable: true,
  });
}
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
w.TIMIA_API_URL = 'none';
const usuario = (id: string, role: AdminUser['role'] = 'developer'): AdminUser => ({
  id, name: id.toUpperCase(), email: `${id}@example.test`, role, projectIds: ['OPEN'], active: true, initials: id, avatarColor: '#0d9488',
});
const ana = usuario('ana');
const bob = usuario('bob');
const pm = usuario('pm', 'pm');
const lt = usuario('lt', 'tech_lead');
w.localStorage.setItem('timia_admin_users', JSON.stringify([ana, bob, pm, lt]));
w.localStorage.setItem('timia_admin_projects', JSON.stringify([
  { id: 'OPEN', name: 'Proyecto abierto', client: 'Demo', tipo: 'tym', active: true, color: '#0d9488' },
]));
const legacy = ['en-curso', 'en-espera', 'finalizada', 'no-se-requiere'];
w.localStorage.setItem('timia_tym_planes', JSON.stringify({ OPEN: {
  projectId: 'OPEN', bloques: [], tareas: legacy.map((estado, i) => ({
    id: `a${i}`, nombre: `Actividad ${i}`, bloque: 'Entrega', estado, pct: 25 + i,
    responsable: 'ANA', creada: '2026-01-01',
  })), historial: { a0: [{ fecha: '2026-01-02', de: 0, a: 25, quien: 'ANA', nota: 'Conservar' }] },
} }));
const estructura: EstructuraTym = { projectId: 'OPEN', entregables: [
  { id: 'e', label: 'Entrega', responsableId: 'ana', activities: legacy.map((_, i) => ({
    id: `a${i}`, label: `Actividad ${i}`, responsableId: 'ana', etapas: i ? [] : [
      { id: 's', label: 'Etapa propia', peso: 50, responsableId: 'ana' },
      { id: 'foreign', label: 'Etapa ajena', peso: 50, responsableId: 'bob' },
    ],
  })) },
  { id: 'empty', label: 'Entrega sin asignar', activities: [] },
] };
const cerrado = { projectId: 'CLOSED', totalWeeks: 2, generatedAt: '2026-01-01', entregables: [] };
w.localStorage.setItem('timia_plan_configs', JSON.stringify({ OPEN: estructura, CLOSED: cerrado }));

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { adminStore } = await import('../src/lib/adminStore');
const { leerPlan, leerEstructura, guardarEstructura, guardarPlan } = await import('../src/modules/tym/almacen');
const { ESTADOS, migrarEstado } = await import('../src/modules/tym/tipos');
const { reconciliarProyectoTym, sincronizarTableroTym, guardarDesdeTableroTym, disponibilidadTym, avisarCambioTym, puedeMoverTym } = await import('../src/modules/tym/tablero');
const { currentMatrix, saveMatrix } = await import('../src/lib/permissions');
const { AuthProvider, useAuth } = await import('../src/contexts/AuthContext');
const ProyectoTym = (await import('../src/modules/tym/ProyectoTym')).default;
const CrearTareas = (await import('../src/modules/tym/CrearTareas')).default;
const KanbanBoard = (await import('../src/components/KanbanBoard')).default;
const tarjetas = () => adminStore.getKanbanTasks();
const tarjeta = (id: string) => {
  const t = tarjetas().find(t => t.tym?.nodoId === id);
  assert.ok(t, `Falta tarjeta ${id}`);
  return t;
};
const arbol = () => leerEstructura(leerPlan('OPEN'));
const snapshot = () => JSON.stringify(Object.fromEntries(
  Array.from({ length: w.localStorage.length }, (_, i) => w.localStorage.key(i)!).sort().map(k => [k, w.localStorage.getItem(k)]),
));
const manual: KanbanTask = {
  id: 'manual', title: 'Manual', description: '', projectId: 'OPEN', status: 'review', assigneeIds: ['ana'],
  priority: 'Alta', startDate: '2026-01-01', endDate: '2026-02-01', links: [], comments: [],
};
adminStore.saveKanbanTasks([manual, { ...manual, id: 'closed', projectId: 'CLOSED', fromPlan: true }]);
reconciliarProyectoTym('OPEN');
assert.deepEqual(leerPlan('OPEN').tareas.map(t => t.estado), ['in-progress', 'backlog', 'done', 'backlog']);
assert.deepEqual(leerPlan('OPEN').tareas.map(t => t.pct), [25, 26, 27, 28]);
assert.equal(tarjetas().length, 10, 'Ocho nodos y dos tarjetas previas');
assert.equal(arbol().entregables[0].estado, 'backlog');
assert.equal(arbol().entregables[0].activities[0].etapas![0].estado, 'backlog');
assert.deepEqual(tarjetas().find(t => t.id === 'manual'), manual);
assert.deepEqual(JSON.parse(w.localStorage.getItem('timia_plan_configs')!).CLOSED, cerrado);
const migrated = snapshot();
reconciliarProyectoTym('OPEN');
assert.equal(snapshot(), migrated, 'Reconciliar dos veces no vuelve a escribir ni duplica');
assert.throws(() => migrarEstado('desconocido'), /no válido/);

const seguimiento = leerPlan('OPEN');
for (const id of ['e', 'a0', 's']) {
  for (const estado of ESTADOS) {
    guardarDesdeTableroTym(ana, { ...tarjeta(id), status: estado.id });
    assert.equal(tarjeta(id).status, estado.id);
    if (id === 'e') assert.equal(arbol().entregables[0].estado, estado.id);
    if (id === 's') assert.equal(arbol().entregables[0].activities[0].etapas![0].estado, estado.id);
    if (id === 'a0') assert.equal(leerPlan('OPEN').tareas[0].estado, estado.id);
    assert.equal(leerPlan('OPEN').tareas[0].pct, 25);
    assert.deepEqual(leerPlan('OPEN').historial, seguimiento.historial);
  }
}
assert.equal(tarjeta('foreign').status, 'backlog', 'No propaga estado a hermanos');
assert.equal(tarjeta('a1').status, 'backlog', 'No propaga estado a actividades');
assert.equal(tarjeta('e').status, 'done');
assert.equal(tarjeta('s').status, 'done');
assert.ok(tarjetas().filter(t => t.tym).every(t => !t.startDate && !t.endDate));
assert.throws(() => guardarDesdeTableroTym(bob, { ...tarjeta('a0'), status: 'review' }), /propios/);
assert.equal(puedeMoverTym(ana, tarjeta('foreign')), false);
assert.equal(puedeMoverTym(lt, tarjeta('e')), true);
assert.equal(puedeMoverTym(pm, tarjeta('empty')), false, 'Sin asignar no es editable');
const matrix = currentMatrix();
saveMatrix({ ...matrix, developer: [...matrix.developer, 'tym.developers.view_all'] });
assert.throws(() => guardarDesdeTableroTym(bob, { ...tarjeta('a0'), status: 'review' }), /propios/);
saveMatrix({ ...matrix, developer: matrix.developer.filter(p => p !== 'tasks.update_status') });
assert.throws(() => guardarDesdeTableroTym(ana, { ...tarjeta('a0'), status: 'review' }), /permiso/);
saveMatrix(matrix);
const documentada = { ...tarjeta('a0'), comments: [{
  id: 'comment', userId: 'ana', userName: 'ANA', userInitials: 'AN', userColor: '#0d9488', date: '2026-01-02', text: 'Evidencia',
}], links: [{ id: 'link', title: 'PR', url: 'https://example.test/pr' }] };
guardarDesdeTableroTym(ana, documentada);
let actual = arbol();
actual.entregables[0].activities[0].label = 'Renombrada';
actual.entregables[0].activities[0].responsableId = 'bob';
guardarEstructura('OPEN', actual.entregables);
reconciliarProyectoTym('OPEN');
assert.deepEqual(tarjeta('a0').assigneeIds, ['bob']);
assert.equal(tarjeta('a0').title, 'Renombrada');
assert.deepEqual(tarjeta('a0').comments, documentada.comments);
assert.deepEqual(tarjeta('a0').links, documentada.links);
assert.equal(tarjeta('a0').status, 'done');
assert.equal(tarjeta('e').assigneeIds[0], 'ana');
assert.equal(tarjeta('s').assigneeIds[0], 'ana');
actual = arbol();
actual.entregables[0].activities[0].responsableId = 'ana';
guardarEstructura('OPEN', actual.entregables);
reconciliarProyectoTym('OPEN');

const configBackup = w.localStorage.getItem('timia_plan_configs')!;
const cardsBackup = w.localStorage.getItem('timia_kanban_tasks')!;
w.localStorage.setItem('timia_plan_configs', JSON.stringify({ CLOSED: cerrado }));
assert.match(disponibilidadTym(tarjeta('a0')), /no está en este navegador/);
assert.throws(() => reconciliarProyectoTym('OPEN'), /estructura local/);
assert.equal(w.localStorage.getItem('timia_kanban_tasks'), cardsBackup);
assert.throws(() => guardarDesdeTableroTym(ana, { ...tarjeta('a0'), status: 'backlog' }), /no está en este navegador/);
w.localStorage.setItem('timia_plan_configs', configBackup);
w.localStorage.setItem('timia_kanban_tasks', '{');
assert.throws(() => reconciliarProyectoTym('OPEN'));
assert.equal(w.localStorage.getItem('timia_kanban_tasks'), '{', 'Corrupción no se reemplaza por vacío');
w.localStorage.setItem('timia_kanban_tasks', cardsBackup);
actual = arbol();
actual.entregables[0].activities[0].etapas = actual.entregables[0].activities[0].etapas!.filter(e => e.id !== 'foreign');
guardarEstructura('OPEN', actual.entregables);
reconciliarProyectoTym('OPEN');
assert.equal(tarjetas().some(t => t.tym?.nodoId === 'foreign'), false);
console.log('OK: migración, tres niveles, cuatro estados, aislamiento, reconciliación e integridad de tarjetas');

const container: HTMLElement = w.document.getElementById('root')!;
const root = createRoot(container);
const errors: unknown[] = [];
const previousError = console.error;
console.error = (...args) => { errors.push(args); previousError(...args); };
let current = ana;
function Session({ inicial = false }: { inicial?: boolean }) {
  const { login } = useAuth();
  React.useEffect(() => { login(current); }, []);
  return inicial ? <CrearTareas projectId="OPEN" onListo={() => {}}/> : <>
    <div id="proyecto"><ProyectoTym projectId="OPEN"/></div>
    <div id="tablero"><KanbanBoard userRole={current.role} setUserRole={() => {}}/></div>
  </>;
}
const project = () => container.querySelector('#proyecto')!;
const board = () => container.querySelector('#tablero')!;
async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
}
async function render(user = ana, inicial = false) {
  await act(async () => { root.render(null); });
  current = user;
  await act(async () => { root.render(<AuthProvider><Session inicial={inicial}/></AuthProvider>); });
  await settle();
}
async function click(label: string, scope: ParentNode = container) {
  const b = Array.from(scope.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label);
  assert.ok(b, `Falta botón ${label}`);
  await act(async () => { b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); });
  await settle();
}
async function change(el: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    el.dispatchEvent(new w.Event('change', { bubbles: true }));
  });
  await settle();
}
const select = (label: string, scope: ParentNode = container) => {
  const el = scope.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  assert.ok(el, `Falta selector ${label}`);
  return el;
};
async function crear(label: string, scope: ParentNode = project()) {
  await click(label, scope);
  const before = snapshot();
  assert.equal(select('Estado del nuevo elemento').value, '');
  assert.equal(container.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')!.disabled, true);
  await act(async () => { container.querySelector('form')!.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(snapshot(), before, 'Sin estado no crea un nodo ni una tarjeta');
  await change(select('Estado del nuevo elemento'), 'review');
  await act(async () => { container.querySelector('form')!.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); });
  await settle();
}
try {
  await render();
  const before = snapshot();
  await click('Agregar entregable', project());
  await click('Cancelar', project());
  assert.equal(snapshot(), before, 'Cancelar no escribe');
  await crear('Agregar entregable');
  const nuevo = arbol().entregables.at(-1)!;
  assert.equal(tarjeta(nuevo.id).status, 'review');
  const entScope = project().querySelector('section[aria-label="Entregable 2"]')!;
  await click('Agregar actividad', entScope);
  await change(select('Estado del nuevo elemento'), 'done');
  await act(async () => { container.querySelector('form')!.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); });
  await settle();
  const nueva = arbol().entregables.at(-1)!.activities[0];
  assert.equal(tarjeta(nueva.id!).status, 'done');
  assert.equal(leerPlan('OPEN').tareas.find(t => t.id === nueva.id)?.pct, 0, 'Finalizado no cambia el avance inicial');
  await crear('Agregar etapa', project().querySelector('section[aria-label="Actividad 2.1"]')!);
  const etapa = arbol().entregables.at(-1)!.activities[0].etapas![0];
  assert.equal(tarjeta(etapa.id).status, 'review');
  await change(select('Estado del entregable 2', project()), 'in-progress');
  assert.equal(tarjeta(nuevo.id).status, 'in-progress');
  assert.equal(tarjeta(nueva.id!).status, 'done', 'Sin cascada');
  const cardElement = board().querySelector<HTMLElement>(`[data-rfd-draggable-id="${tarjeta(nuevo.id).id}"]`)!;
  assert.ok(cardElement, 'La tarjeta propia aparece en el tablero developer');
  await act(async () => { cardElement.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); });
  await change(select('Estado de la tarjeta', board()), 'done');
  assert.equal(select('Estado del entregable 2', project()).value, 'done', 'Tablero actualiza proyecto montado');
  assert.equal(arbol().entregables.at(-1)!.estado, 'done');
  await render();
  assert.equal(select('Estado del entregable 2', project()).value, 'done', 'Persiste tras recargar');
  await click('Reporte Histórico', project());
  const report = project().querySelector('#tym-panel-historico')!;
  assert.equal(report.querySelectorAll('input,select,button,textarea').length, 0);
  assert.ok(report.textContent?.includes('Finalizado'));

  await render(pm, true);
  await change(container.querySelector<HTMLInputElement>('#tym-nombre')!, 'Alta alternativa');
  assert.equal(Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Agregar tarea')!.disabled, true);
  await change(container.querySelector<HTMLSelectElement>('#tym-estado-nueva')!, 'review');
  await change(select('Estado del nuevo bloque'), 'backlog');
  await change(container.querySelector<HTMLSelectElement>('#tym-resp')!, 'ana');
  await click('Agregar tarea');
  const alternativa = leerPlan('OPEN').tareas.find(t => t.nombre === 'Alta alternativa')!;
  assert.equal(tarjeta(alternativa.id).status, 'review');
  await click('Quitar Alta alternativa');
  assert.equal(tarjetas().some(t => t.tym?.nodoId === alternativa.id), false);
  assert.equal(leerEstructura(leerPlan('OPEN')).entregables.some(e => e.activities.some(a => a.id === alternativa.id)), false);

  await render();
  const storagePrototype = w.Storage.prototype;
  const originalSet = storagePrototype.setItem;
  try {
    storagePrototype.setItem = function(key, value) {
      if (key === 'timia_kanban_tasks') throw new w.DOMException('Tablero lleno', 'QuotaExceededError');
      originalSet.call(this, key, value);
    };
    await change(select('Estado del entregable 2', project()), 'backlog');
    assert.ok(project().querySelector('[role="alert"]')?.textContent?.includes('Tablero lleno'));
  } finally { storagePrototype.setItem = originalSet; }
  await click('Reintentar guardado', project());
  assert.equal(tarjeta(nuevo.id).status, 'backlog');
  assert.equal(new Set(tarjetas().map(t => t.id)).size, tarjetas().length);
  const cardRetry = board().querySelector<HTMLElement>(`[data-rfd-draggable-id="${tarjeta(nuevo.id).id}"]`)!;
  await act(async () => { cardRetry.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); });
  try {
    storagePrototype.setItem = function(key, value) {
      if (key === 'timia_plan_configs') throw new w.DOMException('Origen lleno', 'QuotaExceededError');
      originalSet.call(this, key, value);
    };
    await change(select('Estado de la tarjeta', board()), 'done');
    assert.ok(board().querySelector('[role="alert"]')?.textContent?.includes('Origen lleno'));
    assert.equal(tarjeta(nuevo.id).status, 'backlog', 'Un error no simula un cambio guardado');
    assert.equal(board().querySelector('select[aria-label="Estado de la tarjeta"]'), null, 'Bloquea nuevos cambios mientras hay un pendiente');
  } finally { storagePrototype.setItem = originalSet; }
  await click('Reintentar guardado', board());
  assert.equal(tarjeta(nuevo.id).status, 'done');
  assert.equal(arbol().entregables.find(e => e.id === nuevo.id)?.estado, 'done');
  assert.equal(board().querySelector('[role="alert"]'), null);
  await act(async () => {
    const p = leerPlan('OPEN');
    guardarPlan({ ...p, tareas: p.tareas.map(t => t.id === nueva.id ? { ...t, estado: 'backlog' } : t) });
    sincronizarTableroTym(leerPlan('OPEN'), arbol().entregables);
    avisarCambioTym();
  });
  await settle();
  assert.equal(tarjeta(nueva.id!).status, 'backlog');
  assert.equal(leerPlan('OPEN').tareas.find(t => t.id === nueva.id)?.pct, 0);
  assert.equal(errors.length, 0, 'Sin errores React');
  console.log('OK: altas requeridas/cancelación, sincronización UI bidireccional, recarga, reporte y reintento');
} finally {
  await act(async () => { root.unmount(); });
  console.error = previousError;
  dom.window.close();
}
