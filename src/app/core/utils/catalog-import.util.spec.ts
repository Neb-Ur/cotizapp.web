import { CATALOG_IMPORT_COLUMNS, catalogImportTemplateFileName, parseCatalogImportContent } from './catalog-import.util';

describe('catalog import template', () => {
  it('mantiene el formato oficial de columnas', () => {
    expect(CATALOG_IMPORT_COLUMNS).toEqual(['nombre', 'sku', 'precio', 'stock', 'codigo_barras']);
  });

  it('genera un nombre de archivo seguro por ferreteria', () => {
    expect(catalogImportTemplateFileName('Ferretería El Ñandú SpA')).toBe('cotizapp-catalogo-ferreteria-el-nandu-spa.xlsx');
  });
});

describe('parseCatalogImportContent', () => {
  it('reconoce encabezados comunes de una ferreteria y numeros chilenos', async () => {
    const rows = await parseCatalogImportContent(
      'producto,codigo,precio venta,existencia,EAN\nCemento 25kg,CEM25,$5.490,80,7800000000000'
    );

    expect(rows.length).toBe(1);
    expect(rows[0]).toEqual(jasmine.objectContaining({
      name: 'Cemento 25kg',
      sku: 'CEM25',
      price: 5490,
      stock: 80,
      barcode: '7800000000000',
      valid: true
    }));
  });

  it('marca como invalida una fila sin nombre o precio valido', async () => {
    const rows = await parseCatalogImportContent(
      'nombre,sku,precio,stock\n,ABC,0,10'
    );

    expect(rows.length).toBe(1);
    expect(rows[0].valid).toBeFalse();
    expect(rows[0].error).toContain('nombre y precio');
  });
});
