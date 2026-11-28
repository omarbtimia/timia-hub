// La vista de un proyecto abierto en marcha: sus tareas y su avance.
// Deliberadamente no hay avance esperado, diferencia ni semáforo: el contrato
// no compromete fechas, así que no hay contra qué comparar y un semáforo aquí
// mentiría.
import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { adminStore } from '../../lib/adminStore';
import { ChipTym } from './PasosTym';
import { leerPlan, guardarPlan } from './almacen';
import DetalleTym from './DetalleTym';
import { planVacio, type PlanTym } from './tipos';
import { effectiveRole } from '../../lib/permissions';
import { accesoTym, developersDelProyecto, consultaAmpliadaTym, useCambiosTym } from './responsables';
import { CAMBIO_TYM, reconciliarProyectoTym } from './tablero';

export default function ProyectoTym({ projectId }: { projectId: string }) {
  const { user, isLoading } = useAuth();
  useCambiosTym();
  if (isLoading) return <p role="status">Cargando proyecto…</p>;
  if (!accesoTym(user, projectId)) return <p role="alert">No tienes acceso a este proyecto abierto.</p>;
  return <React.Fragment key={`${projectId}:${user?.id}`}><ProyectoTymContenido projectId={projectId}/></React.Fragment>;
}

function ProyectoTymContenido({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const proyecto = useMemo(() => adminStore.getProjects().find(p => p.id === projectId), [projectId]);
  const [carga] = useState(() => {
    try { return { plan: leerPlan(projectId), error: '' }; }
    catch (error) { return { plan: planVacio(projectId), error: error instanceof Error ? error.message : 'No se pudo leer el proyecto.' }; }
  });
  const [plan, setPlan] = useState<PlanTym>(carga.plan);
  const [cargado, setCargado] = useState(!carga.error);
  const [version, setVersion] = useState(0);
  const [errorSincronizacion, setErrorSincronizacion] = useState(carga.error);
  function sincronizar() {
    try {
      reconciliarProyectoTym(projectId);
      setPlan(leerPlan(projectId));
      setCargado(true);
      setVersion(actual => actual + 1);
      setErrorSincronizacion('');
    } catch (error) { setErrorSincronizacion(error instanceof Error ? error.message : 'No se pudo sincronizar el tablero T&M.'); }
  }
  useEffect(() => {
    sincronizar();
    function actualizar() {
      try {
        const siguiente = leerPlan(projectId);
        setPlan(actual => JSON.stringify(actual) === JSON.stringify(siguiente) ? actual : siguiente);
      } catch (error) { setErrorSincronizacion(error instanceof Error ? error.message : 'No se pudo leer el seguimiento.'); }
    }
    window.addEventListener(CAMBIO_TYM, actualizar);
    window.addEventListener('storage', actualizar);
    return () => {
      window.removeEventListener(CAMBIO_TYM, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, [projectId]);
  const personal = effectiveRole(user, projectId) === 'developer';
  const consultaAmpliada = consultaAmpliadaTym(user, projectId);
  const equipo = developersDelProyecto(projectId);
  const [seleccion, setSeleccion] = useState({ valor: '', habilitada: consultaAmpliada });
  useEffect(() => {
    setSeleccion(actual => actual.habilitada === consultaAmpliada ? actual : { valor: '', habilitada: consultaAmpliada });
  }, [consultaAmpliada]);
  const valorSeleccion = seleccion.habilitada === consultaAmpliada ? seleccion.valor : '';
  const personaId = !consultaAmpliada ? user!.id
    : personal && valorSeleccion === '' ? user!.id
    : equipo.some(u => u.id === valorSeleccion) ? valorSeleccion : null;
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

        {consultaAmpliada ? <label style={{ display: 'block', marginBottom: 20, fontSize: 13, color: '#334155' }}>
          Visualizar trabajo de
          <select aria-label="Visualizar trabajo de" value={personal && personaId === user!.id ? '' : personaId ?? (personal ? '__todos' : '')} disabled={bloqueado}
            onChange={ev => {
              if (!bloqueado && (!ev.target.value || ev.target.value === '__todos' || equipo.some(u => u.id === ev.target.value))) {
                setSeleccion({ valor: ev.target.value, habilitada: consultaAmpliada });
              }
            }}
            style={{ display: 'block', width: '100%', maxWidth: 400, minHeight: 44, marginTop: 6, padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>
            {personal && <option value="">Mi trabajo</option>}
            <option value={personal ? '__todos' : ''}>Panorama General</option>
            {equipo.filter(u => !personal || u.id !== user!.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label> : <p style={{ fontSize: 14, fontWeight: 600 }}>Mi trabajo · {user?.name}</p>}
        {!equipo.length && <p role="status">No hay developers activos asociados a este proyecto. Asócialos desde Gestionar equipo.</p>}
        {errorSincronizacion && <p role="alert" style={{ color: '#b91c1c' }}>
          No se pudo cargar o sincronizar el proyecto: {errorSincronizacion}{' '}
          <button type="button" onClick={sincronizar}>Reintentar sincronización</button>
        </p>}
        {cargado && <React.Fragment key={version}><DetalleTym plan={plan} onGuardarPlan={aplicar} equipo={equipo} personaId={personaId}
          personal={personal} usuario={user!} onPendiente={setBloqueado} bloqueado={!!errorSincronizacion}/></React.Fragment>
        }
      </div>

    </div>
  );
}
