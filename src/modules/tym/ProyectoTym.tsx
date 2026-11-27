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
import type { PlanTym } from './tipos';

export default function ProyectoTym({ projectId }: { projectId: string }) {
  return <React.Fragment key={projectId}><ProyectoTymContenido projectId={projectId}/></React.Fragment>;
}

function ProyectoTymContenido({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const proyecto = useMemo(() => adminStore.getProjects().find(p => p.id === projectId), [projectId]);
  const [plan, setPlan] = useState<PlanTym>(() => leerPlan(projectId));
  const [abierta, setAbierta] = useState<string | null>(null);

  function aplicar(siguiente: PlanTym) {
    setPlan(siguiente);
    guardarPlan(siguiente);
  }

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

        <div style={{ padding: '14px 18px', borderRadius: 12, marginBottom: 22, border: '1px dashed #cbd5e1', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <Info size={17} color="#64748b" style={{ flex: '0 0 auto', marginTop: 2 }} aria-hidden="true"/>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: '#475569' }}>
            Este proyecto abierto no compromete fechas: no tiene cronograma, avance esperado, diferencia ni semáforo.
          </p>
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
