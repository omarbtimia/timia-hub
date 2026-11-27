import { adminStore, type AdminUser } from '../../lib/adminStore';
import { effectiveRole, canInProject } from '../../lib/permissions';
import type { ActividadTym, EntregableTym, PlanTym } from './tipos';

export type UsuarioTym = Pick<AdminUser, 'id' | 'name' | 'role' | 'projectIds'>;

export function developersDelProyecto(projectId: string): AdminUser[] {
  return adminStore.getUsers().filter(u =>
    u.active && u.projectIds.includes(projectId) && effectiveRole(u, projectId) === 'developer');
}

export function accesoTym(user: UsuarioTym | null, projectId: string): boolean {
  const proyecto = adminStore.getProjects().find(p => p.id === projectId);
  return !!user && !!proyecto?.active && proyecto.tipo === 'tym'
    && (user.projectIds.includes(projectId) || canInProject(user, 'projects.view_all', projectId));
}

export function responsableActividad(actividad: ActividadTym, plan: PlanTym, equipo: AdminUser[]): string | undefined {
  if (actividad.responsableId) return actividad.responsableId;
  const nombre = plan.tareas.find(t => t.id === actividad.id)?.responsable;
  const candidatos = nombre ? equipo.filter(u => u.name === nombre) : [];
  return candidatos.length === 1 ? candidatos[0].id : undefined;
}

export function estructuraConResponsables(entregables: EntregableTym[], plan: PlanTym, equipo: AdminUser[]): EntregableTym[] {
  return entregables.map(e => ({
    ...e, activities: e.activities.map(a => {
      const id = responsableActividad(a, plan, equipo);
      return id ? { ...a, responsableId: id } : a;
    }),
  }));
}

export function filtrarEntregables(entregables: EntregableTym[], personaId: string | null): EntregableTym[] {
  if (!personaId) return entregables;
  return entregables.map(e => ({
    ...e, activities: e.activities.map(a => ({
      ...a, etapas: (a.etapas ?? []).filter(et => et.responsableId === personaId),
    })).filter(a => a.responsableId === personaId || a.etapas.length > 0),
  })).filter(e => e.responsableId === personaId || e.activities.length > 0);
}
