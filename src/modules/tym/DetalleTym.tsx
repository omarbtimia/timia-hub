import React, { useEffect, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, Info, LayoutList, Plus, Settings2 } from 'lucide-react';
import { guardarEstructura, leerEstructura, nuevoId, nuevaTarea, conAvance } from './almacen';
import { ESTADOS, esEstado, estadoDe, type PlanTym, type EntregableTym, type ActividadTym, type EstadoTarea } from './tipos';
import type { AdminUser } from '../../lib/adminStore';
import { estructuraConResponsables, filtrarEntregables, esLiderTym, type UsuarioTym } from './responsables';
import PanelAvance from './PanelAvance';
import { avisarCambioTym, CAMBIO_TYM, sincronizarTableroTym } from './tablero';

const mensajeError = (error: unknown) => error instanceof Error ? error.message : 'No se pudo acceder al almacenamiento de este navegador.';

const campo: React.CSSProperties = {
  minWidth: 0, flex: '1 1 180px', padding: '7px 10px', fontSize: 12,
  border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', color: '#334155',
};
const accion: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  minHeight: 36, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: '1px solid #99d9ce', borderRadius: 7, background: '#f0fdfa', color: '#0f766e',
};
const desplegar: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36,
  minHeight: 36, padding: 4, border: 0, background: 'transparent', cursor: 'pointer',
};
const badge: React.CSSProperties = {
  padding: '4px 8px', borderRadius: 12, background: '#f1f5f9', color: '#64748b', fontSize: 11,
  minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere',
};
const texto: React.CSSProperties = { minWidth: 0, flex: '1 1 180px', overflowWrap: 'anywhere', fontSize: 12, color: '#334155' };
const PESTANAS = [
  { id: 'activas', nombre: 'Tareas Activas' },
  { id: 'historico', nombre: 'Reporte Histórico' },
] as const;

interface Props {
  plan: PlanTym;
  onGuardarPlan: (plan: PlanTym) => void;
  equipo: AdminUser[];
  personaId: string | null;
  personal: boolean;
  usuario: UsuarioTym;
  onPendiente: (pendiente: boolean) => void;
  bloqueado?: boolean;
}

