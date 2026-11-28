// ─── Proyectos abiertos (T&M) — dónde se guardan ─────────────────────────────
// El seguimiento usa `timia_tym_planes`, con un plan por proyecto. Va por
// la misma capa que el resto del front: localStorage para leer y, si hay API,
// un PUT por escritura.
//
// La estructura reutiliza timia_plan_configs, pero solo en este navegador:
// todavía no tiene integración de backend.

import { persistSet } from '../../lib/persist';
import { adminStore, type AdminProject } from '../../lib/adminStore';
import { migrarEstado, planVacio, type EstadoTarea, type PlanTym, type TareaTym, type CambioTym, type EstructuraTym, type EntregableTym } from './tipos';
import { esObjeto, esEstructuraLocal, estructuraValida, leerConfiguraciones, PLAN_CONFIGS_KEY } from '../../lib/planStructure';

export function leerEstructura(plan: PlanTym): EstructuraTym {
  const cfg = leerConfiguraciones()[plan.projectId];
  if (cfg !== undefined && (!esEstructuraLocal(cfg) || !estructuraValida(cfg) || cfg.projectId !== plan.projectId)) {
    throw new Error('La estructura guardada de este proyecto no es válida. No se sobrescribieron sus datos.');
  }
  const estructura: EstructuraTym = estructuraValida(cfg)
    ? structuredClone(cfg)
    : { projectId: plan.projectId, entregables: [] };
  const ids = new Set(estructura.entregables.flatMap(e => e.activities.map(a => a.id)));
  const pendientes = plan.tareas.filter(t => !ids.has(t.id));
  const bloques = cfg === undefined ? [...plan.bloques, ...pendientes.map(t => t.bloque)] : pendientes.map(t => t.bloque);
  for (const bloque of [...new Set(bloques.map(b => b || 'General'))]) {
    let ent = estructura.entregables.find(e => e.label === bloque);
    if (!ent) {
      ent = { id: nuevoId(), label: bloque, activities: [] };
      estructura.entregables.push(ent);
    }
    ent.activities.push(...pendientes.filter(t => (t.bloque || 'General') === bloque).map(t => ({
      id: t.id, label: t.nombre, etapas: [],
    })));
  }
  estructura.entregables = estructura.entregables.map(e => ({
    ...e, estado: e.estado ?? 'backlog', activities: e.activities.map(a => ({
      ...a, etapas: a.etapas?.map(et => ({ ...et, estado: et.estado ?? 'backlog' })),
    })),
  }));
  return estructura;
}

export function guardarEstructura(projectId: string, entregables: EntregableTym[]): void {
  const estructura: EstructuraTym = { projectId, entregables };
  if (!estructuraValida(estructura)) throw new Error('La estructura contiene identificadores o pesos de etapas no válidos.');
  const all = leerConfiguraciones();
  const anterior = all[projectId];
  if (anterior !== undefined && (!esEstructuraLocal(anterior) || !estructuraValida(anterior) || anterior.projectId !== projectId)) {
    throw new Error('No se puede sobrescribir una configuración inválida o un cronograma existente.');
  }
  localStorage.setItem(PLAN_CONFIGS_KEY, JSON.stringify({ ...all, [projectId]: estructura }));
}

const CLAVE = 'timia_tym_planes';

function todos(): Record<string, unknown> {
  const v: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
  if (!esObjeto(v)) throw new Error('El seguimiento guardado no es válido.');
  return v;
}

