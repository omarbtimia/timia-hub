import React, { useEffect, useState } from 'react';
import { Activity, Briefcase, CheckSquare, Layers, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { View } from '../../components/Layout';
import { ESTADOS } from './tipos';
import { effectiveRole } from '../../lib/permissions';
import { resumenesDashboardTym } from './resumenDashboard';
import { consultaAmpliadaTym, developersDelProyecto, proyectosDashboardTym, useCambiosTym } from './responsables';

const tarjeta: React.CSSProperties = {
  minWidth: 0, padding: 18, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff',
};
const campo: React.CSSProperties = {
  display: 'block', boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 44,
  marginTop: 6, padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff',
};

export default function DashboardTym({ onViewChange }: { onViewChange: (view: View, param?: string) => void }) {
  const { user, isLoading } = useAuth();
  useCambiosTym();
  const [proyectoId, setProyectoId] = useState('');
  const [developerId, setDeveloperId] = useState('__inicial');
  const proyectos = proyectosDashboardTym(user);
  const proyectoActual = proyectos.some(p => p.id === proyectoId) ? proyectoId : '';
  const seleccionados = proyectos.filter(p => !proyectoActual || p.id === proyectoActual);
  const consultables = seleccionados.filter(p => consultaAmpliadaTym(user, p.id));
  const developers = [...new Map(consultables.flatMap(p => developersDelProyecto(p.id)).map(u => [u.id, u])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
  const developerActual = developerId === '__mio' ? '__mio'
    : developers.some(u => u.id === developerId) ? developerId
    : developerId === '__inicial' && seleccionados.every(p => effectiveRole(user, p.id) === 'developer') ? '__mio' : '';
  const firmaAlcance = consultables.map(p => p.id).sort().join('|');
  useEffect(() => { setDeveloperId('__inicial'); }, [firmaAlcance, user?.id]);
  useEffect(() => { setProyectoId(''); }, [user?.id]);

  if (isLoading) return <p role="status">Cargando Dashboard T&amp;M…</p>;
  if (!user || !proyectos.length) return <div style={{ padding: 28 }}>
    <h1 style={{ fontSize: 24 }}>Dashboard T&amp;M</h1>
    <p role="alert">No tienes proyectos T&amp;M activos accesibles con permiso para este dashboard.</p>
  </div>;
  const filas = resumenesDashboardTym(user, proyectoActual, developerActual);
  const validas = filas.filter(f => !f.error);
  const total = (key: 'entregables' | 'actividades' | 'etapas') => validas.reduce((s, f) => s + f[key], 0);
  const incompleto = validas.length !== filas.length;

  return <div style={{ padding: '28px clamp(16px, 3vw, 36px)', maxWidth: 1600, margin: '0 auto' }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 22 }}>
      <div style={{ color: '#0f766e', background: '#ccfbf1', padding: 12, borderRadius: 12 }}><Activity size={25}/></div>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '-.5px', color: '#0f172a' }}>Dashboard T&amp;M</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>Proyectos abiertos · trabajo del equipo sin cronograma</p>
      </div>
    </header>
    <div style={{ ...tarjeta, display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 20 }}>
      <label style={{ flex: '1 1 240px', minWidth: 0, fontSize: 12, color: '#475569' }}>Proyecto
        <select aria-label="Proyecto T&M" style={campo} value={proyectoActual}
          onChange={ev => { setProyectoId(ev.target.value); setDeveloperId('__inicial'); }}>
          <option value="">Todos mis proyectos T&amp;M</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {!!consultables.length && <label style={{ flex: '1 1 240px', minWidth: 0, fontSize: 12, color: '#475569' }}>Desarrollador
        <select aria-label="Developer T&M" style={campo} value={developerActual} onChange={ev => setDeveloperId(ev.target.value)}>
          <option value="">Panorama General</option>
          <option value="__mio">Mi trabajo</option>
          {developers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>}
      {!consultables.length && <p style={{ alignSelf: 'center', margin: 0, color: '#0f766e', fontSize: 13 }}><strong>Mi trabajo</strong> · {user.name}</p>}
    </div>
    {!!consultables.length && !developers.length && <p role="status" style={{ fontSize: 12, color: '#64748b' }}>
      No hay developers activos asociados a estos proyectos. Puedes revisar los elementos Sin asignar en Panorama General.
    </p>}
    {consultables.length > 0 && consultables.length !== seleccionados.length && <p role="note" style={{ fontSize: 12, color: '#475569' }}>
      El filtro de desarrollador se aplica solo donde tienes permiso. Las demás tarjetas conservan «Mi trabajo».
    </p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 12, marginBottom: 20 }}>
      {[
        { label: 'Proyectos T&M', value: filas.length, icon: <Briefcase size={20}/>, color: '#7c3aed' },
        { label: 'Entregables', value: total('entregables'), icon: <CheckSquare size={20}/>, color: '#0369a1' },
        { label: 'Actividades', value: total('actividades'), icon: <Users size={20}/>, color: '#0f766e' },
        { label: 'Etapas', value: total('etapas'), icon: <Layers size={20}/>, color: '#b45309' },
      ].map(k => <div key={k.label} style={{ ...tarjeta, display: 'flex', alignItems: 'center', gap: 14, color: k.color }}>
        {k.icon}<div><strong style={{ display: 'block', fontSize: 25 }}>{k.value}</strong><span style={{ fontSize: 12 }}>{k.label}</span></div>
      </div>)}
    </div>
    <p style={{ fontSize: 12, color: '#64748b' }}>Los contadores incluyen solo elementos del alcance indicado, no contenedores ajenos de contexto.
      {incompleto && ' Resumen parcial: se excluyen los proyectos que no pudieron leerse.'}
    </p>
    {!filas.length && <p role="status" style={tarjeta}>No hay proyectos para el developer seleccionado.</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16 }}>
      {filas.map(f => <article key={f.proyecto.id} aria-label={`Proyecto ${f.proyecto.name}`}
        style={{ ...tarjeta, borderTop: `4px solid ${f.proyecto.color || '#0d9488'}`, overflowWrap: 'anywhere' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>{f.proyecto.name}</h2>
          <span style={{ fontSize: 11, color: '#0f766e', background: '#f0fdfa', borderRadius: 10, padding: '4px 8px' }}>{f.alcance}</span>
        </div>
        <p style={{ fontSize: 12, color: '#64748b' }}>{f.proyecto.client || 'Sin cliente'} · {f.proyecto.id}</p>
        <p style={{ fontSize: 12, color: '#475569' }}>Líder técnico: {f.lideres.join(', ') || 'Sin asignar'}</p>
        {f.error ? <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>No se pudo cargar el resumen: {f.error}</p> : <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 13, color: '#334155', margin: '18px 0' }}>
            <span><strong>{f.entregables}</strong> entregables</span>
            <span><strong>{f.actividades}</strong> actividades</span>
            <span><strong>{f.etapas}</strong> etapas</span>
          </div>
          {!!f.contenedores && <p style={{ fontSize: 11, color: '#64748b' }}>{f.contenedores} contenedores adicionales de contexto al abrir el proyecto.</p>}
          {!f.entregables && !f.actividades && !f.etapas && <p style={{ fontSize: 12, color: '#64748b' }}>Sin trabajo asignado en este alcance.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {ESTADOS.map(e => <span key={e.id} style={{ padding: '5px 8px', borderRadius: 8, background: e.fondo, color: e.texto, fontSize: 11 }}>
              {e.label}: {f.estados[e.id] ?? 0}
            </span>)}
            {!!f.sinSeguimiento && <span style={{ fontSize: 11, color: '#64748b', padding: 5 }}>Sin seguimiento: {f.sinSeguimiento}</span>}
          </div>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 18 }}>
            {f.ultimoMovimiento ? `Último movimiento: ${new Date(f.ultimoMovimiento).toLocaleString('es-CO')}` : 'Sin movimientos registrados'}
          </p>
        </>}
        <button type="button" onClick={() => onViewChange('proyecto-tym', f.proyecto.id)}
          style={{ marginTop: 8, minHeight: 40, padding: '9px 14px', borderRadius: 8, border: '1px solid #99d9ce', color: '#0f766e', background: '#f0fdfa', fontSize: 12, cursor: 'pointer' }}>
          Abrir proyecto abierto
        </button>
      </article>)}
    </div>
    <p role="note" style={{ fontSize: 12, color: '#64748b', marginTop: 24 }}>
      La estructura se consulta desde este navegador. Los permisos T&amp;M controlan la visual del frontend; su aplicación en el backend sigue pendiente.
    </p>
  </div>;
}