export default function DetalleTym({ plan, onGuardarPlan, equipo, personaId, personal, usuario, onPendiente, bloqueado = false }: Props) {
  const [pestana, setPestana] = useState<typeof PESTANAS[number]['id']>('activas');
  const soloLectura = pestana === 'historico';
  const panorama = personaId === null;
  const [inicial] = useState<{ entregables: EntregableTym[]; error: string }>(() => {
    try { return { entregables: estructuraConResponsables(leerEstructura(plan).entregables, plan, equipo), error: '' }; }
    catch (error) { return { entregables: [], error: mensajeError(error) }; }
  });
  const [entregables, setEntregables] = useState(inicial.entregables);
  const [errorGuardado, setErrorGuardado] = useState(inicial.error);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, setPendiente] = useState<PlanTym | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [creacion, setCreacion] = useState<{
    tipo: 'entregable' | 'actividad' | 'etapa'; entId?: string; actId?: string;
    nombre: string; estado: string; responsableId: string; peso: number;
  } | null>(null);
  const [errorCreacion, setErrorCreacion] = useState('');
  const planActual = pendiente ?? plan;
  useEffect(() => { onPendiente(!!errorGuardado && !inicial.error); }, [errorGuardado, inicial.error, onPendiente]);
  useEffect(() => { setAbierta(null); setCreacion(null); }, [personaId, pestana, bloqueado]);
  useEffect(() => {
    function actualizar() {
      if (pendiente || errorGuardado) return;
      try {
        const siguientes = estructuraConResponsables(leerEstructura(plan).entregables, plan, equipo);
        setEntregables(actual => JSON.stringify(actual) === JSON.stringify(siguientes) ? actual : siguientes);
      } catch (error) { setErrorGuardado(mensajeError(error)); }
    }
    window.addEventListener(CAMBIO_TYM, actualizar);
    window.addEventListener('storage', actualizar);
    return () => {
      window.removeEventListener(CAMBIO_TYM, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, [plan, equipo, pendiente, errorGuardado]);
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(entregables.slice(0, 1).map(e => e.id)));
  const visibles = filtrarEntregables(entregables, personaId);
  const actividades = visibles.flatMap(e => e.activities);
  const etapas = actividades.flatMap(a => a.etapas ?? []);
  const persona = equipo.find(u => u.id === personaId);
  const lider = esLiderTym(usuario, plan.projectId);
  const editable = (nodo: { responsableId?: string }) =>
    !bloqueado && !soloLectura && !inicial.error && !!persona && nodo.responsableId === personaId
    && (!personal || nodo.responsableId === usuario.id);
  const puedeCrear = !bloqueado && !soloLectura && !inicial.error && !!persona && (!personal || personaId === usuario.id);
  const sinAsignar = (nodo: { responsableId?: string }) => !equipo.some(u => u.id === nodo.responsableId);
  const puedeAsignar = (nodo: { responsableId?: string }) =>
    !bloqueado && !soloLectura && !inicial.error && (lider || editable(nodo) || (!personal && panorama && sinAsignar(nodo)));

  function aplicar(siguiente: EntregableTym[], seguimiento = planActual): boolean {
    if (inicial.error || bloqueado) return false;
    const tareas = seguimiento.tareas.map(t => {
      const ent = siguiente.find(e => e.activities.some(a => a.id === t.id));
      const act = ent?.activities.find(a => a.id === t.id);
      if (!ent || !act) return t;
      const anterior = entregables.flatMap(e => e.activities).find(a => a.id === t.id);
      const entAnterior = entregables.find(e => e.activities.some(a => a.id === t.id));
      const asignado = equipo.find(u => u.id === act.responsableId);
      return {
        ...t,
        ...(act.label !== anterior?.label ? { nombre: act.label } : {}),
        ...(ent.label !== entAnterior?.label ? { bloque: ent.label } : {}),
        ...(act.responsableId !== anterior?.responsableId && asignado ? { responsable: asignado.name } : {}),
      };
    });
    const nuevoPlan = { ...seguimiento, tareas };
    setEntregables(siguiente);
    setPendiente(nuevoPlan);
    try {
      guardarEstructura(plan.projectId, siguiente);
      if (JSON.stringify(nuevoPlan) !== JSON.stringify(plan)) onGuardarPlan(nuevoPlan);
      sincronizarTableroTym(nuevoPlan, siguiente);
      setPendiente(null);
      setErrorGuardado('');
      setGuardado(true);
      avisarCambioTym();
      return true;
    } catch (error) {
      setErrorGuardado(mensajeError(error));
      setGuardado(false);
      return false;
    }
  }

  function abrir(id: string) {
    setAbiertos(actual => new Set([...actual, id]));
  }

  function alternar(id: string) {
    setAbiertos(actual => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id); else siguiente.add(id);
      return siguiente;
    });
  }

  function cambiarActividad(entId: string, actId: string, transformar: (a: ActividadTym) => ActividadTym) {
    aplicar(entregables.map(e => e.id !== entId ? e : {
      ...e, activities: e.activities.map(a => a.id === actId ? transformar(a) : a),
    }));
  }

  function agregarEntregable() {
    if (!puedeCrear) return;
    setErrorCreacion('');
    setCreacion({ tipo: 'entregable', nombre: 'Nuevo entregable', estado: '', responsableId: personaId!, peso: 0 });
  }

  function agregarActividad(entId: string) {
    if (!puedeCrear || !visibles.some(e => e.id === entId)) return;
    setErrorCreacion('');
    setCreacion({ tipo: 'actividad', entId, nombre: 'Nueva actividad', estado: '', responsableId: personaId!, peso: 0 });
  }

  function agregarEtapa(entId: string, actId: string) {
    if (!puedeCrear || !visibles.some(e => e.id === entId && e.activities.some(a => a.id === actId))) return;
    const act = entregables.find(e => e.id === entId)!.activities.find(a => a.id === actId)!;
    setErrorCreacion('');
    setCreacion({ tipo: 'etapa', entId, actId, nombre: 'Nueva etapa', estado: '', responsableId: personaId!,
      peso: Math.max(0, 100 - (act.etapas ?? []).reduce((s, et) => s + et.peso, 0)) });
  }

  function crearElemento(ev: React.FormEvent) {
    ev.preventDefault();
    if (!creacion || !puedeCrear || pendiente) return;
    const asignado = equipo.find(u => u.id === creacion.responsableId && (!personal || u.id === usuario.id));
    if (!creacion.nombre.trim() || !esEstado(creacion.estado) || !asignado
      || !Number.isInteger(creacion.peso) || creacion.peso < 0 || creacion.peso > 100) {
      setErrorCreacion('Selecciona nombre, estado, responsable y peso válidos.');
      return;
    }
    const id = nuevoId();
    const comun = { id, label: creacion.nombre.trim(), responsableId: asignado.id };
    if (creacion.tipo === 'entregable') {
      aplicar([...entregables, { ...comun, estado: creacion.estado, activities: [] }]);
      abrir(id);
    } else {
      const ent = entregables.find(e => e.id === creacion.entId);
      if (!ent || !visibles.some(e => e.id === ent.id)) {
        setErrorCreacion('El entregable ya no está disponible en esta vista.'); return;
      }
      if (creacion.tipo === 'actividad') {
        const tarea = { ...nuevaTarea(comun.label, ent.label, asignado.name, creacion.estado), id };
        aplicar(entregables.map(e => e.id === ent.id ? { ...e, activities: [...e.activities, { ...comun, etapas: [] }] } : e),
          { ...planActual, tareas: [...planActual.tareas, tarea] });
        setAbiertos(actual => new Set([...actual, ent.id, id]));
      } else {
        if (!visibles.some(e => e.activities.some(a => a.id === creacion.actId))) {
          setErrorCreacion('La actividad ya no está disponible en esta vista.'); return;
        }
        const etapa = { ...comun, estado: creacion.estado, peso: creacion.peso };
        cambiarActividad(ent.id, creacion.actId!, a => ({ ...a, etapas: [...(a.etapas ?? []), etapa] }));
        abrir(creacion.actId!);
      }
    }
    setCreacion(null);
  }

  function selectorEstado(nodo: { responsableId?: string }, valor: EstadoTarea, label: string, guardar: (estado: EstadoTarea) => void) {
    if (!editable(nodo)) {
      const estado = estadoDe(valor);
      return <span style={{ ...badge, background: estado.fondo, color: estado.texto }}>{estado.label}</span>;
    }
    return <label style={{ fontSize: 11, color: '#64748b' }}>Estado{' '}
      <select aria-label={`Estado ${label}`} value={valor} disabled={!!pendiente}
        onChange={ev => { if (editable(nodo) && esEstado(ev.target.value)) guardar(ev.target.value); }}
        style={{ ...campo, minHeight: 36 }}>
        {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
      </select>
    </label>;
  }

  function responsable(nodo: { responsableId?: string }, label: string, asignar: (id: string) => void) {
    const nombre = equipo.find(u => u.id === nodo.responsableId)?.name;
    if (!puedeAsignar(nodo)) return <span style={badge}>Responsable: {nombre ?? 'Sin asignar'}</span>;
    const opciones = personal ? equipo.filter(u => u.id === usuario.id) : equipo;
    return <label style={{ fontSize: 11, color: '#64748b', minWidth: 0, maxWidth: '100%', flex: '0 1 220px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>Responsable{' '}
      <select aria-label={`Responsable ${label}`} value={nombre ? nodo.responsableId : ''}
        onChange={ev => {
          if (puedeAsignar(nodo) && opciones.some(u => u.id === ev.target.value)) asignar(ev.target.value);
        }} style={{ ...campo, width: '100%', maxWidth: '100%', boxSizing: 'border-box', minHeight: 36 }}>
        {!nombre && <option value="">Sin asignar</option>}
        {opciones.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </label>;
  }

  function tareaPara(act: ActividadTym, ent: EntregableTym) {
    return planActual.tareas.find(t => t.id === act.id)
      ?? { ...nuevaTarea(act.label, ent.label, equipo.find(u => u.id === act.responsableId)?.name), id: act.id! };
  }

  const entAbierto = entregables.find(e => e.activities.some(a => a.id === abierta));
  const actAbierta = entAbierto?.activities.find(a => a.id === abierta);
  const tareaAbierta = entAbierto && actAbierta && editable(actAbierta) ? tareaPara(actAbierta, entAbierto) : null;

  function guardarAvance(cambios: { pct: number; estado: EstadoTarea; responsable?: string; responsableId?: string }, nota: string) {
    if (!actAbierta || !entAbierto || !tareaAbierta || !editable(actAbierta) || !esEstado(cambios.estado)) return;
    const candidatos = equipo.filter(u => u.id === cambios.responsableId && (!personal || u.id === usuario.id));
    if (candidatos.length !== 1) {
      setErrorGuardado('Selecciona un developer válido del proyecto.');
      return;
    }
    const id = candidatos[0].id;
    const base = planActual.tareas.some(t => t.id === tareaAbierta.id) ? planActual
      : { ...planActual, tareas: [...planActual.tareas, tareaAbierta] };
    const siguiente = entregables.map(e => ({ ...e, activities: e.activities.map(a =>
      a.id === actAbierta.id ? { ...a, responsableId: id } : a) }));
    aplicar(siguiente, conAvance(base, tareaAbierta.id, {
      pct: cambios.pct, estado: cambios.estado, responsable: candidatos[0].name,
    }, usuario.name, nota));
    setAbierta(null);
  }

  return (
    <section aria-label="Detalle del proyecto">
      <div role="tablist" aria-label="Vistas del proyecto" style={{ display: 'flex', gap: 6, marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
        {PESTANAS.map((tab, i) => (
          <button key={tab.id} type="button" role="tab" id={`tym-tab-${tab.id}`}
            aria-controls={`tym-panel-${tab.id}`} aria-selected={pestana === tab.id} tabIndex={pestana === tab.id ? 0 : -1}
            onClick={() => setPestana(tab.id)}
            onKeyDown={ev => {
              let siguiente: number;
              if (ev.key === 'ArrowRight') siguiente = (i + 1) % PESTANAS.length;
              else if (ev.key === 'ArrowLeft') siguiente = (i + PESTANAS.length - 1) % PESTANAS.length;
              else if (ev.key === 'Home') siguiente = 0;
              else if (ev.key === 'End') siguiente = PESTANAS.length - 1;
              else return;
              ev.preventDefault();
              setPestana(PESTANAS[siguiente].id);
              document.getElementById(`tym-tab-${PESTANAS[siguiente].id}`)?.focus();
            }}
            style={{ ...accion, borderColor: pestana === tab.id ? '#0d9488' : 'transparent', background: pestana === tab.id ? '#0d9488' : 'transparent', color: pestana === tab.id ? '#fff' : '#64748b' }}>
            {tab.nombre}
          </button>
        ))}
      </div>
      {PESTANAS.filter(tab => tab.id !== pestana).map(tab => (
        <div key={tab.id} role="tabpanel" id={`tym-panel-${tab.id}`} aria-labelledby={`tym-tab-${tab.id}`} hidden/>
      ))}
      <div role="tabpanel" id={`tym-panel-${pestana}`} aria-labelledby={`tym-tab-${pestana}`} tabIndex={0}>
      <div role="note" style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 16px', marginBottom: 18,
        border: '1px solid #fde68a', borderRadius: 10, background: '#fffbeb', color: '#92400e',
      }}>
        <Info size={17} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true"/>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
          <strong>Almacenamiento local.</strong> Los entregables, nombres, actividades y etapas se guardan automáticamente
          en este navegador. La integración con el backend está pendiente; no se comparten entre dispositivos.
          {' '}<strong>Guardar avance</strong> de una tarea existente desde Tareas Activas sí conserva sus cambios e historial.
          Los pesos de etapas no modifican el avance real.
          {panorama && (lider
            ? ' Panorama General es de consulta. Como líder técnico puedes cambiar responsables en Tareas Activas.'
            : personal ? ' Panorama General es de consulta; solo puedes editar tu trabajo desde Mi trabajo.'
            : ' Panorama General es de consulta; solo puedes asignar los elementos que figuran Sin asignar.')}
          {soloLectura && ' Este reporte refleja la estructura actual, no versiones históricas guardadas.'}
        </p>
      </div>
      {errorGuardado && <div role="alert" style={{ padding: 14, marginBottom: 16, border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', background: '#fef2f2' }}>
        No se pudieron guardar o cargar los cambios: {errorGuardado} Los cambios visibles sin guardar se perderán al salir.
        {!inicial.error && !soloLectura && <button type="button" onClick={() => aplicar(entregables)} style={{ ...accion, marginLeft: 10 }}>Reintentar guardado</button>}
      </div>}
      {!errorGuardado && guardado && <p role="status" style={{ fontSize: 12, color: '#15803d' }}>Cambios guardados en este navegador.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 18 }}>
        {[
          { nombre: 'Entregables', cantidad: visibles.length, icono: <CheckSquare size={17}/>, fondo: '#f5f3ff', color: '#7c3aed' },
          { nombre: 'Actividades', cantidad: actividades.length, icono: <LayoutList size={17}/>, fondo: '#eff6ff', color: '#0369a1' },
          { nombre: 'Etapas', cantidad: etapas.length, icono: <Settings2 size={17}/>, fondo: '#f0fdfa', color: '#0d9488' },
        ].map(s => (
          <div key={s.nombre} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 10, background: s.fondo, color: s.color }}>
            {s.icono}
            <div>
              <strong style={{ display: 'block', fontSize: 22 }}>{s.cantidad}</strong>
              <span style={{ fontSize: 11 }}>{s.nombre} · visibles{!panorama ? ' (incluye contexto)' : ''}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, color: '#334155' }}>{soloLectura ? 'Reporte Histórico' : 'Detalle del proyecto'}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>Entregables, actividades y etapas de avance · sin cronograma</p>
        </div>
        {puedeCrear && <button type="button" onClick={agregarEntregable} style={{ ...accion, background: '#0d9488', color: '#fff', borderColor: '#0d9488' }}>
          <Plus size={14}/> Agregar entregable
        </button>}
      </div>

      {!visibles.length && !inicial.error && (
        <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
          {panorama ? 'Este proyecto todavía no tiene entregables para mostrar.' : 'No hay elementos asignados a esta persona. Puedes crear su primer entregable desde Tareas Activas.'}
        </p>
      )}
      {visibles.map((ent, ei) => (
        <section key={ent.id} aria-label={`Entregable ${ei + 1}`} style={{ marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fff7f9' }}>
            {!soloLectura && <button type="button" aria-label={`Desplegar entregable ${ei + 1}`} aria-expanded={abiertos.has(ent.id)} aria-controls={`contenido-${ent.id}`} onClick={() => alternar(ent.id)} style={{ ...desplegar, color: '#9f1239' }}>
              {abiertos.has(ent.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
            </button>}
            {!editable(ent) ? <h3 style={{ ...texto, margin: 0, color: '#9f1239' }}>{ent.label || 'Sin nombre'}</h3> : <input aria-label={`Nombre del entregable ${ei + 1}`} value={ent.label} placeholder="Nombre del entregable"
              onChange={ev => { if (editable(ent)) aplicar(entregables.map(e => e.id === ent.id ? { ...e, label: ev.target.value } : e)); }}
              style={{ ...campo, fontWeight: 600, color: '#9f1239' }}/>}
            {responsable(ent, `del entregable ${ei + 1}`, id =>
              aplicar(entregables.map(e => e.id === ent.id ? { ...e, responsableId: id } : e)))}
            {selectorEstado(ent, ent.estado ?? 'backlog', `del entregable ${ei + 1}`, estado =>
              aplicar(entregables.map(e => e.id === ent.id ? { ...e, estado } : e)))}
            {!panorama && !editable(ent) && !soloLectura && <span style={badge}>{lider ? 'Contexto · solo responsable editable' : 'Contexto · solo lectura'}</span>}
            <span style={badge}>{ent.activities.length} {ent.activities.length === 1 ? 'actividad' : 'actividades'}</span>
            {puedeCrear && <button type="button" onClick={() => agregarActividad(ent.id)} style={accion}><Plus size={13}/> Agregar actividad</button>}
          </div>
          {(soloLectura || abiertos.has(ent.id)) && (
            <div id={`contenido-${ent.id}`} style={{ padding: 14, borderTop: '1px solid #f1f5f9' }}>
              {!ent.activities.length && <p style={{ margin: '8px 0', color: '#94a3b8', fontSize: 12 }}>{soloLectura ? 'Sin actividades.' : 'Sin actividades. Agrega una actividad a este entregable.'}</p>}
              {ent.activities.map((act, ai) => {
                const tarea = planActual.tareas.find(t => t.id === act.id);
                const etapasActividad = act.etapas ?? [];
                const completa = entregables.find(e => e.id === ent.id)!.activities.find(a => a.id === act.id)!;
                const total = (completa.etapas ?? []).reduce((s, et) => s + et.peso, 0);
                const correcto = total === 100;
                return (
                  <section key={act.id} aria-label={`Actividad ${ei + 1}.${ai + 1}`} style={{ marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                      {!soloLectura && <button type="button" aria-label={`Desplegar actividad ${ei + 1}.${ai + 1}`} aria-expanded={abiertos.has(act.id)} aria-controls={`contenido-${act.id}`} onClick={() => alternar(act.id)} style={{ ...desplegar, color: '#0d9488' }}>
                        {abiertos.has(act.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      </button>}
                      {!editable(act) ? <h4 style={{ ...texto, margin: 0 }}>{act.label || 'Sin nombre'}</h4> : <input aria-label={`Nombre de la actividad ${ei + 1}.${ai + 1}`} value={act.label} placeholder="Nombre de la actividad"
                        onChange={ev => { if (editable(act)) cambiarActividad(ent.id, act.id, a => ({ ...a, label: ev.target.value })); }} style={campo}/>}
                      {responsable(act, `de la actividad ${ei + 1}.${ai + 1}`, id =>
                        cambiarActividad(ent.id, act.id!, a => ({ ...a, responsableId: id })))}
                      {selectorEstado(act, tarea?.estado ?? 'backlog', `de la actividad ${ei + 1}.${ai + 1}`, estado => {
                        const base = tarea ? planActual : { ...planActual, tareas: [...planActual.tareas, tareaPara(act, ent)] };
                        aplicar(entregables, { ...base, tareas: base.tareas.map(t => t.id === act.id ? { ...t, estado } : t) });
                      })}
                      {!panorama && !editable(act) && !soloLectura && <span style={badge}>{lider ? 'Contexto · solo responsable editable' : 'Contexto · solo lectura'}</span>}
                      {tarea ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{tarea.pct}%</span>
                      ) : <span style={{ ...badge, background: '#f1f5f9', color: '#64748b' }}>Sin seguimiento</span>}
                      {editable(act) && <button type="button" style={accion} onClick={() => { if (editable(act)) setAbierta(act.id!); }} aria-label={`Actualizar avance de ${act.label}`}>Actualizar avance</button>}
                      {puedeCrear && <button type="button" onClick={() => agregarEtapa(ent.id, act.id!)} style={accion}><Plus size={12}/> Agregar etapa</button>}
                    </div>
                    {(soloLectura || abiertos.has(act.id)) && (
                      <div id={`contenido-${act.id}`} style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9', background: '#fafcff' }}>
                        {tarea && <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: 12 }}>Responsable: {tarea.responsable || 'Sin asignar'}</p>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <strong style={{ fontSize: 12, color: '#475569' }}>Etapas de avance</strong>
                          {(completa.etapas?.length ?? 0) > 0 && <span role="status" style={{ fontSize: 11, fontWeight: 600, color: correcto ? '#15803d' : '#dc2626' }}>
                            {correcto ? 'Suma correcta: 100%' : `Las etapas suman ${total}%; deben sumar 100%`}
                            {!panorama && completa.etapas?.length !== etapasActividad.length && ' · total de toda la actividad'}
                          </span>}
                        </div>
                        {!etapasActividad.length && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{soloLectura ? 'Sin etapas.' : 'Sin etapas. Agrega etapas para definir su distribución porcentual.'}</p>}
                        {etapasActividad.map((et, eti) => (
                          <div key={et.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 6, border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc' }}>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{eti + 1}.</span>
                            {!editable(et) ? <span style={texto}>{et.label || 'Sin nombre'}</span> : <input aria-label={`Nombre de la etapa ${ei + 1}.${ai + 1}.${eti + 1}`} value={et.label} placeholder="Nombre de la etapa" style={campo}
                              onChange={ev => { if (editable(et)) cambiarActividad(ent.id, act.id!, a => ({ ...a, etapas: (a.etapas ?? []).map(e => e.id === et.id ? { ...e, label: ev.target.value } : e) })); }}/>}
                            {responsable(et, `de la etapa ${ei + 1}.${ai + 1}.${eti + 1}`, id =>
                              cambiarActividad(ent.id, act.id!, a => ({ ...a, etapas: (a.etapas ?? []).map(e => e.id === et.id ? { ...e, responsableId: id } : e) })))}
                            {selectorEstado(et, et.estado ?? 'backlog', `de la etapa ${ei + 1}.${ai + 1}.${eti + 1}`, estado =>
                              cambiarActividad(ent.id, act.id!, a => ({ ...a, etapas: (a.etapas ?? []).map(e => e.id === et.id ? { ...e, estado } : e) })))}
                            {!editable(et) ? <span style={{ fontSize: 12, color: '#64748b' }}>Peso: {et.peso}%</span> : <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                              Peso
                              <input aria-label={`Peso de la etapa ${ei + 1}.${ai + 1}.${eti + 1}`} type="number" min={0} max={100} step={1} value={et.peso}
                                style={{ ...campo, flex: '0 0 auto', width: 65, textAlign: 'center', fontWeight: 600 }}
                                onChange={ev => {
                                  if (!editable(et)) return;
                                  const peso = Math.min(100, Math.max(0, Math.round(Number(ev.target.value) || 0)));
                                  cambiarActividad(ent.id, act.id!, a => ({ ...a, etapas: (a.etapas ?? []).map(e => e.id === et.id ? { ...e, peso } : e) }));
                                }}/>
                              %
                            </label>}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </section>
      ))}
      </div>
      {creacion && puedeCrear && <div role="dialog" aria-modal="true" aria-label={`Crear ${creacion.tipo}`}
        onKeyDown={ev => { if (ev.key === 'Escape') setCreacion(null); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <form onSubmit={crearElemento} style={{ width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', padding: 24, borderRadius: 14, background: '#fff', display: 'grid', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Crear {creacion.tipo}</h2>
          <label>Nombre
            <input autoFocus aria-label="Nombre del nuevo elemento" required value={creacion.nombre}
              onChange={ev => setCreacion({ ...creacion, nombre: ev.target.value })} style={{ ...campo, width: '100%', boxSizing: 'border-box', marginTop: 6 }}/>
          </label>
          <label>Estado
            <select aria-label="Estado del nuevo elemento" required value={creacion.estado}
              onChange={ev => setCreacion({ ...creacion, estado: ev.target.value })} style={{ ...campo, width: '100%', marginTop: 6 }}>
              <option value="">Selecciona un estado</option>
              {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </label>
          <label>Responsable
            <select aria-label="Responsable del nuevo elemento" required value={creacion.responsableId}
              onChange={ev => setCreacion({ ...creacion, responsableId: ev.target.value })} style={{ ...campo, width: '100%', marginTop: 6 }}>
              {(personal ? equipo.filter(u => u.id === usuario.id) : equipo).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          {creacion.tipo === 'etapa' && <label>Peso (%)
            <input aria-label="Peso de la nueva etapa" type="number" min={0} max={100} step={1} required value={creacion.peso}
              onChange={ev => setCreacion({ ...creacion, peso: Number(ev.target.value) })} style={{ ...campo, width: '100%', boxSizing: 'border-box', marginTop: 6 }}/>
          </label>}
          {errorCreacion && <p role="alert" style={{ color: '#b91c1c' }}>{errorCreacion}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setCreacion(null)} style={accion}>Cancelar</button>
            <button type="submit" disabled={!creacion.nombre.trim() || !esEstado(creacion.estado) || !!pendiente} style={accion}>Crear elemento</button>
          </div>
        </form>
      </div>}
      {tareaAbierta && actAbierta && <React.Fragment key={tareaAbierta.id}><PanelAvance plan={planActual} tarea={tareaAbierta}
        equipoPermitido={personal ? equipo.filter(u => u.id === usuario.id) : equipo}
        responsableId={actAbierta.responsableId} onGuardar={guardarAvance} onCerrar={() => setAbierta(null)}/></React.Fragment>}
    </section>
  );
}
