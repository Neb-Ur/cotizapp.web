export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export function getCurrentBrowserLocation(): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Este dispositivo no permite obtener la ubicacion.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Debes permitir el acceso a la ubicacion para usar esta funcion.'));
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error('No fue posible determinar tu ubicacion actual.'));
          return;
        }
        reject(new Error('La ubicacion demoro demasiado. Intenta nuevamente.'));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      }
    );
  });
}

export function distanceKm(
  origin: GeoCoordinates,
  destination: GeoCoordinates
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

export function hasValidCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): latitude is number {
  return typeof latitude === 'number'
    && Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && typeof longitude === 'number'
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180;
}


export interface NearbySearchPreference extends GeoCoordinates {
  radiusKm: number;
}

const NEARBY_SEARCH_SESSION_KEY = 'cotizapp-nearby-search';

export function saveNearbySearchPreference(preference: NearbySearchPreference): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(NEARBY_SEARCH_SESSION_KEY, JSON.stringify(preference));
}

export function readNearbySearchPreference(): NearbySearchPreference | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(NEARBY_SEARCH_SESSION_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<NearbySearchPreference>;
    const radiusKm = Number(value.radiusKm);
    if (!hasValidCoordinates(value.latitude, value.longitude) || ![5, 10, 20, 50].includes(radiusKm)) {
      return null;
    }
    return {
      latitude: value.latitude,
      longitude: value.longitude as number,
      radiusKm
    };
  } catch {
    return null;
  }
}

export function clearNearbySearchPreference(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(NEARBY_SEARCH_SESSION_KEY);
}
