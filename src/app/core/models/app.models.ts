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
  legalAcceptanceRequired?: boolean;
  privacyProcessingBlocked?: boolean;
  storeAgreementStatus?: 'pendiente' | 'vigente' | 'suspendido' | 'terminado';
  storeAgreementVersion?: string;
  storeAgreementAcceptedAt?: string;
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
  termsAccepted: boolean;
  privacyAcknowledged: boolean;
  ageConfirmed: boolean;
  marketingConsent: boolean;
}

export type PrivacyRequestType = 'access' | 'rectification' | 'deletion' | 'objection' | 'blocking' | 'portability';
export type PrivacyRequestStatus = 'recibida' | 'en_revision' | 'completada' | 'rechazada';

export interface ConsentRecord {
  id: string;
  type: 'terms' | 'privacy_notice' | 'age_declaration' | 'marketing';
  version: string;
  granted: boolean;
  occurredAt: string;
  source: string;
}

export interface PrivacyRequest {
  id: string;
  usuarioId?: string;
  email?: string;
  type: PrivacyRequestType;
  details: string;
  status: PrivacyRequestStatus;
  submittedAt: string;
  acknowledgedAt: string;
  responseDueAt: string;
  blockingDueAt?: string | null;
  resolution?: string | null;
  resolvedAt?: string | null;
}

export interface PrivacyOverview {
  profile: SessionUser;
  currentVersions: { terms: string; privacy: string };
  legalAcceptanceRequired: boolean;
  processingBlocked: boolean;
  marketingConsent: boolean;
  consents: ConsentRecord[];
  requests: PrivacyRequest[];
}

export interface StoreAgreementClause {
  id: string;
  title: string;
  text: string;
}

export interface StoreAgreementOverview {
  version: string;
  effectiveDate: string;
  documentHash: string;
  provider: {
    legalName: string;
    taxId: string;
    address: string;
    legalRepresentative: string;
    legalEmail: string;
  };
  store: {
    id: string;
    legalName: string;
    businessName: string;
    taxId: string;
    address: string;
    commune: string;
    city: string;
    branchName: string;
  };
  clauses: StoreAgreementClause[];
  status: 'pendiente' | 'vigente';
  agreement: {
    id: string;
    aceptadoEn: string;
    firmante?: { nombre?: string; rut?: string; cargo?: string; correo?: string };
  } | null;
}

export type SecurityIncidentSeverity = 'baja' | 'media' | 'alta' | 'critica';
export type SecurityIncidentStatus = 'abierto' | 'contenido' | 'recuperado' | 'cerrado';
export type GovernanceEvidenceType = 'revision_controles' | 'prueba_recuperacion' | 'evaluacion_impacto'
  | 'revision_encargados' | 'revision_accesos' | 'confidencialidad_personal';
export type GovernanceEvidenceOutcome = 'conforme' | 'con_observaciones' | 'no_conforme' | 'no_aplica';

