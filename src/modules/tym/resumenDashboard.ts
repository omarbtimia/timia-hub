import { adminStore, type AdminProject } from '../../lib/adminStore';
import { esObjeto } from '../../lib/planStructure';
import { effectiveRole } from '../../lib/permissions';
import { leerEstructura, normalizarPlan } from './almacen';
import { ESTADOS, planVacio, type PlanTym } from './tipos';
import {
  consultaAmpliadaTym, developersDelProyecto, estructuraConResponsables,
  filtrarEntregables, proyectosDashboardTym, type UsuarioTym,
} from './responsables';

export interface ResumenTym {
  proyecto: AdminProject;
  alcance: string;
  entregables: number;
  actividades: number;
  etapas: number;
  contenedores: number;
  sinSeguimiento: number;
  estados: Record<string, number>;
  ultimoMovimiento: string | null;
  lideres: string[];
  error?: string;
}

function planValidado(projectId: string): PlanTym {
  const raw = localStorage.getItem('timia_tym_planes');
  const mapa: unknown = raw === null ? {} : JSON.parse(raw);
  if (!esObjeto(mapa)) throw new Error('El seguimiento guardado no es válido.');
  const guardado = mapa[projectId];
  if (guardado === undefined) return planVacio(projectId);
  if (!esObjeto(guardado)) throw new Error('El seguimiento del proyecto no es válido.');
  const p = normalizarPlan({ ...planVacio(projectId), ...guardado });
  if (p.projectId !== projectId) {
    throw new Error('Las tareas o el historial de este proyecto no tienen un formato válido.');
  }
  return p;
}

/** Un filtro global nunca amplia el permiso de una tarjeta de otro proyecto. */
export function resumenesDashboardTym(user: UsuarioTym, projectId = '', developerId = ''): ResumenTym[] {
  return proyectosDashboardTym(user).filter(p => !projectId || p.id === projectId).flatMap(proyecto => {
    const equipo = developersDelProyecto(proyecto.id);
    const ampliada = consultaAmpliadaTym(user, proyecto.id);
    if (ampliada && developerId && developerId !== '__mio' && !equipo.some(u => u.id === developerId)) return [];
    const personaId = ampliada ? developerId === '__mio' ? user.id : developerId || null : user.id;
    const alcance = !ampliada || developerId === '__mio' ? 'Mi trabajo' : personaId
      ? equipo.find(u => u.id === personaId)!.name : 'Panorama General';
    const base: ResumenTym = {
      proyecto, alcance, entregables: 0, actividades: 0, etapas: 0, contenedores: 0,
      sinSeguimiento: 0, estados: {}, ultimoMovimiento: null,
      lideres: adminStore.getUsers().filter(u => u.active && u.projectIds.includes(proyecto.id)
        && effectiveRole(u, proyecto.id) === 'tech_lead').map(u => u.name),
    };
    try {
      const plan = planValidado(proyecto.id);
      const completa = estructuraConResponsables(leerEstructura(plan).entregables, plan, equipo);
      const visible = filtrarEntregables(completa, personaId);
      const propias = visible.flatMap(e => e.activities).filter(a => !personaId || a.responsableId === personaId);
      const ids = new Set(propias.map(a => a.id));
      const tareas = plan.tareas.filter(t => ids.has(t.id));
      const fechas = tareas.flatMap(t => plan.historial[t.id] ?? []).map(h => h.fecha)
        .filter(f => Number.isFinite(Date.parse(f))).sort((a, b) => Date.parse(b) - Date.parse(a));
      const entregables = visible.filter(e => !personaId || e.responsableId === personaId).length;
      return [{
        ...base, entregables, actividades: propias.length,
        etapas: visible.flatMap(e => e.activities).flatMap(a => a.etapas ?? []).length,
        contenedores: visible.length - entregables + visible.flatMap(e => e.activities).length - propias.length,
        sinSeguimiento: propias.length - tareas.length,
        estados: Object.fromEntries(ESTADOS.map(e => [e.id, tareas.filter(t => t.estado === e.id).length])),
        ultimoMovimiento: fechas[0] ?? null,
      }];
    } catch (error) {
      return [{ ...base, error: error instanceof Error ? error.message : 'No se pudo leer este proyecto.' }];
    }
  });
}
