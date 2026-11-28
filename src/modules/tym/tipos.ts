// ─── Proyectos abiertos (T&M) — tipos ────────────────────────────────────────
// Un proyecto abierto se factura por tiempo y materiales: no compromete fechas,
// así que no se estima ni se cronograma. Lo que tiene es una lista de tareas con
// su avance, y nada que dependa de semanas.
//
// El seguimiento vive aparte del cronograma de proyectos cerrados. La estructura
// de entregables, actividades y etapas comparte contrato y clave con ellos,
// pero se guarda localmente y no incorpora semanas ni fechas de planificación.

import type { PlanActivityStructure, PlanEntregableStructure, PlanEtapa } from '../../lib/planStructure';
import { ESTADOS_KANBAN, type KanbanStatus } from '../../lib/adminStore';

export interface EtapaTym extends PlanEtapa { responsableId?: string; estado?: KanbanStatus }
export interface ActividadTym extends PlanActivityStructure {
  responsableId?: string;
  etapas?: EtapaTym[];
}
export interface EntregableTym extends PlanEntregableStructure<ActividadTym> { responsableId?: string; estado?: KanbanStatus }
export interface EstructuraTym { projectId: string; entregables: EntregableTym[] }

export type EstadoTarea = KanbanStatus;

export function esEstado(value: unknown): value is EstadoTarea {
  return ESTADOS_KANBAN.some(e => e === value);
}

export function migrarEstado(value: unknown): EstadoTarea {
  if (esEstado(value)) return value;
  switch (value) {
    case 'en-curso': return 'in-progress';
    case 'finalizada': return 'done';
    case 'en-espera':
    case 'no-se-requiere': return 'backlog';
    default: throw new Error(`Estado T&M no válido: ${String(value)}`);
  }
}

export const ESTADOS: { id: EstadoTarea; label: string; fondo: string; texto: string; borde: string }[] = [
  { id: 'backlog',     label: 'Backlog',     fondo: '#f1f5f9', texto: '#475569', borde: '#cbd5e1' },
  { id: 'in-progress', label: 'En Progreso', fondo: '#eff6ff', texto: '#1e40af', borde: '#bfdbfe' },
  { id: 'review',      label: 'Revisión',    fondo: '#fffbeb', texto: '#92400e', borde: '#fde68a' },
  { id: 'done',        label: 'Finalizado',  fondo: '#ecfdf5', texto: '#065f46', borde: '#a7f3d0' },
];

export const estadoDe = (id: EstadoTarea) => ESTADOS.find(e => e.id === id) ?? ESTADOS[0];

export interface TareaTym {
  id: string;
  nombre: string;
  /** Agrupación opcional. Cadena vacía = sin bloque. */
  bloque: string;
  responsable?: string;
  estado: EstadoTarea;
  pct: number;
  creada: string;          // ISO
}

export interface CambioTym {
  fecha: string;           // ISO
  de: number;
  a: number;
  quien: string;
  nota?: string;
}

export interface PlanTym {
  projectId: string;
  /** El orden en el que se enseñan los bloques; las tareas guardan su nombre. */
  bloques: string[];
  tareas: TareaTym[];
  /** Historial por tarea, el mismo que guardan los proyectos cerrados. */
  historial: Record<string, CambioTym[]>;
}

export const planVacio = (projectId: string): PlanTym =>
  ({ projectId, bloques: [], tareas: [], historial: {} });

/** El avance del proyecto: promedio simple, que es lo que pesa igual cada tarea. */
export function avanceDe(plan: PlanTym): number {
  const cuentan = plan.tareas;
  if (!cuentan.length) return 0;
  return parseFloat((cuentan.reduce((s, t) => s + t.pct, 0) / cuentan.length).toFixed(1));
}

/** Cuántas están cerradas y cuántas cuentan, para la pastilla de la cabecera. */
export function cerradasDe(plan: PlanTym): { hechas: number; total: number } {
  const cuentan = plan.tareas;
  return { hechas: cuentan.filter(t => t.estado === 'done' || t.pct >= 100).length, total: cuentan.length };
}
