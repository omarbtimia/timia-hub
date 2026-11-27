// ─── Proyectos abiertos (T&M) — dónde se guardan ─────────────────────────────
// El seguimiento usa `timia_tym_planes`, con un plan por proyecto. Va por
// la misma capa que el resto del front: localStorage para leer y, si hay API,
// un PUT por escritura.
//
// La estructura reutiliza timia_plan_configs, pero solo en este navegador:
// todavía no tiene integración de backend.

import { persistSet } from '../../lib/persist';
import { adminStore, type AdminProject } from '../../lib/adminStore';
import { planVacio, type PlanTym, type TareaTym, type CambioTym } from './tipos';
import { esEstructuraLocal, estructuraValida, leerConfiguraciones, PLAN_CONFIGS_KEY, type PlanStructure, type PlanEntregableStructure } from '../../lib/planStructure';

export function leerEstructura(plan: PlanTym): PlanStructure {
  const cfg = leerConfiguraciones()[plan.projectId];
  if (cfg !== undefined && (!esEstructuraLocal(cfg) || !estructuraValida(cfg) || cfg.projectId !== plan.projectId)) {
    throw new Error('La estructura guardada de este proyecto no es válida. No se sobrescribieron sus datos.');
  }
  const estructura: PlanStructure = estructuraValida(cfg)
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
  return estructura;
}

export function guardarEstructura(projectId: string, entregables: PlanEntregableStructure[]): void {
  const estructura: PlanStructure = { projectId, entregables };
  if (!estructuraValida(estructura)) throw new Error('La estructura contiene identificadores o pesos de etapas no válidos.');
  const all = leerConfiguraciones();
  const anterior = all[projectId];
  if (anterior !== undefined && (!esEstructuraLocal(anterior) || !estructuraValida(anterior) || anterior.projectId !== projectId)) {
    throw new Error('No se puede sobrescribir una configuración inválida o un cronograma existente.');
  }
  localStorage.setItem(PLAN_CONFIGS_KEY, JSON.stringify({ ...all, [projectId]: estructura }));
}

const CLAVE = 'timia_tym_planes';

type Mapa = Record<string, PlanTym>;

function todos(): Mapa {
  try {
    const v = localStorage.getItem(CLAVE);
    return v ? (JSON.parse(v) as Mapa) : {};
  } catch { return {}; }
}

export function leerPlan(projectId: string): PlanTym {
  const p = todos()[projectId];
  if (!p) return planVacio(projectId);
  // Los campos nuevos pueden faltar en lo ya guardado.
  return { ...planVacio(projectId), ...p, projectId };
}

export function guardarPlan(plan: PlanTym): void {
  persistSet(CLAVE, { ...todos(), [plan.projectId]: plan });
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

export function nuevaTarea(nombre: string, bloque: string, responsable?: string): TareaTym {
  return {
    id: nuevoId(),
    nombre: nombre.trim(),
    bloque: bloque.trim(),
    responsable: responsable?.trim() || undefined,
    estado: 'en-curso',
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
