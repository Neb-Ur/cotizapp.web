import { vi, type Mock, type Mocked } from 'vitest';
import { productPath, productSlug } from './product-url.util';

describe('product URL helpers', () => {
  it('creates a stable URL-safe slug in Spanish', () => {
    expect(productSlug('Adhesivo PVC 240 cc – Vinilit')).toBe('adhesivo-pvc-240-cc-vinilit');
    expect(productSlug('Tornillo 1/2"')).toBe('tornillo-1-2');
  });

  it('builds a clean product path', () => {
    expect(productPath('Cemento Melón 25 kg')).toBe('/productos/cemento-melon-25-kg');
    expect(productPath('---')).toBe('/buscar');
  });
});
