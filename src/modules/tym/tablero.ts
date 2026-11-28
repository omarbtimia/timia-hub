import { adminStore, type KanbanTask } from '../../lib/adminStore';
import { canInProject, effectiveRole } from '../../lib/permissions';
import { esObjeto, leerConfiguraciones } from '../../lib/planStructure';
import { guardarEstructura, guardarPlan, leerEstructura, leerPlan, nuevaTarea } from './almacen';
import { accesoTym, consultaAmpliadaTym, developersDelProyecto, estructuraConResponsables, type UsuarioTym } from './responsables';
import { esEstado, type EntregableTym, type EstadoTarea, type PlanTym } from './tipos';

export const CAMBIO_TYM = 'timia-tym-change';
export const TIPOS_TYM = { entregable: 'Entregable', actividad: 'Actividad', etapa: 'Etapa' } as const;
type Tipo = keyof typeof TIPOS_TYM;
interface Nodo {
  id: string;
  tipo: Tipo;
  label: string;
  contexto: string;
  responsableId?: string;
  estado: EstadoTarea;
}

function nodos(plan: PlanTym, entregables: EntregableTym[]): Nodo[] {
  const equipo = developersDelProyecto(plan.projectId);
  const propietario = (id?: string) => equipo.some(u => u.id === id) ? id : undefined;
  return estructuraConResponsables(entregables, plan, equipo).flatMap(e => [
    { id: e.id, tipo: 'entregable' as const, label: e.label, contexto: '', responsableId: propietario(e.responsableId), estado: e.estado ?? 'backlog' },
    ...e.activities.flatMap(a => [
      { id: a.id!, tipo: 'actividad' as const, label: a.label, contexto: e.label, responsableId: propietario(a.responsableId), estado: plan.tareas.find(t => t.id === a.id)?.estado ?? 'backlog' },
      ...(a.etapas ?? []).map(et => ({
        id: et.id, tipo: 'etapa' as const, label: et.label, contexto: `${e.label} / ${a.label}`,
        responsableId: propietario(et.responsableId), estado: et.estado ?? 'backlog',
      })),
    ]),
  ]);
}

function idTarjeta(projectId: string, nodo: Nodo): string {
  return `tym:${encodeURIComponent(projectId)}:${nodo.tipo}:${encodeURIComponent(nodo.id)}`;
}

function guardarTarjetas(tarjetas: KanbanTask[]) {
  localStorage.setItem('timia_kanban_tasks', JSON.stringify(tarjetas));
  adminStore.saveKanbanTasks(tarjetas);
}

function leerTarjetas(): KanbanTask[] {
  const raw: unknown = JSON.parse(localStorage.getItem('timia_kanban_tasks') ?? '[]');
  if (!Array.isArray(raw) || !raw.every(t => esObjeto(t) && typeof t.id === 'string'
    && (t.tym === undefined || (esObjeto(t.tym) && typeof t.projectId === 'string'
      && typeof t.tym.nodoId === 'string' && ['entregable', 'actividad', 'etapa'].includes(String(t.tym.tipo)))))
    || new Set(raw.map(t => t.id)).size !== raw.length) {
    throw new Error('Las tarjetas guardadas no tienen un formato válido. No se sobrescribió el tablero.');
  }
  return adminStore.getKanbanTasks();
}

export function avisarCambioTym() {
  window.dispatchEvent(new Event(CAMBIO_TYM));
}

/** La tarjeta es una proyeccion del nodo; conserva comentarios y enlaces del tablero. */
export function sincronizarTableroTym(plan: PlanTym, entregables: EntregableTym[]) {
  const actuales = leerTarjetas();
  const vinculadas = nodos(plan, entregables).map(n => {
    const id = idTarjeta(plan.projectId, n);
    const anterior = actuales.find(t => t.id === id);
    const tarjeta: KanbanTask = {
      ...anterior, id, title: n.label,
      description: `${TIPOS_TYM[n.tipo]} T&M${n.contexto ? ` · ${n.contexto}` : ''}`,
      projectId: plan.projectId, tym: { tipo: n.tipo, nodoId: n.id },
      status: n.estado, assigneeIds: n.responsableId ? [n.responsableId] : [],
      priority: anterior?.priority ?? 'Media', startDate: '', endDate: '',
      isLocked: true, comments: anterior?.comments ?? [], links: anterior?.links ?? [],
    };
    return tarjeta;
  });
  const porId = new Map(vinculadas.map(t => [t.id, t]));
  const siguientes = actuales.flatMap(t => {
    if (!t.tym || t.projectId !== plan.projectId) return [t];
    const vinculada = porId.get(t.id);
    porId.delete(t.id);
    return vinculada ? [vinculada] : [];
  });
  siguientes.push(...porId.values());
  if (JSON.stringify(actuales) !== JSON.stringify(siguientes)) guardarTarjetas(siguientes);
}

