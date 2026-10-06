
export type UserRole = 'maestro' | 'ferreteria' | 'admin';
export type ProjectItem = {
  productName: string;
  quantity: number;
  storeId?: string;
  storeName?: string;
  productoFerreteriaId?: string;
  productoMaestroId?: string;
};

export type ProjectProximity = {
  latitude: number;
  longitude: number;
  radiusKm: number;
};

export type SearchRow = {
  productoMaestroId: string;
  productoFerreteriaId: string;
  productName: string;
  storeName: string;
  storeId: string;
  storeLatitude: number | null;
  storeLongitude: number | null;
  storeAddress: string;
  storeCommune: string;
  storeRut: string;
  storeEmail: string;
  storePhone: string;
  price: number;
  priceUpdatedAt: string;
  includesVat: boolean;
  comparisonEligible: boolean;
  includesShipping: boolean;
  validFrom: string;
  validUntil: string | null;
  offerConditions: string;
  sponsored: boolean;
  measurementUnit: 'kg' | 'l' | 'm' | 'm2' | 'm3' | 'unidad' | null;
  measurementQuantity: number | null;
  pricePerMeasurement: number | null;
  measurementSource: 'store_reported' | 'catalog_presentation' | null;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  familyId: string;
  familyName: string;
  stock: number;
  sku: string;
};
