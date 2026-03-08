import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminMockMetrics,
  AdminUsagePoint,
  CatalogImportReport,
  CatalogImportRowResult,
  CatalogProduct,
  CatalogValidationDecision,
  CatalogValidationRequest,
  CatalogValidationStatus,
  CatalogValidationType,
  FamilyProductRow,
  FamilySpecField,
  FamilyTemplate,
  ProductDetailView,
  ProductStoreOfferRow,
  ProjectComparisonStrategy,
  ProjectItem,
  ProjectQuotationView,
  ProjectStatus,
  ProjectSummary,
  SearchFilters,
  SearchRow,
  SearchSort,
  SessionUser,
  SubscriptionPlan,
  TaxonomyOption
} from '../models/app.models';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../config/api.config';

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface PlanCapabilities {
  plan: SubscriptionPlan;
  label: string;
  maxPendingQuotations: number | null;
  hasHistory: boolean;
}

interface StorePlanCapabilities {
  plan: SubscriptionPlan;
  label: string;
  maxCatalogProducts: number | null;
  allowCsvImport: boolean;
  allowAdvancedMetrics: boolean;
}

interface CapacityResponse {
  allowed: boolean;
  limit: number | null;
  message: string;
  pendingCount?: number;
  currentCount?: number;
  remaining?: number | null;
}

interface CatalogMeta {
  ferreteriaId: string;
  productoFerreteriaId: string;
  productoMaestroId: string;
}

interface SearchRowExtended extends SearchRow {
  productoMaestroId: string;
  productoFerreteriaId: string;
  sku: string;
  stock: number;
}

interface MaestroSummary {
  activeProjects: number;
  estimatedSaving: number;
  topSearches: string[];
}

interface FerreteriaMvpMetrics {
  totalProducts: number;
  publishedProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  avgPricePublished: number;
  quotationReach: number;
}

interface ProductoMaestroApi {
  id: string;
  categoriaId: string;
  subcategoriaId: string;
  familiaId: string;
  nombre: string;
  marca: string;
  descripcionCorta?: string;
  descripcionLarga?: string;
  imagenPrincipalUrl?: string;
  galeriaJson?: string[];
}

