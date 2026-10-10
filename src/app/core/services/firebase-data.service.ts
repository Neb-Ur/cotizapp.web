import { StoreDailyAnalytics } from '../models/app.models';
import { DataModeService } from './data-mode.service';
import { findExactMasterMatch } from '../utils/catalog-match.util';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import {
  CatalogImportReport,
  CatalogImportRowResult,
  CatalogProduct,
  CatalogValidationDecision,
  CatalogValidationRequest,
  CatalogValidationStatus,
  CatalogValidationType,
  ContactRequest,
  ContactRequestStatus,
  FamilyProductRow,
  ProductSearchPage,
  FamilySpecField,
  FamilyTemplate,
  ProductDetailView,
  PriceReport,
  PriceReportStatus,
  ProductStoreOfferRow,
  ProjectComparisonStrategy,
  ProjectItem,
  ProjectQuotationView,
  ProjectSummary,
  SearchFilters,
  SearchProximity,
  SearchRow,
  SavedQuotationOffer,
  StoreQuotationVerification,
  SessionUser,
  TaxonomyOption
} from '../models/app.models';
import { AuthService } from './auth.service';
import { ApiClientService } from './api-client.service';
import { parseCatalogImportContent } from '../utils/catalog-import.util';
import { buildQuotationOptimization } from '../utils/quotation-optimizer.util';
import { distanceKm, hasValidCoordinates } from '../utils/location.util';
import { productSlug } from '../utils/product-url.util';

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

interface ProductoMaestroApi {
  id: string;
  categoriaId: string;
  subcategoriaId: string;
  familiaId: string;
  nombre: string;
  marca: string;
  marcaId?: string | null;
  codigoBarras?: string;
  descripcionCorta?: string;
  descripcionLarga?: string;
  imagenPrincipalUrl?: string;
  imagenStorageUrl?: string;
  imagenStoragePath?: string;
  imagenMiniaturaUrl?: string;
  imagenMiniaturaPath?: string;
  imagenExternaUrl?: string;
  galeriaJson?: string[];
  caracteristicasDestacadas?: string[];
  pesoLogisticoKg?: number | null;
  volumenLogisticoM3?: number | null;
  unidadesPorPallet?: number | null;
  estado?: string;
  catalogoNivel?: 'tipo_base' | 'producto_comercial';
  tipoProducto?: string;
  unidadVenta?: string;
  presentacion?: string;
  origenImagen?: NonNullable<CatalogProduct['imageRights']>['sourceType'];
  proveedorImagen?: string;
  terminosFuenteUrl?: string;
  referenciaAutorizacion?: string;
  contieneMarcasTerceros?: boolean;
  referenciaAutorizacionMarca?: string;
  derechosRevisadosEn?: string;
  origenContenido?: NonNullable<CatalogProduct['contentRights']>['sourceType'];
  fuenteContenidoUrl?: string;
  referenciaDerechosContenido?: string;
  derechosContenidoRevisadosEn?: string;
}