export function normalizarPlan(plan: unknown): PlanTym {
  if (!esObjeto(plan) || typeof plan.projectId !== 'string'
    || !Array.isArray(plan.bloques) || !plan.bloques.every(b => typeof b === 'string')
    || !Array.isArray(plan.tareas) || !esObjeto(plan.historial)) {
    throw new Error('El seguimiento guardado no tiene un formato válido.');
  }
  const tareas: TareaTym[] = plan.tareas.map(t => {
    if (!esObjeto(t) || typeof t.id !== 'string' || !t.id || typeof t.nombre !== 'string'
      || typeof t.bloque !== 'string' || typeof t.pct !== 'number' || !Number.isFinite(t.pct) || t.pct < 0 || t.pct > 100
      || typeof t.creada !== 'string' || (t.responsable !== undefined && typeof t.responsable !== 'string')) {
      throw new Error('Las tareas guardadas no tienen un formato válido.');
    }
    const { responsable, ...resto } = t;
    return { ...resto, id: t.id, nombre: t.nombre, bloque: t.bloque, pct: t.pct, creada: t.creada,
      ...(typeof responsable === 'string' ? { responsable } : {}), estado: migrarEstado(t.estado) };
  });
  if (new Set(tareas.map(t => t.id)).size !== tareas.length) throw new Error('Hay tareas con identificadores duplicados.');
  const historial: Record<string, CambioTym[]> = {};
  for (const [id, cambios] of Object.entries(plan.historial)) {
    if (!Array.isArray(cambios)) throw new Error('El historial guardado no tiene un formato válido.');
    historial[id] = cambios.map(c => {
      if (!esObjeto(c) || typeof c.fecha !== 'string' || typeof c.de !== 'number' || !Number.isFinite(c.de)
        || typeof c.a !== 'number' || !Number.isFinite(c.a) || typeof c.quien !== 'string'
        || (c.nota !== undefined && typeof c.nota !== 'string')) {
        throw new Error('Los movimientos guardados no tienen un formato válido.');
      }
      const { nota, ...resto } = c;
      return { ...resto, fecha: c.fecha, de: c.de, a: c.a, quien: c.quien, ...(typeof nota === 'string' ? { nota } : {}) };
    });
  }
  return { ...plan, projectId: plan.projectId, bloques: plan.bloques, tareas, historial };
}

export function leerPlan(projectId: string): PlanTym {
  const p = todos()[projectId];
  if (p === undefined) return planVacio(projectId);
  if (!esObjeto(p) || (p.projectId !== undefined && p.projectId !== projectId)) {
    throw new Error('El seguimiento guardado no corresponde a este proyecto.');
  }
  // Los campos nuevos pueden faltar en lo ya guardado.
  return normalizarPlan({ ...planVacio(projectId), ...p, projectId });
}

export function guardarPlan(plan: PlanTym): void {
  const raw = localStorage.getItem(CLAVE);
  const all: unknown = raw === null ? {} : JSON.parse(raw);
  if (!all || typeof all !== 'object' || Array.isArray(all)) throw new Error('El seguimiento guardado no es válido.');
  const siguiente = { ...all, [plan.projectId]: normalizarPlan(plan) };
  // persistSet oculta errores de cuota en otras claves; aqui deben poder reintentarse.
  localStorage.setItem(CLAVE, JSON.stringify(siguiente));
  persistSet(CLAVE, siguiente);
}

/** ¿Este proyecto es abierto? Sin `tipo`, es cerrado: así estaban todos. */
export function esTym(proyecto: AdminProject | string | undefined): boolean {
  if (!proyecto) return false;
  const p = typeof proyecto === 'string'
    ? adminStore.getProjects().find(x => x.id === proyecto)
    : proyecto;
  return p?.tipo === 'tym';
}

export const nuevoId = () =>
  `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function nuevaTarea(nombre: string, bloque: string, responsable?: string, estado: EstadoTarea = 'backlog'): TareaTym {
  return {
    id: nuevoId(),
    nombre: nombre.trim(),
    bloque: bloque.trim(),
    responsable: responsable?.trim() || undefined,
    estado,
    pct: 0,
    creada: new Date().toISOString(),
  };
}

/**
 * Cambia el avance de una tarea y deja el movimiento en el historial.
 * Devuelve el plan nuevo; no guarda, para que quien llama decida cuándo.
 */
export function conAvance(
  plan: PlanTym, tareaId: string,
  cambios: Partial<Pick<TareaTym, 'pct' | 'estado' | 'responsable' | 'nombre' | 'bloque'>>,
  quien: string, nota?: string,
): PlanTym {
  const antes = plan.tareas.find(t => t.id === tareaId);
  if (!antes) return plan;
  const tareas = plan.tareas.map(t => (t.id === tareaId ? { ...t, ...cambios } : t));
  const historial = { ...plan.historial };
  const pct = cambios.pct ?? antes.pct;
  if (pct !== antes.pct || nota?.trim()) {
    const linea: CambioTym = { fecha: new Date().toISOString(), de: antes.pct, a: pct, quien, nota: nota?.trim() || undefined };
    historial[tareaId] = [linea, ...(historial[tareaId] ?? [])].slice(0, 60);
  }
  return { ...plan, tareas, historial };
}