export function reconciliarProyectoTym(projectId: string) {
  const guardadas = leerConfiguraciones();
  const seguimientos: unknown = JSON.parse(localStorage.getItem('timia_tym_planes') ?? '{}');
  if (!esObjeto(seguimientos)) throw new Error('El seguimiento guardado no es válido.');
  if (!guardadas[projectId] && leerTarjetas().some(t => t.tym && t.projectId === projectId)) {
    throw new Error('Las tarjetas T&M no tienen su estructura local en este navegador. No se modificaron sus datos.');
  }
  if (!guardadas[projectId] && !seguimientos[projectId]) return;
  const plan = leerPlan(projectId);
  const estructura = leerEstructura(plan);
  if (JSON.stringify(guardadas[projectId]) !== JSON.stringify(estructura)) {
    guardarEstructura(projectId, estructura.entregables);
  }
  if (seguimientos[projectId] && JSON.stringify(seguimientos[projectId]) !== JSON.stringify(plan)) guardarPlan(plan);
  sincronizarTableroTym(plan, estructura.entregables);
}

function origen(tarjeta: KanbanTask) {
  if (!tarjeta.tym || !tarjeta.projectId) throw new Error('La tarjeta no tiene un vínculo T&M válido.');
  const cfg = leerConfiguraciones();
  if (!cfg[tarjeta.projectId]) {
    throw new Error('La estructura T&M de esta tarjeta no está en este navegador. Abre el proyecto en el navegador donde fue creada.');
  }
  const plan = leerPlan(tarjeta.projectId);
  const estructura = leerEstructura(plan);
  const nodo = nodos(plan, estructura.entregables).find(n =>
    n.id === tarjeta.tym!.nodoId && n.tipo === tarjeta.tym!.tipo && idTarjeta(plan.projectId, n) === tarjeta.id);
  if (!nodo) throw new Error('El elemento T&M vinculado ya no existe en la estructura local.');
  return { plan, estructura, nodo };
}

export function disponibilidadTym(tarjeta: KanbanTask): string {
  try { origen(tarjeta); return ''; }
  catch (error) { return error instanceof Error ? error.message : 'No se pudo leer el origen T&M.'; }
}

export function puedeMoverTym(usuario: UsuarioTym | null, tarjeta: KanbanTask): boolean {
  if (!usuario || !tarjeta.projectId || !accesoTym(usuario, tarjeta.projectId)
    || !canInProject(usuario, 'tasks.update_status', tarjeta.projectId)) return false;
  const propietario = tarjeta.assigneeIds[0];
  return !!propietario && (propietario === usuario.id
    || (effectiveRole(usuario, tarjeta.projectId) !== 'developer' && consultaAmpliadaTym(usuario, tarjeta.projectId)));
}

/** Solo el estado y la documentacion se editan desde una tarjeta vinculada. */
export function guardarDesdeTableroTym(usuario: UsuarioTym, tarjeta: KanbanTask) {
  const { plan, estructura, nodo } = origen(tarjeta);
  if (!accesoTym(usuario, plan.projectId)) throw new Error('No tienes acceso a este proyecto T&M.');
  const anterior = leerTarjetas().find(t => t.id === tarjeta.id);
  if (!anterior) throw new Error('La tarjeta ya no existe. Actualiza el tablero.');
  const actual = { ...anterior, assigneeIds: nodo.responsableId ? [nodo.responsableId] : [] };
  if (effectiveRole(usuario, plan.projectId) === 'developer' && nodo.responsableId !== usuario.id) {
    throw new Error('Solo puedes actualizar tus propios elementos T&M.');
  }
  if (!consultaAmpliadaTym(usuario, plan.projectId) && nodo.responsableId !== usuario.id) {
    throw new Error('Solo puedes consultar tu propio trabajo T&M.');
  }
  if (!esEstado(tarjeta.status)) throw new Error('Selecciona un estado válido.');
  const cambiaEstado = tarjeta.status !== nodo.estado;
  if (cambiaEstado && !puedeMoverTym(usuario, actual)) throw new Error('No tienes permiso para cambiar este estado T&M.');
  if (JSON.stringify(tarjeta.comments) !== JSON.stringify(anterior.comments)
    && !canInProject(usuario, 'tasks.comment', plan.projectId)) throw new Error('No tienes permiso para comentar.');
  if (JSON.stringify(tarjeta.links) !== JSON.stringify(anterior.links)
    && !canInProject(usuario, 'tasks.link', plan.projectId)) throw new Error('No tienes permiso para adjuntar enlaces.');
  if (cambiaEstado) {
    if (nodo.tipo === 'actividad') {
      const existe = plan.tareas.some(t => t.id === nodo.id);
      const ent = estructura.entregables.find(e => e.activities.some(a => a.id === nodo.id))!;
      const tarea = { ...nuevaTarea(nodo.label, ent.label, developersDelProyecto(plan.projectId).find(u => u.id === nodo.responsableId)?.name, tarjeta.status), id: nodo.id };
      guardarPlan({ ...plan, tareas: existe
        ? plan.tareas.map(t => t.id === nodo.id ? { ...t, estado: tarjeta.status } : t)
        : [...plan.tareas, tarea] });
    } else {
      guardarEstructura(plan.projectId, estructura.entregables.map(e => ({
        ...e, ...(nodo.tipo === 'entregable' && e.id === nodo.id ? { estado: tarjeta.status } : {}),
        activities: e.activities.map(a => ({
          ...a, etapas: a.etapas?.map(et => nodo.tipo === 'etapa' && et.id === nodo.id ? { ...et, estado: tarjeta.status } : et),
        })),
      })));
    }
  }
  const vigentes = leerTarjetas();
  guardarTarjetas(vigentes.map(t => t.id === tarjeta.id ? {
    ...t, status: tarjeta.status, comments: tarjeta.comments, links: tarjeta.links,
  } : t));
  avisarCambioTym();
}
