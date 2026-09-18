import * as XLSX from 'xlsx';

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

export const CATALOG_IMPORT_TEMPLATE = [
  ['nombre', 'sku', 'precio', 'stock', 'codigo_barras'],
  ['Cemento Melon 25kg', 'CEM-25', '5490', '80', '7800000000000'],
  ['OSB 11.1mm 122x244', 'OSB-111', '16990', '25', '']
].map((row) => row.join(',')).join('\n');

export async function catalogFileToCsv(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    return file.text();
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo no contiene hojas para procesar.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n' });
}

export function parseCatalogImportContent(content: string): ParsedCatalogImportRow[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

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
    const price = parseChileanNumber(cell(row, map.price));
    const stock = Math.max(0, Math.floor(parseChileanNumber(cell(row, map.stock))));
    const barcode = cell(row, map.barcode);

    if (!name || price <= 0) {
      return {
        lineNumber: sourceLine,
        rawLine: row.join(' | '),
        name,
        sku,
        price,
        stock,
        barcode,
        valid: false,
        error: 'La fila debe incluir al menos nombre y precio valido.'
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
