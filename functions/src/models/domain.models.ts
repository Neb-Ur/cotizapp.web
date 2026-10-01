
export type UserRole = 'maestro' | 'ferreteria' | 'admin';
export type ProjectItem = {
  productName: string;
  quantity: number;
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
  price: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  familyId: string;
  familyName: string;
  stock: number;
  sku: string;
};

