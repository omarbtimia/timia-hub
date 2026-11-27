import React, { useState } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, Info, LayoutList, Plus, Settings2 } from 'lucide-react';
import { nuevoId } from './almacen';
import { estadoDe, type PlanTym } from './tipos';

interface EtapaVisual {
  id: string;
  nombre: string;
  peso: number;
}

interface ActividadVisual {
  id: string;
  tareaId?: string;
  nombre: string;
  etapas: EtapaVisual[];
}

interface EntregableVisual {
  id: string;
  nombre: string;
  actividades: ActividadVisual[];
}

function borradorDe(plan: PlanTym): EntregableVisual[] {
  const bloques = [...new Set([...plan.bloques, ...plan.tareas.map(t => t.bloque)].map(b => b || 'General'))];
  return bloques.map(nombre => ({
    id: nuevoId(), nombre,
    actividades: plan.tareas.filter(t => (t.bloque || 'General') === nombre).map(t => ({
      id: t.id, tareaId: t.id, nombre: t.nombre, etapas: [],
    })),
  }));
}

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

export default function DetalleTym({ plan, onAvance }: { plan: PlanTym; onAvance: (id: string) => void }) {
  const [entregables, setEntregables] = useState(() => borradorDe(plan));
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(entregables.slice(0, 1).map(e => e.id)));
  const actividades = entregables.flatMap(e => e.actividades);
  const etapas = actividades.flatMap(a => a.etapas);

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

  function cambiarActividad(entId: string, actId: string, transformar: (a: ActividadVisual) => ActividadVisual) {
    setEntregables(actual => actual.map(e => e.id !== entId ? e : {
      ...e, actividades: e.actividades.map(a => a.id === actId ? transformar(a) : a),
    }));
  }

  function agregarEntregable() {
    const nuevo: EntregableVisual = { id: nuevoId(), nombre: 'Nuevo entregable', actividades: [] };
    setEntregables(actual => [...actual, nuevo]);
    abrir(nuevo.id);
  }

  function agregarActividad(entId: string) {
    const nueva: ActividadVisual = { id: nuevoId(), nombre: 'Nueva actividad', etapas: [] };
    setEntregables(actual => actual.map(e => e.id === entId ? { ...e, actividades: [...e.actividades, nueva] } : e));
    setAbiertos(actual => new Set([...actual, entId, nueva.id]));
  }

  function agregarEtapa(entId: string, actId: string) {
    const id = nuevoId();
    cambiarActividad(entId, actId, a => ({
      ...a, etapas: [...a.etapas, {
        id, nombre: 'Nueva etapa', peso: Math.max(0, 100 - a.etapas.reduce((s, et) => s + et.peso, 0)),
      }],
    }));
    abrir(actId);
  }

  return (
    <section aria-label="Detalle del proyecto">
      <div role="note" style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 16px', marginBottom: 18,
        border: '1px solid #fde68a', borderRadius: 10, background: '#fffbeb', color: '#92400e',
      }}>
        <Info size={17} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true"/>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
          <strong>Simulación visual.</strong> Los entregables, nombres, actividades y etapas que edites aquí
          son temporales y se descartan al salir o recargar. No se envían al servidor.
          {' '}<strong>Guardar avance</strong> de una tarea existente sí conserva sus cambios e historial.
          Los pesos de etapas no modifican el avance real.
        </p>
      </div>

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
              <span style={{ fontSize: 11 }}>{s.nombre} · vista temporal</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, color: '#334155' }}>Detalle del proyecto</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>Entregables, actividades y etapas de avance · sin cronograma</p>
        </div>
        <button type="button" onClick={agregarEntregable} style={{ ...accion, background: '#0d9488', color: '#fff', borderColor: '#0d9488' }}>
          <Plus size={14}/> Agregar entregable
        </button>
      </div>

      {!entregables.length && (
        <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
          Este proyecto todavía no tiene entregables. Agrega el primero para crear sus actividades y etapas.
        </p>
      )}
      {entregables.map((ent, ei) => (
        <section key={ent.id} aria-label={`Entregable ${ei + 1}`} style={{ marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fff7f9' }}>
            <button type="button" aria-label={`Desplegar entregable ${ei + 1}`} aria-expanded={abiertos.has(ent.id)} aria-controls={`contenido-${ent.id}`} onClick={() => alternar(ent.id)} style={{ ...desplegar, color: '#9f1239' }}>
              {abiertos.has(ent.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
            </button>
            <input aria-label={`Nombre del entregable ${ei + 1}`} value={ent.nombre} placeholder="Nombre del entregable"
              onChange={ev => setEntregables(actual => actual.map(e => e.id === ent.id ? { ...e, nombre: ev.target.value } : e))}
              style={{ ...campo, fontWeight: 600, color: '#9f1239' }}/>
            <span style={badge}>{ent.actividades.length} {ent.actividades.length === 1 ? 'actividad' : 'actividades'}</span>
            <button type="button" onClick={() => agregarActividad(ent.id)} style={accion}><Plus size={13}/> Agregar actividad</button>
          </div>
          {abiertos.has(ent.id) && (
            <div id={`contenido-${ent.id}`} style={{ padding: 14, borderTop: '1px solid #f1f5f9' }}>
              {!ent.actividades.length && <p style={{ margin: '8px 0', color: '#94a3b8', fontSize: 12 }}>Sin actividades. Agrega una actividad a este entregable.</p>}
              {ent.actividades.map((act, ai) => {
                const tarea = plan.tareas.find(t => t.id === act.tareaId);
                const estado = tarea ? estadoDe(tarea.estado) : null;
                const total = act.etapas.reduce((s, et) => s + et.peso, 0);
                const correcto = total === 100;
                return (
                  <section key={act.id} aria-label={`Actividad ${ei + 1}.${ai + 1}`} style={{ marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                      <button type="button" aria-label={`Desplegar actividad ${ei + 1}.${ai + 1}`} aria-expanded={abiertos.has(act.id)} aria-controls={`contenido-${act.id}`} onClick={() => alternar(act.id)} style={{ ...desplegar, color: '#0d9488' }}>
                        {abiertos.has(act.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      </button>
                      <input aria-label={`Nombre de la actividad ${ei + 1}.${ai + 1}`} value={act.nombre} placeholder="Nombre de la actividad"
                        onChange={ev => cambiarActividad(ent.id, act.id, a => ({ ...a, nombre: ev.target.value }))} style={campo}/>
                      {tarea && estado ? (
                        <>
                          <span style={{ ...badge, background: estado.fondo, color: estado.texto }}>{estado.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{tarea.pct}%</span>
                          <button type="button" style={accion} onClick={() => onAvance(tarea.id)} aria-label={`Actualizar avance de ${tarea.nombre}`}>Actualizar avance</button>
                        </>
                      ) : <span style={{ ...badge, background: '#fffbeb', color: '#92400e' }}>Simulada · sin guardar</span>}
                      <button type="button" onClick={() => agregarEtapa(ent.id, act.id)} style={accion}><Plus size={12}/> Agregar etapa</button>
                    </div>
                    {abiertos.has(act.id) && (
                      <div id={`contenido-${act.id}`} style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9', background: '#fafcff' }}>
                        {tarea && <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: 12 }}>Responsable: {tarea.responsable || 'Sin asignar'}</p>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <strong style={{ fontSize: 12, color: '#475569' }}>Etapas de avance</strong>
                          {act.etapas.length > 0 && <span role="status" style={{ fontSize: 11, fontWeight: 600, color: correcto ? '#15803d' : '#dc2626' }}>
                            {correcto ? 'Suma correcta: 100%' : `Las etapas suman ${total}%; deben sumar 100%`}
                          </span>}
                        </div>
                        {!act.etapas.length && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Sin etapas. Agrega etapas para simular su distribución porcentual.</p>}
                        {act.etapas.map((et, eti) => (
                          <div key={et.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 6, border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc' }}>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{eti + 1}.</span>
                            <input aria-label={`Nombre de la etapa ${ei + 1}.${ai + 1}.${eti + 1}`} value={et.nombre} placeholder="Nombre de la etapa" style={campo}
                              onChange={ev => cambiarActividad(ent.id, act.id, a => ({ ...a, etapas: a.etapas.map(e => e.id === et.id ? { ...e, nombre: ev.target.value } : e) }))}/>
                            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                              Peso
                              <input aria-label={`Peso de la etapa ${ei + 1}.${ai + 1}.${eti + 1}`} type="number" min={0} max={100} step={1} value={et.peso}
                                style={{ ...campo, flex: '0 0 auto', width: 65, textAlign: 'center', fontWeight: 600 }}
                                onChange={ev => {
                                  const peso = Math.min(100, Math.max(0, Math.round(Number(ev.target.value) || 0)));
                                  cambiarActividad(ent.id, act.id, a => ({ ...a, etapas: a.etapas.map(e => e.id === et.id ? { ...e, peso } : e) }));
                                }}/>
                              %
                            </label>
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
    </section>
  );
}
