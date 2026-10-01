import type { UserRole, ProjectProximity } from '../models/domain.models.js';
export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

export function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function coordinateValue(value: unknown, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function normalizeProjectProximity(value: unknown): ProjectProximity | null {
  const raw = value as Record<string, unknown> | null | undefined;
  if (!raw) return null;

  const latitude = coordinateValue(raw['latitude'] ?? raw['latitud'], -90, 90);
  const longitude = coordinateValue(raw['longitude'] ?? raw['longitud'], -180, 180);
  const radiusKm = numberValue(raw['radiusKm'] ?? raw['radioKm']);

  if (latitude === null || longitude === null || ![5, 10, 20, 50].includes(radiusKm)) return null;
  return { latitude, longitude, radiusKm };
}

export function geographicDistanceKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);
  const deltaLat = toRadians(destination.latitude - origin.latitude);
  const deltaLng = toRadians(destination.longitude - origin.longitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function validRole(value: unknown): value is UserRole {
  return value === 'maestro' || value === 'ferreteria' || value === 'admin';
}