export interface AdminAuditEntry {
  id: string;
  actorId: string;
  actorRole: 'admin';
  action: string;
  method: string;
  path: string;
  statusCode: number;
  outcome: 'success' | 'failure';
  occurredAt: string;
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: SecurityIncidentSeverity;
  status: SecurityIncidentStatus;
  detectedAt: string;
  systems: string[];
  dataCategories: string[];
  affectedPeopleEstimate: number;
  reasonableRisk: boolean | null;
  agencyNotificationRequired: boolean | null;
  containmentActions?: string;
  rootCause?: string;
  lessonsLearned?: string;
  agencyNotifiedAt?: string | null;
  subjectsNotifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface GovernanceEvidence {
  id: string;
  type: GovernanceEvidenceType;
  outcome: GovernanceEvidenceOutcome;
  title: string;
  owner: string;
  performedAt: string;
  nextReviewAt?: string | null;
  notes?: string;
  evidenceUrl?: string;
  createdAt: string;
}

export interface GovernanceSummary {
  openIncidents: number;
  criticalOpenIncidents: number;
  evidenceCount: number;
  auditEventCount: number;
  latestEvidenceByType: Partial<Record<GovernanceEvidenceType, GovernanceEvidence | null>>;
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
  productoMaestroId?: string;
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

export interface ProductSearchPage {
  items: FamilyProductRow[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
  version: string;
}

export interface ProductStoreOfferRow {
  offerId?: string;
  storeName: string;
  price: number;
  stock: number;
  storeId?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  commune?: string;
  distanceKm?: number;
  rut?: string;
  email?: string;
  phone?: string;
  priceUpdatedAt: string;
  includesVat: boolean;
  comparisonEligible: boolean;
  includesShipping: boolean;
  validFrom: string;
  validUntil?: string | null;
  offerConditions: string;
  sponsored: boolean;
  measurementUnit?: 'kg' | 'l' | 'm' | 'm2' | 'unidad' | null;
  measurementQuantity?: number | null;
  pricePerMeasurement?: number | null;
  measurementSource?: 'store_reported' | 'catalog_presentation' | null;
  source: string;
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
  productoMaestroId?: string;
  productName: string;
  imageUrl: string;
  gallery: string[];
  imageDisclosure: string;
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
  comparisonCriteria: string;
}

export interface ProjectItem {
  productName: string;
  quantity: number;
  storeId?: string;
  storeName?: string;
  productoFerreteriaId?: string;
  productoMaestroId?: string;
}

export interface ProjectSummary {
  availabilityStatus?: 'draft' | 'incomplete' | 'ready';
  pricesCheckedAt?: string;
  id: string;
  name: string;
  address?: string;
  proximity?: SearchProximity;
  singleStoreName?: string;
  singleStoreId?: string;
  createdAt: string;
  items: ProjectItem[];
  totalOptimal: number;
  saving: number;
}

export interface ProjectStoreTotal {
  storeId?: string;
  storeName: string;
  total: number;
}

export interface ProjectQuotationLine {
  productName: string;
  quantity: number;
  storeId?: string;
  storeName?: string;
  productoFerreteriaId?: string;
  productoMaestroId?: string;
  bestStoreName: string;
  bestStoreId?: string;
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
  appliedStoreId?: string;
  selectionAvailable?: boolean;
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
  includesVat?: boolean;
  validUntil?: string;
  offerConditions?: string;
  measurementUnit?: 'kg' | 'l' | 'm' | 'm2' | 'unidad' | '';
  measurementQuantity?: number | null;
  imageRights?: {
    sourceType: 'ai_generated' | 'manufacturer_authorized' | 'store_authorized' | 'licensed_stock' | 'original' | 'other' | '';
    provider: string;
    sourceTermsUrl: string;
    authorizationReference: string;
    containsThirdPartyMarks: boolean;
    trademarkAuthorizationReference: string;
    reviewedAt?: string;
  };
  contentRights?: {
    sourceType: 'manufacturer_authorized' | 'store_authorized' | 'licensed' | 'original' | 'ai_assisted_original' | 'public_domain' | 'other' | '';
    sourceUrl: string;
    authorizationReference: string;
    reviewedAt?: string;
  };
}

export type IpReportStatus = 'recibida' | 'en_revision' | 'retiro_preventivo' | 'esperando_respuesta' | 'repuesto' | 'retiro_definitivo' | 'rechazada';

export interface IpReport {
  id: string;
  reference: string;
  claimant: { name: string; email: string; organization?: string; capacity: 'owner' | 'authorized_agent' };
  rightsType: 'copyright' | 'trademark' | 'both';
  contentType: 'product_image' | 'logo' | 'technical_sheet' | 'commercial_description' | 'other';
  targetType: 'store_offer' | 'master_product' | 'store' | 'other';
  targetId?: string | null;
  contentUrl: string;
  originalWorkUrl?: string | null;
  workDescription: string;
  infringementDescription: string;
  status: IpReportStatus;
  publicStatusMessage: string;
  submittedAt: string;
  initialReviewDueAt: string;
  targetResolutionAt: string;
  resolution?: string | null;
  resolvedAt?: string | null;
}

export type PriceReportStatus = 'recibido' | 'en_revision' | 'corregido' | 'no_acreditado';

export interface PriceReport {
  id: string;
  reference: string;
  email: string;
  productName: string;
  storeName: string;
  storeId: string;
  offerId: string;
  contentUrl: string;
  displayedPrice: number;
  observedPrice: number;
  details: string;
  status: PriceReportStatus;
  createdAt: string;
  updatedAt: string;
  resolution?: string | null;
  resolvedAt?: string | null;
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
  legalAcceptance?: {
    termsAccepted: boolean;
    termsVersion: string;
    privacyAcknowledged: boolean;
    privacyVersion: string;
    ageConfirmed: boolean;
    authorityConfirmed: boolean;
    accuracyConfirmed: boolean;
    source: string;
    acceptedAt: string;
  };
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
