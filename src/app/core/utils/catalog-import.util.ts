export interface ParsedCatalogImportRow {
  lineNumber: number;
  rawLine: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  barcode: string;
  valid: boolean;
  error?: string;
}

const HEADER_ALIASES = {
  name: ['nombre', 'producto', 'descripcion', 'descripción', 'item', 'articulo', 'artículo'],
  sku: ['sku', 'codigo', 'código', 'cod', 'codigo producto', 'código producto'],
  price: ['precio', 'precio venta', 'precio_venta', 'valor', 'venta', 'precio unitario'],
  stock: ['stock', 'existencia', 'existencias', 'cantidad', 'disponible'],
  barcode: ['codigo barras', 'código barras', 'codigo de barras', 'código de barras', 'barcode', 'ean', 'ean13']
} as const;

export const CATALOG_IMPORT_COLUMNS = ['nombre', 'sku', 'precio', 'stock', 'codigo_barras'] as const;

export interface CatalogTemplateProductRow {
  name: string;
  sku: string;
  price: number;
  stock: number;
  barcode?: string;
}

export function buildCatalogTemplateRows(products: CatalogTemplateProductRow[] = []): Array<Array<string | number>> {
  return [
    [...CATALOG_IMPORT_COLUMNS],
    ...products.map((product) => [
      product.name,
      product.sku,
      product.price,
      product.stock,
      product.barcode || ''
    ])
  ];
}

export const CATALOG_IMPORT_TEMPLATE = [
  [...CATALOG_IMPORT_COLUMNS],
  ['Cemento Melon 25kg', 'CEM-25', '5490', '80', '7800000000000'],
  ['OSB 11.1mm 122x244', 'OSB-111', '16990', '25', '']
].map((row) => row.join(',')).join('\n');

export function catalogImportTemplateFileName(label?: string): string {
  const normalized = (label || 'catalogo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return `cotizapp-catalogo-${normalized || 'catalogo'}.xlsx`;
}

export async function downloadCatalogImportTemplate(
  fileName = 'cotizapp-catalogo-template.xlsx',
  products: CatalogTemplateProductRow[] = []
): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  // Keep Productos as the first sheet: the importer always reads the first sheet.
  const productSheet = XLSX.utils.aoa_to_sheet(buildCatalogTemplateRows(products));
  productSheet['!cols'] = [
    { wch: 42 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 24 }
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ['Template oficial de catalogo CotizApp'],
    [],
    ['Columna', 'Obligatoria', 'Uso', 'Ejemplo'],
    ['nombre', 'Si', 'Nombre comercial del producto.', 'Cemento Melon 25kg'],
    ['sku', 'No', 'Codigo interno de la ferreteria. Si falta, CotizApp genera uno.', 'CEM-25'],
    ['precio', 'Si', 'Precio de venta en pesos, mayor a 0. Puede venir con $ o separador de miles.', '5490'],
    ['stock', 'No', 'Unidades disponibles. Si se deja vacio se considera 0.', '80'],
    ['codigo_barras', 'No', 'EAN/codigo de barras cuando exista.', '7800000000000'],
    [],
    ['Importante'],
    ['1. No cambies los nombres de las columnas de la hoja Productos.'],
    ['2. Pega un producto por fila y no agregues titulos antes del encabezado.'],
    ['3. Deja vacias las columnas que no tengas; nombre y precio son las unicas obligatorias.'],
    ['4. Sube este mismo archivo desde Admin > Ferreterias o desde el panel de la ferreteria.'],
    ['5. Si el archivo viene con tu catalogo actual, modifica principalmente precio y stock; conserva nombre, SKU y codigo de barras para identificar correctamente cada producto.'],
    ['6. CotizApp relaciona cada fila por SKU, codigo de barras o nombre; si agregas una fila nueva, el producto puede quedar para revision.']
  ]);
  instructionsSheet['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 70 },
    { wch: 28 }
  ];

  XLSX.utils.book_append_sheet(workbook, productSheet, 'Productos');
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instrucciones');

  const normalizedFileName = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, normalizedFileName, { bookType: 'xlsx' });
}

export interface CatalogImportErrorExportRow {
  name: string;
  sku: string;
  price: number;
  stock: number;
  barcode?: string;
  message: string;
}

