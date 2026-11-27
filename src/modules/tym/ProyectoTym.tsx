// La vista de un proyecto abierto en marcha: sus tareas y su avance.
// Deliberadamente no hay avance esperado, diferencia ni semáforo: el contrato
// no compromete fechas, así que no hay contra qué comparar y un semáforo aquí
// mentiría.
import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { adminStore } from '../../lib/adminStore';
import { ChipTym } from './PasosTym';
import { leerPlan, guardarPlan } from './almacen';
import DetalleTym from './DetalleTym';
import type { PlanTym } from './tipos';
import { effectiveRole } from '../../lib/permissions';
import { accesoTym, developersDelProyecto } from './responsables';

export default function ProyectoTym({ projectId }: { projectId: string }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p role="status">Cargando proyecto…</p>;
  if (!accesoTym(user, projectId)) return <p role="alert">No tienes acceso a este proyecto abierto.</p>;
  return <React.Fragment key={`${projectId}:${user?.id}`}><ProyectoTymContenido projectId={projectId}/></React.Fragment>;
}

function ProyectoTymContenido({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const proyecto = useMemo(() => adminStore.getProjects().find(p => p.id === projectId), [projectId]);
  const [plan, setPlan] = useState<PlanTym>(() => leerPlan(projectId));
  const personal = effectiveRole(user, projectId) === 'developer';
  const equipo = developersDelProyecto(projectId);
  const [seleccion, setSeleccion] = useState('');
  const personaId = personal ? user!.id : equipo.some(u => u.id === seleccion) ? seleccion : null;
  const [bloqueado, setBloqueado] = useState(false);

  function aplicar(siguiente: PlanTym) {
    guardarPlan(siguiente);
    setPlan(siguiente);
  }

  return (
    <div style={{ minHeight: '100%', background: '#f8fafc', padding: '34px 24px 56px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 5 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.9 }}>{proyecto?.name ?? projectId}</h1>
          <ChipTym/>
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b' }}>
          {proyecto?.client ?? '—'}
        </p>

        <div style={{ padding: '14px 18px', borderRadius: 12, marginBottom: 22, border: '1px dashed #cbd5e1', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <Info size={17} color="#64748b" style={{ flex: '0 0 auto', marginTop: 2 }} aria-hidden="true"/>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: '#475569' }}>
            Este proyecto abierto no compromete fechas: no tiene cronograma, avance esperado, diferencia ni semáforo.
          </p>
        </div>

        {!personal ? <label style={{ display: 'block', marginBottom: 20, fontSize: 13, color: '#334155' }}>
          Visualizar trabajo de
          <select aria-label="Visualizar trabajo de" value={personaId ?? ''} disabled={bloqueado}
            onChange={ev => {
              if (!bloqueado && (!ev.target.value || equipo.some(u => u.id === ev.target.value))) setSeleccion(ev.target.value);
            }}
            style={{ display: 'block', width: '100%', maxWidth: 400, minHeight: 44, marginTop: 6, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
            <option value="">Panorama General</option>
            {equipo.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label> : <p style={{ fontSize: 14, fontWeight: 600 }}>Mi trabajo · {user?.name}</p>}
        {!equipo.length && <p role="status">No hay developers activos asociados a este proyecto. Asócialos desde Gestionar equipo.</p>}
        <DetalleTym plan={plan} onGuardarPlan={aplicar} equipo={equipo} personaId={personaId}
          personal={personal} usuario={user!} onPendiente={setBloqueado}/>
      </div>

    </div>
  );
}
