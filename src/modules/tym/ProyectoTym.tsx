// La vista de un proyecto abierto en marcha: sus tareas y su avance.
// Deliberadamente no hay avance esperado, diferencia ni semáforo: el contrato
// no compromete fechas, así que no hay contra qué comparar y un semáforo aquí
// mentiría.
import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { adminStore } from '../../lib/adminStore';
import { ChipTym } from './PasosTym';
import { leerPlan, guardarPlan, conAvance } from './almacen';
import PanelAvance from './PanelAvance';
import DetalleTym from './DetalleTym';
import { avanceDe, cerradasDe, type PlanTym } from './tipos';

export default function ProyectoTym({ projectId }: { projectId: string }) {
  return <React.Fragment key={projectId}><ProyectoTymContenido projectId={projectId}/></React.Fragment>;
}

function ProyectoTymContenido({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const proyecto = useMemo(() => adminStore.getProjects().find(p => p.id === projectId), [projectId]);
  const [plan, setPlan] = useState<PlanTym>(() => leerPlan(projectId));
  const [abierta, setAbierta] = useState<string | null>(null);

  const avance = avanceDe(plan);
  const cerradas = cerradasDe(plan);

  function aplicar(siguiente: PlanTym) {
    setPlan(siguiente);
    guardarPlan(siguiente);
  }

  const tarjeta: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '17px 20px',
  };

  return (
    <div style={{ minHeight: '100%', background: '#f8fafc', padding: '34px 24px 56px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 5 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.9 }}>{proyecto?.name ?? projectId}</h1>
          <ChipTym/>
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b' }}>
          {proyecto?.client ?? '—'} · {plan.tareas.length} {plan.tareas.length === 1 ? 'tarea' : 'tareas'}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 26 }}>
          <div style={{ ...tarjeta, flex: '0 1 200px', minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: .8 }}>Avance real</p>
            <p style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 900, letterSpacing: -1.6, lineHeight: 1 }}>
              {avance.toFixed(1)}<span style={{ fontSize: 20 }}>%</span>
            </p>
          </div>
          <div style={{ ...tarjeta, flex: '0 1 190px', minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: .8 }}>Tareas cerradas</p>
            <p style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 900, letterSpacing: -1.6, lineHeight: 1 }}>
              {cerradas.hechas}<span style={{ fontSize: 19, color: '#64748b' }}> / {cerradas.total}</span>
            </p>
          </div>
          <div style={{ ...tarjeta, flex: '1 1 320px', minWidth: 0, border: '1px dashed #cbd5e1', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <Info size={17} color="#64748b" style={{ flex: '0 0 auto', marginTop: 2 }} aria-hidden="true"/>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: '#475569' }}>
              El seguimiento real se calcula sobre las tareas guardadas. Este proyecto abierto no compromete fechas: no tiene avance esperado, diferencia ni semáforo.
            </p>
          </div>
        </div>

        <DetalleTym plan={plan} onAvance={setAbierta}/>
      </div>

      {abierta && (() => {
        const t = plan.tareas.find(x => x.id === abierta);
        if (!t) return null;
        return (
          <PanelAvance
            plan={plan} tarea={t}
            onCerrar={() => setAbierta(null)}
            onGuardar={(cambios, nota) => {
              aplicar(conAvance(plan, t.id, cambios, user?.name ?? 'Alguien', nota));
              setAbierta(null);
            }}
          />
        );
      })()}
    </div>
  );
}