export async function downloadCatalogImportErrors(
  rows: CatalogImportErrorExportRow[],
  fileName = 'cotizapp-errores-catalogo.xlsx'
): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [...CATALOG_IMPORT_COLUMNS, 'error'],
    ...rows.map((row) => [
      row.name,
      row.sku,
      row.price,
      row.stock,
      row.barcode || '',
      row.message
    ])
  ]);
  sheet['!cols'] = [
    { wch: 42 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 24 },
    { wch: 70 }
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Productos');
  XLSX.writeFile(workbook, fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`, { bookType: 'xlsx' });
}

export async function catalogFileToCsv(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    return file.text();
  }

  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo no contiene hojas para procesar.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n' });
}

export async function parseCatalogImportContent(content: string): Promise<ParsedCatalogImportRow[]> {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

  const XLSX = await import('xlsx');
  const workbook = XLSX.read(trimmed, { type: 'string' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(sheet, {
    header: 1,
    raw: false,
    defval: ''
  });

  const rows = rawRows
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (rows.length === 0) {
    return [];
  }

  const headerMap = resolveHeaderMap(rows[0]);
  const hasHeader = headerMap.name >= 0 && headerMap.price >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const fallbackMap = { name: 0, sku: 1, price: 2, stock: 3, barcode: 4 };
  const map = hasHeader ? headerMap : fallbackMap;

  return dataRows.map((row, index) => {
    const sourceLine = index + (hasHeader ? 2 : 1);
    const name = cell(row, map.name);
    const sku = cell(row, map.sku) || `IMP-${String(sourceLine).padStart(4, '0')}`;
    const rawPrice = cell(row, map.price);
    const rawStock = cell(row, map.stock);
    const price = parseChileanNumber(rawPrice);
    const parsedStock = parseChileanNumber(rawStock);
    const stock = Math.floor(parsedStock);
    const barcode = cell(row, map.barcode);

    let error = '';
    if (!name) {
      error = 'El nombre del producto es obligatorio.';
    } else if (!isNumericField(rawPrice) || price <= 0) {
      error = 'El precio debe ser un numero mayor a 0.';
    } else if (rawStock && !isNumericField(rawStock)) {
      error = 'El stock debe ser un numero valido.';
    } else if (parsedStock < 0) {
      error = 'El stock no puede ser negativo.';
    }

    if (error) {
      return {
        lineNumber: sourceLine,
        rawLine: row.join(' | '),
        name,
        sku,
        price,
        stock,
        barcode,
        valid: false,
        error
      };
    }

    return {
      lineNumber: sourceLine,
      rawLine: row.join(' | '),
      name,
      sku,
      price,
      stock,
      barcode,
      valid: true
    };
  });
}

function resolveHeaderMap(row: string[]): { name: number; sku: number; price: number; stock: number; barcode: number } {
  const normalized = row.map(normalizeHeader);
  return {
    name: findAlias(normalized, HEADER_ALIASES.name),
    sku: findAlias(normalized, HEADER_ALIASES.sku),
    price: findAlias(normalized, HEADER_ALIASES.price),
    stock: findAlias(normalized, HEADER_ALIASES.stock),
    barcode: findAlias(normalized, HEADER_ALIASES.barcode)
  };
}

function findAlias(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((header) => aliases.some((alias) => header === normalizeHeader(alias)));
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function cell(row: string[], index: number): string {
  if (index < 0 || index >= row.length) {
    return '';
  }
  return row[index]?.trim() || '';
}

function isNumericField(value: string): boolean {
  const compact = value.replace(/\$/g, '').replace(/\s/g, '');
  return !!compact && !/[^0-9,.-]/.test(compact) && /\d/.test(compact);
}

function parseChileanNumber(value: string): number {
  const clean = value
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!clean) {
    return 0;
  }

  if (clean.includes('.') && clean.includes(',')) {
    return Number(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }

  if (clean.includes(',')) {
    const decimals = clean.split(',').pop()?.length || 0;
    return decimals <= 2
      ? Number(clean.replace(',', '.')) || 0
      : Number(clean.replace(/,/g, '')) || 0;
  }

  if (/^-?\d{1,3}(\.\d{3})+$/.test(clean)) {
    return Number(clean.replace(/\./g, '')) || 0;
  }

  return Number(clean) || 0;
}
