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

export function pricePerMeasurement(priceValue: unknown, quantityValue: unknown): number | null {
  const price = numberValue(priceValue, 0);
  const quantity = numberValue(quantityValue, 0);
  if (price <= 0 || quantity <= 0) return null;
  return Math.round((price / quantity) * 100) / 100;
}

export function inferMeasurementFromLabel(value: unknown): {
  unit: 'kg' | 'l' | 'm' | 'm2' | 'unidad';
  quantity: number;
} | null {
  const label = normalizeText(value);
  const decimal = (raw: string): number => Number(raw.replace(',', '.'));
  const kilograms = label.match(/([0-9]+(?:[.,][0-9]+)?)\s*kg\b/i);
  if (kilograms) return { unit: 'kg', quantity: decimal(kilograms[1]) };
  const volume = label.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:ml|cc)\b/i);
  if (volume) return { unit: 'l', quantity: decimal(volume[1]) / 1000 };
  const area = label.match(/([0-9]+(?:[.,][0-9]+)?)\s*x\s*([0-9]+(?:[.,][0-9]+)?)\s*m\b/i);
  if (area) return { unit: 'm2', quantity: decimal(area[1]) * decimal(area[2]) };
  const pieces = label.match(/\b(?:caja|bolsa)\s+(?:de\s+)?([0-9]+)\b/i);
  if (pieces) return { unit: 'unidad', quantity: decimal(pieces[1]) };
  const length = label.match(/([0-9]+(?:[.,][0-9]+)?)\s*m\b/i);
  if (length) return { unit: 'm', quantity: decimal(length[1]) };
  return null;
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

export function validStrongPassword(value: unknown): boolean {
  const password = String(value ?? '');
  return password.length >= 12
    && password.length <= 128
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9\s]/.test(password);
}

export function validChileanTaxId(value: unknown): boolean {
  const normalized = normalizeText(value).replace(/[^0-9kK]/g, '').toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(normalized)) return false;
  const body = normalized.slice(0, -1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  const checkDigit = result === 11 ? '0' : result === 10 ? 'K' : String(result);
  return checkDigit === normalized.slice(-1);
}