interface PaginatedMasterCatalogApi {
  items: ProductoMaestroApi[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface TaxonomyDefinitionApi {
  id: string;
  familiaId: string;
  codigo: string;
  etiqueta: string;
  tipoDato: 'texto' | 'numero' | 'seleccion' | 'booleano';
  esFiltrable: boolean;
  esObligatorio: boolean;
  opcionesJson?: string[];
  orden?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MockApiService {
  private readonly apiBaseUrl = API_BASE_URL;

  private readonly maestroPlanCapabilities: Record<SubscriptionPlan, PlanCapabilities> = {
    basico: { plan: 'basico', label: 'Plan Basico', maxPendingQuotations: 1, hasHistory: false },
    pro: { plan: 'pro', label: 'Plan Pro', maxPendingQuotations: 5, hasHistory: true },
    premium: { plan: 'premium', label: 'Plan Premium', maxPendingQuotations: null, hasHistory: true }
  };

  private readonly ferreteriaPlanCapabilities: Record<SubscriptionPlan, StorePlanCapabilities> = {
    basico: { plan: 'basico', label: 'Plan Basico', maxCatalogProducts: 30, allowCsvImport: false, allowAdvancedMetrics: false },
    pro: { plan: 'pro', label: 'Plan Pro', maxCatalogProducts: 200, allowCsvImport: true, allowAdvancedMetrics: true },
    premium: { plan: 'premium', label: 'Plan Premium', maxCatalogProducts: null, allowCsvImport: true, allowAdvancedMetrics: true }
  };

  private readonly categories: TaxonomyOption[] = [];
  private readonly subcategories: TaxonomyOption[] = [];
  private readonly families: TaxonomyOption[] = [];
  private readonly familyTemplates = new Map<string, FamilyTemplate>();
  private readonly familyDefinitionsByFamily = new Map<string, TaxonomyDefinitionApi[]>();

  private readonly masterCatalog: CatalogProduct[] = [];
  private readonly searchRows: SearchRowExtended[] = [];
  private readonly productDetailByName = new Map<string, ProductDetailView>();

  private readonly projectsByOwner = new Map<string, ProjectSummary[]>();
  private readonly catalogByOwner = new Map<string, CatalogProduct[]>();
  private readonly catalogMetaByOwner = new Map<string, Map<string, CatalogMeta>>();
  private readonly ferreteriaIdByOwner = new Map<string, string>();

  private readonly maestroSummaryByOwner = new Map<string, MaestroSummary>();
  private readonly ferreteriaMvpByOwner = new Map<string, FerreteriaMvpMetrics>();
  private readonly pendingQuotaByOwner = new Map<string, CapacityResponse>();
  private readonly catalogCapacityByOwner = new Map<string, CapacityResponse>();

  private readonly importReports: CatalogImportReport[] = [];
  private readonly importRowById = new Map<string, {
    ownerId: string;
    ownerLabel: string;
    batchId: string;
    row: CatalogImportRowResult;
  }>();
  private readonly validationQueue: CatalogValidationRequest[] = [];

  private adminMetrics: AdminMockMetrics = this.emptyAdminMetrics();

  private taxonomyPromise: Promise<void> | null = null;
  private masterPromise: Promise<void> | null = null;
  private searchPromise: Promise<void> | null = null;
  private adminPromise: Promise<void> | null = null;
  private readonly projectsPromiseByOwner = new Map<string, Promise<void>>();
  private readonly catalogPromiseByOwner = new Map<string, Promise<void>>();
  private readonly maestroSummaryPromiseByOwner = new Map<string, Promise<void>>();
  private readonly ferreteriaMvpPromiseByOwner = new Map<string, Promise<void>>();
  private importPromise: Promise<void> | null = null;
  private validationPromise: Promise<void> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {
    this.ensureTaxonomyLoaded();
    this.ensureSearchRowsLoaded();
    this.ensureMasterCatalogLoaded();
  }

  async refreshMaestroData(ownerId: string): Promise<void> {
    await Promise.all([
      this.ensureTaxonomyLoaded(),
      this.ensureSearchRowsLoaded(),
      this.ensureMasterCatalogLoaded(),
      this.ensureProjectsLoaded(ownerId),
      this.ensureMaestroSummaryLoaded(ownerId),
      this.ensurePendingQuotaLoaded(ownerId)
    ]);
  }

  async refreshMaestroOverview(ownerId: string, force = false): Promise<void> {
    await Promise.all([
      this.ensureProjectsLoaded(ownerId, force),
      this.ensureMaestroSummaryLoaded(ownerId, force),
      this.ensurePendingQuotaLoaded(ownerId, force)
    ]);
  }

  async refreshMaestroSearchSection(force = false): Promise<void> {
    await Promise.all([
      this.ensureTaxonomyLoaded(force),
      this.ensureSearchRowsLoaded(force),
      this.ensureMasterCatalogLoaded(force)
    ]);
  }

  async refreshMaestroProjectsSection(ownerId: string, force = false): Promise<void> {
    await Promise.all([
      this.ensureProjectsLoaded(ownerId, force),
      this.ensurePendingQuotaLoaded(ownerId, force)
    ]);
  }

  async refreshMaestroSubscriptionSection(ownerId: string, force = false): Promise<void> {
    await Promise.all([
      this.ensureProjectsLoaded(ownerId, force),
      this.ensurePendingQuotaLoaded(ownerId, force)
    ]);
  }

  async refreshFerreteriaData(ownerId: string): Promise<void> {
    await Promise.all([
      this.ensureTaxonomyLoaded(),
      this.ensureSearchRowsLoaded(),
      this.ensureMasterCatalogLoaded(),
      this.ensureCatalogLoaded(ownerId),
      this.ensureFerreteriaMvpLoaded(ownerId),
      this.ensureCatalogCapacityLoaded(ownerId)
    ]);
  }

  async refreshFerreteriaOverview(ownerId: string, force = false): Promise<void> {
    await Promise.all([
      this.resolveFerreteriaId(ownerId),
      this.ensureFerreteriaMvpLoaded(ownerId, force)
    ]);
  }

  async refreshFerreteriaCatalogSection(ownerId: string, force = false): Promise<void> {
    await Promise.all([
      this.ensureTaxonomyLoaded(force),
      this.ensureCatalogLoaded(ownerId, force)
    ]);
    await this.ensureCatalogCapacityLoaded(ownerId, force);
  }

  async refreshFerreteriaUploadSection(ownerId: string, force = false): Promise<void> {
    await Promise.all([
      this.ensureTaxonomyLoaded(force),
      this.resolveFerreteriaId(ownerId)
    ]);
  }

  async refreshFerreteriaMetricsSection(ownerId: string, force = false): Promise<void> {
    await this.ensureFerreteriaMvpLoaded(ownerId, force);
  }

  async refreshFerreteriaSubscriptionSection(ownerId: string, force = false): Promise<void> {
    await this.ensureCatalogCapacityLoaded(ownerId, force);
  }

  async refreshAdminData(): Promise<void> {
    await Promise.all([
      this.ensureTaxonomyLoaded(),
      this.ensureSearchRowsLoaded(),
      this.ensureMasterCatalogLoaded(),
      this.ensureImportReportsLoaded(),
      this.ensureValidationQueueLoaded(),
      this.ensureAdminMetricsLoaded()
    ]);
  }

  async refreshAdminTaxonomySection(force = false): Promise<void> {
    await this.ensureTaxonomyLoaded(force);
  }

  async refreshAdminProductsSection(force = false): Promise<void> {
    await Promise.all([
      this.ensureTaxonomyLoaded(force),
      this.ensureMasterCatalogLoaded(force)
    ]);
  }

  async refreshAdminRequestsSection(force = false): Promise<void> {
    await this.ensureValidationQueueLoaded(force);
  }

  async refreshAdminImportsSection(force = false): Promise<void> {
    await this.ensureImportReportsLoaded(force);
  }

  async refreshAdminMetricsSection(force = false): Promise<void> {
    await Promise.all([
      this.ensureAdminMetricsLoaded(force),
      this.ensureMasterCatalogLoaded(force)
    ]);
  }

  async refreshAdminSnapshotSection(users: SessionUser[], force = false): Promise<void> {
    await Promise.all([
      this.refreshAdminImportsSection(force),
      this.refreshAdminRequestsSection(force),
      ...users
        .filter((user) => user.role === 'ferreteria')
        .map((user) => this.refreshFerreteriaCatalogSection(user.id, force)),
      ...users
        .filter((user) => user.role === 'maestro')
        .map((user) => this.refreshMaestroProjectsSection(user.id, force))
    ]);
  }

  dashboardByRole(user: SessionUser | null): string {
    if (!user) {
      return '/login';
    }
    if (user.role === 'ferreteria') {
      return '/dashboard/ferreteria';
    }
    if (user.role === 'admin') {
      return '/dashboard/admin/validaciones';
    }
    return '/dashboard/maestro';
  }

  getCategoryOptions(): TaxonomyOption[] {
    this.ensureTaxonomyLoaded();
    return this.categories;
  }

  getSubcategoryOptions(categoryId?: string): TaxonomyOption[] {
    this.ensureTaxonomyLoaded();
    if (!categoryId) {
      return this.subcategories;
    }
    return this.subcategories.filter((item) => item.parentId === categoryId);
  }

  getFamilyOptions(subcategoryId?: string): TaxonomyOption[] {
    this.ensureTaxonomyLoaded();
    if (!subcategoryId) {
      return this.families;
    }
    return this.families.filter((item) => item.parentId === subcategoryId);
  }

  getFamilyTemplate(familyId: string): FamilyTemplate | null {
    this.ensureTaxonomyLoaded();
    return this.familyTemplates.get(familyId) || null;
  }

  getFamilyDefinitionRows(familyId: string): TaxonomyDefinitionApi[] {
    this.ensureTaxonomyLoaded();
    return this.familyDefinitionsByFamily.get(familyId) || [];
  }

  async createCategory(name: string): Promise<TaxonomyOption> {
    const created = await this.apiPost<any>('/categorias', { nombre: name.trim() }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: created.id, name: created.nombre };
  }

  async updateCategory(categoryId: string, name: string): Promise<TaxonomyOption> {
    const updated = await this.apiPatch<any>(`/categorias/${categoryId}`, { nombre: name.trim() }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: updated.id, name: updated.nombre };
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.apiDelete(`/categorias/${categoryId}`, true);
    await this.ensureTaxonomyLoaded(true);
  }

  async createSubcategory(categoryId: string, name: string): Promise<TaxonomyOption> {
    const created = await this.apiPost<any>('/subcategorias', {
      categoriaId: categoryId,
      nombre: name.trim()
    }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: created.id, parentId: created.categoriaId, name: created.nombre };
  }

  async updateSubcategory(subcategoryId: string, categoryId: string, name: string): Promise<TaxonomyOption> {
    const updated = await this.apiPatch<any>(`/subcategorias/${subcategoryId}`, {
      categoriaId: categoryId,
      nombre: name.trim()
    }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: updated.id, parentId: updated.categoriaId, name: updated.nombre };
  }

  async deleteSubcategory(subcategoryId: string): Promise<void> {
    await this.apiDelete(`/subcategorias/${subcategoryId}`, true);
    await this.ensureTaxonomyLoaded(true);
  }

  async createFamily(subcategoryId: string, name: string): Promise<TaxonomyOption> {
    const created = await this.apiPost<any>('/familias', {
      subcategoriaId: subcategoryId,
      nombre: name.trim()
    }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: created.id, parentId: created.subcategoriaId, name: created.nombre };
  }

  async updateFamily(familyId: string, subcategoryId: string, name: string): Promise<TaxonomyOption> {
    const updated = await this.apiPatch<any>(`/familias/${familyId}`, {
      subcategoriaId: subcategoryId,
      nombre: name.trim()
    }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: updated.id, parentId: updated.subcategoriaId, name: updated.nombre };
  }

  async deleteFamily(familyId: string): Promise<void> {
    await this.apiDelete(`/familias/${familyId}`, true);
    await this.ensureTaxonomyLoaded(true);
  }

  async createFamilyDefinition(familyId: string, payload: Omit<TaxonomyDefinitionApi, 'id' | 'familiaId'>): Promise<TaxonomyDefinitionApi> {
    const created = await this.apiPost<TaxonomyDefinitionApi>(`/familias/${familyId}/atributos-definicion`, payload, true);
    await this.ensureTaxonomyLoaded(true);
    return created;
  }

  async updateFamilyDefinition(familyId: string, definitionId: string, payload: Partial<Omit<TaxonomyDefinitionApi, 'id' | 'familiaId'>>): Promise<TaxonomyDefinitionApi> {
    const updated = await this.apiPatch<TaxonomyDefinitionApi>(`/familias/${familyId}/atributos-definicion/${definitionId}`, payload, true);
    await this.ensureTaxonomyLoaded(true);
    return updated;
  }

  async deleteFamilyDefinition(familyId: string, definitionId: string): Promise<void> {
    await this.apiDelete(`/familias/${familyId}/atributos-definicion/${definitionId}`, true);
    await this.ensureTaxonomyLoaded(true);
  }

  getMasterCatalogProducts(): CatalogProduct[] {
    this.ensureMasterCatalogLoaded();
    return this.masterCatalog;
  }

  async searchMasterCatalogProducts(payload: {
    query?: string;
    categoryId?: string;
    subcategoryId?: string;
    familyId?: string;
    excludeMasterProductIds?: string[];
    page?: number;
    size?: number;
  }): Promise<{
    items: CatalogProduct[];
    page: number;
    size: number;
    total: number;
    totalPages: number;
  }> {
    await this.ensureSearchRowsLoaded();

    const raw = await this.apiGet<PaginatedMasterCatalogApi>('/productos-maestro/paginado', false, {
      query: payload.query?.trim() || undefined,
      categoriaId: payload.categoryId || undefined,
      subcategoriaId: payload.subcategoryId || undefined,
      familiaId: payload.familyId || undefined,
      excludeProductoMaestroIds: payload.excludeMasterProductIds?.filter(Boolean).join(',') || undefined,
      page: payload.page || 1,
      size: payload.size || 25
    });

    const items = (raw.items || []).map((product) => {
      const relatedOffers = this.searchRows.filter((row) => row.productoMaestroId === product.id);
      const minPrice = relatedOffers.length > 0
        ? Math.min(...relatedOffers.map((row) => row.price))
        : 0;
      return this.mapMasterProduct(product, minPrice);
    });

    return {
      items,
      page: raw.page || 1,
      size: raw.size || payload.size || 25,
      total: raw.total || 0,
      totalPages: raw.totalPages || 1
    };
  }

  async getMasterCatalogProductDetail(masterProductId: string): Promise<{
    product: CatalogProduct | null;
    attributes: any[];
  }> {
    const raw = await this.apiGet<any>(`/productos-maestro/${masterProductId}`);
    const product = this.mapMasterProduct({
      id: raw.id,
      categoriaId: raw.categoriaId,
      subcategoriaId: raw.subcategoriaId,
      familiaId: raw.familiaId,
      nombre: raw.nombre,
      marca: raw.marca,
      descripcionCorta: raw.descripcionCorta,
      descripcionLarga: raw.descripcionLarga,
      imagenPrincipalUrl: raw.imagenPrincipalUrl,
      galeriaJson: raw.galeriaJson
    }, 0);

    return {
      product: {
        ...product,
        shortDescription: raw.descripcionCorta || '',
        descriptionBlocks: raw.descripcionLarga ? [{ text: raw.descripcionLarga }] : [],
        gallery: Array.isArray(raw.galeriaJson) && raw.galeriaJson.length > 0 ? raw.galeriaJson : product.gallery
      },
      attributes: Array.isArray(raw.atributos) ? raw.atributos : []
    };
  }

  async createMasterCatalogProduct(payload: Partial<CatalogProduct> & {
    descriptionText?: string;
  }): Promise<CatalogProduct> {
    const created = await this.apiPost<any>('/productos-maestro', {
      nombre: payload.name,
      marca: payload.brand,
      categoriaId: payload.categoryId,
      subcategoriaId: payload.subcategoryId,
      familiaId: payload.familyId,
      descripcionCorta: payload.shortDescription || payload.descriptionText,
      descripcionLarga: payload.descriptionBlocks?.[0]?.text || payload.descriptionText,
      imagenPrincipalUrl: payload.imageUrl,
      galeriaJson: payload.gallery || []
    }, true);

    await this.ensureMasterCatalogLoaded(true);
    return this.masterCatalog.find((item) => (item.masterProductId || item.id) === created.id) || this.mapMasterProduct(created, 0);
  }

  async updateMasterCatalogProduct(masterProductId: string, patch: Partial<CatalogProduct> & {
    descriptionText?: string;
    logisticsWeightKg?: number;
    logisticsVolumeM3?: number;
    logisticsPalletUnits?: number;
  }): Promise<CatalogProduct | null> {
    const payload = {
      nombre: patch.name,
      marca: patch.brand,
      categoriaId: patch.categoryId,
      subcategoriaId: patch.subcategoryId,
      familiaId: patch.familyId,
      descripcionCorta: patch.shortDescription || patch.descriptionText,
      descripcionLarga: patch.descriptionBlocks?.[0]?.text || patch.descriptionText,
      imagenPrincipalUrl: patch.imageUrl,
      galeriaJson: patch.gallery
    };

    const cleaned = this.removeUndefined(payload);

    await this.apiPatch(`/productos-maestro/${masterProductId}`, cleaned, true);
    await this.ensureMasterCatalogLoaded(true);
    return this.masterCatalog.find((item) => (item.masterProductId || item.id) === masterProductId) || null;
  }

  async saveMasterProductAttributes(masterProductId: string, rows: Array<{
    definicionAtributoId: string;
    valorTexto?: string | null;
    valorNumero?: number | null;
    valorBooleano?: boolean | null;
    valorOpcion?: string | null;
  }>): Promise<void> {
    await this.apiPut(`/productos-maestro/${masterProductId}/atributos`, rows, true);
  }

  async deleteMasterCatalogProduct(masterProductId: string): Promise<void> {
    await this.apiDelete(`/productos-maestro/${masterProductId}`, true);
    await this.ensureMasterCatalogLoaded(true);
    await this.ensureSearchRowsLoaded(true);
  }

  getCatalog(ownerId: string): CatalogProduct[] {
    const bucket = this.getOrCreateCatalogBucket(ownerId);
    this.ensureCatalogLoaded(ownerId);
    return bucket;
  }

  async upsertCatalog(ownerId: string, payload: CatalogProduct): Promise<CatalogProduct[]> {
    const ferreteriaId = await this.resolveFerreteriaId(ownerId);
    const meta = this.getMeta(ownerId, payload.id);

    if (meta) {
      await this.apiPatch(`/ferreterias/${ferreteriaId}/catalogo/${meta.productoFerreteriaId}`, {
        skuFerreteria: payload.sku,
        codigoBarras: payload.barcode || null,
        precio: payload.price,
        stock: payload.stock,
        activo: payload.isPublished,
        publicado: payload.isPublished
      }, true);

      await this.ensureCatalogLoaded(ownerId, true);
      return this.getCatalog(ownerId);
    }

    const masterId = payload.masterProductId || payload.id;
    if (!masterId || !this.masterCatalog.some((item) => (item.masterProductId || item.id) === masterId)) {
      throw new Error('Solo puedes subir productos que existan en el catalogo maestro.');
    }

    await this.apiPost<any>(`/ferreterias/${ferreteriaId}/catalogo`, {
      productoMaestroId: masterId,
      skuFerreteria: payload.sku || `SKU-${masterId.slice(0, 8).toUpperCase()}`,
      codigoBarras: payload.barcode || null,
      precio: payload.price,
      stock: payload.stock,
      activo: payload.isPublished,
      publicado: payload.isPublished
    }, true);

    await this.ensureCatalogLoaded(ownerId, true);
    return this.getCatalog(ownerId);
  }

  async deleteCatalog(ownerId: string, productId: string): Promise<CatalogProduct[]> {
    const meta = this.getMeta(ownerId, productId);
    if (!meta) {
      return this.getCatalog(ownerId);
    }

    await this.apiDelete(`/ferreterias/${meta.ferreteriaId}/catalogo/${meta.productoFerreteriaId}`, true);
    await this.ensureCatalogLoaded(ownerId, true);
    return this.getCatalog(ownerId);
  }

  async addCatalogProductFromMaster(ownerId: string, masterProductId: string, relation: {
    price: number;
    stock: number;
  }): Promise<{ catalog: CatalogProduct[]; wasUpdate: boolean }> {
    await this.ensureCatalogLoaded(ownerId, true);
    const catalog = this.getCatalog(ownerId);
    const current = catalog.find((item) => (item.masterProductId || item.id) === masterProductId);

    if (current) {
      const updated = await this.upsertCatalog(ownerId, {
        ...current,
        price: relation.price,
        stock: relation.stock,
        isPublished: true
      });
      return { catalog: updated, wasUpdate: true };
    }

    const master = this.masterCatalog.find((item) => (item.masterProductId || item.id) === masterProductId);
    if (!master) {
      throw new Error('No se encontro el producto maestro seleccionado.');
    }

    const sku = master.sku?.trim() || `SKU-${masterProductId.slice(0, 8).toUpperCase()}`;
    try {
      const next = await this.upsertCatalog(ownerId, {
        ...master,
        id: '',
        masterProductId,
        sku,
        price: relation.price,
        stock: relation.stock,
        isPublished: true
      });

      return { catalog: next, wasUpdate: false };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (!message.includes('ya esta vinculado')) {
        throw error;
      }

      await this.ensureCatalogLoaded(ownerId, true);
      const synced = this.getCatalog(ownerId).find((item) => (item.masterProductId || item.id) === masterProductId);
      if (!synced) {
        throw error;
      }

      const updated = await this.upsertCatalog(ownerId, {
        ...synced,
        price: relation.price,
        stock: relation.stock,
        isPublished: true
      });
      return { catalog: updated, wasUpdate: true };
    }
  }

  async addCatalogProductsFromMasterBatch(ownerId: string, relations: Array<{
    masterProductId: string;
    price: number;
    stock: number;
  }>): Promise<{ catalog: CatalogProduct[]; createdCount: number; updatedCount: number }> {
    let createdCount = 0;
    let updatedCount = 0;
    let latestCatalog = this.getCatalog(ownerId);

    for (const relation of relations) {
      const result = await this.addCatalogProductFromMaster(ownerId, relation.masterProductId, {
        price: relation.price,
        stock: relation.stock
      });
      latestCatalog = result.catalog;
      if (result.wasUpdate) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    return {
      catalog: latestCatalog,
      createdCount,
      updatedCount
    };
  }

  async requestCatalogProductCreation(ownerId: string, _ownerLabel: string, draft: {
    name: string;
    barcode: string;
    quantity: number;
    price: number;
  }): Promise<{ id: string; type: CatalogValidationType }> {
    const ferreteriaId = await this.resolveFerreteriaId(ownerId);

    const maybeMatch = this.masterCatalog.some((item) => {
      const barcodeMatches = this.normalizeBarcode(item.barcode || '') === this.normalizeBarcode(draft.barcode);
      const nameMatches = item.name.toLowerCase().includes(draft.name.trim().toLowerCase());
      return barcodeMatches || nameMatches;
    });

    const created = await this.apiPost<{ id: string }>(`/ferreterias/${ferreteriaId}/solicitudes-creacion-producto`, {
      nombreProducto: draft.name.trim(),
      codigoBarras: draft.barcode.trim(),
      cantidadReferencia: Math.max(1, Math.floor(Number(draft.quantity) || 1)),
      precioReferencia: Math.max(1, Math.round(Number(draft.price) || 0))
    }, true);

    return {
      id: created.id,
      type: maybeMatch ? 'posible_match' : 'nuevo_producto'
    };
  }

  async importCatalogBatch(
    ownerId: string,
    ownerLabel: string,
    csvContent: string,
    _plan: SubscriptionPlan,
    _defaults: {
      categoryId: string;
      subcategoryId: string;
      familyId: string;
      brand: string;
      unitLabel: string;
      isPublished: boolean;
    }
  ): Promise<{ catalog: CatalogProduct[]; report: CatalogImportReport }> {
    await Promise.all([
      this.ensureTaxonomyLoaded(),
      this.ensureMasterCatalogLoaded(true),
      this.ensureCatalogLoaded(ownerId, true)
    ]);

    const ferreteriaId = await this.resolveFerreteriaId(ownerId);
    const parsedRows = this.parseCatalogCsv(csvContent);
    const reportRows: CatalogImportRowResult[] = [];

    for (const parsed of parsedRows) {
      if (!parsed.valid) {
        reportRows.push({
          lineNumber: parsed.lineNumber,
          rawLine: parsed.rawLine,
          name: parsed.name,
          sku: parsed.sku,
          price: parsed.price,
          stock: parsed.stock,
          outcome: 'fallido',
          message: parsed.error || 'Fila invalida.',
          suggestions: []
        });
        continue;
      }

      const suggestions = this.suggestMatches(parsed.name);
      const firstMatch = suggestions[0];
      if (!firstMatch) {
        const fallbackBarcode = parsed.barcode || `sol-${String(parsed.lineNumber).padStart(8, '0')}`;
        const created = await this.requestCatalogProductCreation(ownerId, ownerLabel, {
          name: parsed.name,
          barcode: fallbackBarcode,
          quantity: parsed.stock,
          price: parsed.price
        });

        reportRows.push({
          lineNumber: parsed.lineNumber,
          rawLine: parsed.rawLine,
          name: parsed.name,
          sku: parsed.sku,
          price: parsed.price,
          stock: parsed.stock,
          outcome: 'nuevo_validacion',
          message: 'Enviado a revision de catalogo maestro.',
          suggestions: [],
          validationRequestId: created.id
        });
        continue;
      }

      await this.addCatalogProductFromMaster(ownerId, firstMatch.masterProductId, {
        price: parsed.price,
        stock: parsed.stock
      });

      reportRows.push({
        lineNumber: parsed.lineNumber,
        rawLine: parsed.rawLine,
        name: parsed.name,
        sku: parsed.sku,
        price: parsed.price,
        stock: parsed.stock,
        outcome: 'subido',
        message: 'Producto vinculado al catalogo de la ferreteria.',
        suggestions
      });
    }

    await this.ensureCatalogLoaded(ownerId, true);

    const report: CatalogImportReport = {
      batchId: `batch-${this.createLocalId('imp')}`,
      createdAt: new Date().toISOString(),
      ownerId: ferreteriaId,
      ownerLabel,
      totalRows: reportRows.length,
      uploadedCount: reportRows.filter((row) => row.outcome === 'subido').length,
      failedCount: reportRows.filter((row) => row.outcome === 'fallido').length,
      pendingNewCount: reportRows.filter((row) => row.outcome === 'nuevo_validacion').length,
      possibleMatchCount: reportRows.filter((row) => row.outcome === 'posible_match').length,
      rows: reportRows
    };

    this.importReports.unshift(report);
    return {
      catalog: this.getCatalog(ownerId),
      report
    };
  }

  getCatalogImportReports(ownerId: string | 'all' = 'all'): CatalogImportReport[] {
    this.ensureImportReportsLoaded();
    if (ownerId === 'all') {
      return this.importReports;
    }

    const ferreteriaId = this.ferreteriaIdByOwner.get(ownerId);
    if (!ferreteriaId) {
      return this.importReports.filter((item) => item.ownerId === ownerId);
    }
    return this.importReports.filter((item) => item.ownerId === ferreteriaId);
  }

  getCatalogValidationQueue(status: CatalogValidationStatus | 'all' = 'pendiente'): CatalogValidationRequest[] {
    this.ensureValidationQueueLoaded();
    if (status === 'all') {
      return this.validationQueue;
    }
    return this.validationQueue.filter((item) => item.status === status);
  }

  async resolveCatalogValidationRequest(
    requestId: string,
    action: CatalogValidationDecision,
    options?: {
      selectedMasterProductId?: string;
      adminId?: string;
      adminNote?: string;
      masterDraft?: {
        name?: string;
        barcode?: string;
        brand?: string;
        productType?: string;
        categoryId?: string;
        subcategoryId?: string;
        familyId?: string;
        unitLabel?: string;
        packagingLabel?: string;
        shortDescription?: string;
        descriptionText?: string;
        imageUrl?: string;
        gallery?: string[];
        featureBullets?: string[];
        attributes?: Array<{
          definicionAtributoId: string;
          valorTexto?: string | null;
          valorNumero?: number | null;
          valorBooleano?: boolean | null;
          valorOpcion?: string | null;
        }>;
      };
    }
  ): Promise<CatalogValidationRequest | null> {
    let suggestedMasterProductId = options?.selectedMasterProductId;

    if (action === 'aprobar_nuevo' && options?.masterDraft?.name && options.masterDraft.categoryId && options.masterDraft.subcategoryId && options.masterDraft.familyId) {
      const created = await this.apiPost<{ id: string }>('/productos-maestro', {
        nombre: options.masterDraft.name,
        marca: options.masterDraft.brand || 'Sin marca',
        categoriaId: options.masterDraft.categoryId,
        subcategoriaId: options.masterDraft.subcategoryId,
        familiaId: options.masterDraft.familyId,
        descripcionCorta: options.masterDraft.shortDescription || options.masterDraft.descriptionText || '',
        descripcionLarga: options.masterDraft.descriptionText || '',
        imagenPrincipalUrl: options.masterDraft.imageUrl || '',
        galeriaJson: options.masterDraft.gallery || []
      }, true);

      suggestedMasterProductId = created.id;

      if (options.masterDraft.attributes && options.masterDraft.attributes.length > 0) {
        await this.saveMasterProductAttributes(created.id, options.masterDraft.attributes);
      }

      await this.ensureMasterCatalogLoaded(true);
    }

    await this.apiPost(`/solicitudes-creacion-producto/${requestId}/resolver`, {
      accion: action === 'rechazar' ? 'rechazar' : 'aprobar',
      productoMaestroSugeridoId: suggestedMasterProductId,
      notaAdmin: options?.adminNote || ''
    }, true);

    await this.ensureValidationQueueLoaded(true);
    return this.validationQueue.find((item) => item.id === requestId) || null;
  }

  getProjects(ownerId: string): ProjectSummary[] {
    const bucket = this.getOrCreateProjectsBucket(ownerId);
    this.ensureProjectsLoaded(ownerId);
    return bucket;
  }

  getProjectsByStatus(ownerId: string, statuses: ProjectStatus | ProjectStatus[]): ProjectSummary[] {
    const expected = Array.isArray(statuses) ? statuses : [statuses];
    return this.getProjects(ownerId).filter((item) => expected.includes(item.status));
  }

  getProjectById(ownerId: string, projectId: string): ProjectSummary | null {
    return this.getProjects(ownerId).find((item) => item.id === projectId) || null;
  }

  async saveProject(
    ownerId: string,
    name: string,
    items: ProjectItem[],
    address = '',
    _plan?: SubscriptionPlan
  ): Promise<ProjectSummary> {
    const created = await this.apiPost<any>(`/maestros/${ownerId}/proyectos`, {
      nombre: name.trim(),
      direccionObra: address.trim(),
      items: items.map((item) => ({
        productName: item.productName.trim(),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 0))
      }))
    }, true);

    const summary = this.mapProjectRow(created);
    this.upsertProjectBucket(this.getOrCreateProjectsBucket(ownerId), summary);
    this.invalidateMaestroState(ownerId);
    return summary;
  }

  async updateProject(ownerId: string, projectId: string, name: string, items: ProjectItem[], address = ''): Promise<ProjectSummary | null> {
    try {
      const updated = await this.apiPut<any>(`/maestros/${ownerId}/proyectos/${projectId}`, {
        nombre: name.trim(),
        direccionObra: address.trim(),
        items: items.map((item) => ({
          productName: item.productName.trim(),
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 0))
        }))
      }, true);

      const summary = this.mapProjectRow(updated);
      this.upsertProjectBucket(this.getOrCreateProjectsBucket(ownerId), summary);
      this.invalidateMaestroState(ownerId);
      return summary;
    } catch {
      return null;
    }
  }

