export interface PlanEtapa {
  id: string;
  label: string;
  peso: number;
  optional?: boolean;
  subs?: string[];
  /** Si falta, hereda el responsable de la actividad. */
  resp?: 'timia' | 'bbva' | 'mixto';
}

export interface PlanActivityStructure {
  id?: string;
  label: string;
  /** @deprecated usar resp; se conserva por compatibilidad. */
  bbva?: boolean;
  resp?: 'timia' | 'bbva' | 'mixto';
  /** Fase del SDA usada al imputar en el Activity Report. */
  faseSDA?: string;
  etapas?: PlanEtapa[];
}

export interface PlanEntregableStructure<A extends PlanActivityStructure = PlanActivityStructure> {
  id: string;
  label: string;
  activities: A[];
}

export interface PlanStructure {
  projectId: string;
  entregables: PlanEntregableStructure[];
}

export const PLAN_CONFIGS_KEY = 'timia_plan_configs';

export function esObjeto(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Los cronogramas tienen totalWeeks; la estructura local T&M no tiene calendario.
export function esEstructuraLocal(value: unknown): value is Record<string, unknown> {
  return esObjeto(value) && !('totalWeeks' in value);
}

export function estructuraValida(value: unknown): value is PlanStructure {
  if (!esObjeto(value) || typeof value.projectId !== 'string' || !Array.isArray(value.entregables)) return false;
  const ids = new Set<string>();
  const responsableValido = (nodo: Record<string, unknown>) =>
    nodo.responsableId === undefined || (typeof nodo.responsableId === 'string' && nodo.responsableId.trim().length > 0);
  const unico = (id: unknown) => {
    if (typeof id !== 'string' || !id || ids.has(id)) return false;
    ids.add(id);
    return true;
  };
  return value.entregables.every(ent =>
    esObjeto(ent) && unico(ent.id) && responsableValido(ent) && typeof ent.label === 'string' && Array.isArray(ent.activities)
    && ent.activities.every(act =>
      esObjeto(act) && unico(act.id) && responsableValido(act) && typeof act.label === 'string'
      && (act.etapas === undefined || (Array.isArray(act.etapas) && act.etapas.every(et =>
        esObjeto(et) && unico(et.id) && responsableValido(et) && typeof et.label === 'string'
        && typeof et.peso === 'number' && Number.isInteger(et.peso) && et.peso >= 0 && et.peso <= 100
      )))
    )
  );
}

export function leerConfiguraciones(): Record<string, unknown> {
  const raw = localStorage.getItem(PLAN_CONFIGS_KEY);
  if (raw === null) return {};
  const value: unknown = JSON.parse(raw);
  if (!esObjeto(value)) throw new Error('Las configuraciones de proyectos guardadas no tienen un formato válido.');
  return value;
}

export function soloCronogramas<T>(value: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(value).filter(([, cfg]) => !esEstructuraLocal(cfg)));
}

export function conservarEstructurasLocales(value: unknown): Record<string, unknown> {
  if (!esObjeto(value)) throw new Error('Las configuraciones recibidas no tienen un formato válido.');
  const locales = Object.entries(leerConfiguraciones()).filter(([, cfg]) => esEstructuraLocal(cfg));
  return { ...value, ...Object.fromEntries(locales) };
}
