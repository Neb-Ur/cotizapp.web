export type UserRole = 'maestro' | 'ferreteria' | 'admin';
export type PreferredContactMethod = 'whatsapp' | 'llamada' | 'email';
export type SubscriptionPlan = 'basico' | 'pro' | 'premium';
export type ProjectStatus = 'pendiente' | 'aceptada' | 'rechazada';
export type AccountStatus = 'activo' | 'bloqueado' | 'pendiente';

export interface SessionUser {
  id: string;
  ferreteriaId?: string;
  email: string;
  displayName: string;
  role: UserRole;
  subscriptionPlan?: SubscriptionPlan;
  accountStatus?: AccountStatus;
  adminValidated?: boolean;
  createdAt?: string;
  legalFullName?: string;
  phone?: string;
  secondaryPhone?: string;
  city?: string;
  commune?: string;
  region?: string;
  businessName?: string;
  rut?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  specialty?: string;
  experienceYears?: number;
  preferredContactMethod?: PreferredContactMethod;
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
  specialty?: string;
  experienceYears?: number;
}

export interface LocationOption {
  id: string;
  name: string;
  regionId?: string;
  cityId?: string;
}

export interface SearchRow {
  productName: string;
  storeName: string;
  price: number;
  distanceKm: number;
  balanceScore: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  familyId: string;
  familyName: string;
}

export type SearchSort = 'precio' | 'cercania' | 'balance';

export interface SearchFilters {
  query?: string;
  categoryId?: string;
  subcategoryId?: string;
  familyId?: string;
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
}

export interface ProductStoreOfferRow {
  storeName: string;
  price: number;
  distanceKm: number;
  stock: number;
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

export interface ProductCoverageConfig {
  quantityInputUnit: string;
  yieldPerPackage: number;
  yieldUnit: 'm2' | 'm3';
  requiresDepthCm?: boolean;
  defaultDepthCm?: number;
  description: string;
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
  coverageConfig?: ProductCoverageConfig;
}

export interface QuotationItem {
  id: string;
  productName: string;
  sku: string;
  storeName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addedAt: string;
}

export interface ProjectItem {
  productName: string;
  quantity: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  address?: string;
  createdAt: string;
  status: ProjectStatus;
  statusUpdatedAt: string;
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
  bestStore: ProjectStoreTotal;
  optimalTotal: number;
  mixedSaving: number;
}

export type ProjectComparisonStrategyId =
  | 'cheapest'
  | 'same-store'
  | 'nearest-user'
  | 'nearest-work';

export interface ProjectComparisonStrategy {
  id: ProjectComparisonStrategyId;
  title: string;
  subtitle: string;
  total: number;
  saving?: number;
  distanceKm?: number;
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
}

export type CatalogImportOutcome = 'subido' | 'fallido' | 'nuevo_validacion' | 'posible_match';
export type CatalogValidationType = 'nuevo_producto' | 'posible_match';
export type CatalogValidationStatus = 'pendiente' | 'aprobado' | 'rechazado';
export type CatalogValidationDecision = 'aprobar_match' | 'aprobar_nuevo' | 'rechazar';

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

export interface AdminUsagePoint {
  label: string;
  activeUsers: number;
  searches: number;
  quotations: number;
  imports: number;
}

export interface AdminMockMetrics {
  generatedAt: string;
  totals: {
    users: number;
    maestros: number;
    ferreterias: number;
    admins: number;
    ferreteriasActivas: number;
    maestrosActivos: number;
    usuariosPendientes: number;
    usuariosBloqueados: number;
  };
  catalog: {
    totalProducts: number;
    publishedProducts: number;
    lowStockProducts: number;
    inventoryValue: number;
  };
  quotations: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  };
  validation: {
    pending: number;
    approved: number;
    rejected: number;
    pendingNewRows: number;
    possibleMatchRows: number;
  };
  usage30d: {
    sessions: number;
    activeUsers: number;
    searches: number;
    quotationEvents: number;
    catalogUpdates: number;
    conversionRate: number;
  };
  topFerreterias: Array<{
    ownerId: string;
    ownerLabel: string;
    publishedProducts: number;
    views: number;
    quotationsEstimate: number;
  }>;
  usageSeries: AdminUsagePoint[];
}
