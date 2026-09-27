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
  it('solo ofrece como tienda unica ferreterias ya usadas por la compra combinada', () => {
    const result = buildQuotationOptimization(
      [
        { productName: 'Cemento', quantity: 1 },
        { productName: 'OSB', quantity: 1 }
      ],
      [
        { productName: 'Cemento', storeName: 'Ferreteria A', price: 5000, stock: 10 },
        { productName: 'OSB', storeName: 'Ferreteria A', price: 9000, stock: 10 },
        { productName: 'Cemento', storeName: 'Ferreteria B', price: 7000, stock: 10 },
        { productName: 'OSB', storeName: 'Ferreteria B', price: 6000, stock: 10 },
        { productName: 'Cemento', storeName: 'Ferreteria D', price: 6000, stock: 10 },
        { productName: 'OSB', storeName: 'Ferreteria D', price: 7000, stock: 10 }
      ]
    );

    expect(result.lines.map((line) => line.bestStoreName)).toEqual(['Ferreteria A', 'Ferreteria B']);
    expect(result.singleStoreOptions.map((row) => row.storeName)).toEqual(['Ferreteria B', 'Ferreteria A']);
    expect(result.singleStoreOptions.some((row) => row.storeName === 'Ferreteria D')).toBeFalse();
  });

  it('aplica una ferreteria valida a todos los productos de la cotizacion', () => {
    const items = [
      { productName: 'Cemento', quantity: 2 },
      { productName: 'OSB', quantity: 1 }
    ];
    const offers = [
      { productName: 'Cemento', storeName: 'Ferreteria A', price: 5000, stock: 10 },
      { productName: 'OSB', storeName: 'Ferreteria A', price: 9000, stock: 10 },
      { productName: 'Cemento', storeName: 'Ferreteria B', price: 7000, stock: 10 },
      { productName: 'OSB', storeName: 'Ferreteria B', price: 6000, stock: 10 }
    ];

    const result = buildQuotationOptimization(items, offers, 'Ferreteria A');

    expect(result.appliedStoreName).toBe('Ferreteria A');
    expect(result.lines.every((line) => line.bestStoreName === 'Ferreteria A')).toBeTrue();
    expect(result.optimalTotal).toBe(19000);
    expect(result.mixedTotal).toBe(16000);
  });

  it('ignora una tienda aplicada si deja de tener toda la cotizacion disponible', () => {
    const result = buildQuotationOptimization(
      [
        { productName: 'Cemento', quantity: 2 },
        { productName: 'OSB', quantity: 1 }
      ],
      [
        { productName: 'Cemento', storeName: 'Ferreteria A', price: 5000, stock: 10 },
        { productName: 'OSB', storeName: 'Ferreteria A', price: 9000, stock: 0 },
        { productName: 'Cemento', storeName: 'Ferreteria B', price: 7000, stock: 10 },
        { productName: 'OSB', storeName: 'Ferreteria B', price: 6000, stock: 10 }
      ],
      'Ferreteria A'
    );

    expect(result.appliedStoreName).toBeUndefined();
    expect(result.lines.map((line) => line.bestStoreName)).toEqual(['Ferreteria A', 'Ferreteria B']);
  });

});