  async addItemToProject(ownerId: string, projectId: string, item: ProjectItem): Promise<ProjectSummary | null> {
    try {
      const updated = await this.apiPost<any>(`/maestros/${ownerId}/proyectos/${projectId}/items`, {
        productName: item.productName.trim(),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 0))
      }, true);

      const summary = this.mapProjectRow(updated);
      this.upsertProjectBucket(this.getOrCreateProjectsBucket(ownerId), summary);
      this.invalidateMaestroState(ownerId);
      return summary;
    } catch {
      return null;
    }
  }

  async updateProjectStatus(ownerId: string, projectId: string, status: ProjectStatus): Promise<ProjectSummary | null> {
    try {
      const updated = await this.apiPatch<any>(`/maestros/${ownerId}/proyectos/${projectId}/estado`, {
        estado: status
      }, true);

      const summary = this.mapProjectRow(updated);
      this.upsertProjectBucket(this.getOrCreateProjectsBucket(ownerId), summary);
      this.invalidateMaestroState(ownerId);
      return summary;
    } catch {
      return null;
    }
  }

  async deleteProject(ownerId: string, projectId: string): Promise<ProjectSummary[]> {
    await this.apiDelete(`/maestros/${ownerId}/proyectos/${projectId}`, true);
    await this.ensureProjectsLoaded(ownerId, true);
    this.invalidateMaestroState(ownerId);
    return this.getProjects(ownerId);
  }

  getMaestroSummary(ownerId: string): MaestroSummary {
    this.ensureMaestroSummaryLoaded(ownerId);
    return this.maestroSummaryByOwner.get(ownerId) || {
      activeProjects: this.getProjectsByStatus(ownerId, 'pendiente').length,
      estimatedSaving: 0,
      topSearches: []
    };
  }

  getFerreteriaMvpMetrics(ownerId: string): FerreteriaMvpMetrics {
    this.ensureFerreteriaMvpLoaded(ownerId);
    return this.ferreteriaMvpByOwner.get(ownerId) || {
      totalProducts: this.getCatalog(ownerId).length,
      publishedProducts: this.getCatalog(ownerId).filter((item) => item.isPublished).length,
      lowStockProducts: this.getCatalog(ownerId).filter((item) => item.stock > 0 && item.stock < 15).length,
      outOfStockProducts: this.getCatalog(ownerId).filter((item) => item.stock === 0).length,
      avgPricePublished: 0,
      quotationReach: 0
    };
  }

  getAdminMockMetrics(): AdminMockMetrics {
    this.ensureAdminMetricsLoaded();
    return this.adminMetrics;
  }

  getFamilyProductRows(familyId: string, searchTerm = ''): FamilyProductRow[] {
    this.ensureSearchRowsLoaded();
    this.ensureMasterCatalogLoaded();

    const query = searchTerm.trim().toLowerCase();
    const byProduct = new Map<string, {
      productName: string;
      minPrice: number;
      maxPrice: number;
      sellers: Set<string>;
      brand: string;
      productType: string;
      imageUrl: string;
    }>();

    this.searchRows
      .filter((row) => !familyId || row.familyId === familyId)
      .filter((row) => !query || row.productName.toLowerCase().includes(query))
      .forEach((row) => {
        const master = this.masterCatalog.find((item) => item.name.toLowerCase() === row.productName.toLowerCase());
        const current = byProduct.get(row.productName) || {
          productName: row.productName,
          minPrice: row.price,
          maxPrice: row.price,
          sellers: new Set<string>(),
          brand: master?.brand || 'Sin marca',
          productType: master?.productType || 'Producto ferretero',
          imageUrl: master?.imageUrl || 'https://via.placeholder.com/600x420?text=Producto'
        };

        current.minPrice = Math.min(current.minPrice, row.price);
        current.maxPrice = Math.max(current.maxPrice, row.price);
        current.sellers.add(row.storeName);
        byProduct.set(row.productName, current);
      });

    return Array.from(byProduct.values())
      .map((item) => ({
        productName: item.productName,
        imageUrl: item.imageUrl,
        minPrice: item.minPrice,
        maxPrice: item.maxPrice,
        storeCount: item.sellers.size,
        brand: item.brand,
        productType: item.productType,
        sellers: Array.from(item.sellers)
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }

  getPopularProductRows(searchTerm = '', limit = 12): FamilyProductRow[] {
    const rows = this.getFamilyProductRows('', searchTerm);
    return rows
      .sort((a, b) => b.storeCount - a.storeCount || a.productName.localeCompare(b.productName))
      .slice(0, Math.max(1, limit));
  }

  getProductOptions(filters: SearchFilters = {}): string[] {
    this.ensureSearchRowsLoaded();
    return Array.from(new Set(
      this.searchRows
        .filter((row) => !filters.categoryId || row.categoryId === filters.categoryId)
        .filter((row) => !filters.subcategoryId || row.subcategoryId === filters.subcategoryId)
        .filter((row) => !filters.familyId || row.familyId === filters.familyId)
        .map((row) => row.productName)
    )).sort((a, b) => a.localeCompare(b));
  }

  async loadProductDetail(productName?: string): Promise<ProductDetailView | null> {
    this.ensureSearchRowsLoaded();
    this.ensureMasterCatalogLoaded();

    const selectedName = productName?.trim() || this.searchRows[0]?.productName || this.masterCatalog[0]?.name || '';
    if (!selectedName) {
      return null;
    }

    const key = selectedName.toLowerCase();
    if (this.productDetailByName.has(key)) {
      return this.productDetailByName.get(key) || null;
    }

    try {
      const raw = await this.apiGet<any>('/productos/detalle', false, {
        producto: selectedName
      });

      const master = raw.productoMaestro;
      const stores: ProductStoreOfferRow[] = (raw.stores || []).map((store: any) => ({
        storeName: store.storeName,
        price: Number(store.price) || 0,
        distanceKm: Number(store.distanceKm) || 0,
        stock: Number(store.stock) || 0
      }));

      const detail: ProductDetailView = {
        productName: master.nombre,
        imageUrl: master.imagenPrincipalUrl || 'https://via.placeholder.com/600x420?text=Producto',
        gallery: Array.isArray(master.galeriaJson) && master.galeriaJson.length > 0
          ? master.galeriaJson
          : [master.imagenPrincipalUrl || 'https://via.placeholder.com/600x420?text=Producto'],
        sku: raw.stores?.[0]?.sku || '',
        unitLabel: 'Unidad',
        packagingLabel: 'Unidad',
        stock: stores.reduce((acc, item) => acc + item.stock, 0),
        brand: master.marca || 'Sin marca',
        productType: master.descripcionCorta || 'Producto ferretero',
        categoryName: this.categories.find((item) => item.id === master.categoriaId)?.name || 'Sin categoria',
        subcategoryName: this.subcategories.find((item) => item.id === master.subcategoriaId)?.name || 'Sin subcategoria',
        familyName: this.families.find((item) => item.id === master.familiaId)?.name || 'Sin familia',
        description: master.descripcionLarga || master.descripcionCorta || '',
        shortDescription: master.descripcionCorta || '',
        featureBullets: [master.descripcionCorta || ''],
        descriptionBlocks: [{ text: master.descripcionLarga || master.descripcionCorta || '' }],
        technicalSheet: (raw.atributosProducto || []).map((item: any) => ({
          label: item.definicionAtributoId,
          value: String(item.valorTexto || item.valorNumero || item.valorOpcion || item.valorBooleano || '')
        })),
        extraSections: [],
        minPrice: Number(raw.minPrice) || 0,
        maxPrice: Number(raw.maxPrice) || 0,
        stores
      };

      this.productDetailByName.set(key, detail);
      return detail;
    } catch {
      return null;
    }
  }

  getProductDetail(productName?: string): ProductDetailView | null {
    if (!productName?.trim()) {
      return this.productDetailByName.values().next().value || null;
    }

    const key = productName.trim().toLowerCase();
    const cached = this.productDetailByName.get(key) || null;
    if (!cached) {
      void this.loadProductDetail(productName);
    }
    return cached;
  }

  getBestOfferForProduct(productName: string): { storeName: string; price: number } | null {
    this.ensureSearchRowsLoaded();

    const rows = this.searchRows
      .filter((row) => row.productName.toLowerCase() === productName.toLowerCase())
      .sort((a, b) => a.price - b.price || a.distanceKm - b.distanceKm);

    if (rows.length === 0) {
      return null;
    }

    return {
      storeName: rows[0].storeName,
      price: rows[0].price
    };
  }

  buildProjectQuotation(items: ProjectItem[]): ProjectQuotationView {
    this.ensureSearchRowsLoaded();

    const lines = items
      .filter((item) => item.productName.trim())
      .map((item) => {
        const best = this.searchRows
          .filter((row) => row.productName.toLowerCase() === item.productName.trim().toLowerCase())
          .sort((a, b) => a.price - b.price)[0];

        const unitPrice = best?.price || 0;
        const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));

        return {
          productName: item.productName,
          quantity,
          bestStoreName: best?.storeName || 'Sin datos',
          unitPrice,
          subtotal: unitPrice * quantity
        };
      });

    const totalsMap = new Map<string, number>();
    lines.forEach((line) => {
      totalsMap.set(line.bestStoreName, (totalsMap.get(line.bestStoreName) || 0) + line.subtotal);
    });

    const totalsByStore = Array.from(totalsMap.entries()).map(([storeName, total]) => ({ storeName, total }));
    const bestStore = [...totalsByStore].sort((a, b) => a.total - b.total)[0] || {
      storeName: 'Sin datos',
      total: 0
    };

    return {
      lines,
      totalsByStore,
      bestStore,
      optimalTotal: lines.reduce((acc, line) => acc + line.subtotal, 0),
      mixedSaving: 0
    };
  }

  getProjectComparisonStrategies(items: ProjectItem[], _projectAddress = ''): ProjectComparisonStrategy[] {
    const quotation = this.buildProjectQuotation(items);
    return [
      {
        id: 'cheapest',
        title: 'Tienda mas barata',
        subtitle: quotation.bestStore.storeName,
        total: quotation.bestStore.total,
        saving: 0
      },
      {
        id: 'same-store',
        title: 'Todo en la misma tienda',
        subtitle: quotation.bestStore.storeName,
        total: quotation.bestStore.total
      }
    ];
  }

  getPlanCapabilities(plan: SubscriptionPlan): PlanCapabilities {
    return this.maestroPlanCapabilities[plan] || this.maestroPlanCapabilities.basico;
  }

  getFerreteriaPlanCapabilities(plan: SubscriptionPlan): StorePlanCapabilities {
    return this.ferreteriaPlanCapabilities[plan] || this.ferreteriaPlanCapabilities.basico;
  }

  canCreatePendingProject(ownerId: string, plan: SubscriptionPlan): {
    allowed: boolean;
    pendingCount: number;
    limit: number | null;
    remaining: number | null;
    message: string;
  } {
    this.ensurePendingQuotaLoaded(ownerId);

    const remote = this.pendingQuotaByOwner.get(ownerId);
    if (remote) {
      return {
        allowed: remote.allowed,
        pendingCount: remote.pendingCount || 0,
        limit: remote.limit,
        remaining: remote.remaining ?? null,
        message: remote.message || ''
      };
    }

    const pendingCount = this.getProjectsByStatus(ownerId, 'pendiente').length;
    const capabilities = this.getPlanCapabilities(plan);
    const limit = capabilities.maxPendingQuotations;

    if (limit !== null && pendingCount >= limit) {
      return {
        allowed: false,
        pendingCount,
        limit,
        remaining: 0,
        message: `Tu ${capabilities.label} permite ${limit} cotizacion(es) pendiente(s).`
      };
    }

    return {
      allowed: true,
      pendingCount,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - pendingCount),
      message: ''
    };
  }

  canAddCatalogProduct(ownerId: string, plan: SubscriptionPlan): {
    allowed: boolean;
    currentCount: number;
    limit: number | null;
    message: string;
  } {
    this.ensureCatalogCapacityLoaded(ownerId);

    const remote = this.catalogCapacityByOwner.get(ownerId);
    if (remote) {
      return {
        allowed: remote.allowed,
        currentCount: remote.currentCount || 0,
        limit: remote.limit,
        message: remote.message || ''
      };
    }

    const currentCount = this.getCatalog(ownerId).length;
    const capabilities = this.getFerreteriaPlanCapabilities(plan);
    const limit = capabilities.maxCatalogProducts;

    if (limit !== null && currentCount >= limit) {
      return {
        allowed: false,
        currentCount,
        limit,
        message: `Tu ${capabilities.label} permite hasta ${limit} productos en catalogo.`
      };
    }

    return {
      allowed: true,
      currentCount,
      limit,
      message: ''
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number.isFinite(value) ? value : 0);
  }

  resolveStoreDistance(storeName: string, baseDistanceKm: number, address = ''): number {
    const hash = this.hashCode(`${storeName}-${address}`);
    const adjustment = ((hash % 20) - 10) / 10;
    const resolved = baseDistanceKm + adjustment;
    return Number(Math.max(0.4, resolved).toFixed(1));
  }

  private ensureTaxonomyLoaded(force = false): Promise<void> {
    if (!force && this.taxonomyPromise) {
      return this.taxonomyPromise;
    }

    this.taxonomyPromise = (async () => {
      try {
        const [categories, subcategories, families] = await Promise.all([
          this.apiGet<any[]>('/categorias'),
          this.apiGet<any[]>('/subcategorias'),
          this.apiGet<any[]>('/familias')
        ]);

        this.replaceArray(this.categories, categories.map((item) => ({ id: item.id, name: item.nombre })));
        this.replaceArray(this.subcategories, subcategories.map((item) => ({ id: item.id, parentId: item.categoriaId, name: item.nombre })));
        this.replaceArray(this.families, families.map((item) => ({ id: item.id, parentId: item.subcategoriaId, name: item.nombre })));
        this.familyDefinitionsByFamily.clear();

        await Promise.all(this.families.map(async (family) => {
          try {
            const definitions = await this.apiGet<any[]>(`/familias/${family.id}/atributos-definicion`);
            this.familyDefinitionsByFamily.set(family.id, definitions as TaxonomyDefinitionApi[]);
            this.familyTemplates.set(family.id, this.mapFamilyTemplate(family.id, family.name, definitions));
          } catch {
            this.familyDefinitionsByFamily.set(family.id, []);
            this.familyTemplates.set(family.id, this.mapFamilyTemplate(family.id, family.name, []));
          }
        }));
      } catch {
        // noop
      }
    })();

    return this.taxonomyPromise;
  }

  private ensureSearchRowsLoaded(force = false): Promise<void> {
    if (!force && this.searchPromise) {
      return this.searchPromise;
    }

    this.searchPromise = (async () => {
      try {
        const rows = await this.apiGet<any[]>('/busqueda', false, { sort: 'precio' });
        this.replaceArray(this.searchRows, rows.map((item) => ({
          productName: item.productName,
          storeName: item.storeName,
          price: Number(item.price) || 0,
          distanceKm: Number(item.distanceKm) || 0,
          balanceScore: Number(item.balanceScore) || 0,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          subcategoryId: item.subcategoryId,
          subcategoryName: item.subcategoryName,
          familyId: item.familyId,
          familyName: item.familyName,
          productoMaestroId: item.productoMaestroId,
          productoFerreteriaId: item.productoFerreteriaId,
          sku: item.sku,
          stock: Number(item.stock) || 0
        })));
      } catch {
        // noop
      }
    })();

    return this.searchPromise;
  }

  private ensureMasterCatalogLoaded(force = false): Promise<void> {
    if (!force && this.masterPromise) {
      return this.masterPromise;
    }

    this.masterPromise = (async () => {
      try {
        await Promise.all([this.ensureTaxonomyLoaded(), this.ensureSearchRowsLoaded()]);
        const products = await this.apiGet<ProductoMaestroApi[]>('/productos-maestro');

        const rows = await Promise.all(products.map(async (product) => {
          const relatedOffers = this.searchRows.filter((row) => row.productoMaestroId === product.id);
          const minPrice = relatedOffers.length > 0
            ? Math.min(...relatedOffers.map((row) => row.price))
            : 0;

          return this.mapMasterProduct(product, minPrice);
        }));

        this.replaceArray(this.masterCatalog, rows.sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        // noop
      }
    })();

    return this.masterPromise;
  }

  private ensureProjectsLoaded(ownerId: string, force = false): Promise<void> {
    const existing = this.projectsPromiseByOwner.get(ownerId);
    if (!force && existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const rows = await this.apiGet<any[]>(`/maestros/${ownerId}/proyectos`, true);
        const mapped = rows.map((item) => this.mapProjectRow(item));
        this.replaceArray(this.getOrCreateProjectsBucket(ownerId), mapped);
      } catch {
        this.getOrCreateProjectsBucket(ownerId);
      }
    })();

    this.projectsPromiseByOwner.set(ownerId, promise);
    return promise;
  }

  private ensureCatalogLoaded(ownerId: string, force = false): Promise<void> {
    const existing = this.catalogPromiseByOwner.get(ownerId);
    if (!force && existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const ferreteriaId = await this.resolveFerreteriaId(ownerId);
        const rows = await this.apiGet<any[]>(`/ferreterias/${ferreteriaId}/catalogo`, true);
        const mapped = rows.map((item) => this.mapCatalogRow(ownerId, ferreteriaId, item));
        this.replaceArray(this.getOrCreateCatalogBucket(ownerId), mapped);
      } catch {
        // noop
      }
    })();

    this.catalogPromiseByOwner.set(ownerId, promise);
    return promise;
  }

  private ensureMaestroSummaryLoaded(ownerId: string, force = false): Promise<void> {
    const existing = this.maestroSummaryPromiseByOwner.get(ownerId);
    if (!force && existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const summary = await this.apiGet<MaestroSummary>(`/maestros/${ownerId}/resumen`, true);
        this.maestroSummaryByOwner.set(ownerId, summary);
      } catch {
        // noop
      }
    })();

    this.maestroSummaryPromiseByOwner.set(ownerId, promise);
    return promise;
  }

  private ensureFerreteriaMvpLoaded(ownerId: string, force = false): Promise<void> {
    const existing = this.ferreteriaMvpPromiseByOwner.get(ownerId);
    if (!force && existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const ferreteriaId = await this.resolveFerreteriaId(ownerId);
        const metrics = await this.apiGet<FerreteriaMvpMetrics>(`/ferreterias/${ferreteriaId}/metricas-mvp`, true);
        this.ferreteriaMvpByOwner.set(ownerId, metrics);
      } catch {
        // noop
      }
    })();

    this.ferreteriaMvpPromiseByOwner.set(ownerId, promise);
    return promise;
  }

  private ensurePendingQuotaLoaded(ownerId: string, force = false): Promise<void> {
    if (!force && this.pendingQuotaByOwner.has(ownerId)) {
      return Promise.resolve();
    }

    const plan = this.authService.currentUser()?.subscriptionPlan || 'basico';
    return this.apiGet<CapacityResponse>(`/maestros/${ownerId}/capacidad-cotizaciones`, true, {
      plan
    })
      .then((data) => {
        this.pendingQuotaByOwner.set(ownerId, data);
      })
      .catch(() => undefined);
  }

  private ensureCatalogCapacityLoaded(ownerId: string, force = false): Promise<void> {
    if (!force && this.catalogCapacityByOwner.has(ownerId)) {
      return Promise.resolve();
    }

    const plan = this.authService.currentUser()?.subscriptionPlan || 'basico';
    return this.resolveFerreteriaId(ownerId)
      .then((ferreteriaId) => this.apiGet<CapacityResponse>(`/ferreterias/${ferreteriaId}/capacidad-catalogo`, true, { plan }))
      .then((data) => {
        this.catalogCapacityByOwner.set(ownerId, data);
      })
      .catch(() => undefined);
  }

  private ensureImportReportsLoaded(force = false): Promise<void> {
    if (!force && this.importPromise) {
      return this.importPromise;
    }

    this.importPromise = Promise.resolve();

    return this.importPromise;
  }

  private ensureValidationQueueLoaded(force = false): Promise<void> {
    if (!force && this.validationPromise) {
      return this.validationPromise;
    }

    this.validationPromise = (async () => {
      try {
        await Promise.all([
          this.ensureTaxonomyLoaded(),
          this.ensureMasterCatalogLoaded()
        ]);

        const rows = await this.apiGet<any[]>('/solicitudes-creacion-producto', true);
        const mapped = rows.map((item) => this.mapValidationRequest(item));
        this.replaceArray(this.validationQueue, mapped);
      } catch {
        // noop
      }
    })();

    return this.validationPromise;
  }

  private ensureAdminMetricsLoaded(force = false): Promise<void> {
    if (!force && this.adminPromise) {
      return this.adminPromise;
    }

    this.adminPromise = (async () => {
      try {
        const metrics = await this.apiGet<any>('/admin/metricas', true);
        this.adminMetrics = this.mapAdminMetrics(metrics);
      } catch {
        // noop
      }
    })();

    return this.adminPromise;
  }

  private async resolveFerreteriaId(ownerId: string): Promise<string> {
    const cached = this.ferreteriaIdByOwner.get(ownerId);
    if (cached) {
      return cached;
    }

    const current = this.authService.currentUser();
    if (current?.id === ownerId && current.ferreteriaId) {
      this.ferreteriaIdByOwner.set(ownerId, current.ferreteriaId);
      return current.ferreteriaId;
    }

    const data = await this.apiGet<{ id: string }>(`/ferreterias/by-owner/${ownerId}`, true);
    this.ferreteriaIdByOwner.set(ownerId, data.id);
    return data.id;
  }

  private mapMasterProduct(product: ProductoMaestroApi, minPrice: number): CatalogProduct {
    return {
      id: product.id,
      masterProductId: product.id,
      name: product.nombre,
      barcode: '',
      categoryId: product.categoriaId,
      subcategoryId: product.subcategoriaId,
      familyId: product.familiaId,
      brand: product.marca || 'Sin marca',
      productType: product.descripcionCorta || 'Producto ferretero',
      unitLabel: 'Unidad',
      packagingLabel: 'Unidad',
      price: minPrice,
      stock: 0,
      sku: '',
      imageUrl: product.imagenPrincipalUrl || 'https://via.placeholder.com/600x420?text=Producto',
      isPublished: true,
      shortDescription: product.descripcionCorta || '',
      descriptionBlocks: product.descripcionLarga ? [{ text: product.descripcionLarga }] : [],
      featureBullets: product.descripcionCorta ? [product.descripcionCorta] : [],
      technicalSheet: [],
      extraSections: [],
      gallery: Array.isArray(product.galeriaJson) && product.galeriaJson.length > 0
        ? product.galeriaJson
        : [product.imagenPrincipalUrl || 'https://via.placeholder.com/600x420?text=Producto'],
      specValues: {},
      templateVersion: 1
    };
  }

  private mapCatalogRow(ownerId: string, ferreteriaId: string, row: any): CatalogProduct {
    const master = row.productoMaestro || {};

    const item: CatalogProduct = {
      id: row.id,
      masterProductId: master.id || row.productoMaestroId,
      name: master.nombre || 'Producto',
      barcode: row.codigoBarras || '',
      categoryId: master.categoriaId,
      subcategoryId: master.subcategoriaId,
      familyId: master.familiaId,
      brand: master.marca || 'Sin marca',
      productType: master.descripcionCorta || 'Producto ferretero',
      unitLabel: 'Unidad',
      packagingLabel: 'Unidad',
      price: Number(row.precio) || 0,
      stock: Number(row.stock) || 0,
      sku: row.skuFerreteria || '',
      imageUrl: master.imagenPrincipalUrl || 'https://via.placeholder.com/600x420?text=Producto',
      isPublished: Boolean(row.publicado),
      shortDescription: master.descripcionCorta || '',
      descriptionBlocks: master.descripcionLarga ? [{ text: master.descripcionLarga }] : [],
      featureBullets: master.descripcionCorta ? [master.descripcionCorta] : [],
      technicalSheet: [],
      extraSections: [],
      gallery: Array.isArray(master.galeriaJson) && master.galeriaJson.length > 0
        ? master.galeriaJson
        : [master.imagenPrincipalUrl || 'https://via.placeholder.com/600x420?text=Producto'],
      specValues: {},
      templateVersion: 1
    };

    const metaByProduct = this.getOrCreateCatalogMeta(ownerId);
    metaByProduct.set(item.id, {
      ferreteriaId,
      productoFerreteriaId: row.id,
      productoMaestroId: master.id || row.productoMaestroId
    });

    return item;
  }

  private mapProjectRow(row: any): ProjectSummary {
    if ('name' in row && 'createdAt' in row) {
      return {
        id: row.id,
        name: row.name,
        address: row.address || '',
        createdAt: row.createdAt,
        status: row.status || 'pendiente',
        statusUpdatedAt: row.statusUpdatedAt || row.createdAt,
        items: (row.items || []).map((item: any) => ({
          productName: item.productName,
          quantity: Number(item.quantity) || 0
        })),
        totalOptimal: Number(row.totalOptimal) || 0,
        saving: Number(row.saving) || 0
      };
    }

    const latestQuotation = [...(row.cotizaciones || [])]
      .sort((a, b) => String(b.actualizadaEn || '').localeCompare(String(a.actualizadaEn || '')))[0];

    const items: ProjectItem[] = (row.items || []).map((item: any) => ({
      productName: item.productName,
      quantity: Number(item.quantity) || 0
    }));

    return {
      id: row.id,
      name: row.nombre,
      address: row.direccionObra || '',
      createdAt: row.creadoEn,
      status: latestQuotation?.estado || 'pendiente',
      statusUpdatedAt: latestQuotation?.actualizadaEn || row.creadoEn,
      items,
      totalOptimal: Number(latestQuotation?.total) || this.buildProjectQuotation(items).optimalTotal,
      saving: Number(latestQuotation?.ahorroEstimado) || 0
    };
  }

  private mapFamilyTemplate(familyId: string, familyName: string, definitions: any[]): FamilyTemplate {
    const specFields: FamilySpecField[] = definitions.map((item, index) => ({
      id: item.codigo,
      label: item.etiqueta,
      type: this.mapFieldType(item.tipoDato),
      required: Boolean(item.esObligatorio),
      options: Array.isArray(item.opcionesJson) ? item.opcionesJson : undefined,
      placeholder: item.tipoDato === 'numero' ? 'Ingresa valor numerico' : 'Ingresa valor'
    })).sort((a, b) => {
      const left = definitions.find((item) => item.codigo === a.id)?.orden || 0;
      const right = definitions.find((item) => item.codigo === b.id)?.orden || 0;
      return left - right || a.label.localeCompare(b.label);
    });

    return {
      familyId,
      version: Math.max(1, specFields.length),
      title: `Plantilla ${familyName}`,
      descriptionHint: `Completa los atributos de ${familyName.toLowerCase()} para publicar con informacion clara.`,
      usageGuidelines: [
        'Mantener descripcion y atributos consistentes con la ficha tecnica.',
        'Validar unidades de medida antes de publicar.'
      ],
      featureSuggestions: [
        'Disponible para despacho y retiro en tienda.',
        'Ficha optimizada para comparacion de cotizaciones.'
      ],
      specFields
    };
  }

  private mapFieldType(tipoDato: string): FamilySpecField['type'] {
    if (tipoDato === 'numero') return 'number';
    if (tipoDato === 'seleccion') return 'select';
    if (tipoDato === 'texto') return 'text';
    return 'text';
  }

  private mapReportFromLote(lote: any, filas: any[], ownerLabel: string): CatalogImportReport {
    const rows: CatalogImportRowResult[] = filas.map((fila) => {
      const row: CatalogImportRowResult = {
        lineNumber: fila.numeroFila,
        rawLine: `${fila.nombreProducto},${fila.precio},${fila.stock},${fila.sku}`,
        name: fila.nombreProducto,
        sku: fila.sku,
        price: Number(fila.precio) || 0,
        stock: Number(fila.stock) || 0,
        outcome: fila.resultado,
        message: fila.mensaje,
        suggestions: []
      };

      if (fila.id) {
        this.importRowById.set(fila.id, {
          ownerId: lote.ferreteriaId,
          ownerLabel,
          batchId: lote.id,
          row
        });
      }

      return row;
    });

    return {
      batchId: lote.id,
      createdAt: lote.creadoEn,
      ownerId: lote.ferreteriaId,
      ownerLabel,
      totalRows: lote.totalFilas,
      uploadedCount: lote.filasOk,
      failedCount: lote.filasError,
      pendingNewCount: rows.filter((row) => row.outcome === 'nuevo_validacion').length,
      possibleMatchCount: rows.filter((row) => row.outcome === 'posible_match').length,
      rows
    };
  }

  private mapValidationRequest(item: any): CatalogValidationRequest {
    const status = this.mapValidationStatus(item.estado);
    const row = {
      lineNumber: 0,
      rawLine: `${item.nombreProducto || ''},${item.codigoBarras || ''},${item.precioReferencia || 0},${item.cantidadReferencia || 1}`,
      name: item.nombreProducto || 'Producto solicitado',
      barcode: item.codigoBarras || '',
      brand: 'Sin marca',
      sku: 'SOLICITUD',
      price: Number(item.precioReferencia) || 0,
      stock: Number(item.cantidadReferencia) || 1,
      categoryId: this.categories[0]?.id || '',
      subcategoryId: this.subcategories[0]?.id || '',
      familyId: this.families[0]?.id || '',
      unitLabel: 'Unidad'
    };

    return {
      id: item.id,
      batchId: `solicitud-${String(item.id || '').slice(0, 8)}`,
      createdAt: item.fechaCreacion || item.creadaEn,
      ownerId: item.ferreteriaId,
      ownerLabel: `Ferreteria ${String(item.ferreteriaId || '').slice(0, 8)}`,
      type: 'nuevo_producto',
      status,
      row,
      suggestions: this.suggestMatches(row.name),
      resolution: status === 'pendiente'
        ? undefined
        : {
          action: status === 'rechazado' ? 'rechazar' : (item.productoMaestroSugeridoId ? 'aprobar_match' : 'aprobar_nuevo'),
          selectedMasterProductId: item.productoMaestroSugeridoId || undefined,
          decidedAt: item.fechaResolucion || item.resueltaEn || item.fechaCreacion || item.creadaEn,
          decidedBy: item.usuarioAdminId || undefined,
          adminNote: item.notasAdmin || item.notaAdmin || undefined
        }
    };
  }

  private mapValidationStatus(status: string): CatalogValidationStatus {
    if (status === 'aprobada') return 'aprobado';
    if (status === 'rechazada') return 'rechazado';
    return 'pendiente';
  }

  private suggestMatches(name: string): Array<{ masterProductId: string; name: string; brand: string; familyName: string; score: number }> {
    const normalized = name.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    return this.masterCatalog
      .map((item) => {
        let score = 0;
        if (item.name.toLowerCase() === normalized) score += 90;
        if (item.name.toLowerCase().includes(normalized) || normalized.includes(item.name.toLowerCase())) score += 50;
        if (item.brand.toLowerCase().includes(normalized)) score += 15;
        return {
          masterProductId: item.masterProductId || item.id,
          name: item.name,
          brand: item.brand,
          familyName: this.families.find((family) => family.id === item.familyId)?.name || 'Sin familia',
          score
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private mapAdminMetrics(raw: any): AdminMockMetrics {
    const usageSeries: AdminUsagePoint[] = [
      { label: 'Sem 1', activeUsers: Math.max(0, raw.usuariosActivos - 6), searches: 112, quotations: 40, imports: 8 },
      { label: 'Sem 2', activeUsers: Math.max(0, raw.usuariosActivos - 4), searches: 128, quotations: 48, imports: 11 },
      { label: 'Sem 3', activeUsers: Math.max(0, raw.usuariosActivos - 2), searches: 140, quotations: 56, imports: 15 },
      { label: 'Sem 4', activeUsers: raw.usuariosActivos, searches: 156, quotations: 63, imports: 18 }
    ];

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        users: raw.totalUsuarios || 0,
        maestros: raw.maestros || 0,
        ferreterias: raw.ferreterias || 0,
        admins: Math.max(0, (raw.totalUsuarios || 0) - (raw.maestros || 0) - (raw.ferreterias || 0)),
        ferreteriasActivas: raw.ferreterias || 0,
        maestrosActivos: raw.maestros || 0,
        usuariosPendientes: 0,
        usuariosBloqueados: Math.max(0, (raw.totalUsuarios || 0) - (raw.usuariosActivos || 0))
      },
      catalog: {
        totalProducts: raw.productosMaestro || 0,
        publishedProducts: raw.productosMaestro || 0,
        lowStockProducts: 0,
        inventoryValue: 0
      },
      quotations: {
        total: raw.cotizaciones || 0,
        pending: Math.max(0, (raw.cotizaciones || 0) - (raw.cotizacionesAceptadas || 0) - (raw.cotizacionesRechazadas || 0)),
        accepted: raw.cotizacionesAceptadas || 0,
        rejected: raw.cotizacionesRechazadas || 0
      },
      validation: {
        pending: raw.solicitudesPendientes || 0,
        approved: 0,
        rejected: 0,
        pendingNewRows: this.importReports.reduce((acc, report) => acc + report.pendingNewCount, 0),
        possibleMatchRows: this.importReports.reduce((acc, report) => acc + report.possibleMatchCount, 0)
      },
      usage30d: {
        sessions: 320,
        activeUsers: raw.usuariosActivos || 0,
        searches: 520,
        quotationEvents: raw.cotizaciones || 0,
        catalogUpdates: this.importReports.reduce((acc, report) => acc + report.uploadedCount, 0),
        conversionRate: 18
      },
      topFerreterias: [],
      usageSeries
    };
  }

  private emptyAdminMetrics(): AdminMockMetrics {
    return {
      generatedAt: new Date().toISOString(),
      totals: {
        users: 0,
        maestros: 0,
        ferreterias: 0,
        admins: 0,
        ferreteriasActivas: 0,
        maestrosActivos: 0,
        usuariosPendientes: 0,
        usuariosBloqueados: 0
      },
      catalog: {
        totalProducts: 0,
        publishedProducts: 0,
        lowStockProducts: 0,
        inventoryValue: 0
      },
      quotations: {
        total: 0,
        pending: 0,
        accepted: 0,
        rejected: 0
      },
      validation: {
        pending: 0,
        approved: 0,
        rejected: 0,
        pendingNewRows: 0,
        possibleMatchRows: 0
      },
      usage30d: {
        sessions: 0,
        activeUsers: 0,
        searches: 0,
        quotationEvents: 0,
        catalogUpdates: 0,
        conversionRate: 0
      },
      topFerreterias: [],
      usageSeries: []
    };
  }

  private getMeta(ownerId: string, productId: string): CatalogMeta | null {
    return this.getOrCreateCatalogMeta(ownerId).get(productId) || null;
  }

  private getOrCreateCatalogBucket(ownerId: string): CatalogProduct[] {
    const existing = this.catalogByOwner.get(ownerId);
    if (existing) {
      return existing;
    }

    const created: CatalogProduct[] = [];
    this.catalogByOwner.set(ownerId, created);
    return created;
  }

  private getOrCreateCatalogMeta(ownerId: string): Map<string, CatalogMeta> {
    const existing = this.catalogMetaByOwner.get(ownerId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, CatalogMeta>();
    this.catalogMetaByOwner.set(ownerId, created);
    return created;
  }

  private getOrCreateProjectsBucket(ownerId: string): ProjectSummary[] {
    const existing = this.projectsByOwner.get(ownerId);
    if (existing) {
      return existing;
    }

    const created: ProjectSummary[] = [];
    this.projectsByOwner.set(ownerId, created);
    return created;
  }

  private upsertProjectBucket(bucket: ProjectSummary[], value: ProjectSummary): void {
    const index = bucket.findIndex((item) => item.id === value.id);
    if (index < 0) {
      bucket.unshift(value);
      return;
    }
    bucket.splice(index, 1, value);
  }

  private invalidateMaestroState(ownerId: string): void {
    this.projectsPromiseByOwner.delete(ownerId);
    this.maestroSummaryPromiseByOwner.delete(ownerId);
    this.pendingQuotaByOwner.delete(ownerId);
    this.maestroSummaryByOwner.delete(ownerId);
  }

  private replaceArray<T>(target: T[], source: T[]): void {
    target.splice(0, target.length, ...source);
  }

  private normalizeBarcode(value: string): string {
    return value.replace(/[^0-9A-Za-z]/g, '').trim().toLowerCase();
  }

  private hashCode(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private createLocalId(prefix: string): string {
    const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  private parseCatalogCsv(content: string): Array<{
    lineNumber: number;
    rawLine: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
    barcode: string;
    valid: boolean;
    error?: string;
  }> {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line, index) => {
      const [nameRaw = '', skuRaw = '', priceRaw = '', stockRaw = '', barcodeRaw = ''] = line.split(',').map((part) => part.trim());
      const name = nameRaw;
      const sku = skuRaw || `CSV-${String(index + 1).padStart(4, '0')}`;
      const price = Math.max(0, Number(priceRaw) || 0);
      const stock = Math.max(0, Math.floor(Number(stockRaw) || 0));
      const barcode = barcodeRaw;

      if (!name || price <= 0) {
        return {
          lineNumber: index + 1,
          rawLine: line,
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
        lineNumber: index + 1,
        rawLine: line,
        name,
        sku,
        price,
        stock,
        barcode,
        valid: true
      };
    });
  }

  private removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as Partial<T>;
  }

  private headers(requireAuth: boolean): HttpHeaders {
    if (!requireAuth) {
      return new HttpHeaders();
    }

    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No hay sesion activa para llamar al backend.');
    }

    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private async apiGet<T>(path: string, requireAuth = false, query?: Record<string, string | number | undefined>): Promise<T> {
    const params = this.toHttpParams(query);
    const response = await firstValueFrom(
      this.http.get<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, {
        headers: this.headers(requireAuth),
        params
      })
    );
    return response.data;
  }

  private async apiPost<T>(path: string, body: unknown, requireAuth = false): Promise<T> {
    const response = await firstValueFrom(
      this.http.post<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, body, {
        headers: this.headers(requireAuth)
      })
    );
    return response.data;
  }

  private async apiPatch<T>(path: string, body: unknown, requireAuth = false): Promise<T> {
    const response = await firstValueFrom(
      this.http.patch<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, body, {
        headers: this.headers(requireAuth)
      })
    );
    return response.data;
  }

  private async apiPut<T>(path: string, body: unknown, requireAuth = false): Promise<T> {
    const response = await firstValueFrom(
      this.http.put<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, body, {
        headers: this.headers(requireAuth)
      })
    );
    return response.data;
  }

  private async apiDelete<T>(path: string, requireAuth = false): Promise<T> {
    const response = await firstValueFrom(
      this.http.delete<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, {
        headers: this.headers(requireAuth)
      })
    );
    return response.data;
  }

  private toHttpParams(query?: Record<string, string | number | undefined>): HttpParams {
    let params = new HttpParams();
    if (!query) {
      return params;
    }

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });
    return params;
  }

  private normalizeError(error: unknown, fallback = 'No fue posible conectar con el backend.'): Error {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.error?.message;
      if (typeof message === 'string' && message.trim()) {
        return new Error(message);
      }
      return new Error(fallback);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(fallback);
  }
}
