interface MasterCandidate { id: string; masterProductId?: string; name: string; barcode?: string; }
const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-CL');
const normalizeCode = (value?: string) => (value || '').trim().replace(/[\s-]/g, '').toLowerCase();

/** Store SKUs cannot identify a master product; use unique barcode or exact name. */
export function findExactMasterMatch<T extends MasterCandidate>(products: T[], name: string, barcode?: string): T | undefined {
  const code = normalizeCode(barcode);
  const byBarcode = code ? products.filter(product => normalizeCode(product.barcode) === code) : [];
  if (byBarcode.length) return byBarcode.length === 1 ? byBarcode[0] : undefined;
  const byName = products.filter(product => normalizeName(product.name) === normalizeName(name)
    && (!code || !product.barcode || normalizeCode(product.barcode) === code));
  return byName.length === 1 ? byName[0] : undefined;
}
