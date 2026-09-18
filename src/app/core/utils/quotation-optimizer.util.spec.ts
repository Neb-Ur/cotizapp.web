import { buildQuotationOptimization } from './quotation-optimizer.util';

describe('buildQuotationOptimization', () => {
  it('calcula menor precio combinado y ahorro contra una sola ferreteria', () => {
    const result = buildQuotationOptimization(
      [
        { productName: 'Cemento 25kg', quantity: 10 },
        { productName: 'OSB 11mm', quantity: 5 }
      ],
      [
        { productName: 'Cemento 25kg', storeName: 'Ferreteria A', price: 5000, stock: 100 },
        { productName: 'OSB 11mm', storeName: 'Ferreteria A', price: 18000, stock: 100 },
        { productName: 'Cemento 25kg', storeName: 'Ferreteria B', price: 5500, stock: 100 },
        { productName: 'OSB 11mm', storeName: 'Ferreteria B', price: 15000, stock: 100 }
      ]
    );

    expect(result.optimalTotal).toBe(125000);
    expect(result.bestStore).toEqual({ storeName: 'Ferreteria B', total: 130000 });
    expect(result.mixedSaving).toBe(5000);
    expect(result.lines[0].bestStoreName).toBe('Ferreteria A');
    expect(result.lines[1].bestStoreName).toBe('Ferreteria B');
  });

  it('descarta una tienda que no tiene stock para cubrir la cotizacion completa', () => {
    const result = buildQuotationOptimization(
      [{ productName: 'Cemento 25kg', quantity: 10 }],
      [
        { productName: 'Cemento 25kg', storeName: 'Sin stock', price: 4000, stock: 5 },
        { productName: 'Cemento 25kg', storeName: 'Con stock', price: 5000, stock: 10 }
      ]
    );

    expect(result.optimalTotal).toBe(50000);
    expect(result.bestStore).toEqual({ storeName: 'Con stock', total: 50000 });
    expect(result.mixedSaving).toBe(0);
  });
});
