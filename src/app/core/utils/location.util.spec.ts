import { distanceKm, hasValidCoordinates } from './location.util';

describe('location.util', () => {
  it('returns zero for the same coordinates', () => {
    expect(distanceKm(
      { latitude: -33.4489, longitude: -70.6693 },
      { latitude: -33.4489, longitude: -70.6693 }
    )).toBeCloseTo(0, 5);
  });

  it('calculates a plausible distance between nearby Santiago coordinates', () => {
    const distance = distanceKm(
      { latitude: -33.5104, longitude: -70.6053 },
      { latitude: -33.5754, longitude: -70.5838 }
    );

    expect(distance).toBeGreaterThan(7);
    expect(distance).toBeLessThan(8.5);
  });

  it('validates coordinate ranges', () => {
    expect(hasValidCoordinates(-33.45, -70.66)).toBeTrue();
    expect(hasValidCoordinates(95, -70.66)).toBeFalse();
    expect(hasValidCoordinates(-33.45, -190)).toBeFalse();
  });
});
