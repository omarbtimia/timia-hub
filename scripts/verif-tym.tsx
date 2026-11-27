import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { PlanTym } from '../src/modules/tym/tipos';

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

const original: PlanTym = {
  projectId: 'DEMO', bloques: ['Soporte', 'Vacío'],
  tareas: [
    { id: 'real-1', nombre: 'Tarea real', bloque: 'Soporte', pct: 25, estado: 'en-curso', creada: '2026-01-01' },
    { id: 'real-2', nombre: 'Sin bloque', bloque: '', pct: 100, estado: 'finalizada', creada: '2026-01-01' },
    { id: 'real-3', nombre: 'Actividad no requerida', bloque: '', pct: 0, estado: 'no-se-requiere', creada: '2026-01-01' },
  ],
  historial: { 'real-1': [{ fecha: '2026-01-02', de: 0, a: 25, quien: 'Demo' }] },
};
w.localStorage.setItem('timia_tym_planes', JSON.stringify({ DEMO: original }));
w.localStorage.setItem('timia_admin_projects', JSON.stringify([
  { id: 'DEMO', name: 'Proyecto de prueba', client: 'Demo', active: true, tipo: 'tym' },
]));
w.localStorage.setItem('timia_admin_users', '[]');
const requests: { url: string; method: string; body: unknown }[] = [];
const closed = { projectId: 'CERRADO', totalWeeks: 4, generatedAt: '2026-01-01', entregables: [
  { id: 'c1', label: 'Entrega cerrada', activities: [{ label: 'Trabajo cerrado', startWeek: 1, endWeek: 4 }] },
] };
let remoteConfigs: Record<string, unknown> = { CERRADO: closed };
let denyNextWrite = false;
const previousFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  requests.push({ url, method: init?.method ?? 'GET', body: init?.body });
  if (url.endsWith('/api/auth/config')) {
    return Response.json({ demo: true, google: false, googleClientId: null, allowedDomains: [] });
  }
  if (url.endsWith('/api/state') && !init?.method) return Response.json({ timia_plan_configs: remoteConfigs });
  if (url.endsWith('/api/state/timia_plan_configs')) {
    if (init?.method !== 'PUT') return Response.json(remoteConfigs);
    if (denyNextWrite) {
      denyNextWrite = false;
      return Response.json({ detail: 'Prueba de permisos' }, { status: 403 });
    }
    return Response.json({ ok: true });
  }
  assert.equal(init?.method, 'PUT', `Solicitud inesperada: ${url}`);
  assert.ok(url.endsWith('/api/state/timia_tym_planes'), `Clave inesperada: ${url}`);
  return Response.json({ ok: true });
};

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { probeApi, persist, loadStateFromApi, persistRefresh } = await import('../src/lib/persist');
const { adminStore } = await import('../src/lib/adminStore');
const { leerEstructura, guardarEstructura, leerPlan } = await import('../src/modules/tym/almacen');
const ProyectoTym = (await import('../src/modules/tym/ProyectoTym')).default;
await probeApi();
assert.equal(persist.mode, 'api');
requests.length = 0;

const container: HTMLElement = w.document.getElementById('root')!;
const root = createRoot(container);
const errors: unknown[] = [];
const previousError = console.error;
console.error = (...args: unknown[]) => { errors.push(args); previousError(...args); };

function named(label: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll('input')).find(el => el.getAttribute('aria-label') === label);
  assert.ok(input, `Falta input: ${label}`);
  return input;
}

async function click(label: string, scope: ParentNode = container) {
  const button = Array.from(scope.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label);
  assert.ok(button, `Falta botón: ${label}`);
  await act(async () => { button.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); });
}

async function edit(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
  });
}

const snapshot = () => JSON.stringify(Object.fromEntries(
  Array.from({ length: w.localStorage.length }, (_, i) => w.localStorage.key(i)!).sort().map(k => [k, w.localStorage.getItem(k)]),
));
const render = async (projectId: string) => {
  await act(async () => { root.render(<ProyectoTym projectId={projectId}/>); });
};
function reporte(): HTMLElement {
  const panel = container.querySelector<HTMLElement>('#tym-panel-historico');
  assert.ok(panel && !panel.hidden, 'El reporte está seleccionado');
  assert.equal(panel.querySelectorAll('input, select, textarea, button, [contenteditable]').length, 0, 'Reporte sin controles editables ni acciones');
  return panel;
}

