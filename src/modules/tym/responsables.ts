import { adminStore, type AdminUser } from '../../lib/adminStore';
import { effectiveRole, canInProject } from '../../lib/permissions';
import type { ActividadTym, EntregableTym, PlanTym } from './tipos';
import { useEffect, useReducer } from 'react';
import { persist } from '../../lib/persist';

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

export function proyectosDashboardTym(user: UsuarioTym | null) {
  return adminStore.getProjects().filter(p =>
    accesoTym(user, p.id) && canInProject(user, 'tym.dashboard.view', p.id));
}

export function consultaAmpliadaTym(user: UsuarioTym | null, projectId: string): boolean {
  return accesoTym(user, projectId) && canInProject(user, 'tym.developers.view_all', projectId);
}

export function esLiderTym(user: UsuarioTym | null, projectId: string): boolean {
  return accesoTym(user, projectId) && effectiveRole(user, projectId) === 'tech_lead';
}

export function useCambiosTym() {
  const [, actualizar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener('storage', actualizar);
    window.addEventListener('timia-permissions-change', actualizar);
    const unsubscribe = persist.onChange(actualizar);
    return () => {
      window.removeEventListener('storage', actualizar);
      window.removeEventListener('timia-permissions-change', actualizar);
      unsubscribe();
    };
  }, []);
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