interface PaginatedMasterCatalogApi {
  items: ProductoMaestroApi[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

interface PublicCatalogSnapshotApi {
  version: string;
  updatedAt: string;
  taxonomy: {
    categories: any[];
    subcategories: any[];
    families: any[];
  };
  products: ProductoMaestroApi[];
  searchRows: any[];
}

const PUBLIC_CATALOG_STORAGE_KEY = 'cotizapp.publicCatalog.v3';
const LEGACY_PUBLIC_CATALOG_STORAGE_KEY = 'cotizapp.publicCatalog.v1';

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
export class FirebaseDataService {
  private readonly observedLoads = new WeakSet<Promise<void>>();

  private observeLoad(promise: Promise<void>): void {
    // Getters run during change detection. Attach only once, so settled
    // promises do not schedule another Angular render on every read.
    if (this.observedLoads.has(promise)) return;
    this.observedLoads.add(promise);
    void promise.catch(() => undefined);
  }

  private readonly loadErrors = signal<Record<string, string>>({});
  readonly loadError = computed(() => Object.values(this.loadErrors()).join(' '));

  private clearLoadError(key: string): void {
    this.loadErrors.update(errors => {
      if (!errors[key]) return errors;
      const next = { ...errors };
      delete next[key];
      return next;
    });
  }

  private recordLoadError(key: string, error: unknown, message: string): Error {
    const failure = this.normalizeError(error, message);
    this.loadErrors.update(errors => ({ ...errors, [key]: message }));
    return failure;
  }

  private readonly categories: TaxonomyOption[] = [];
  private readonly subcategories: TaxonomyOption[] = [];
  private readonly families: TaxonomyOption[] = [];
  private readonly familyTemplates = new Map<string, FamilyTemplate>();
  private readonly familyDefinitionsByFamily = new Map<string, TaxonomyDefinitionApi[]>();

  private readonly masterCatalog: CatalogProduct[] = [];
  private readonly quotationCache = new Map<string, ProjectQuotationView>();
  private readonly searchRows: SearchRowExtended[] = [];
  private readonly productDetailLoadedAt = new Map<string, number>();
  private readonly productDetailRequests = new Map<string, Promise<ProductDetailView | null>>();
  private readonly productDetailByName = new Map<string, ProductDetailView>();

  private readonly projectsByOwner = new Map<string, ProjectSummary[]>();
  private readonly catalogByOwner = new Map<string, CatalogProduct[]>();
  private readonly catalogMetaByOwner = new Map<string, Map<string, CatalogMeta>>();
  private readonly ferreteriaIdByOwner = new Map<string, string>();


  private readonly validationQueue: CatalogValidationRequest[] = [];

  private basicTaxonomyPromise: Promise<void> | null = null;
  private taxonomyPromise: Promise<void> | null = null;
  private basicTaxonomyLoading = false;
  private taxonomyLoading = false;
  private masterPromise: Promise<void> | null = null;
  private searchPromise: Promise<void> | null = null;
  private readonly projectsPromiseByOwner = new Map<string, Promise<void>>();
  private readonly catalogPromiseByOwner = new Map<string, Promise<void>>();
  private validationPromise: Promise<void> | null = null;
  private publicCatalogVersion = '';
  private publicCatalogNeedsPriceRefresh = false;

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly authService: AuthService,
    private readonly dataMode: DataModeService | null = null
  ) {}

  async refreshMaestroData(ownerId: string): Promise<void> {
    await Promise.all([
      this.ensureTaxonomyLoaded(),
      this.ensureSearchRowsLoaded(),
      this.ensureMasterCatalogLoaded(),
      this.ensureProjectsLoaded(ownerId)
    ]);
  }


  async refreshMaestroSearchSection(force = false): Promise<void> {
    await Promise.all([
      this.ensureBasicTaxonomyLoaded(force),
      this.ensureSearchRowsLoaded(force),
      this.ensureMasterCatalogLoaded(force)
    ]);
  }

  async refreshSearchTaxonomy(force = false): Promise<void> {
    await this.ensureBasicTaxonomyLoaded(force);
  }

  async searchProductPage(filters: SearchFilters, page: number, size: number, sort: string, proximity?: SearchProximity): Promise<ProductSearchPage> {
    try {
      return await this.apiClient.get<ProductSearchPage>('/busqueda', false, {
        vista: 'productos', query: filters.query, marca: filters.brand, marcaId: filters.brandId,
        categoriaId: filters.categoryId, subcategoriaId: filters.subcategoryId, familiaId: filters.familyId,
        ferreteriaId: filters.storeId, page, size, sort, latitude: proximity?.latitude, longitude: proximity?.longitude, radiusKm: proximity?.radiusKm
      });
    } catch (error) {
      throw this.normalizeError(error, 'No se pudieron cargar los productos. Intenta nuevamente.');
    }
  }

  async getHomeCatalogPreview():Promise<{products:FamilyProductRow[];categories:TaxonomyOption[]}> {
    return this.apiClient.get('/catalogo-inicio');
  }

  async refreshPublicCatalogSection(force = false): Promise<void> {
    if (!force && this.restorePublicCatalogBrowserCache()) {
      return;
    }

    try {
      await this.fetchPublicCatalogSnapshot();
    } catch {
      await Promise.all([
        this.ensureBasicTaxonomyLoaded(force),
        this.ensureSearchRowsLoaded(force),
        this.ensureMasterCatalogLoaded(force)
      ]);
    }
  }

  async refreshPublicCatalogEnhancements(force = false): Promise<void> {
    try {
      const metadata = await this.apiClient.get<{ version: string; updatedAt: string }>('/catalogo-publico/version');
      if (!force && !this.publicCatalogNeedsPriceRefresh && metadata.version && metadata.version === this.publicCatalogVersion) {
        return;
      }
      await this.fetchPublicCatalogSnapshot(metadata.version);
    } catch {
      await Promise.all([
        this.ensureBasicTaxonomyLoaded(force),
        this.ensureMasterCatalogLoaded(force)
      ]);
    }
  }

  async resolveProductNameBySlug(slug: string): Promise<string> {
    const normalizedSlug = productSlug(slug);
    if (!normalizedSlug) return '';

    await this.refreshPublicCatalogSection();
    const productNames = new Set([
      ...this.masterCatalog.map((product) => product.name),
      ...this.searchRows.map((row) => row.productName)
    ]);

    return Array.from(productNames).find((name) => productSlug(name) === normalizedSlug) || '';
  }

  async refreshMaestroProjectsSection(ownerId: string, force = false): Promise<void> {
    await Promise.all([
      this.ensureProjectsLoaded(ownerId, force)
    ]);
  }


  async refreshFerreteriaCatalogSection(ownerId: string, force = false): Promise<void> {
    await this.ensureCatalogLoaded(ownerId, force);
  }

  async refreshFerreteriaUploadSection(ownerId: string, force = false): Promise<void> {
    await Promise.all([
      this.ensureBasicTaxonomyLoaded(force),
      this.resolveFerreteriaId(ownerId)
    ]);
  }


  async refreshAdminTaxonomySection(force = false): Promise<void> {
    await this.ensureTaxonomyLoaded(force);
  }

  async refreshAdminProductsSection(force = false): Promise<void> {
    await Promise.all([
      this.ensureBasicTaxonomyLoaded(force),
      this.ensureMasterCatalogLoaded(force)
    ]);
  }

  async refreshAdminProductsTaxonomySection(force = false): Promise<void> {
    await this.ensureBasicTaxonomyLoaded(force);
  }

  async refreshAdminRequestsSection(force = false): Promise<void> {
    await this.ensureValidationQueueLoaded(force);
  }

  async getContactRequestsForAdmin(): Promise<ContactRequest[]> {
    return this.apiClient.get<ContactRequest[]>('/admin/solicitudes-contacto', true);
  }

  async updateContactRequestStatus(requestId: string, status: ContactRequestStatus): Promise<ContactRequest> {
    return this.apiClient.patch<ContactRequest>(`/admin/solicitudes-contacto/${requestId}`, { status }, true);
  }

  getPriceReportsForAdmin(): Promise<PriceReport[]> {
    return this.apiClient.get<PriceReport[]>('/admin/price-reports', true);
  }

  updatePriceReportForAdmin(
    reportId: string,
    status: Exclude<PriceReportStatus, 'recibido'>,
    resolution: string,
    correctedPrice?: number
  ): Promise<PriceReport> {
    return this.apiClient.patch<PriceReport>(`/admin/price-reports/${reportId}`, {
      status,
      resolution,
      correctedPrice
    }, true);
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
    return '/';
  }

  async getBrandOptions():Promise<Array<{id:string;name:string}>> {
    const brands=await this.apiClient.get<Array<{id:string;nombre:string}>>('/marcas');
    return brands.map(item=>({id:item.id,name:item.nombre}));
  }

  getCategoryOptions(autoLoad = true): TaxonomyOption[] {
    if (autoLoad) this.observeLoad(this.ensureBasicTaxonomyLoaded());
    return this.categories;
  }

  getSubcategoryOptions(categoryId?: string, autoLoad = true): TaxonomyOption[] {
    if (autoLoad) this.observeLoad(this.ensureBasicTaxonomyLoaded());
    if (!categoryId) {
      return this.subcategories;
    }
    return this.subcategories.filter((item) => item.parentId === categoryId);
  }

  getFamilyOptions(subcategoryId?: string, autoLoad = true): TaxonomyOption[] {
    if (autoLoad) this.observeLoad(this.ensureBasicTaxonomyLoaded());
    if (!subcategoryId) {
      return this.families;
    }
    return this.families.filter((item) => item.parentId === subcategoryId);
  }

  getFamilyTemplate(familyId: string): FamilyTemplate | null {
    this.observeLoad(this.ensureTaxonomyLoaded());
    return this.familyTemplates.get(familyId) || null;
  }

  getFamilyDefinitionRows(familyId: string): TaxonomyDefinitionApi[] {
    this.observeLoad(this.ensureTaxonomyLoaded());
    return this.familyDefinitionsByFamily.get(familyId) || [];
  }

  async createCategory(name: string, icon = 'box'): Promise<TaxonomyOption> {
    const created = await this.apiClient.post<any>('/categorias', { nombre: name.trim(), icono: icon }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: created.id, name: created.nombre, icon: created.icono };
  }

  async updateCategory(categoryId: string, name: string, icon = 'box'): Promise<TaxonomyOption> {
    const updated = await this.apiClient.patch<any>(`/categorias/${categoryId}`, { nombre: name.trim(), icono: icon }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: updated.id, name: updated.nombre, icon: updated.icono };
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.apiClient.delete(`/categorias/${categoryId}`, true);
    await this.ensureTaxonomyLoaded(true);
  }

  async createSubcategory(categoryId: string, name: string): Promise<TaxonomyOption> {
    const created = await this.apiClient.post<any>('/subcategorias', {
      categoriaId: categoryId,
      nombre: name.trim()
    }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: created.id, parentId: created.categoriaId, name: created.nombre };
  }

  async updateSubcategory(subcategoryId: string, categoryId: string, name: string): Promise<TaxonomyOption> {
    const updated = await this.apiClient.patch<any>(`/subcategorias/${subcategoryId}`, {
      categoriaId: categoryId,
      nombre: name.trim()
    }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: updated.id, parentId: updated.categoriaId, name: updated.nombre };
  }

  async deleteSubcategory(subcategoryId: string): Promise<void> {
    await this.apiClient.delete(`/subcategorias/${subcategoryId}`, true);
    await this.ensureTaxonomyLoaded(true);
  }

  async createFamily(subcategoryId: string, name: string): Promise<TaxonomyOption> {
    const created = await this.apiClient.post<any>('/familias', {
      subcategoriaId: subcategoryId,
      nombre: name.trim()
    }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: created.id, parentId: created.subcategoriaId, name: created.nombre };
  }

  async updateFamily(familyId: string, subcategoryId: string, name: string): Promise<TaxonomyOption> {
    const updated = await this.apiClient.patch<any>(`/familias/${familyId}`, {
      subcategoriaId: subcategoryId,
      nombre: name.trim()
    }, true);
    await this.ensureTaxonomyLoaded(true);
    return { id: updated.id, parentId: updated.subcategoriaId, name: updated.nombre };
  }

  async deleteFamily(familyId: string): Promise<void> {
    await this.apiClient.delete(`/familias/${familyId}`, true);
    await this.ensureTaxonomyLoaded(true);
  }

  async createFamilyDefinition(familyId: string, payload: Omit<TaxonomyDefinitionApi, 'id' | 'familiaId'>): Promise<TaxonomyDefinitionApi> {
    const created = await this.apiClient.post<TaxonomyDefinitionApi>(`/familias/${familyId}/atributos-definicion`, payload, true);
    await this.ensureTaxonomyLoaded(true);
    return created;
  }

  async updateFamilyDefinition(familyId: string, definitionId: string, payload: Partial<Omit<TaxonomyDefinitionApi, 'id' | 'familiaId'>>): Promise<TaxonomyDefinitionApi> {
    const updated = await this.apiClient.patch<TaxonomyDefinitionApi>(`/familias/${familyId}/atributos-definicion/${definitionId}`, payload, true);
    await this.ensureTaxonomyLoaded(true);
    return updated;
  }

  async deleteFamilyDefinition(familyId: string, definitionId: string): Promise<void> {
    await this.apiClient.delete(`/familias/${familyId}/atributos-definicion/${definitionId}`, true);
    await this.ensureTaxonomyLoaded(true);
  }

  getMasterCatalogProducts(): CatalogProduct[] {
    this.observeLoad(this.ensureMasterCatalogLoaded());
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

    const raw = await this.apiClient.get<PaginatedMasterCatalogApi>('/productos-maestro/paginado', false, {
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

  async getAdminMasterCatalogPage(payload: {
    query?: string;
    categoryId?: string;
    subcategoryId?: string;
    familyId?: string;
    page?: number;
    size?: number;
  }): Promise<{
    items: CatalogProduct[];
    page: number;
    size: number;
    total: number;
    totalPages: number;
  }> {
    const raw = await this.apiClient.get<PaginatedMasterCatalogApi>('/admin/productos-maestro/paginado', true, {
      query: payload.query?.trim() || undefined,
      categoriaId: payload.categoryId || undefined,
      subcategoriaId: payload.subcategoryId || undefined,
      familiaId: payload.familyId || undefined,
      page: payload.page || 1,
      size: payload.size || 20
    });

    return {
      items: (raw.items || []).map((product) => this.mapMasterProduct(product, 0)),
      page: raw.page || 1,
      size: raw.size || payload.size || 20,
      total: raw.total || 0,
      totalPages: raw.totalPages || 1
    };
  }

  async getMasterCatalogProductDetail(masterProductId: string): Promise<{
    product: CatalogProduct | null;
    attributes: any[];
  }> {
    const raw = await this.apiClient.get<any>(`/admin/productos-maestro/${masterProductId}`, true);
    const product = this.mapMasterProduct({
      id: raw.id,
      categoriaId: raw.categoriaId,
      subcategoriaId: raw.subcategoriaId,
      familiaId: raw.familiaId,
      nombre: raw.nombre,
      estado: raw.estado,
      catalogoNivel: raw.catalogoNivel,
      tipoProducto: raw.tipoProducto,
      unidadVenta: raw.unidadVenta,
      presentacion: raw.presentacion,
      marca: raw.marca,
      codigoBarras: raw.codigoBarras,
      descripcionCorta: raw.descripcionCorta,
      descripcionLarga: raw.descripcionLarga,
      imagenPrincipalUrl: raw.imagenPrincipalUrl,
      imagenStorageUrl: raw.imagenStorageUrl,
      imagenStoragePath: raw.imagenStoragePath,
      imagenMiniaturaUrl: raw.imagenMiniaturaUrl,
      imagenMiniaturaPath: raw.imagenMiniaturaPath,
      imagenExternaUrl: raw.imagenExternaUrl,
      galeriaJson: raw.galeriaJson,
      caracteristicasDestacadas: raw.caracteristicasDestacadas,
      pesoLogisticoKg: raw.pesoLogisticoKg,
      volumenLogisticoM3: raw.volumenLogisticoM3,
      unidadesPorPallet: raw.unidadesPorPallet,
      origenImagen: raw.origenImagen,
      proveedorImagen: raw.proveedorImagen,
      terminosFuenteUrl: raw.terminosFuenteUrl,
      referenciaAutorizacion: raw.referenciaAutorizacion,
      contieneMarcasTerceros: raw.contieneMarcasTerceros,
      referenciaAutorizacionMarca: raw.referenciaAutorizacionMarca,
      derechosRevisadosEn: raw.derechosRevisadosEn,
      origenContenido: raw.origenContenido,
      fuenteContenidoUrl: raw.fuenteContenidoUrl,
      referenciaDerechosContenido: raw.referenciaDerechosContenido,
      derechosContenidoRevisadosEn: raw.derechosContenidoRevisadosEn
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
    logisticsWeightKg?: number | null;
    logisticsVolumeM3?: number | null;
    logisticsPalletUnits?: number | null;
  }, refreshCache = true): Promise<CatalogProduct> {
    const created = await this.apiClient.post<any>('/productos-maestro', {
      nombre: payload.name,
      tipoProducto: payload.productType,
      unidadVenta: payload.unitLabel,
      presentacion: payload.packagingLabel,
      estado: payload.isPublished === false ? 'inactivo' : 'activo',
      marca: payload.brand,
      codigoBarras: payload.barcode,
      categoriaId: payload.categoryId,
      subcategoriaId: payload.subcategoryId,
      familiaId: payload.familyId,
      descripcionCorta: payload.shortDescription || payload.descriptionText,
      descripcionLarga: payload.descriptionBlocks?.[0]?.text || payload.descriptionText,
      imagenPrincipalUrl: payload.imageUrl,
      imagenStorageUrl: payload.storageImageUrl,
      imagenStoragePath: payload.storageImagePath,
      imagenMiniaturaUrl: payload.thumbnailImageUrl,
      imagenMiniaturaPath: payload.thumbnailImagePath,
      galeriaJson: payload.gallery || [],
      caracteristicasDestacadas: payload.featureBullets,
      pesoLogisticoKg: payload.logisticsWeightKg,
      volumenLogisticoM3: payload.logisticsVolumeM3,
      unidadesPorPallet: payload.logisticsPalletUnits,
      origenImagen: payload.imageRights?.sourceType,
      proveedorImagen: payload.imageRights?.provider,
      terminosFuenteUrl: payload.imageRights?.sourceTermsUrl,
      referenciaAutorizacion: payload.imageRights?.authorizationReference,
      contieneMarcasTerceros: payload.imageRights?.containsThirdPartyMarks,
      referenciaAutorizacionMarca: payload.imageRights?.trademarkAuthorizationReference,
      origenContenido: payload.contentRights?.sourceType,
      fuenteContenidoUrl: payload.contentRights?.sourceUrl,
      referenciaDerechosContenido: payload.contentRights?.authorizationReference
    }, true);

    if (refreshCache) await this.ensureMasterCatalogLoaded(true);
    return this.masterCatalog.find((item) => (item.masterProductId || item.id) === created.id) || this.mapMasterProduct(created, 0);
  }

  async updateMasterCatalogProduct(masterProductId: string, patch: Partial<CatalogProduct> & {
    descriptionText?: string;
    logisticsWeightKg?: number | null;
    logisticsVolumeM3?: number | null;
    logisticsPalletUnits?: number | null;
  }, refreshCache = true): Promise<CatalogProduct | null> {
    const payload = {
      nombre: patch.name,
      tipoProducto: patch.productType,
      unidadVenta: patch.unitLabel,
      presentacion: patch.packagingLabel,
      estado: patch.isPublished === undefined ? undefined : patch.isPublished ? 'activo' : 'inactivo',
      marca: patch.brand,
      codigoBarras: patch.barcode,
      categoriaId: patch.categoryId,
      subcategoriaId: patch.subcategoryId,
      familiaId: patch.familyId,
      descripcionCorta: patch.shortDescription || patch.descriptionText,
      descripcionLarga: patch.descriptionBlocks?.[0]?.text || patch.descriptionText,
      imagenPrincipalUrl: patch.imageUrl,
      imagenStorageUrl: patch.storageImageUrl,
      imagenStoragePath: patch.storageImagePath,
      imagenMiniaturaUrl: patch.thumbnailImageUrl,
      imagenMiniaturaPath: patch.thumbnailImagePath,
      galeriaJson: patch.gallery,
      caracteristicasDestacadas: patch.featureBullets,
      pesoLogisticoKg: patch.logisticsWeightKg,
      volumenLogisticoM3: patch.logisticsVolumeM3,
      unidadesPorPallet: patch.logisticsPalletUnits,
      origenImagen: patch.imageRights?.sourceType,
      proveedorImagen: patch.imageRights?.provider,
      terminosFuenteUrl: patch.imageRights?.sourceTermsUrl,
      referenciaAutorizacion: patch.imageRights?.authorizationReference,
      contieneMarcasTerceros: patch.imageRights?.containsThirdPartyMarks,
      referenciaAutorizacionMarca: patch.imageRights?.trademarkAuthorizationReference,
      origenContenido: patch.contentRights?.sourceType,
      fuenteContenidoUrl: patch.contentRights?.sourceUrl,
      referenciaDerechosContenido: patch.contentRights?.authorizationReference
    };

    const cleaned = this.removeUndefined(payload);

    const updated = await this.apiClient.patch<any>(`/productos-maestro/${masterProductId}`, cleaned, true);
    if (refreshCache) await this.ensureMasterCatalogLoaded(true);
    return updated ? this.mapMasterProduct(updated, 0) : null;
  }

  async saveMasterProductAttributes(masterProductId: string, rows: Array<{
    definicionAtributoId: string;
    valorTexto?: string | null;
    valorNumero?: number | null;
    valorBooleano?: boolean | null;
    valorOpcion?: string | null;
  }>): Promise<void> {
    await this.apiClient.put(`/productos-maestro/${masterProductId}/atributos`, rows, true);
  }

  async deleteMasterCatalogProduct(masterProductId: string, refreshCache = true): Promise<void> {
    await this.apiClient.delete(`/productos-maestro/${masterProductId}`, true);
    if (refreshCache) {
      await this.ensureMasterCatalogLoaded(true);
      await this.ensureSearchRowsLoaded(true);
    }
  }

  getCatalog(ownerId: string): CatalogProduct[] {
    const bucket = this.getOrCreateCatalogBucket(ownerId);
    this.observeLoad(this.ensureCatalogLoaded(ownerId));
    return bucket;
  }

  async upsertCatalog(ownerId: string, payload: CatalogProduct): Promise<CatalogProduct[]> {
    const ferreteriaId = await this.resolveFerreteriaId(ownerId);
    const meta = this.getMeta(ownerId, payload.id);

    if (meta) {
      await this.apiClient.patch(`/ferreterias/${ferreteriaId}/catalogo/${meta.productoFerreteriaId}`, {
        skuFerreteria: payload.sku,
        codigoBarras: payload.barcode || null,
        precio: payload.price,
        stock: payload.stock,
        incluyeIva: true,
        unidadMedidaPrecio: payload.measurementUnit || null,
        cantidadMedida: payload.measurementQuantity || null,
        vigenteHasta: payload.validUntil || null,
        condicionesOferta: payload.offerConditions || '',
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

    await this.apiClient.post<any>(`/ferreterias/${ferreteriaId}/catalogo`, {
      productoMaestroId: masterId,
      skuFerreteria: payload.sku || `SKU-${masterId.slice(0, 8).toUpperCase()}`,
      codigoBarras: payload.barcode || null,
      precio: payload.price,
      stock: payload.stock,
      incluyeIva: true,
      unidadMedidaPrecio: payload.measurementUnit || null,
      cantidadMedida: payload.measurementQuantity || null,
      vigenteHasta: payload.validUntil || null,
      condicionesOferta: payload.offerConditions || '',
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

    await this.apiClient.delete(`/ferreterias/${meta.ferreteriaId}/catalogo/${meta.productoFerreteriaId}`, true);
    await this.ensureCatalogLoaded(ownerId, true);
    return this.getCatalog(ownerId);
  }

  async addCatalogProductFromMaster(ownerId: string, masterProductId: string, relation: {
    price: number;
    stock: number;
    sku?: string;
    barcode?: string;
    isPublished?: boolean;
  }): Promise<{ catalog: CatalogProduct[]; wasUpdate: boolean }> {
    await this.ensureCatalogLoaded(ownerId, true);
    await this.ensureMasterCatalogLoaded();
    const catalog = this.getCatalog(ownerId);
    const current = catalog.find((item) => (item.masterProductId || item.id) === masterProductId);

    if (current) {
      const updated = await this.upsertCatalog(ownerId, {
        ...current,
        price: relation.price,
        stock: relation.stock,
        sku: relation.sku || current.sku,
        barcode: relation.barcode || current.barcode || '',
        isPublished: relation.isPublished ?? true
      });
      return { catalog: updated, wasUpdate: true };
    }

    const master = this.masterCatalog.find((item) => (item.masterProductId || item.id) === masterProductId);
    if (!master) {
      throw new Error('No se encontro el producto maestro seleccionado.');
    }

    const sku = relation.sku?.trim() || master.sku?.trim() || `SKU-${masterProductId.slice(0, 8).toUpperCase()}`;
    try {
      const next = await this.upsertCatalog(ownerId, {
        ...master,
        id: '',
        masterProductId,
        sku,
        price: relation.price,
        stock: relation.stock,
        barcode: relation.barcode || master.barcode || '',
        isPublished: relation.isPublished ?? true
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
        sku: relation.sku || synced.sku || sku,
        barcode: relation.barcode || synced.barcode || master.barcode || '',
        isPublished: relation.isPublished ?? true
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
    sku?: string;
    isPublished?: boolean;
  }): Promise<{ id: string; type: CatalogValidationType }> {
    const ferreteriaId = await this.resolveFerreteriaId(ownerId);

    const maybeMatch = this.masterCatalog.some((item) => {
      const barcodeMatches = !!draft.barcode && !!item.barcode && this.normalizeBarcode(item.barcode) === this.normalizeBarcode(draft.barcode);
      const nameMatches = item.name.toLowerCase().includes(draft.name.trim().toLowerCase());
      return barcodeMatches || nameMatches;
    });

    const created = await this.apiClient.post<{ id: string }>(`/ferreterias/${ferreteriaId}/solicitudes-creacion-producto`, {
      nombreProducto: draft.name.trim(),
      codigoBarras: draft.barcode.trim(),
      skuFerreteria: draft.sku || '',
      publicado: draft.isPublished !== false,
      tipoSolicitud: maybeMatch ? 'posible_match' : 'nuevo_producto',
      cantidadReferencia: Math.max(0, Math.floor(Number(draft.quantity) || 0)),
      precioReferencia: Math.max(0, Math.round(Number(draft.price) || 0))
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
    options: {
      categoryId: string;
      subcategoryId: string;
      familyId: string;
      brand: string;
      unitLabel: string;
      isPublished: boolean;
      mode?: 'initial' | 'update';
    }
  ): Promise<{ catalog: CatalogProduct[]; report: CatalogImportReport }> {
    await Promise.all([
      this.ensureTaxonomyLoaded(),
      this.ensureMasterCatalogLoaded(true),
      this.ensureCatalogLoaded(ownerId, true)
    ]);

    const ferreteriaId = await this.resolveFerreteriaId(ownerId);
    const parsedRows = await this.parseCatalogCsv(csvContent);
    const reportRows: CatalogImportRowResult[] = [];
    const mode = options.mode || 'initial';

    const duplicateLineNumbers = new Set<number>();
    if (mode === 'update') {
      const identifierLines = new Map<string, number[]>();

      for (const parsed of parsedRows.filter((row) => row.valid)) {
        const identifiers: string[] = [];
        const normalizedSku = this.normalizeBarcode(parsed.sku);
        const normalizedBarcode = this.normalizeBarcode(parsed.barcode);
        const generatedSku = /^imp\d+$/i.test(normalizedSku);

        if (normalizedSku && !generatedSku) identifiers.push(`sku:${normalizedSku}`);
        if (normalizedBarcode) identifiers.push(`barcode:${normalizedBarcode}`);
        if (identifiers.length === 0 && parsed.name.trim()) {
          identifiers.push(`name:${parsed.name.trim().toLowerCase()}`);
        }

        for (const identifier of identifiers) {
          const lines = identifierLines.get(identifier) || [];
          lines.push(parsed.lineNumber);
          identifierLines.set(identifier, lines);
        }
      }

      for (const lines of identifierLines.values()) {
        if (lines.length > 1) {
          lines.forEach((line) => duplicateLineNumbers.add(line));
        }
      }
    }

    for (const parsed of parsedRows) {
      const failedRow = (message: string): CatalogImportRowResult => ({
        lineNumber: parsed.lineNumber,
        rawLine: parsed.rawLine,
        name: parsed.name,
        sku: parsed.sku,
        barcode: parsed.barcode,
        price: parsed.price,
        stock: parsed.stock,
        outcome: 'fallido',
        message,
        suggestions: []
      });

      if (!parsed.valid) {
        reportRows.push(failedRow(parsed.error || 'Fila invalida.'));
        continue;
      }

      if (mode === 'update' && duplicateLineNumbers.has(parsed.lineNumber)) {
        reportRows.push(failedRow('Producto repetido dentro del archivo. Revisa SKU o codigo de barras.'));
        continue;
      }

      try {
        const catalog = this.getCatalog(ownerId);
        const normalizedSku = this.normalizeBarcode(parsed.sku);
        const normalizedBarcode = this.normalizeBarcode(parsed.barcode);
        const generatedSku = /^imp\d+$/i.test(normalizedSku);

        const skuMatches = normalizedSku && !generatedSku
          ? catalog.filter((item) => this.normalizeBarcode(item.sku || '') === normalizedSku)
          : [];
        const barcodeMatches = normalizedBarcode
          ? catalog.filter((item) => this.normalizeBarcode(item.barcode || '') === normalizedBarcode)
          : [];

        if (mode === 'update') {
          if (skuMatches.length > 1 || barcodeMatches.length > 1) {
            reportRows.push(failedRow('Encontramos mas de una coincidencia. Revisa SKU o codigo de barras.'));
            continue;
          }

          if (
            skuMatches.length === 1
            && barcodeMatches.length === 1
            && skuMatches[0].id !== barcodeMatches[0].id
          ) {
            reportRows.push(failedRow('El SKU y el codigo de barras apuntan a productos distintos.'));
            continue;
          }

          let existingCatalogProduct = skuMatches[0] || barcodeMatches[0];
          if (!existingCatalogProduct) {
            const normalizedName = parsed.name.trim().toLowerCase();
            const nameMatches = catalog.filter((item) => item.name.trim().toLowerCase() === normalizedName);

            if (nameMatches.length > 1) {
              reportRows.push(failedRow('Encontramos mas de un producto con ese nombre. Conserva SKU o codigo de barras.'));
              continue;
            }
            existingCatalogProduct = nameMatches[0];
          }

          if (!existingCatalogProduct) {
            reportRows.push(failedRow('Producto no encontrado en tu catalogo. No se realizo ningun cambio.'));
            continue;
          }

          const priceChanged = existingCatalogProduct.price !== parsed.price;
          const stockChanged = existingCatalogProduct.stock !== parsed.stock;

          if (!priceChanged && !stockChanged) {
            reportRows.push({
              lineNumber: parsed.lineNumber,
              rawLine: parsed.rawLine,
              name: existingCatalogProduct.name,
              sku: existingCatalogProduct.sku,
              barcode: existingCatalogProduct.barcode,
              price: parsed.price,
              stock: parsed.stock,
              outcome: 'sin_cambios',
              message: 'Precio y stock sin cambios.',
              suggestions: []
            });
            continue;
          }

          const changes: string[] = [];
          if (priceChanged) changes.push(`Precio ${existingCatalogProduct.price} -> ${parsed.price}`);
          if (stockChanged) changes.push(`Stock ${existingCatalogProduct.stock} -> ${parsed.stock}`);

          await this.upsertCatalog(ownerId, {
            ...existingCatalogProduct,
            price: parsed.price,
            stock: parsed.stock
          });

          reportRows.push({
            lineNumber: parsed.lineNumber,
            rawLine: parsed.rawLine,
            name: existingCatalogProduct.name,
            sku: existingCatalogProduct.sku,
            barcode: existingCatalogProduct.barcode,
            price: parsed.price,
            stock: parsed.stock,
            outcome: 'subido',
            message: changes.join(' · '),
            suggestions: []
          });
          continue;
        }

        if (skuMatches.length > 1 || barcodeMatches.length > 1
          || (skuMatches.length === 1 && barcodeMatches.length === 1 && skuMatches[0].id !== barcodeMatches[0].id)) {
          reportRows.push(failedRow('Identificadores ambiguos: revisa el SKU y código de barras.'));
          continue;
        }
        const existingCatalogProduct = skuMatches[0] || barcodeMatches[0]
          || findExactMasterMatch(catalog, parsed.name, parsed.barcode);

        if (existingCatalogProduct) {
          await this.upsertCatalog(ownerId, {
            ...existingCatalogProduct,
            sku: parsed.sku || existingCatalogProduct.sku,
            barcode: parsed.barcode || existingCatalogProduct.barcode,
            price: parsed.price,
            stock: parsed.stock
          });

          reportRows.push({
            lineNumber: parsed.lineNumber,
            rawLine: parsed.rawLine,
            name: parsed.name,
            sku: parsed.sku,
            barcode: parsed.barcode,
            price: parsed.price,
            stock: parsed.stock,
            outcome: 'subido',
            message: 'Precio y stock actualizados en el catalogo de la ferreteria.',
            suggestions: []
          });
          continue;
        }

        const suggestions = this.suggestMatches(parsed.name);
        const firstMatch = findExactMasterMatch(this.masterCatalog, parsed.name, parsed.barcode);
        if (!firstMatch) {
          const fallbackBarcode = parsed.barcode || '';
          const created = await this.requestCatalogProductCreation(ownerId, ownerLabel, {
            name: parsed.name,
            barcode: fallbackBarcode,
            quantity: parsed.stock,
            price: parsed.price,
            sku: parsed.sku,
            isPublished: options.isPublished
          });

          reportRows.push({
            lineNumber: parsed.lineNumber,
            rawLine: parsed.rawLine,
            name: parsed.name,
            sku: parsed.sku,
            barcode: parsed.barcode,
            price: parsed.price,
            stock: parsed.stock,
            outcome: suggestions.length ? 'posible_match' : 'nuevo_validacion',
            message: suggestions.length ? 'Coincidencia ambigua enviada a revisión antes de publicar.' : 'Enviado a revision de catalogo maestro.',
            suggestions,
            validationRequestId: created.id
          });
          continue;
        }

        await this.addCatalogProductFromMaster(ownerId, firstMatch.masterProductId || firstMatch.id, {
          price: parsed.price,
          stock: parsed.stock,
          sku: parsed.sku,
          barcode: parsed.barcode,
          isPublished: options.isPublished
        });

        reportRows.push({
          lineNumber: parsed.lineNumber,
          rawLine: parsed.rawLine,
          name: parsed.name,
          sku: parsed.sku,
          barcode: parsed.barcode,
          price: parsed.price,
          stock: parsed.stock,
          outcome: 'subido',
          message: 'Producto vinculado al catalogo de la ferreteria.',
          suggestions
        });
      } catch (error) {
        reportRows.push(failedRow(error instanceof Error ? error.message : 'No se pudo guardar esta fila.'));
      }
    }

    await this.ensureCatalogLoaded(ownerId, true);

    const report: CatalogImportReport = {
      batchId: `batch-${this.createLocalId('imp')}`,
      createdAt: new Date().toISOString(),
      ownerId: ferreteriaId,
      ownerLabel,
      totalRows: reportRows.length,
      uploadedCount: reportRows.filter((row) => row.outcome === 'subido').length,
      noChangeCount: reportRows.filter((row) => row.outcome === 'sin_cambios').length,
      failedCount: reportRows.filter((row) => row.outcome === 'fallido').length,
      pendingNewCount: reportRows.filter((row) => row.outcome === 'nuevo_validacion').length,
      possibleMatchCount: reportRows.filter((row) => row.outcome === 'posible_match').length,
      rows: reportRows
    };

    return {
      catalog: this.getCatalog(ownerId),
      report
    };
  }

  getCatalogValidationQueue(status: CatalogValidationStatus | 'all' = 'pendiente'): CatalogValidationRequest[] {
    this.observeLoad(this.ensureValidationQueueLoaded());
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
        imageRights?: CatalogProduct['imageRights'];
        contentRights?: CatalogProduct['contentRights'];
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
      const created = await this.apiClient.post<{ id: string }>('/productos-maestro', {
        nombre: options.masterDraft.name,
        marca: options.masterDraft.brand || 'Sin marca',
        categoriaId: options.masterDraft.categoryId,
        subcategoriaId: options.masterDraft.subcategoryId,
        familiaId: options.masterDraft.familyId,
        descripcionCorta: options.masterDraft.shortDescription || options.masterDraft.descriptionText || '',
        descripcionLarga: options.masterDraft.descriptionText || '',
        imagenPrincipalUrl: options.masterDraft.imageUrl || '',
        galeriaJson: options.masterDraft.gallery || [],
        origenImagen: options.masterDraft.imageRights?.sourceType,
        proveedorImagen: options.masterDraft.imageRights?.provider,
        terminosFuenteUrl: options.masterDraft.imageRights?.sourceTermsUrl,
        referenciaAutorizacion: options.masterDraft.imageRights?.authorizationReference,
        contieneMarcasTerceros: options.masterDraft.imageRights?.containsThirdPartyMarks,
        referenciaAutorizacionMarca: options.masterDraft.imageRights?.trademarkAuthorizationReference,
        origenContenido: options.masterDraft.contentRights?.sourceType,
        fuenteContenidoUrl: options.masterDraft.contentRights?.sourceUrl,
        referenciaDerechosContenido: options.masterDraft.contentRights?.authorizationReference
      }, true);

      suggestedMasterProductId = created.id;

      if (options.masterDraft.attributes && options.masterDraft.attributes.length > 0) {
        await this.saveMasterProductAttributes(created.id, options.masterDraft.attributes);
      }

      await this.ensureMasterCatalogLoaded(true);
    }

    await this.apiClient.post(`/solicitudes-creacion-producto/${requestId}/resolver`, {
      accion: action === 'rechazar' ? 'rechazar' : 'aprobar',
      productoMaestroSugeridoId: suggestedMasterProductId,
      notaAdmin: options?.adminNote || ''
    }, true);

    await this.ensureValidationQueueLoaded(true);
    return this.validationQueue.find((item) => item.id === requestId) || null;
  }

  getProjects(ownerId: string): ProjectSummary[] {
    const bucket = this.getOrCreateProjectsBucket(ownerId);
    this.observeLoad(this.ensureProjectsLoaded(ownerId));
    return bucket;
  }

  getProjectById(ownerId: string, projectId: string): ProjectSummary | null {
    return this.getProjects(ownerId).find((item) => item.id === projectId) || null;
  }

  async saveProject(
    ownerId: string,
    name: string,
    items: ProjectItem[],
    address = '',
    proximity?: SearchProximity,
    singleStoreName?: string,
    singleStoreId?: string,
    description = ''
  ): Promise<ProjectSummary> {
    try {
      const created = await this.apiClient.post<any>(`/maestros/${ownerId}/proyectos`, {
        nombre: name.trim(),
        direccionObra: address.trim(),
        descripcion: description.trim(),
        proximidad: proximity ? {
          latitude: proximity.latitude,
          longitude: proximity.longitude,
          radiusKm: proximity.radiusKm
        } : null,
        ferreteriaUnica: singleStoreName?.trim() || null,
        ferreteriaUnicaId: singleStoreId?.trim() || null,
        items: items.map((item) => ({
          ...item,
          productName: item.productName.trim(),
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 0))
        }))
      }, true);

      const summary = this.mapProjectRow(created);
      this.upsertProjectBucket(this.getOrCreateProjectsBucket(ownerId), summary);
      this.invalidateMaestroState(ownerId);
      return summary;
    } catch (error) {
      throw this.normalizeError(error, 'No se pudo guardar la cotizacion.');
    }
  }

  async updateProject(
    ownerId: string,
    projectId: string,
    name: string,
    items: ProjectItem[],
    address = '',
    proximity?: SearchProximity,
    singleStoreName?: string,
    singleStoreId?: string,
    description = '',
    renewPrices = false
  ): Promise<ProjectSummary | null> {
    try {
      const updated = await this.apiClient.put<any>(`/maestros/${ownerId}/proyectos/${projectId}`, {
        nombre: name.trim(),
        direccionObra: address.trim(),
        descripcion: description.trim(),
        renovarPrecios: renewPrices,
        proximidad: proximity ? {
          latitude: proximity.latitude,
          longitude: proximity.longitude,
          radiusKm: proximity.radiusKm
        } : null,
        ferreteriaUnica: singleStoreName?.trim() || null,
        ferreteriaUnicaId: singleStoreId?.trim() || null,
        items: items.map((item) => ({
          ...item,
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
      const updated = await this.apiClient.post<any>(`/maestros/${ownerId}/proyectos/${projectId}/items`, {
        ...item,
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

  async deleteProject(ownerId: string, projectId: string): Promise<ProjectSummary[]> {
    await this.apiClient.delete(`/maestros/${ownerId}/proyectos/${projectId}`, true);
    await this.ensureProjectsLoaded(ownerId, true);
    this.invalidateMaestroState(ownerId);
    return this.getProjects(ownerId);
  }

  getFamilyProductRows(
    familyId: string,
    searchTerm = '',
    proximity?: SearchProximity,
    autoLoad = true
  ): FamilyProductRow[] {
    if (autoLoad) {
      this.observeLoad(this.ensureSearchRowsLoaded());
      this.observeLoad(this.ensureMasterCatalogLoaded());
    }

    const query = searchTerm.trim().toLowerCase();
    const masterByName = new Map(
      this.masterCatalog.map((item) => [item.name.toLowerCase(), item] as const)
    );
    const byProduct = new Map<string, {
      productName: string;
      minPrice: number;
      maxPrice: number;
      sellers: Set<string>;
      storeIds: Set<string>;
      brand: string;
      productType: string;
      imageUrl: string;
      imageFallbackUrl?: string;
      fullImageUrl?: string;
      nearestDistanceKm?: number;
    }>();

    this.filterSearchRowsByProximity(this.searchRows, proximity)
      .filter((row) => !familyId || row.familyId === familyId)
      .filter((row) => !query || row.productName.toLowerCase().includes(query))
      .forEach((row) => {
        const master = masterByName.get(row.productName.toLowerCase());
        const rowDistance = proximity && hasValidCoordinates(row.storeLatitude, row.storeLongitude)
          ? distanceKm(
            { latitude: proximity.latitude, longitude: proximity.longitude },
            { latitude: row.storeLatitude, longitude: row.storeLongitude as number }
          )
          : undefined;
        const current = byProduct.get(row.productName) || {
          productName: row.productName,
          minPrice: row.price,
          maxPrice: row.price,
          sellers: new Set<string>(),
          storeIds: new Set<string>(),
          brand: master?.brand || 'Sin marca',
          productType: master?.productType || 'Producto ferretero',
          imageUrl: master?.thumbnailImageUrl || (master?.imageUrl && !master.imageUrl.includes('via.placeholder.com') ? master.imageUrl : ''),
          fullImageUrl: master?.imageUrl || '',
          imageFallbackUrl: master?.imageFallbackUrl || '',
          nearestDistanceKm: rowDistance
        };

        current.minPrice = Math.min(current.minPrice, row.price);
        current.maxPrice = Math.max(current.maxPrice, row.price);
        current.sellers.add(row.storeName);
        current.storeIds.add(row.storeId || row.storeName);
        if (rowDistance !== undefined) {
          current.nearestDistanceKm = current.nearestDistanceKm === undefined
            ? rowDistance
            : Math.min(current.nearestDistanceKm, rowDistance);
        }
        byProduct.set(row.productName, current);
      });

    // The master catalog exists independently of store offers.
    for (const master of this.masterCatalog) {
      if (!master.isPublished || (familyId && master.familyId !== familyId)
        || (query && !master.name.toLowerCase().includes(query)) || byProduct.has(master.name)) continue;
      byProduct.set(master.name, {
        productName: master.name, minPrice: 0, maxPrice: 0,
        sellers: new Set<string>(), storeIds: new Set<string>(),
        brand: master.brand, productType: master.productType, imageUrl: master.thumbnailImageUrl || master.imageUrl, fullImageUrl: master.imageUrl, imageFallbackUrl: master.imageFallbackUrl
      });
    }

    return Array.from(byProduct.values())
      .map((item) => ({
        ...item,
        productName: item.productName,
        imageUrl: item.imageUrl,
        minPrice: item.minPrice,
        maxPrice: item.maxPrice,
        storeCount: item.storeIds.size,
        brand: item.brand,
        productType: item.productType,
        sellers: Array.from(item.sellers),
        nearestDistanceKm: item.nearestDistanceKm
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }

  getPopularProductRows(
    searchTerm = '',
    limit = 12,
    proximity?: SearchProximity,
    autoLoad = true
  ): FamilyProductRow[] {
    const rows = this.getFamilyProductRows('', searchTerm, proximity, autoLoad);
    return rows
      .sort((a, b) => b.storeCount - a.storeCount || a.productName.localeCompare(b.productName))
      .slice(0, Math.max(1, limit));
  }

  getProductOptions(filters: SearchFilters = {}, proximity?: SearchProximity, autoLoad = true): string[] {
    if (autoLoad) this.observeLoad(this.ensureSearchRowsLoaded());
    return Array.from(new Set(
      this.filterSearchRowsByProximity(this.searchRows, proximity)
        .filter((row) => !filters.categoryId || row.categoryId === filters.categoryId)
        .filter((row) => !filters.subcategoryId || row.subcategoryId === filters.subcategoryId)
        .filter((row) => !filters.familyId || row.familyId === filters.familyId)
        .map((row) => row.productName)
    )).sort((a, b) => a.localeCompare(b));
  }

  async recordOfferEvent(offerId: string | undefined, event: 'view' | 'select'): Promise<void> {
    if (!offerId || typeof window === 'undefined') return;
    try { await this.apiClient.post('/metricas/oferta', { offerId, event }, false); } catch { /* Metrics never block a purchase flow. */ }
  }

  async getStoreQuotation(storeId:string,code:string):Promise<StoreQuotationVerification> {
    try {return await this.apiClient.get<StoreQuotationVerification>(`/ferreterias/${encodeURIComponent(storeId)}/cotizaciones/${encodeURIComponent(code.trim())}`,true);}
    catch(error){throw this.normalizeError(error,'No pudimos verificar el código de cotización.');}
  }

  async loadStoreDailyDashboard(ownerId: string): Promise<{reports:StoreDailyAnalytics[]}> {
    return this.apiClient.get(`/ferreterias/propietario/${ownerId}/dashboard`, true);
  }

  async loadStoreMetrics(ownerId: string): Promise<{ views: number; selections: number }> {
    return this.apiClient.get(`/ferreterias/propietario/${ownerId}/metricas`, true);
  }

  async loadProductDetail(productName?: string, slug?: string): Promise<ProductDetailView | null> {
    const requestKey = slug ? `slug:${slug}` : (productName || '').trim().toLowerCase();
    const existing = this.productDetailRequests.get(requestKey);
    if (existing) return existing;
    const request = this.fetchProductDetail(productName, slug);
    this.productDetailRequests.set(requestKey, request);
    try { return await request; } finally { this.productDetailRequests.delete(requestKey); }
  }

  private async fetchProductDetail(productName?: string, slug?: string): Promise<ProductDetailView | null> {
    if (!productName?.trim() && !slug) await this.ensureMasterCatalogLoaded();
    const selectedName = productName?.trim() || (!slug ? this.masterCatalog[0]?.name : '') || '';
    if (!selectedName && !slug) return null;
    const key = slug ? `slug:${slug}` : selectedName.toLowerCase();
    if (this.productDetailByName.has(key) && Date.now() - (this.productDetailLoadedAt.get(key) || 0) < 60_000) {
      return this.productDetailByName.get(key) || null;
    }

    try {
      const raw = await this.apiClient.get<any>('/productos/detalle', false, {
        producto: selectedName || undefined,
        slug: slug || undefined
      });

      const detail = this.mapProductDetail(raw);

      this.productDetailLoadedAt.set(key, Date.now());
      this.productDetailByName.set(key, detail);
      this.productDetailByName.set(detail.productName.toLowerCase(), detail);
      this.productDetailLoadedAt.set(detail.productName.toLowerCase(), Date.now());
      return detail;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw this.normalizeError(error, 'No fue posible cargar el producto. Intenta nuevamente.');
    }
  }

  private mapProductDetail(raw: any): ProductDetailView {
      const master = raw.productoMaestro;
      const stores: ProductStoreOfferRow[] = (raw.stores || []).map((store: any) => ({
        offerId: store.productoFerreteriaId || '',
        storeName: store.storeName,
        storeId: store.storeId,
        latitude: typeof store.latitude === 'number' ? store.latitude : null,
        longitude: typeof store.longitude === 'number' ? store.longitude : null,
        address: store.address || '',
        commune: store.commune || '',
        price: Number(store.price) || 0,
        stock: Number(store.stock) || 0,
        rut: store.rut || '',
        email: store.email || '',
        phone: store.phone || '',
        priceUpdatedAt: store.priceUpdatedAt || '',
        includesVat: store.includesVat !== false,
        comparisonEligible: store.comparisonEligible !== false,
        includesShipping: store.includesShipping === true,
        validFrom: store.validFrom || store.priceUpdatedAt || '',
        validUntil: store.validUntil || null,
        offerConditions: store.offerConditions || 'Precio sujeto a stock y confirmación con la ferretería.',
        sponsored: store.sponsored === true,
        measurementUnit: store.measurementUnit || null,
        measurementQuantity: Number(store.measurementQuantity) > 0 ? Number(store.measurementQuantity) : null,
        pricePerMeasurement: Number(store.pricePerMeasurement) > 0 ? Number(store.pricePerMeasurement) : null,
        measurementSource: store.measurementSource || null,
        source: store.source || 'Informado por la ferretería'
      }));

      return {
        seoPath:master.seoPath,
        productoMaestroId: master.id,
        productName: master.nombre,
        imageUrl: master.imagenStorageUrl || master.imagenPrincipalUrl || master.imagenExternaUrl || '',
      imageFallbackUrl: master.imagenExternaUrl || '',
        gallery: Array.isArray(master.galeriaJson) && master.galeriaJson.length > 0
          ? master.galeriaJson
          : (master.imagenPrincipalUrl ? [master.imagenPrincipalUrl] : []),
        imageDisclosure: master.origenImagen === 'ai_generated'
          ? 'Imagen referencial generada con inteligencia artificial. Verifica presentación y características con la ferretería.'
          : master.imagenReferencial === true
            ? 'Imagen referencial del tipo de producto. La marca, presentación y medidas son las indicadas en la ficha.'
            : '',
        sku: raw.stores?.[0]?.sku || '',
        unitLabel: 'Unidad',
        packagingLabel: master.presentacion || 'Unidad',
        stock: stores.reduce((acc, item) => acc + item.stock, 0),
        brand: master.marca || 'Sin marca',
        productType: master.tipoProducto || master.descripcionCorta || 'Producto ferretero',
        categoryName: raw.categoryName || this.categories.find((item) => item.id === master.categoriaId)?.name || 'Sin categoria',
        subcategoryName: raw.subcategoryName || this.subcategories.find((item) => item.id === master.subcategoriaId)?.name || 'Sin subcategoria',
        familyName: raw.familyName || this.families.find((item) => item.id === master.familiaId)?.name || 'Sin familia',
        description: master.descripcionLarga || master.descripcionCorta || '',
        shortDescription: master.descripcionCorta || '',
        featureBullets: master.caracteristicasDestacadas || [master.descripcionCorta || ''],
        descriptionBlocks: [{ text: master.descripcionLarga || master.descripcionCorta || '' }],
        technicalSheet: (raw.atributosProducto || []).map((item: any) => ({
          label: item.etiqueta || item.definicionAtributoId,
          value: String(item.valorTexto ?? item.valorNumero ?? item.valorOpcion ?? item.valorBooleano ?? '')
        })),
        extraSections: [],
        minPrice: Number(raw.minPrice) || 0,
        maxPrice: Number(raw.maxPrice) || 0,
        stores,
        comparisonCriteria: raw.comparisonCriteria
          || 'Menor precio final unitario con IVA incluido, informado para la misma ficha de producto, con oferta activa y vigente. El patrocinio no altera el orden.'
      };

  }

  acceptCatalogSearchVersion(version: string): void {
    if (!version || typeof localStorage === 'undefined') return;
    const marker = `cotizapp-sheet-index-version:${this.dataMode?.mode() || 'real'}`;
    try {
      const previous = localStorage.getItem(marker);
      if (previous !== version) {
        this.productDetailByName.clear(); this.productDetailLoadedAt.clear();
        const prefix = `cotizapp-product-sheet-v1:${this.dataMode?.mode() || 'real'}:`;
        for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
        localStorage.setItem(marker, version);
      }
    } catch { /* Optional browser storage. */ }
  }

  async loadProductSheet(productName?: string, slug?: string): Promise<ProductDetailView | null> {
    const key = `cotizapp-product-sheet-v1:${this.dataMode?.mode() || 'real'}:${slug || productSlug(productName || '')}`;
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        if (cached?.raw?.productoMaestro?.id && Date.now() - cached.savedAt < 3_600_000) {
          return this.mapProductDetail(cached.raw);
        }
      } catch { /* Storage is optional. */ }
    }
    try {
      const raw = await this.apiClient.get<any>('/productos/detalle', false, {
        producto: productName || undefined, slug: slug || undefined, vista: 'ficha'
      });
      // Persist only the sheet. Prices, stock and store contacts are never persisted here.
      const sheet = { productoMaestro: raw.productoMaestro, categoryName: raw.categoryName,
        subcategoryName: raw.subcategoryName, familyName: raw.familyName, atributosProducto: raw.atributosProducto };
      if (typeof localStorage !== 'undefined') {
        try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), raw: sheet })); }
        catch { /* Storage is optional. */ }
      }
      return this.mapProductDetail(sheet);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw this.normalizeError(error, 'No fue posible cargar el producto. Intenta nuevamente.');
    }
  }

  async loadProductOffers(sheet: ProductDetailView): Promise<ProductDetailView> {
    const raw = await this.apiClient.get<any>('/productos/detalle', false, {
      slug: sheet.seoPath?.split('/').pop() || productSlug(sheet.productName), vista: 'ofertas'
    });
    const offers = this.mapProductDetail({ ...raw, productoMaestro: { id: sheet.productoMaestroId, nombre: sheet.productName } });
    return { ...sheet, stores: offers.stores, minPrice: offers.minPrice, maxPrice: offers.maxPrice,
      sku: offers.sku, stock: offers.stock };
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

  getBestOfferForProduct(
    productName: string,
    proximity?: SearchProximity,
    singleStoreName?: string,
    singleStoreId?: string
  ): { storeName: string; price: number } | null {
    this.observeLoad(this.ensureSearchRowsLoaded());

    const rows = this.filterSearchRowsByProximity(this.searchRows, proximity)
      .filter((row) => row.productName.toLowerCase() === productName.toLowerCase())
      .filter((row) => singleStoreId ? row.storeId === singleStoreId : !singleStoreName || row.storeName === singleStoreName)
      .sort((a, b) => a.price - b.price);

    if (rows.length === 0) {
      return null;
    }

    return {
      storeName: rows[0].storeName,
      price: rows[0].price
    };
  }

  buildProjectQuotation(
    items: ProjectItem[],
    proximity?: SearchProximity,
    singleStoreName?: string,
    singleStoreId?: string,
    pricingOffers?: SavedQuotationOffer[]
  ): ProjectQuotationView {
    if (pricingOffers) return buildQuotationOptimization(items, this.filterSearchRowsByProximity(pricingOffers, proximity), singleStoreName, singleStoreId);
    this.observeLoad(this.ensureSearchRowsLoaded());
    const key = JSON.stringify([items, proximity, singleStoreName, singleStoreId]);
    const cached = this.quotationCache.get(key);
    if (cached) return cached;
    const quotation = buildQuotationOptimization(items, this.filterSearchRowsByProximity(this.searchRows, proximity), singleStoreName, singleStoreId);
    if (this.quotationCache.size >= 16) this.quotationCache.clear();
    this.quotationCache.set(key, quotation);
    return quotation;
  }


  getProjectComparisonStrategies(
    items: ProjectItem[],
    _projectAddress = '',
    proximity?: SearchProximity,
    singleStoreName?: string,
    singleStoreId?: string,
    pricingOffers?: SavedQuotationOffer[]
  ): ProjectComparisonStrategy[] {
    const quotation = this.buildProjectQuotation(items, proximity, singleStoreName, singleStoreId, pricingOffers);
    const mixedStoresUsed = new Set(
      this.buildProjectQuotation(items, proximity, undefined, undefined, pricingOffers).lines
        .map((line) => line.bestStoreId || line.bestStoreName)
        .filter((name) => name && name !== 'Sin datos')
    ).size;

    if (quotation.appliedStoreName) {
      return [
        {
          id: 'same-store',
          title: 'Compra aplicada',
          subtitle: quotation.appliedStoreName,
          total: quotation.optimalTotal
        },
        {
          id: 'cheapest',
          title: 'Compra combinada',
          subtitle: mixedStoresUsed === 1 ? '1 ferreteria' : `${mixedStoresUsed} ferreterias`,
          total: quotation.mixedTotal,
          saving: Math.max(0, quotation.optimalTotal - quotation.mixedTotal)
        }
      ];
    }

    return [{
      id: 'cheapest',
      title: 'Menor precio combinado',
      subtitle: mixedStoresUsed === 1 ? '1 ferreteria' : `${mixedStoresUsed} ferreterias`,
      total: quotation.mixedTotal,
      saving: quotation.mixedSaving
    }];
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number.isFinite(value) ? value : 0);
  }

  private filterSearchRowsByProximity(
    rows: SearchRowExtended[],
    proximity?: SearchProximity
  ): SearchRowExtended[] {
    if (!proximity) return rows;

    return rows.filter((row) => {
      if (!hasValidCoordinates(row.storeLatitude, row.storeLongitude)) return false;
      const km = distanceKm(
        { latitude: proximity.latitude, longitude: proximity.longitude },
        { latitude: row.storeLatitude, longitude: row.storeLongitude as number }
      );
      return km <= proximity.radiusKm;
    });
  }

  private get publicCatalogStorageKey(): string {
    return `${PUBLIC_CATALOG_STORAGE_KEY}:${this.dataMode?.mode() || 'real'}`;
  }

  private restorePublicCatalogBrowserCache(): boolean {
    if (typeof localStorage === 'undefined') return false;

    try {
      localStorage.removeItem(LEGACY_PUBLIC_CATALOG_STORAGE_KEY);
      const raw = localStorage.getItem(this.publicCatalogStorageKey);
      if (!raw) return false;
      const snapshot = JSON.parse(raw) as PublicCatalogSnapshotApi & {cachedAt?:number};
      const age=Date.now()-(snapshot.cachedAt || Date.parse(snapshot.updatedAt || ''));
      if (!this.isUsablePublicCatalogSnapshot(snapshot) || !Number.isFinite(age) || age > 7 * 24 * 60 * 60_000) {
        localStorage.removeItem(this.publicCatalogStorageKey);
        return false;
      }
      this.publicCatalogNeedsPriceRefresh=age>60_000;
      this.applyPublicCatalogSnapshot(this.publicCatalogNeedsPriceRefresh?{...snapshot,searchRows:[]}:snapshot);
      return true;
    } catch {
      localStorage.removeItem(this.publicCatalogStorageKey);
      return false;
    }
  }

  private async fetchPublicCatalogSnapshot(version?: string): Promise<void> {
    const snapshot = await this.apiClient.get<PublicCatalogSnapshotApi>('/catalogo-publico', false, { v: version });
    if (!this.isUsablePublicCatalogSnapshot(snapshot)) {
      throw new Error('El catalogo publico recibido no contiene productos disponibles.');
    }
    this.applyPublicCatalogSnapshot(snapshot);
    this.publicCatalogNeedsPriceRefresh=false;
    ['basic-taxonomy', 'taxonomy', 'master', 'search', 'catalog'].forEach(key => this.clearLoadError(key));

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.publicCatalogStorageKey, JSON.stringify({...snapshot,cachedAt:Date.now()}));
      } catch {
        // Browser storage is optional; server-side cache remains authoritative.
      }
    }
  }

  private isUsablePublicCatalogSnapshot(snapshot: PublicCatalogSnapshotApi | null | undefined): snapshot is PublicCatalogSnapshotApi {
    return !!snapshot?.version
      && Array.isArray(snapshot.searchRows)
      && Array.isArray(snapshot.products);
  }

  private applyPublicCatalogSnapshot(snapshot: PublicCatalogSnapshotApi): void {
    if (snapshot.version !== this.publicCatalogVersion) this.productDetailByName.clear();
    this.publicCatalogVersion = snapshot.version || '';

    const categories = Array.isArray(snapshot.taxonomy?.categories) ? snapshot.taxonomy.categories : [];
    const subcategories = Array.isArray(snapshot.taxonomy?.subcategories) ? snapshot.taxonomy.subcategories : [];
    const families = Array.isArray(snapshot.taxonomy?.families) ? snapshot.taxonomy.families : [];

    this.replaceArray(this.categories, categories.map((item) => ({
      id: item.id,
      name: item.nombre, icon: item.icono
    })));
    this.replaceArray(this.subcategories, subcategories.map((item) => ({
      id: item.id,
      parentId: item.categoriaId,
      name: item.nombre, icon: item.icono
    })));
    this.replaceArray(this.families, families.map((item) => ({
      id: item.id,
      parentId: item.subcategoriaId,
      name: item.nombre, icon: item.icono
    })));

    const now=Date.now();
    const mappedSearchRows: SearchRowExtended[] = (snapshot.searchRows || []).filter(item=>
      (!item.validFrom || Date.parse(item.validFrom)<=now) && (!item.validUntil || Date.parse(item.validUntil)>now)
    ).map((item) => ({
      ...item,
      productName: item.productName,
      storeName: item.storeName,
      storeId: item.storeId,
      storeLatitude: typeof item.storeLatitude === 'number' ? item.storeLatitude : null,
      storeLongitude: typeof item.storeLongitude === 'number' ? item.storeLongitude : null,
      storeAddress: item.storeAddress || '',
      storeCommune: item.storeCommune || '',
      price: Number(item.price) || 0,
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
    }));
    this.replaceArray(this.searchRows, mappedSearchRows);

    const minPriceByProduct = new Map<string, number>();
    mappedSearchRows.forEach((row) => {
      const current = minPriceByProduct.get(row.productoMaestroId);
      minPriceByProduct.set(
        row.productoMaestroId,
        current === undefined ? row.price : Math.min(current, row.price)
      );
    });

    const mappedProducts = (snapshot.products || []).map((product) =>
      this.mapMasterProduct(product, minPriceByProduct.get(product.id) || 0)
    );
    this.replaceArray(this.masterCatalog, mappedProducts.sort((a, b) => a.name.localeCompare(b.name)));

    this.searchPromise = Promise.resolve();
    this.masterPromise = Promise.resolve();
    this.basicTaxonomyPromise = Promise.resolve();
  }

  private ensureBasicTaxonomyLoaded(force = false): Promise<void> {
    if (this.basicTaxonomyPromise && (!force || this.basicTaxonomyLoading)) {
      return this.basicTaxonomyPromise;
    }

    this.basicTaxonomyLoading = true;
    this.basicTaxonomyPromise = (async () => {
      try {
        this.clearLoadError('basic-taxonomy');
        const [categories, subcategories, families] = await Promise.all([
          this.apiClient.get<any[]>('/categorias'),
          this.apiClient.get<any[]>('/subcategorias'),
          this.apiClient.get<any[]>('/familias')
        ]);

        this.replaceArray(this.categories, categories.map((item) => ({ id: item.id, name: item.nombre, icon: item.icono })));
        this.replaceArray(this.subcategories, subcategories.map((item) => ({ id: item.id, parentId: item.categoriaId, name: item.nombre })));
        this.replaceArray(this.families, families.map((item) => ({ id: item.id, parentId: item.subcategoriaId, name: item.nombre })));
      } catch (error) {
        throw this.recordLoadError('basic-taxonomy', error, 'No se pudieron cargar las categorías.');
      } finally {
        this.basicTaxonomyLoading = false;
      }
    })();

    return this.basicTaxonomyPromise;
  }

  private ensureTaxonomyLoaded(force = false): Promise<void> {
    if (this.taxonomyPromise && (!force || this.taxonomyLoading)) {
      return this.taxonomyPromise;
    }

    this.taxonomyLoading = true;
    this.taxonomyPromise = (async () => {
      try {
        this.clearLoadError('taxonomy');
        await this.ensureBasicTaxonomyLoaded(force);
        const definitions = await this.apiClient.get<TaxonomyDefinitionApi[]>('/atributos-definicion');
        const definitionsByFamily = new Map<string, TaxonomyDefinitionApi[]>();

        definitions.forEach((definition) => {
          const bucket = definitionsByFamily.get(definition.familiaId) || [];
          bucket.push(definition);
          definitionsByFamily.set(definition.familiaId, bucket);
        });

        this.familyDefinitionsByFamily.clear();
        this.familyTemplates.clear();
        this.families.forEach((family) => {
          const familyDefinitions = definitionsByFamily.get(family.id) || [];
          this.familyDefinitionsByFamily.set(family.id, familyDefinitions);
          this.familyTemplates.set(family.id, this.mapFamilyTemplate(family.id, family.name, familyDefinitions));
        });
      } catch (error) {
        throw this.recordLoadError('taxonomy', error, 'No se pudieron cargar los atributos del catálogo.');
      } finally {
        this.taxonomyLoading = false;
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
        this.clearLoadError('search');
        const rows = await this.apiClient.get<any[]>('/busqueda');
        this.replaceArray(this.searchRows, rows.map((item) => ({
          ...item,
          productName: item.productName,
          storeName: item.storeName,
          storeId: item.storeId,
          storeLatitude: typeof item.storeLatitude === 'number' ? item.storeLatitude : null,
          storeLongitude: typeof item.storeLongitude === 'number' ? item.storeLongitude : null,
          storeAddress: item.storeAddress || '',
          storeCommune: item.storeCommune || '',
          price: Number(item.price) || 0,
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
      } catch (error) {
        throw this.recordLoadError('search', error, 'No se pudieron cargar las ofertas. Intenta nuevamente.');
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
        this.clearLoadError('master');
        const [products] = await Promise.all([
          this.apiClient.get<ProductoMaestroApi[]>('/productos-maestro'),
          this.ensureSearchRowsLoaded(force)
        ]);

        const rows = products.map((product) => {
          const relatedOffers = this.searchRows.filter((row) => row.productoMaestroId === product.id);
          const minPrice = relatedOffers.length > 0
            ? Math.min(...relatedOffers.map((row) => row.price))
            : 0;

          return this.mapMasterProduct(product, minPrice);
        });

        this.replaceArray(this.masterCatalog, rows.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        throw this.recordLoadError('master', error, 'No se pudo cargar el catálogo maestro.');
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
        this.clearLoadError('projects');
        const rows = await this.apiClient.get<any[]>(`/maestros/${ownerId}/proyectos`, true);
        const mapped = rows.map((item) => this.mapProjectRow(item));
        this.replaceArray(this.getOrCreateProjectsBucket(ownerId), mapped);
      } catch (error) {
        throw this.recordLoadError('projects', error, 'No se pudieron cargar tus cotizaciones.');
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
        this.clearLoadError('store-catalog');
        const ferreteriaId = await this.resolveFerreteriaId(ownerId);
        const rows = await this.apiClient.get<any[]>(`/ferreterias/${ferreteriaId}/catalogo`, true);
        const mapped = rows.map((item) => this.mapCatalogRow(ownerId, ferreteriaId, item));
        this.replaceArray(this.getOrCreateCatalogBucket(ownerId), mapped);
      } catch (error) {
        throw this.recordLoadError('store-catalog', error, 'No se pudo cargar el catálogo de la ferretería.');
      }
    })();

    this.catalogPromiseByOwner.set(ownerId, promise);
    return promise;
  }

  private ensureValidationQueueLoaded(force = false): Promise<void> {
    if (!force && this.validationPromise) {
      return this.validationPromise;
    }

    this.validationPromise = (async () => {
      try {
        this.clearLoadError('validation');
        await Promise.all([
          this.ensureTaxonomyLoaded(),
          this.ensureMasterCatalogLoaded()
        ]);

        const rows = await this.apiClient.get<any[]>('/solicitudes-creacion-producto', true);
        const mapped = rows.map((item) => this.mapValidationRequest(item));
        this.replaceArray(this.validationQueue, mapped);
      } catch (error) {
        throw this.recordLoadError('validation', error, 'No se pudieron cargar las solicitudes.');
      }
    })();

    return this.validationPromise;
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

    const data = await this.apiClient.get<{ id: string }>(`/ferreterias/by-owner/${ownerId}`, true);
    this.ferreteriaIdByOwner.set(ownerId, data.id);
    return data.id;
  }

  private mapMasterProduct(product: ProductoMaestroApi, minPrice: number): CatalogProduct {
    return {
      id: product.id,
      masterProductId: product.id,
      catalogLevel: product.catalogoNivel,
      name: product.nombre,
      barcode: product.codigoBarras || '',
      categoryId: product.categoriaId,
      subcategoryId: product.subcategoriaId,
      familyId: product.familiaId,
      brand: product.marca || 'Sin marca',
      brandId: product.marcaId || null,
      productType: product.tipoProducto || product.descripcionCorta || 'Producto ferretero',
      unitLabel: product.unidadVenta || 'Unidad',
      packagingLabel: product.presentacion || 'Unidad',
      price: minPrice,
      stock: 0,
      sku: '',
      storageImageUrl: product.imagenStorageUrl || '',
      storageImagePath: product.imagenStoragePath || '',
      thumbnailImageUrl: product.imagenMiniaturaUrl || '',
      thumbnailImagePath: product.imagenMiniaturaPath || '',
      imageUrl: product.imagenStorageUrl || product.imagenPrincipalUrl || product.imagenExternaUrl || '',
      imageFallbackUrl: product.imagenExternaUrl || '',
      isPublished: product.estado !== 'inactivo',
      shortDescription: product.descripcionCorta || '',
      descriptionBlocks: product.descripcionLarga ? [{ text: product.descripcionLarga }] : [],
      featureBullets: product.caracteristicasDestacadas || (product.descripcionCorta ? [product.descripcionCorta] : []),
      technicalSheet: [
        ...(typeof product.pesoLogisticoKg === 'number' ? [{label:'Peso logístico (kg)',value:String(product.pesoLogisticoKg)}] : []),
        ...(typeof product.volumenLogisticoM3 === 'number' ? [{label:'Volumen logístico (m3)',value:String(product.volumenLogisticoM3)}] : []),
        ...(typeof product.unidadesPorPallet === 'number' ? [{label:'Unidades por pallet',value:String(product.unidadesPorPallet)}] : [])
      ],
      extraSections: [],
      gallery: Array.isArray(product.galeriaJson) && product.galeriaJson.length > 0
        ? product.galeriaJson
        : (product.imagenPrincipalUrl ? [product.imagenPrincipalUrl] : []),
      specValues: {},
      templateVersion: 1,
      imageRights: {
        sourceType: product.origenImagen || '',
        provider: product.proveedorImagen || '',
        sourceTermsUrl: product.terminosFuenteUrl || '',
        authorizationReference: product.referenciaAutorizacion || '',
        containsThirdPartyMarks: product.contieneMarcasTerceros === true,
        trademarkAuthorizationReference: product.referenciaAutorizacionMarca || '',
        reviewedAt: product.derechosRevisadosEn
      },
      contentRights: {
        sourceType: product.origenContenido || '',
        sourceUrl: product.fuenteContenidoUrl || '',
        authorizationReference: product.referenciaDerechosContenido || '',
        reviewedAt: product.derechosContenidoRevisadosEn
      }
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
      productType: master.tipoProducto || master.descripcionCorta || 'Producto ferretero',
      unitLabel: master.unidadVenta || 'Unidad',
      packagingLabel: master.presentacion || 'Unidad',
      price: Number(row.precio) || 0,
      stock: Number(row.stock) || 0,
      sku: row.skuFerreteria || '',
      imageUrl: master.imagenStorageUrl || master.imagenPrincipalUrl || master.imagenExternaUrl || '',
      imageFallbackUrl: master.imagenExternaUrl || '',
      isPublished: Boolean(row.publicado),
      shortDescription: master.descripcionCorta || '',
      descriptionBlocks: master.descripcionLarga ? [{ text: master.descripcionLarga }] : [],
      featureBullets: master.descripcionCorta ? [master.descripcionCorta] : [],
      technicalSheet: [],
      extraSections: [],
      gallery: Array.isArray(master.galeriaJson) && master.galeriaJson.length > 0
        ? master.galeriaJson
        : (master.imagenPrincipalUrl ? [master.imagenPrincipalUrl] : []),
      specValues: {},
      templateVersion: 1,
      updatedAt: row.actualizadoEn || row.creadoEn || undefined,
      includesVat: row.incluyeIva !== false,
      validUntil: row.vigenteHasta ? String(row.vigenteHasta).slice(0, 10) : '',
      offerConditions: row.condicionesOferta || '',
      measurementUnit: row.unidadMedidaPrecio || '',
      measurementQuantity: Number(row.cantidadMedida) > 0 ? Number(row.cantidadMedida) : null
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
        availabilityStatus: row.availabilityStatus,
        pricesCheckedAt: row.pricesCheckedAt,
        verificationCode: row.verificationCode,
        pricesCapturedAt: row.pricesCapturedAt,
        validUntil: row.validUntil,
        expired: row.expired,
        pricingOffers: row.pricingOffers,
        id: row.id,
        description: row.description || '',
        name: row.name,
        address: row.address || '',
        proximity: this.mapSearchProximity(row.proximity),
        singleStoreId: row.singleStoreId || undefined,
        singleStoreName: typeof row.singleStoreName === 'string' && row.singleStoreName.trim()
          ? row.singleStoreName.trim()
          : undefined,
        createdAt: row.createdAt,
        items: (row.items || []).map((item: any) => ({
          ...item,
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
      ...item,
      productName: item.productName,
      quantity: Number(item.quantity) || 0
    }));

    return {
      id: row.id,
      name: row.nombre,
      address: row.direccionObra || '',
      proximity: this.mapSearchProximity(row.proximity || row.proximidad),
      singleStoreId: row.singleStoreId || row.ferreteriaUnicaId || undefined,
      singleStoreName: typeof (row.singleStoreName || row.ferreteriaUnica) === 'string'
        && String(row.singleStoreName || row.ferreteriaUnica).trim()
        ? String(row.singleStoreName || row.ferreteriaUnica).trim()
        : undefined,
      createdAt: row.creadoEn,
      items,
      totalOptimal: Number(latestQuotation?.total) || this.buildProjectQuotation(items).optimalTotal,
      saving: Number(latestQuotation?.ahorroEstimado) || 0
    };
  }

  private mapSearchProximity(value: any): SearchProximity | undefined {
    if (!value) return undefined;
    const latitude = Number(value.latitude ?? value.latitud);
    const longitude = Number(value.longitude ?? value.longitud);
    const radiusKm = Number(value.radiusKm ?? value.radioKm);
    if (
      !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || ![5, 10, 20, 50].includes(radiusKm)
    ) {
      return undefined;
    }
    return { latitude, longitude, radiusKm };
  }

  private mapFamilyTemplate(familyId: string, familyName: string, definitions: any[]): FamilyTemplate {
    const specFields: FamilySpecField[] = definitions.map((item, index) => ({
      id: item.codigo,
      label: item.etiqueta,
      type: this.mapFieldType(item.tipoDato),
      required: Boolean(item.esObligatorio),
      unitLabel: item.unidad || undefined,
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
  }

  private replaceArray<T>(target: T[], source: T[]): void {
    this.quotationCache.clear();
    target.splice(0, target.length, ...source);
  }

  private normalizeBarcode(value: string): string {
    return value.replace(/[^0-9A-Za-z]/g, '').trim().toLowerCase();
  }

  private createLocalId(prefix: string): string {
    const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  private async parseCatalogCsv(content: string): Promise<Array<{
    lineNumber: number;
    rawLine: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
    barcode: string;
    valid: boolean;
    error?: string;
  }>> {
    return parseCatalogImportContent(content);
  }

  private removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as Partial<T>;
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
