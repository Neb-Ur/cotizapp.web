export interface VehicleApplication {
  marcaId: string;
  modeloId: string;
  anioDesde: number | null;
  anioHasta: number | null;
  marcaNombre?: string;
  modeloNombre?: string;
}
export const MAX_VEHICLE_APPLICATIONS = 20;
export function normalizeVehicleApplications(value: unknown): VehicleApplication[] {
  if (!Array.isArray(value) || value.length > MAX_VEHICLE_APPLICATIONS) throw new Error('VEHICLE_APPLICATIONS_INVALID');
  const applications = value.map(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.marcaId !== 'string' || !entry.marcaId.trim() || entry.marcaId.length > 200
      || typeof entry.modeloId !== 'string' || !entry.modeloId.trim() || entry.modeloId.length > 200) throw new Error('VEHICLE_APPLICATIONS_INVALID');
    const from = entry.anioDesde ?? null, to = entry.anioHasta ?? null;
    if ((from === null) !== (to === null) || from !== null && (!Number.isInteger(from) || !Number.isInteger(to) || from < 1886 || to > 2100 || from > to)) throw new Error('VEHICLE_APPLICATION_YEARS_INVALID');
    return {marcaId: entry.marcaId.trim(), modeloId: entry.modeloId.trim(), anioDesde: from, anioHasta: to,
      ...(typeof entry.marcaNombre === 'string' ? {marcaNombre: entry.marcaNombre} : {}),
      ...(typeof entry.modeloNombre === 'string' ? {modeloNombre: entry.modeloNombre} : {})};
  });
  for (let i = 0; i < applications.length; i++) for (let j = i + 1; j < applications.length; j++) {
    const a = applications[i], b = applications[j];
    if (a.modeloId === b.modeloId && (a.anioDesde === null || b.anioDesde === null
      || a.anioDesde <= b.anioHasta! && b.anioDesde <= a.anioHasta!)) throw new Error('VEHICLE_APPLICATION_OVERLAP');
  }
  return applications;
}
export function vehicleApplicationsEnabled(storeId: string): boolean {
  return process.env['VEHICLE_APPLICATIONS_ENABLED'] === 'true'
    && (process.env['VEHICLE_APPLICATION_PILOT_STORE_IDS'] || '').split(',').map(id => id.trim()).includes(storeId);
}
