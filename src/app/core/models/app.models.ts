export type UserRole = 'maestro' | 'ferreteria' | 'admin';
export type AccountStatus = 'activo' | 'bloqueado' | 'pendiente';

export interface SessionUser {
  id: string;
  ferreteriaId?: string;
  email: string;
  displayName: string;
  role: UserRole;
  accountStatus?: AccountStatus;
  adminValidated?: boolean;
  createdAt?: string;
  phone?: string;
  city?: string;
  commune?: string;
  region?: string;
  businessName?: string;
  rut?: string;
  address?: string;
  storeLatitude?: number;
  storeLongitude?: number;
}

export interface LoginPayload {
  email: string;
  password: string;
  remember: boolean;
}

export interface RegisterPayload {
  role: UserRole;
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  commune: string;
  region: string;
  businessName?: string;
  rut?: string;
  address: string;
  storeLatitude?: number;
  storeLongitude?: number;
}

export interface SearchRow {
  productName: string;
  storeName: string;
  storeId?: string;
  storeLatitude?: number | null;
  storeLongitude?: number | null;
  storeAddress?: string;
  storeCommune?: string;
  price: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  familyId: string;
  familyName: string;
}

export interface SearchFilters {
  query?: string;
  categoryId?: string;
  subcategoryId?: string;
  familyId?: string;
}

export interface SearchProximity {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface TaxonomyOption {
  id: string;
  name: string;
  parentId?: string;
}

export type FamilySpecFieldType = 'text' | 'number' | 'select' | 'textarea';

export interface FamilySpecField {
  id: string;
  label: string;
  type: FamilySpecFieldType;
  required?: boolean;
  options?: string[];
  unitLabel?: string;
  placeholder?: string;
  helperText?: string;
}

export interface FamilyTemplate {
  familyId: string;
  version: number;
  title: string;
  descriptionHint: string;
  usageGuidelines: string[];
  featureSuggestions: string[];
  specFields: FamilySpecField[];
}

export interface FamilyProductRow {
  productName: string;
  imageUrl: string;
  minPrice: number;
  maxPrice: number;
  storeCount: number;
  brand: string;
  productType: string;
  sellers: string[];
  nearestDistanceKm?: number;
}

export interface ProductStoreOfferRow {
  storeName: string;
  price: number;
  stock: number;
  storeId?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  commune?: string;
  distanceKm?: number;
}

export interface ProductTechSpecRow {
  label: string;
  value: string;
}

export interface ProductDescriptionBlock {
  title?: string;
  text: string;
}

export interface ProductExtraSection {
  id: string;
  title: string;
  points: string[];
}

export interface ProductDetailView {
  productName: string;
  imageUrl: string;
  gallery: string[];
  sku: string;
  unitLabel: string;
  packagingLabel: string;
  stock: number;
  brand: string;
  productType: string;
  categoryName: string;
  subcategoryName: string;
  familyName: string;
  description: string;
  shortDescription: string;
  featureBullets: string[];
  descriptionBlocks: ProductDescriptionBlock[];
  technicalSheet: ProductTechSpecRow[];
  extraSections: ProductExtraSection[];
  minPrice: number;
  maxPrice: number;
  stores: ProductStoreOfferRow[];
}

export interface ProjectItem {
  productName: string;
  quantity: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  address?: string;
  proximity?: SearchProximity;
  singleStoreName?: string;
  createdAt: string;
  items: ProjectItem[];
  totalOptimal: number;
  saving: number;
}

export interface ProjectStoreTotal {
  storeName: string;
  total: number;
}

export interface ProjectQuotationLine {
  productName: string;
  quantity: number;
  bestStoreName: string;
  unitPrice: number;
  subtotal: number;
}

export interface ProjectQuotationView {
  lines: ProjectQuotationLine[];
  totalsByStore: ProjectStoreTotal[];
  singleStoreOptions: ProjectStoreTotal[];
  bestStore: ProjectStoreTotal;
  optimalTotal: number;
  mixedTotal: number;
  mixedSaving: number;
  appliedStoreName?: string;
}

export type ProjectComparisonStrategyId = 'cheapest' | 'same-store';

export interface ProjectComparisonStrategy {
  id: ProjectComparisonStrategyId;
  title: string;
  subtitle: string;
  total: number;
  saving?: number;
}

export interface CatalogProduct {
  id: string;
  masterProductId?: string;
  name: string;
  barcode?: string;
  categoryId: string;
  subcategoryId: string;
  familyId: string;
  brand: string;
  productType: string;
  unitLabel: string;
  packagingLabel: string;
  price: number;
  stock: number;
  sku: string;
  imageUrl: string;
  isPublished: boolean;
  shortDescription: string;
  descriptionBlocks: ProductDescriptionBlock[];
  featureBullets: string[];
  technicalSheet: ProductTechSpecRow[];
  extraSections: ProductExtraSection[];
  gallery: string[];
  specValues: Record<string, string>;
  templateVersion: number;
  updatedAt?: string;
}

export type CatalogImportOutcome = 'subido' | 'sin_cambios' | 'fallido' | 'nuevo_validacion' | 'posible_match';
export type CatalogValidationType = 'nuevo_producto' | 'posible_match';
export type CatalogValidationStatus = 'pendiente' | 'aprobado' | 'rechazado';
export type CatalogValidationDecision = 'aprobar_match' | 'aprobar_nuevo' | 'rechazar';

export type ContactRequestStatus = 'pendiente' | 'contactado' | 'cerrado';

export interface ContactRequest {
  id: string;
  type: 'maestro' | 'ferreteria' | 'otro';
  name: string;
  email: string;
  message: string;
  businessName: string;
  phone: string;
  commune: string;
  status: ContactRequestStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CatalogMatchSuggestion {
  masterProductId: string;
  name: string;
  brand: string;
  familyName: string;
  score: number;
}

export interface CatalogImportRowResult {
  lineNumber: number;
  rawLine: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  stock: number;
  outcome: CatalogImportOutcome;
  message: string;
  suggestions: CatalogMatchSuggestion[];
  validationRequestId?: string;
}

export interface CatalogImportReport {
  batchId: string;
  createdAt: string;
  ownerId: string;
  ownerLabel: string;
  totalRows: number;
  uploadedCount: number;
  noChangeCount: number;
  failedCount: number;
  pendingNewCount: number;
  possibleMatchCount: number;
  rows: CatalogImportRowResult[];
}

export interface CatalogValidationRequest {
  id: string;
  batchId: string;
  createdAt: string;
  ownerId: string;
  ownerLabel: string;
  type: CatalogValidationType;
  status: CatalogValidationStatus;
  row: {
    lineNumber: number;
    rawLine: string;
    name: string;
    barcode?: string;
    brand: string;
    sku: string;
    price: number;
    stock: number;
    categoryId: string;
    subcategoryId: string;
    familyId: string;
    unitLabel: string;
  };
  suggestions: CatalogMatchSuggestion[];
  resolution?: {
    action: CatalogValidationDecision;
    selectedMasterProductId?: string;
    decidedAt: string;
    decidedBy?: string;
    adminNote?: string;
  };
}

