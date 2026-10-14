import type { VehicleApplication } from './vehicle-application.js';

export type VehicleSearch = { vehicleBrandId?: string; vehicleModelId?: string; vehicleYear?: number };
export function hasVehicleFilter(filter: VehicleSearch): boolean {
  return !!(filter.vehicleBrandId || filter.vehicleModelId || filter.vehicleYear !== undefined);
}
export function matchesVehicle(applications: VehicleApplication[] | undefined, filter: VehicleSearch): boolean {
  if (!hasVehicleFilter(filter)) return true;
  return (applications || []).some(application =>
    (!filter.vehicleBrandId || application.marcaId === filter.vehicleBrandId)
    && (!filter.vehicleModelId || application.modeloId === filter.vehicleModelId)
    && (filter.vehicleYear === undefined || application.anioDesde !== null && application.anioHasta !== null
      && application.anioDesde <= filter.vehicleYear && filter.vehicleYear <= application.anioHasta));
}
export function parseVehicleSearch(query: Record<string, unknown>): VehicleSearch {
  const id = (value: unknown): string => {
    if (value === undefined || value === '') return '';
    if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error('SEARCH_INVALID_VEHICLE');
    return value.trim();
  };
  const vehicleBrandId = id(query['vehiculoMarcaId']);
  const vehicleModelId = id(query['vehiculoModeloId']);
  const rawYear = query['vehiculoAnio'];
  const vehicleYear = rawYear === undefined || rawYear === '' ? undefined : Number(rawYear);
  if (vehicleModelId && !vehicleBrandId || vehicleYear !== undefined && (
    !vehicleModelId || typeof rawYear !== 'string' || !/^\d{4}$/.test(rawYear)
    || !Number.isInteger(vehicleYear) || vehicleYear < 1886 || vehicleYear > 2100)) throw new Error('SEARCH_INVALID_VEHICLE');
  return { vehicleBrandId, vehicleModelId, vehicleYear };
}
