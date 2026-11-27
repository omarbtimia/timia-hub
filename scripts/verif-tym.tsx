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
    { id: 'real-2', nombre: 'Sin bloque', bloque: '', pct: 0, estado: 'en-espera', creada: '2026-01-01' },
  ],
  historial: { 'real-1': [{ fecha: '2026-01-02', de: 0, a: 25, quien: 'Demo' }] },
};
w.localStorage.setItem('timia_tym_planes', JSON.stringify({ DEMO: original }));
w.localStorage.setItem('timia_admin_projects', JSON.stringify([
  { id: 'DEMO', name: 'Proyecto de prueba', client: 'Demo', active: true, tipo: 'tym' },
]));
w.localStorage.setItem('timia_admin_users', '[]');
const requests: { url: string; method: string; body: unknown }[] = [];
const previousFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  requests.push({ url, method: init?.method ?? 'GET', body: init?.body });
  if (url.endsWith('/api/auth/config')) {
    return Response.json({ demo: true, google: false, googleClientId: null, allowedDomains: [] });
  }
  assert.equal(init?.method, 'PUT', `Solicitud inesperada: ${url}`);
  assert.ok(url.endsWith('/api/state/timia_tym_planes'), `Clave inesperada: ${url}`);
  return Response.json({ ok: true });
};

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { probeApi, persist } = await import('../src/lib/persist');
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

try {
  await render('DEMO');
  const before = snapshot();
  assert.equal(named('Nombre del entregable 1').value, 'Soporte');
  assert.equal(named('Nombre del entregable 2').value, 'Vacío');
  assert.equal(named('Nombre del entregable 3').value, 'General');
  await click('Desplegar entregable 2');
  assert.ok(container.textContent?.includes('Sin actividades.'));
  await click('Desplegar entregable 3');
  assert.equal(named('Nombre de la actividad 3.1').value, 'Sin bloque');
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
  assert.ok(simulated.textContent?.includes('Simulada'));
  assert.equal(simulated.querySelector('[aria-label^="Actualizar avance"]'), null);

  await click('Agregar entregable');
  await edit(named('Nombre del entregable 4'), 'Entrega simulada');
  await click('Agregar actividad', container.querySelector('[aria-label="Entregable 4"]')!);
  await click('Agregar etapa', container.querySelector('[aria-label="Actividad 4.1"]')!);
  assert.equal(named('Peso de la etapa 4.1.1').value, '100');
  assert.equal(snapshot(), before, 'La simulación no escribe en localStorage');
  assert.equal(persist.pendingWrites, 0, 'La simulación no encola escrituras');
  assert.equal(requests.length, 0, 'La simulación no llama a la API');
  console.log('OK: jerarquía, inserciones, nombres, pesos y simulación sin escrituras');

  await click('Actualizar avance de Tarea real');
  const dialog = container.querySelector('[role="dialog"]')!;
  assert.ok(dialog.textContent?.includes('Soporte · Tarea real'), 'El panel usa la tarea real, no el nombre simulado');
  await click('75%', dialog);
  await edit(dialog.querySelector('textarea')!, 'Avance conservado');
  await click('Guardar avance', dialog);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(requests.length, 1);
  const saved = JSON.parse(w.localStorage.getItem('timia_tym_planes')!).DEMO as PlanTym;
  assert.equal(saved.tareas.length, 2);
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
  assert.ok(container.textContent?.includes('37.5'), 'Las métricas reales se actualizan');
  console.log('OK: avance e historial reales sin filtrar borrador al almacenamiento ni API');

  await render('VACIO');
  assert.ok(container.textContent?.includes('todavía no tiene entregables'));
  assert.equal(container.querySelectorAll('input').length, 0);
  await click('Agregar entregable');
  await click('Agregar actividad');
  await click('Agregar etapa');
  assert.equal(named('Peso de la etapa 1.1.1').value, '100');
  await render('DEMO');
  assert.equal(named('Nombre del entregable 1').value, 'Soporte');
  assert.equal(named('Nombre de la actividad 1.1').value, 'Tarea real');
  assert.equal(container.querySelectorAll('[aria-label^="Nombre del entregable"]').length, 3);
  assert.equal(container.querySelectorAll('input[type="number"]').length, 0);
  assert.ok(container.textContent?.includes('75%'));
  await act(async () => { root.render(null); });
  await render('DEMO');
  assert.equal(named('Nombre del entregable 1').value, 'Soporte');
  assert.equal(requests.length, 1, 'Cambiar de proyecto y remontar no escribe');
  assert.equal(errors.length, 0, 'Sin errores React');
  console.log('OK: proyecto vacío, aislamiento por proyecto y descarte al salir');
} finally {
  await act(async () => { root.unmount(); });
  console.error = previousError;
  globalThis.fetch = previousFetch;
  dom.window.close();
}