function sinTarjetasGlobales() {
  assert.equal(container.textContent?.includes('Avance real'), false);
  assert.equal(container.textContent?.includes('Tareas cerradas'), false);
}

async function tecla(key: string) {
  const tab = container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
  assert.ok(tab);
  await act(async () => { tab.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true })); });
  assert.equal(w.document.activeElement, container.querySelector('[role="tab"][aria-selected="true"]'));
}

try {
  await render('DEMO');
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(), 'Tareas Activas');
  sinTarjetasGlobales();
  const before = snapshot();
  assert.equal(w.localStorage.getItem('timia_plan_configs'), null, 'Consultar no guarda una estructura nueva');
  assert.equal(named('Nombre del entregable 1').value, 'Soporte');
  assert.equal(named('Nombre del entregable 2').value, 'Vacío');
  assert.equal(named('Nombre del entregable 3').value, 'General');
  await click('Desplegar entregable 2');
  assert.ok(container.textContent?.includes('Sin actividades.'));
  await click('Desplegar entregable 3');
  assert.equal(named('Nombre de la actividad 3.1').value, 'Sin bloque');
  assert.equal(named('Nombre de la actividad 3.2').value, 'Actividad no requerida');
  await click('Desplegar actividad 1.1');
  assert.ok(container.textContent?.includes('Sin etapas.'));

  await edit(named('Nombre del entregable 1'), 'Nombre temporal');
  await edit(named('Nombre de la actividad 1.1'), 'Actividad renombrada temporal');
  const first = container.querySelector('[aria-label="Actividad 1.1"]')!;
  await click('Agregar etapa', first);
  assert.equal(named('Peso de la etapa 1.1.1').value, '100');
  await edit(named('Nombre de la etapa 1.1.1'), 'Análisis');
  await edit(named('Peso de la etapa 1.1.1'), '40');
  assert.ok(first.textContent?.includes('Las etapas suman 40%; deben sumar 100%'));
  await click('Agregar etapa', first);
  assert.equal(named('Peso de la etapa 1.1.2').value, '60');
  assert.ok(first.textContent?.includes('Suma correcta: 100%'));
  await edit(named('Peso de la etapa 1.1.2'), '140');
  assert.equal(named('Peso de la etapa 1.1.2').value, '100');
  await edit(named('Peso de la etapa 1.1.2'), '-10');
  assert.equal(named('Peso de la etapa 1.1.2').value, '0');
  await edit(named('Peso de la etapa 1.1.2'), '60');

  await click('Desplegar entregable 1');
  assert.equal(container.querySelector('[aria-label="Actividad 1.1"]'), null);
  await click('Agregar actividad', container.querySelector('[aria-label="Entregable 1"]')!);
  assert.equal(named('Nombre de la actividad 1.2').value, 'Nueva actividad');
  const simulated = container.querySelector('[aria-label="Actividad 1.2"]')!;
  assert.ok(simulated.textContent?.includes('Sin seguimiento'));
  assert.equal(simulated.querySelector('[aria-label^="Actualizar avance"]'), null);

  await click('Agregar entregable');
  await edit(named('Nombre del entregable 4'), 'Entrega simulada');
  await click('Agregar actividad', container.querySelector('[aria-label="Entregable 4"]')!);
  await click('Agregar etapa', container.querySelector('[aria-label="Actividad 4.1"]')!);
  assert.equal(named('Peso de la etapa 4.1.1').value, '100');
  assert.notEqual(snapshot(), before, 'La estructura se guarda en localStorage');
  const estructuraGuardada = w.localStorage.getItem('timia_plan_configs')!;
  const estructura = JSON.parse(estructuraGuardada).DEMO;
  assert.deepEqual(Object.keys(estructura).sort(), ['entregables', 'projectId']);
  assert.deepEqual(Object.keys(estructura.entregables[0]).sort(), ['activities', 'id', 'label']);
  assert.deepEqual(Object.keys(estructura.entregables[0].activities[0]).sort(), ['etapas', 'id', 'label']);
  assert.deepEqual(Object.keys(estructura.entregables[0].activities[0].etapas[0]).sort(), ['id', 'label', 'peso']);
  assert.equal(estructura.entregables[0].activities[0].id, 'real-1');
  assert.deepEqual(JSON.parse(w.localStorage.getItem('timia_tym_planes')!).DEMO, original);
  assert.equal(persist.pendingWrites, 0, 'El guardado local no encola escrituras');
  assert.equal(requests.length, 0, 'El guardado de estructura no llama a la API');
  const despuesDeEditar = snapshot();
  console.log('OK: jerarquía y formato compartido guardados localmente sin API');

  await click('Desplegar entregable 1');
  await click('Desplegar entregable 4');
  assert.equal(container.querySelector('[aria-label="Actividad 1.1"]'), null);
  await click('Reporte Histórico');
  const report = reporte();
  for (const value of ['Nombre temporal', 'Actividad renombrada temporal', 'Análisis', 'Peso: 40%', 'Peso: 60%', 'Entrega simulada', 'Nueva actividad', 'Nueva etapa', 'Sin bloque', 'Actividad no requerida']) {
    assert.ok(report.textContent?.includes(value), `El reporte muestra ${value}`);
  }
  assert.equal(report.querySelectorAll('[aria-label^="Entregable "]').length, 4);
  assert.equal(report.querySelectorAll('[aria-label^="Actividad "]').length, 5);
  assert.ok(report.textContent?.includes('no versiones históricas guardadas'));
  sinTarjetasGlobales();
  assert.equal(snapshot(), despuesDeEditar);
  assert.equal(persist.pendingWrites, 0);
  assert.equal(requests.length, 0);
  await click('Tareas Activas');
  assert.equal(named('Nombre del entregable 1').value, 'Nombre temporal');
  assert.equal(container.querySelector('[aria-label="Actividad 1.1"]'), null, 'Se conserva el entregable contraído');
  assert.equal(container.querySelector('[aria-label="Actividad 4.1"]'), null);
  await click('Desplegar entregable 1');
  assert.equal(named('Nombre de la etapa 1.1.1').value, 'Análisis');
  assert.equal(named('Peso de la etapa 1.1.2').value, '60');
  await tecla('ArrowRight');
  reporte();
  await tecla('ArrowRight');
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]')?.id, 'tym-tab-activas');
  await tecla('ArrowLeft');
  reporte();
  await tecla('Home');
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]')?.id, 'tym-tab-activas');
  await tecla('End');
  reporte();
  await click('Tareas Activas');
  console.log('OK: pestañas, reporte desplegado de solo lectura y conservación del borrador y expansión');

  await click('Actualizar avance de Tarea real');
  const dialog = container.querySelector('[role="dialog"]')!;
  assert.ok(dialog.textContent?.includes('Soporte · Tarea real'), 'El panel usa la tarea real, no el nombre simulado');
  await click('75%', dialog);
  await edit(dialog.querySelector('textarea')!, 'Avance conservado');
  await click('Guardar avance', dialog);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(requests.length, 1);
  const saved = JSON.parse(w.localStorage.getItem('timia_tym_planes')!).DEMO as PlanTym;
  assert.equal(saved.tareas.length, 3);
  assert.equal(saved.tareas[0].nombre, 'Tarea real');
  assert.equal(saved.tareas[0].pct, 75);
  assert.deepEqual(saved.bloques, original.bloques);
  assert.equal(saved.historial['real-1'][0].nota, 'Avance conservado');
  assert.equal(saved.historial['real-1'][0].de, 25);
  assert.equal(saved.historial['real-1'].length, 2);
  assert.equal(JSON.stringify(saved).includes('etapas'), false);
  assert.equal(JSON.stringify(saved).includes('simulada'), false);
  assert.deepEqual(JSON.parse(String(requests[0].body)).value.DEMO, saved);
  assert.equal(named('Nombre de la actividad 1.1').value, 'Actividad renombrada temporal');
  assert.equal(named('Nombre del entregable 4').value, 'Entrega simulada');
  assert.ok(container.querySelector('[aria-label="Actividad 1.1"]')?.textContent?.includes('75%'), 'Se actualiza el porcentaje de la tarea');
  await click('Reporte Histórico');
  assert.ok(reporte().querySelector('[aria-label="Actividad 1.1"]')?.textContent?.includes('75%'));
  assert.equal(requests.length, 1, 'Consultar el reporte no agrega escrituras');
  await click('Tareas Activas');
  console.log('OK: avance e historial reales separados de la estructura local');

  await render('VACIO');
  assert.ok(container.textContent?.includes('todavía no tiene entregables'));
  assert.equal(container.querySelectorAll('input').length, 0);
  await click('Reporte Histórico');
  assert.ok(reporte().textContent?.includes('todavía no tiene entregables para mostrar'));
  sinTarjetasGlobales();
  await click('Tareas Activas');
  await click('Agregar entregable');
  await click('Agregar actividad');
  await click('Agregar etapa');
  assert.equal(named('Peso de la etapa 1.1.1').value, '100');
  await render('DEMO');
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]')?.id, 'tym-tab-activas');
  assert.equal(named('Nombre del entregable 1').value, 'Nombre temporal');
  assert.equal(named('Nombre de la actividad 1.1').value, 'Actividad renombrada temporal');
  assert.equal(container.querySelectorAll('[aria-label^="Nombre del entregable"]').length, 4);
  await click('Desplegar actividad 1.1');
  assert.equal(named('Nombre de la etapa 1.1.1').value, 'Análisis');
  assert.equal(named('Peso de la etapa 1.1.1').value, '40');
  assert.ok(container.textContent?.includes('75%'));
  await act(async () => { root.render(null); });
  await render('DEMO');
  assert.equal(named('Nombre del entregable 1').value, 'Nombre temporal');
  assert.equal(JSON.stringify(JSON.parse(w.localStorage.getItem('timia_plan_configs')!).DEMO), JSON.stringify(JSON.parse(estructuraGuardada).DEMO));
  assert.equal(requests.length, 1, 'Cambiar de proyecto y remontar no escribe');
  assert.equal(errors.length, 0, 'Sin errores React');
  console.log('OK: proyecto vacío, aislamiento por proyecto y persistencia al salir');

  const mapaLocal = JSON.parse(w.localStorage.getItem('timia_plan_configs')!);
  const expectedLocal = mapaLocal.DEMO;
  const originalClosed = structuredClone(closed);
  await loadStateFromApi();
  assert.deepEqual(JSON.parse(w.localStorage.getItem('timia_plan_configs')!).DEMO, expectedLocal);
  assert.deepEqual(adminStore.getPlanConfigs(), { CERRADO: closed });
  assert.equal(adminStore.getPlanConfig('DEMO'), null);
  assert.equal(adminStore.getProjectCronogramas('DEMO').length, 0);
  assert.equal(adminStore.getProjectCronogramas('CERRADO').length, 1);
  assert.throws(() => guardarEstructura('CERRADO', []), /cronograma existente/);
  assert.deepEqual(adminStore.getPlanConfig('CERRADO'), closed, 'No se sobrescribe un cronograma con una estructura T&M');
  assert.deepEqual(leerEstructura(leerPlan('DEMO')).entregables, expectedLocal.entregables);

  await persistRefresh('timia_plan_configs');
  assert.deepEqual(JSON.parse(w.localStorage.getItem('timia_plan_configs')!).DEMO, expectedLocal);
  const beforeClosedWrite = requests.length;
  adminStore.savePlanConfig('CERRADO', { ...closed, totalWeeks: 5 });
  await new Promise(resolve => setTimeout(resolve, 450));
  const closedWrite = requests.slice(beforeClosedWrite).find(r => r.method === 'PUT')!;
  assert.ok(closedWrite);
  assert.deepEqual(Object.keys(JSON.parse(String(closedWrite.body)).value), ['CERRADO']);
  assert.deepEqual(JSON.parse(w.localStorage.getItem('timia_plan_configs')!).DEMO, expectedLocal);
  assert.equal(adminStore.getPlanConfig('CERRADO')?.totalWeeks, 5);

  const beacons: Blob[] = [];
  Object.defineProperty(w.navigator, 'sendBeacon', { configurable: true, value: (_url: string, body: Blob) => { beacons.push(body); return true; } });
  adminStore.savePlanConfigs({ CERRADO: closed });
  w.dispatchEvent(new w.Event('beforeunload'));
  assert.equal(beacons.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(await beacons[0].text()).value), ['CERRADO']);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.deepEqual(JSON.parse(w.localStorage.getItem('timia_plan_configs')!).DEMO, expectedLocal);

  denyNextWrite = true;
  adminStore.savePlanConfig('CERRADO', closed);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.deepEqual(JSON.parse(w.localStorage.getItem('timia_plan_configs')!).DEMO, expectedLocal, 'La recuperación por 403 conserva T&M');
  persist.clearError();
  assert.deepEqual(closed, originalClosed, 'No se muta el cronograma anterior');
  console.log('OK: API activa, refresh, guardado cerrado, beacon y recuperación 403 sin filtrar ni perder T&M');

  const realActual = leerPlan('DEMO');
  w.localStorage.setItem('timia_tym_planes', JSON.stringify({ DEMO: {
    ...realActual, tareas: [...realActual.tareas, { id: 'posterior', nombre: 'Agregada después', bloque: 'General', pct: 0, estado: 'en-curso', creada: '2026-01-01' }],
  } }));
  const reconciliada = leerEstructura(leerPlan('DEMO'));
  assert.equal(reconciliada.entregables.flatMap(e => e.activities).filter(a => a.id === 'posterior').length, 1);
  assert.equal(reconciliada.entregables[0].activities[0].label, 'Actividad renombrada temporal');
  guardarEstructura('DEMO', reconciliada.entregables);
  assert.deepEqual(leerEstructura(leerPlan('DEMO')), reconciliada, 'Reconciliar dos veces no duplica tareas');
  assert.deepEqual(adminStore.getPlanConfig('CERRADO'), closed);

  const backup = w.localStorage.getItem('timia_plan_configs')!;
  for (const corrupto of ['{', '[]', JSON.stringify({ DEMO: { projectId: 'DEMO', entregables: [{ id: 'mal', label: 'Datos inválidos', activities: [{}] }] } })]) {
    await render('OTRO');
    w.localStorage.setItem('timia_plan_configs', corrupto);
    await render('DEMO');
    assert.ok(container.querySelector('[role="alert"]'));
    assert.equal(Array.from(container.querySelectorAll('button')).some(b => b.textContent?.includes('Agregar entregable')), false);
    assert.equal(w.localStorage.getItem('timia_plan_configs'), corrupto);
    await click('Reporte Histórico');
    reporte();
    assert.equal(w.localStorage.getItem('timia_plan_configs'), corrupto);
  }
  w.localStorage.setItem('timia_plan_configs', backup);
  await render('OTRO');
  await render('DEMO');
  const storagePrototype = w.Storage.prototype;
  const setItemOriginal = storagePrototype.setItem;
  try {
    storagePrototype.setItem = function(key, value) {
      if (key === 'timia_plan_configs') throw new w.DOMException('Almacenamiento lleno', 'QuotaExceededError');
      setItemOriginal.call(this, key, value);
    };
    await edit(named('Nombre del entregable 1'), 'Cambio pendiente de espacio');
    assert.ok(container.querySelector('[role="alert"]')?.textContent?.includes('Almacenamiento lleno'));
    assert.equal(named('Nombre del entregable 1').value, 'Cambio pendiente de espacio', 'El fallo no descarta la edición');
    assert.equal(w.localStorage.getItem('timia_plan_configs'), backup);
  } finally { storagePrototype.setItem = setItemOriginal; }
  await click('Reintentar guardado');
  assert.equal(container.querySelector('[role="alert"]'), null);
  assert.equal(JSON.parse(w.localStorage.getItem('timia_plan_configs')!).DEMO.entregables[0].label, 'Cambio pendiente de espacio');
  await render('OTRO');
  const getItemOriginal = storagePrototype.getItem;
  try {
    storagePrototype.getItem = function(key) {
      if (key === 'timia_plan_configs') throw new w.DOMException('Acceso denegado', 'SecurityError');
      return getItemOriginal.call(this, key);
    };
    await render('DEMO');
    assert.ok(container.querySelector('[role="alert"]')?.textContent?.includes('Acceso denegado'));
  } finally { storagePrototype.getItem = getItemOriginal; }
  assert.equal(errors.length, 0);
  console.log('OK: reconciliación por id, datos corruptos, almacenamiento lleno y acceso bloqueado sin pérdida silenciosa');
} finally {
  await act(async () => { root.unmount(); });
  console.error = previousError;
  globalThis.fetch = previousFetch;
  dom.window.close();
}
