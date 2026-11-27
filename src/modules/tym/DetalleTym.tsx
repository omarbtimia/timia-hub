import React, { useState } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, Info, LayoutList, Plus, Settings2 } from 'lucide-react';
import { guardarEstructura, leerEstructura, nuevoId } from './almacen';
import { estadoDe, type PlanTym } from './tipos';
import type { PlanActivityStructure, PlanEntregableStructure } from '../../lib/planStructure';

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
};
const texto: React.CSSProperties = { minWidth: 0, flex: '1 1 180px', overflowWrap: 'anywhere', fontSize: 12, color: '#334155' };
const PESTANAS = [
  { id: 'activas', nombre: 'Tareas Activas' },
  { id: 'historico', nombre: 'Reporte Histórico' },
] as const;

export default function DetalleTym({ plan, onAvance }: { plan: PlanTym; onAvance: (id: string) => void }) {
  const [pestana, setPestana] = useState<typeof PESTANAS[number]['id']>('activas');
  const soloLectura = pestana === 'historico';
  const [inicial] = useState<{ entregables: PlanEntregableStructure[]; error: string }>(() => {
    try { return { entregables: leerEstructura(plan).entregables, error: '' }; }
    catch (error) { return { entregables: [], error: mensajeError(error) }; }
  });
  const [entregables, setEntregables] = useState(inicial.entregables);
  const [errorGuardado, setErrorGuardado] = useState(inicial.error);
  const [guardado, setGuardado] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(entregables.slice(0, 1).map(e => e.id)));
  const actividades = entregables.flatMap(e => e.activities);
  const etapas = actividades.flatMap(a => a.etapas ?? []);

  function aplicar(siguiente: PlanEntregableStructure[]) {
    setEntregables(siguiente);
    try {
      guardarEstructura(plan.projectId, siguiente);
      setErrorGuardado('');
      setGuardado(true);
    } catch (error) {
      setErrorGuardado(mensajeError(error));
      setGuardado(false);
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

  function cambiarActividad(entId: string, actId: string, transformar: (a: PlanActivityStructure) => PlanActivityStructure) {
    aplicar(entregables.map(e => e.id !== entId ? e : {
      ...e, activities: e.activities.map(a => a.id === actId ? transformar(a) : a),
    }));
  }

  function agregarEntregable() {
    const nuevo: PlanEntregableStructure = { id: nuevoId(), label: 'Nuevo entregable', activities: [] };
    aplicar([...entregables, nuevo]);
    abrir(nuevo.id);
  }

  function agregarActividad(entId: string) {
    const id = nuevoId();
    const nueva: PlanActivityStructure = { id, label: 'Nueva actividad', etapas: [] };
    aplicar(entregables.map(e => e.id === entId ? { ...e, activities: [...e.activities, nueva] } : e));
    setAbiertos(actual => new Set([...actual, entId, id]));
  }

  function agregarEtapa(entId: string, actId: string) {
    const id = nuevoId();
    cambiarActividad(entId, actId, a => ({
      ...a, etapas: [...(a.etapas ?? []), {
        id, label: 'Nueva etapa', peso: Math.max(0, 100 - (a.etapas ?? []).reduce((s, et) => s + et.peso, 0)),
      }],
    }));
    abrir(actId);
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
          { nombre: 'Entregables', cantidad: entregables.length, icono: <CheckSquare size={17}/>, fondo: '#f5f3ff', color: '#7c3aed' },
          { nombre: 'Actividades', cantidad: actividades.length, icono: <LayoutList size={17}/>, fondo: '#eff6ff', color: '#0369a1' },
          { nombre: 'Etapas', cantidad: etapas.length, icono: <Settings2 size={17}/>, fondo: '#f0fdfa', color: '#0d9488' },
        ].map(s => (
          <div key={s.nombre} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 10, background: s.fondo, color: s.color }}>
            {s.icono}
            <div>
              <strong style={{ display: 'block', fontSize: 22 }}>{s.cantidad}</strong>
              <span style={{ fontSize: 11 }}>{s.nombre} · estructura local</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, color: '#334155' }}>{soloLectura ? 'Reporte Histórico' : 'Detalle del proyecto'}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>Entregables, actividades y etapas de avance · sin cronograma</p>
        </div>
        {!soloLectura && !inicial.error && <button type="button" onClick={agregarEntregable} style={{ ...accion, background: '#0d9488', color: '#fff', borderColor: '#0d9488' }}>
          <Plus size={14}/> Agregar entregable
        </button>}
      </div>

      {!entregables.length && !inicial.error && (
        <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
          {soloLectura ? 'Este proyecto todavía no tiene entregables para mostrar en el reporte.' : 'Este proyecto todavía no tiene entregables. Agrega el primero para crear sus actividades y etapas.'}
        </p>
      )}
      {entregables.map((ent, ei) => (
        <section key={ent.id} aria-label={`Entregable ${ei + 1}`} style={{ marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fff7f9' }}>
            {!soloLectura && <button type="button" aria-label={`Desplegar entregable ${ei + 1}`} aria-expanded={abiertos.has(ent.id)} aria-controls={`contenido-${ent.id}`} onClick={() => alternar(ent.id)} style={{ ...desplegar, color: '#9f1239' }}>
              {abiertos.has(ent.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
            </button>}
            {soloLectura ? <h3 style={{ ...texto, margin: 0, color: '#9f1239' }}>{ent.label || 'Sin nombre'}</h3> : <input aria-label={`Nombre del entregable ${ei + 1}`} value={ent.label} placeholder="Nombre del entregable"
              onChange={ev => aplicar(entregables.map(e => e.id === ent.id ? { ...e, label: ev.target.value } : e))}
              style={{ ...campo, fontWeight: 600, color: '#9f1239' }}/>}
            <span style={badge}>{ent.activities.length} {ent.activities.length === 1 ? 'actividad' : 'actividades'}</span>
            {!soloLectura && <button type="button" onClick={() => agregarActividad(ent.id)} style={accion}><Plus size={13}/> Agregar actividad</button>}
          </div>
          {(soloLectura || abiertos.has(ent.id)) && (
            <div id={`contenido-${ent.id}`} style={{ padding: 14, borderTop: '1px solid #f1f5f9' }}>
              {!ent.activities.length && <p style={{ margin: '8px 0', color: '#94a3b8', fontSize: 12 }}>{soloLectura ? 'Sin actividades.' : 'Sin actividades. Agrega una actividad a este entregable.'}</p>}
              {ent.activities.map((act, ai) => {
                const tarea = plan.tareas.find(t => t.id === act.id);
                const estado = tarea ? estadoDe(tarea.estado) : null;
                const etapasActividad = act.etapas ?? [];
                const total = etapasActividad.reduce((s, et) => s + et.peso, 0);
                const correcto = total === 100;
                return (
                  <section key={act.id} aria-label={`Actividad ${ei + 1}.${ai + 1}`} style={{ marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                      {!soloLectura && <button type="button" aria-label={`Desplegar actividad ${ei + 1}.${ai + 1}`} aria-expanded={abiertos.has(act.id)} aria-controls={`contenido-${act.id}`} onClick={() => alternar(act.id)} style={{ ...desplegar, color: '#0d9488' }}>
                        {abiertos.has(act.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      </button>}
                      {soloLectura ? <h4 style={{ ...texto, margin: 0 }}>{act.label || 'Sin nombre'}</h4> : <input aria-label={`Nombre de la actividad ${ei + 1}.${ai + 1}`} value={act.label} placeholder="Nombre de la actividad"
                        onChange={ev => cambiarActividad(ent.id, act.id, a => ({ ...a, label: ev.target.value }))} style={campo}/>}
                      {tarea && estado ? (
                        <>
                          <span style={{ ...badge, background: estado.fondo, color: estado.texto }}>{estado.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{tarea.pct}%</span>
                          {!soloLectura && <button type="button" style={accion} onClick={() => onAvance(tarea.id)} aria-label={`Actualizar avance de ${tarea.nombre}`}>Actualizar avance</button>}
                        </>
                      ) : <span style={{ ...badge, background: '#f1f5f9', color: '#64748b' }}>Sin seguimiento</span>}
                      {!soloLectura && <button type="button" onClick={() => agregarEtapa(ent.id, act.id)} style={accion}><Plus size={12}/> Agregar etapa</button>}
                    </div>
                    {(soloLectura || abiertos.has(act.id)) && (
                      <div id={`contenido-${act.id}`} style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9', background: '#fafcff' }}>
                        {tarea && <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: 12 }}>Responsable: {tarea.responsable || 'Sin asignar'}</p>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <strong style={{ fontSize: 12, color: '#475569' }}>Etapas de avance</strong>
                          {etapasActividad.length > 0 && <span role="status" style={{ fontSize: 11, fontWeight: 600, color: correcto ? '#15803d' : '#dc2626' }}>
                            {correcto ? 'Suma correcta: 100%' : `Las etapas suman ${total}%; deben sumar 100%`}
                          </span>}
                        </div>
                        {!etapasActividad.length && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{soloLectura ? 'Sin etapas.' : 'Sin etapas. Agrega etapas para definir su distribución porcentual.'}</p>}
                        {etapasActividad.map((et, eti) => (
                          <div key={et.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 6, border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc' }}>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{eti + 1}.</span>
                            {soloLectura ? <span style={texto}>{et.label || 'Sin nombre'}</span> : <input aria-label={`Nombre de la etapa ${ei + 1}.${ai + 1}.${eti + 1}`} value={et.label} placeholder="Nombre de la etapa" style={campo}
                              onChange={ev => cambiarActividad(ent.id, act.id, a => ({ ...a, etapas: (a.etapas ?? []).map(e => e.id === et.id ? { ...e, label: ev.target.value } : e) }))}/>}
                            {soloLectura ? <span style={{ fontSize: 12, color: '#64748b' }}>Peso: {et.peso}%</span> : <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                              Peso
                              <input aria-label={`Peso de la etapa ${ei + 1}.${ai + 1}.${eti + 1}`} type="number" min={0} max={100} step={1} value={et.peso}
                                style={{ ...campo, flex: '0 0 auto', width: 65, textAlign: 'center', fontWeight: 600 }}
                                onChange={ev => {
                                  const peso = Math.min(100, Math.max(0, Math.round(Number(ev.target.value) || 0)));
                                  cambiarActividad(ent.id, act.id, a => ({ ...a, etapas: (a.etapas ?? []).map(e => e.id === et.id ? { ...e, peso } : e) }));
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
    </section>
  );
}
