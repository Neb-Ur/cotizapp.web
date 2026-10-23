import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowDownWideShort, faChevronDown, faLocationDot, faSliders, faXmark } from '@fortawesome/free-solid-svg-icons';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { Subscription } from 'rxjs';
import { FamilyProductRow, SearchFilters, SearchProximity, SessionUser, TaxonomyOption } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { VehicleCatalogService, VehicleCatalog } from '../../core/services/vehicle-catalog.service';
import { StoreDirectoryService } from '../../core/services/store-directory.service';
import {
  GeoCoordinates,
  clearNearbySearchPreference,
  getCurrentBrowserLocation,
  readNearbySearchPreference,
  saveNearbySearchPreference
} from '../../core/utils/location.util';
import { productPath } from '../../core/utils/product-url.util';
import { ProductImageDirective } from '../../shared/directives/product-image.directive';
import { ModalSurfaceDirective } from '../../shared/directives/modal-surface.directive';
import type { CatalogLandingView } from '../catalog-landing/catalog-landing.component';

@Component({
  selector: 'app-catalog-search',
  standalone: true,
  imports: [ProductImageDirective, CommonModule, RouterLink, FormsModule, FontAwesomeModule, PaginatorModule, ModalSurfaceDirective],
  templateUrl: './catalog-search.component.html',
  styleUrls: ['./catalog-search.component.scss']
})
export class CatalogSearchComponent implements OnInit, OnDestroy {
  /** Landing view (category, family or brand page) that scopes the search. */
  @Input() landing?: CatalogLandingView;
  /** True when rendered inside another page (e.g. the maestro panel) instead of a standalone route. */
  @Input() embedded = false;

  private catalogError = '';
  protected get dataLoadError(): string { return this.catalogError || this.apiService.loadError(); }
  protected async retryDataLoad(): Promise<void> {
    await this.loadCatalog(true).catch(() => undefined);
  }

  protected readonly faFilters = faSliders;
  protected readonly faSort = faArrowDownWideShort;
  protected readonly faLocation = faLocationDot;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faRemove = faXmark;

  protected selectedArea: SearchFilters['area'] = undefined;
  protected categorySearch = '';
  protected subcategorySearch = '';
  protected familySearch = '';
  protected tableProductSearch = '';
  protected selectedStoreId = '';
  protected selectedStoreName = '';
  protected storeOptions: Array<{ id: string; name: string }> = [];
  protected storeFilterError = '';
  protected selectedVehicleBrandId = '';
  protected selectedVehicleModelId = '';
  protected selectedVehicleYear = '';
  protected vehicleCatalog: VehicleCatalog = {brands:[],models:[]};
  protected vehicleCatalogError = '';
  protected vehicleYearError = '';
  private vehicleCatalogLoaded = false;
  private vehicleCatalogLoading = false;
  protected selectedBrand = '';
  protected selectedBrandId = '';
  protected selectedCategoryId = '';
  protected selectedSubcategoryId = '';
  protected selectedFamilyId = '';
  protected productRows: FamilyProductRow[] = [];
  protected totalProducts = 0;
  protected pageSize = 20;
  protected currentPage = 1;
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly nearbyRadiusOptions = [5, 10, 20, 50];
  protected nearbyEnabled = false;
  protected nearbyRadiusKm = 10;
  protected userLocation: GeoCoordinates | null = null;
  protected nearbyMessage = '';
  protected nearbyError = '';
  protected isLocatingNearby = false;
  protected filtersPanelOpen = false;
  protected isMobileFilters = false;
  protected nearbyPanelOpen = false;
  protected productSort = 'relevance';

  protected projectTarget = '';
  protected draftProjectName = '';
  protected draftProjectAddress = '';

  protected isInitialLoading = true;
  protected isCatalogLoading = false;
  protected isPublicCatalogRefreshing = false;

  private catalogLoaded = false;
  private lastQuerySearch = '';
  private searchReady = false;
  private searchRequestId = 0;
  private querySubscription?: Subscription;
  private destroyed = false;

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: FirebaseDataService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly storeDirectory: StoreDirectoryService | null = null,
    private readonly changeDetector: ChangeDetectorRef | null = null,
    private readonly vehicles: VehicleCatalogService | null = null
  ) {}

  ngOnInit(): void {
    this.syncFiltersViewport();
    // Embedded views are created during a render; start signal writes after it.
    if (this.landing) {
      queueMicrotask(() => { if (!this.destroyed) this.startCatalog(); });
      return;
    }
    this.startCatalog();
  }

  private startCatalog(): void {
    const savedNearby = readNearbySearchPreference();
    if (savedNearby) {
      this.nearbyEnabled = true;
      this.userLocation = {
        latitude: savedNearby.latitude,
        longitude: savedNearby.longitude
      };
      this.nearbyRadiusKm = savedNearby.radiusKm;
      this.nearbyMessage = `Mostrando locales a hasta ${this.nearbyRadiusKm} km de tu ubicacion.`;
    }

    this.querySubscription = this.route.queryParamMap.subscribe((params) => {
      const requestedQuery = params.get('q') || '';
      let filtersChanged = false;
      if (requestedQuery !== this.lastQuerySearch) {
        this.lastQuerySearch = requestedQuery;
        this.tableProductSearch = requestedQuery;
        filtersChanged = true;
      }

      const requestedStoreId = params.get('ferreteriaId') || '';
      const requestedStoreName = params.get('ferreteria') || '';
      const requestedBrand = params.get('marca') || this.landing?.filters['marca'] || '';
      const requestedBrandId = params.get('marcaId') || this.landing?.filters['marcaId'] || '';
      const area = params.get('rubro') || this.landing?.filters['rubro'] || '';
      const requestedArea = ['materiales','herramientas','repuestos'].includes(area) ? area as SearchFilters['area'] : undefined;
      const requestedVehicleBrand = params.get('vehiculoMarcaId') || this.landing?.filters['vehiculoMarcaId'] || '';
      const requestedVehicleModel = params.get('vehiculoModeloId') || this.landing?.filters['vehiculoModeloId'] || '';
      const requestedVehicleYear = params.get('vehiculoAnio') || '';
      const requestedCategory = params.get('categoria') || this.landing?.filters['categoria'] || '';
      const requestedSubcategory = params.get('subcategoria') || this.landing?.filters['subcategoria'] || '';
      const requestedFamily = params.get('familia') || this.landing?.filters['familia'] || '';
      if (
        requestedArea !== this.selectedArea || requestedVehicleBrand !== this.selectedVehicleBrandId || requestedVehicleModel !== this.selectedVehicleModelId
        || requestedVehicleYear !== this.selectedVehicleYear || requestedStoreId !== this.selectedStoreId || requestedStoreName !== this.selectedStoreName
        || requestedBrand !== this.selectedBrand || requestedBrandId !== this.selectedBrandId
        || requestedCategory !== this.selectedCategoryId
        || requestedSubcategory !== this.selectedSubcategoryId
        || requestedFamily !== this.selectedFamilyId
      ) {
        this.selectedArea = requestedArea;
        this.selectedVehicleBrandId = requestedVehicleBrand;
        this.selectedVehicleModelId = requestedVehicleModel;
        this.selectedVehicleYear = requestedVehicleYear;
        this.selectedStoreId = requestedStoreId;
        this.selectedStoreName = requestedStoreName;
        this.selectedBrand = requestedBrand;
        this.selectedBrandId = requestedBrandId;
        this.selectedCategoryId = requestedCategory;
        this.selectedSubcategoryId = requestedSubcategory;
        this.selectedFamilyId = requestedFamily;
        this.syncTaxonomySearchLabels();
        filtersChanged = true;
      }

      this.projectTarget = params.get('projectTarget') || '';
      this.draftProjectName = params.get('draftName') || '';
      this.draftProjectAddress = params.get('draftAddress') || '';

      if (filtersChanged) {
        this.currentPage = 1;
        this.refreshProductRows();
      }
      if (!this.isInitialLoading) {
        void this.loadCatalog();
      }
    });

    void this.initializeCatalog();
  }

  protected get user(): SessionUser | null {
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'maestro' ? currentUser : null;
  }

  protected get showVehicleFilters(): boolean {
    return this.selectedArea === 'repuestos' || this.selectedCategoryId === 'cat-repuestos-automotrices'
      || /repuesto|automotriz|automotrices/i.test(this.tableProductSearch)
      || !!this.selectedVehicleBrandId || !!this.selectedVehicleModelId || !!this.selectedVehicleYear
      || this.familyOptions.some(f => f.id === this.selectedFamilyId && f.supportsVehicleApplications)
      || this.productRows.some(p => p.categoryId === 'cat-repuestos-automotrices');
  }

  protected get vehicleModelOptions() {
    return this.vehicleCatalog.models.filter(model => model.marcaId === this.selectedVehicleBrandId);
  }

  protected async loadVehicleCatalog(): Promise<void> {
    if (!this.vehicles || this.vehicleCatalogLoaded || this.vehicleCatalogLoading) return;
    this.vehicleCatalogLoading = true;
    try {
      const catalog = await this.vehicles.publicCatalog();
      if (this.destroyed) return;
      this.vehicleCatalog = catalog;
      this.vehicleCatalogLoaded = true;
      this.vehicleCatalogError = '';
    } catch { this.vehicleCatalogError = 'No se pudieron cargar las marcas y modelos de vehículos.'; }
    finally { this.vehicleCatalogLoading = false; this.changeDetector?.markForCheck(); }
  }

  protected onVehicleBrandChange(id: string): void {
    this.selectedVehicleBrandId = id;
    this.selectedVehicleModelId = '';
    this.selectedVehicleYear = '';
    this.applyVehicleFilters();
  }

  protected onVehicleModelChange(id: string): void {
    this.selectedVehicleModelId = id;
    this.selectedVehicleYear = '';
    this.applyVehicleFilters();
  }

  protected onVehicleYearChange(value: string | number | null): void {
    this.selectedVehicleYear = value === null ? '' : String(value);
    const year = Number(this.selectedVehicleYear);
    this.vehicleYearError = this.selectedVehicleYear && (!Number.isInteger(year) || year < 1886 || year > 2100)
      ? 'Indica un año entre 1886 y 2100.' : '';
    if (!this.vehicleYearError) this.applyVehicleFilters();
  }

  private resetVehicleFilters(): void {
    this.selectedVehicleBrandId = this.selectedVehicleModelId = this.selectedVehicleYear = '';
    this.vehicleYearError = '';
  }

  protected clearVehicleFilters(): void {
    this.resetVehicleFilters();
    this.applyVehicleFilters();
  }

  private applyVehicleFilters(): void {
    this.vehicleYearError = '';
    this.currentPage = 1;
    this.refreshProductRows(true);
  }

  protected get categoryOptions(): TaxonomyOption[] {
    return this.apiService.getCategoryOptions(false);
  }

  protected get subcategoryOptions(): TaxonomyOption[] {
    return this.selectedCategoryId
      ? this.apiService.getSubcategoryOptions(this.selectedCategoryId, false)
      : [];
  }

  protected get familyOptions(): TaxonomyOption[] {
    return this.selectedSubcategoryId
      ? this.apiService.getFamilyOptions(this.selectedSubcategoryId, false)
      : [];
  }

  protected get selectedCategoryName(): string {
    return this.categoryOptions.find((item) => item.id === this.selectedCategoryId)?.name || '';
  }

  protected get selectedSubcategoryName(): string {
    return this.subcategoryOptions.find((item) => item.id === this.selectedSubcategoryId)?.name || '';
  }

  protected get selectedFamilyName(): string {
    return this.familyOptions.find((item) => item.id === this.selectedFamilyId)?.name || '';
  }

  protected get isPickingProductForProject(): boolean {
    return !!this.projectTarget;
  }

  protected get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalProducts / this.pageSize));
  }

  protected get paginatedProductRows(): FamilyProductRow[] {
    return this.productRows;
  }

  protected get currentProximity(): SearchProximity | undefined {
    if (!this.nearbyEnabled || !this.userLocation) return undefined;
    return {
      latitude: this.userLocation.latitude,
      longitude: this.userLocation.longitude,
      radiusKm: this.nearbyRadiusKm
    };
  }

  protected get taxonomyFilterCount(): number {
    return [this.selectedArea, this.selectedStoreId, this.selectedCategoryId, this.selectedSubcategoryId, this.selectedFamilyId, this.selectedBrand, this.selectedVehicleBrandId, this.selectedVehicleModelId, this.selectedVehicleYear]
      .filter(Boolean).length;
  }

  protected toggleNearbyPanel(): void {
    this.nearbyPanelOpen = !this.nearbyPanelOpen;
  }

  protected toggleFiltersPanel(): void {
    this.filtersPanelOpen = !this.filtersPanelOpen;
  }

  @HostListener('window:resize')
  protected syncFiltersViewport(): void {
    this.isMobileFilters = typeof window !== 'undefined' && window.innerWidth <= 900;
    if (!this.isMobileFilters) this.filtersPanelOpen = false;
  }

  protected async toggleNearbySearch(): Promise<void> {
    this.nearbyError = '';
    this.nearbyMessage = '';

    if (this.nearbyEnabled) {
      this.nearbyEnabled = false;
      this.userLocation = null;
      clearNearbySearchPreference();
      this.currentPage = 1;
      this.refreshProductRows();
      return;
    }

    this.isLocatingNearby = true;
    try {
      this.userLocation = await getCurrentBrowserLocation();
      this.nearbyEnabled = true;
      this.nearbyMessage = `Mostrando locales a hasta ${this.nearbyRadiusKm} km de tu ubicacion.`;
      saveNearbySearchPreference({
        latitude: this.userLocation.latitude,
        longitude: this.userLocation.longitude,
        radiusKm: this.nearbyRadiusKm
      });
      this.currentPage = 1;
      this.refreshProductRows();
    } catch (error) {
      this.nearbyError = error instanceof Error ? error.message : 'No se pudo obtener tu ubicacion.';
    } finally {
      this.isLocatingNearby = false;
    }
  }

  protected onNearbyRadiusChange(value: number | string): void {
    const parsed = Number(value);
    this.nearbyRadiusKm = this.nearbyRadiusOptions.includes(parsed) ? parsed : 10;
    this.nearbyMessage = this.nearbyEnabled
      ? `Mostrando locales a hasta ${this.nearbyRadiusKm} km de tu ubicacion.`
      : '';
    if (this.nearbyEnabled && this.userLocation) {
      saveNearbySearchPreference({
        latitude: this.userLocation.latitude,
        longitude: this.userLocation.longitude,
        radiusKm: this.nearbyRadiusKm
      });
    }
    this.currentPage = 1;
    this.refreshProductRows();
  }

  private async loadStoreOptions(): Promise<void> {
    try {
      const result = await this.storeDirectory!.list(1, '', '', '', 1);
      if (this.destroyed) return;
      this.storeOptions = result.storeOptions;
      this.storeFilterError = '';
      const selected = this.storeOptions.find(store => store.id === this.selectedStoreId);
      if (selected) this.selectedStoreName = selected.name;
    } catch { if (!this.destroyed) this.storeFilterError = 'No se pudo cargar el filtro de locales.'; }
    finally { if (!this.destroyed) this.changeDetector?.markForCheck(); }
  }

  protected onAreaChange(area: SearchFilters['area']): void {
    this.selectedArea = area || undefined;
    this.selectedCategoryId = ''; this.selectedSubcategoryId = ''; this.selectedFamilyId = '';
    if (area !== 'repuestos') { this.selectedVehicleBrandId = ''; this.selectedVehicleModelId = ''; this.selectedVehicleYear = ''; }
    this.currentPage = 1; this.refreshProductRows(true);
  }

  protected onStoreFilterChange(id: string): void {
    this.selectedStoreId = id;
    this.selectedStoreName = this.storeOptions.find(store => store.id === id)?.name || '';
    this.currentPage = 1;
    this.refreshProductRows(true);
  }

  private syncStoreFilterUrl(): void {
    void this.router.navigate([], {relativeTo:this.route, queryParamsHandling:'merge', replaceUrl:true,
      queryParams: {rubro:this.selectedArea || null,vehiculoMarcaId:this.selectedVehicleBrandId || null, vehiculoModeloId:this.selectedVehicleModelId || null, vehiculoAnio:this.selectedVehicleYear || null, ferreteriaId:this.selectedStoreId || null, ferreteria:this.selectedStoreName || null,
        marca:this.selectedBrand || null, marcaId:this.selectedBrandId || null,
        categoria:this.selectedCategoryId || null, subcategoria:this.selectedSubcategoryId || null,
        familia:this.selectedFamilyId || null, q:this.tableProductSearch || null}});
  }

  protected onCategoryInput(value: string): void {
    this.categorySearch = value;
    const match = this.findByName(this.categoryOptions, value);
    this.selectedCategoryId = match?.id || '';
    const clearVehicle = this.selectedCategoryId !== 'cat-repuestos-automotrices' && !!(this.selectedVehicleBrandId || this.selectedVehicleModelId || this.selectedVehicleYear);
    if (clearVehicle) this.resetVehicleFilters();
    this.selectedSubcategoryId = '';
    this.selectedFamilyId = '';
    this.subcategorySearch = '';
    this.familySearch = '';
    this.currentPage = 1;
    this.refreshProductRows(true);
  }

  protected onSubcategoryInput(value: string): void {
    this.subcategorySearch = value;
    const match = this.findByName(this.subcategoryOptions, value);
    this.selectedSubcategoryId = match?.id || '';
    this.selectedFamilyId = '';
    this.familySearch = '';
    this.currentPage = 1;
    this.refreshProductRows(true);
  }

  protected onFamilyInput(value: string): void {
    this.familySearch = value;
    const match = this.findByName(this.familyOptions, value);
    this.selectedFamilyId = match?.id || '';
    this.currentPage = 1;
    this.refreshProductRows(true);
  }

  protected onProductSortChange(value: string): void {
    this.productSort = value;
    this.currentPage = 1;
    this.refreshProductRows();
  }

  protected clearBrandFilter(): void {
    this.selectedBrand = '';
    this.selectedBrandId = '';
    this.currentPage = 1;
    this.refreshProductRows(true);
  }

  protected clearCategoryFilter(): void {
    this.resetVehicleFilters();
    this.categorySearch = '';
    this.subcategorySearch = '';
    this.familySearch = '';
    this.selectedCategoryId = '';
    this.selectedSubcategoryId = '';
    this.selectedFamilyId = '';
    this.currentPage = 1;
    this.refreshProductRows(true);
  }

  protected clearAllFilters(): void {
    this.selectedArea = undefined;
    this.selectedStoreId = '';
    this.selectedStoreName = '';
    this.selectedBrand = '';
    this.selectedBrandId = '';
    this.clearCategoryFilter();
  }

  protected clearSubcategoryFilter(): void {
    this.subcategorySearch = '';
    this.familySearch = '';
    this.selectedSubcategoryId = '';
    this.selectedFamilyId = '';
    this.currentPage = 1;
    this.refreshProductRows(true);
  }

  protected clearFamilyFilter(): void {
    this.familySearch = '';
    this.selectedFamilyId = '';
    this.currentPage = 1;
    this.refreshProductRows(true);
  }

  protected onProductsPageChange(event: PaginatorState): void {
    this.pageSize = event.rows ?? this.pageSize;
    this.currentPage = (event.page ?? 0) + 1;
    this.refreshProductRows();
  }

  protected selectProductCard(event: Event, productName: string, seoPath?: string): void {
    const click = event as MouseEvent;
    if (click.ctrlKey || click.metaKey || click.shiftKey || click.altKey || (click.button !== undefined && click.button !== 0)) return;
    event.preventDefault();
    void this.router.navigateByUrl(this.productUrl(productName, seoPath));
  }

  protected productUrl(productName: string, seoPath?: string): string {
    const path = seoPath || productPath(productName);
    const params = new URLSearchParams();
    if (this.projectTarget) params.set('projectTarget', this.projectTarget);
    if (this.draftProjectName) params.set('draftName', this.draftProjectName);
    if (this.draftProjectAddress) params.set('draftAddress', this.draftProjectAddress);
    if (this.selectedStoreId) { params.set('ferreteriaId',this.selectedStoreId); params.set('ferreteria',this.selectedStoreName); }
    if (this.selectedVehicleBrandId) params.set('vehiculoMarcaId',this.selectedVehicleBrandId);
    if (this.selectedVehicleModelId) params.set('vehiculoModeloId',this.selectedVehicleModelId);
    if (this.selectedVehicleYear && !this.vehicleYearError) params.set('vehiculoAnio',this.selectedVehicleYear);
    return params.size ? `${path}?${params}` : path;
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  private async initializeCatalog(): Promise<void> {
    try {
      await this.loadCatalog();
    } finally {
      this.isInitialLoading = false;
    }
  }

  private async loadCatalog(force = false): Promise<void> {
    if (!force && this.catalogLoaded) return;

    this.isCatalogLoading = true;
    try {
      await this.apiService.refreshSearchTaxonomy(force);
      if (this.storeDirectory) void this.loadStoreOptions();
      if (this.showVehicleFilters) void this.loadVehicleCatalog();
      this.searchReady = true;
      if (!await this.fetchProductPage()) return;

      this.catalogError = '';
      this.catalogLoaded = true;
    } catch (error) {
      this.catalogError = error instanceof Error ? error.message : 'No se pudo cargar el catálogo. Intenta nuevamente.';
      this.catalogLoaded = false;
    } finally {
      this.isCatalogLoading = false;
    }
  }

  private refreshProductRows(syncUrl = false): void {
    if (this.landing && this.searchReady) {
      const selected: Record<string, string> = {rubro:this.selectedArea || '',vehiculoMarcaId:this.selectedVehicleBrandId,vehiculoModeloId:this.selectedVehicleModelId,familia:this.selectedFamilyId,categoria:this.selectedCategoryId,subcategoria:this.selectedSubcategoryId,marca:this.selectedBrand,marcaId:this.selectedBrandId};
      if (Object.entries(this.landing.filters).some(([key, value]) => value && selected[key] !== value)) {
        void this.router.navigate(['/buscar'], {queryParams:{...selected,rubro:this.selectedArea || undefined,q:this.tableProductSearch || undefined,vehiculoMarcaId:this.selectedVehicleBrandId || undefined,vehiculoModeloId:this.selectedVehicleModelId || undefined,vehiculoAnio:this.selectedVehicleYear || undefined,ferreteriaId:this.selectedStoreId || undefined,ferreteria:this.selectedStoreName || undefined,projectTarget:this.projectTarget || undefined}});
        return;
      }
    }
    if (syncUrl) this.syncStoreFilterUrl();
    if (!this.searchReady) return;
    void this.fetchProductPage();
  }

  private async fetchProductPage(): Promise<boolean> {
    const vehicleYear = this.selectedVehicleYear ? Number(this.selectedVehicleYear) : undefined;
    this.vehicleYearError = vehicleYear !== undefined && (!Number.isInteger(vehicleYear) || vehicleYear < 1886 || vehicleYear > 2100)
      ? 'Indica un año entre 1886 y 2100.' : '';
    if (this.vehicleYearError) {
      this.searchRequestId++;
      this.isPublicCatalogRefreshing = false;
      return false;
    }
    const requestId = ++this.searchRequestId;
    this.syncTaxonomySearchLabels();
    this.isPublicCatalogRefreshing = true;
    this.catalogError = '';
    try {
      const result = await this.apiService.searchProductPage({
        ...(this.landing && /^\/(repuestos|vehiculos|marcas-vehiculos)(\/|$)/.test(this.landing.path) ? {seoOnly:this.landing.index !== false} : {}),
        area: this.selectedArea,
        query: this.tableProductSearch.trim(),
        categoryId: this.selectedCategoryId,
        subcategoryId: this.selectedSubcategoryId,
        familyId: this.selectedFamilyId,
        brand: this.selectedBrand,
        ...(this.selectedVehicleBrandId ? {vehicleBrandId:this.selectedVehicleBrandId} : {}),
        ...(this.selectedVehicleModelId ? {vehicleModelId:this.selectedVehicleModelId} : {}),
        ...(this.selectedVehicleYear ? {vehicleYear:Number(this.selectedVehicleYear)} : {}),
        ...(this.selectedStoreId ? {storeId:this.selectedStoreId} : {}),
        ...(this.selectedBrandId ? {brandId:this.selectedBrandId} : {})
      }, this.currentPage, this.pageSize, this.productSort, this.currentProximity);
      if (requestId !== this.searchRequestId) return false;
      this.productRows = result.items;
      if (this.showVehicleFilters) void this.loadVehicleCatalog();
      this.totalProducts = result.total;
      this.currentPage = result.page;
      this.pageSize = result.size;
      return true;
    } catch (error) {
      if (requestId !== this.searchRequestId) return false;
      this.catalogError = error instanceof Error ? error.message : 'No se pudieron cargar los productos. Intenta nuevamente.';
      this.catalogLoaded = false;
      return false;
    } finally {
      if (requestId === this.searchRequestId) this.isPublicCatalogRefreshing = false;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.querySubscription?.unsubscribe();
    this.searchRequestId++;
  }

  private findByName(options: TaxonomyOption[], value: string): TaxonomyOption | null {
    const normalized = value.trim().toLowerCase();
    return options.find((option) => option.name.toLowerCase() === normalized) || null;
  }

  private syncTaxonomySearchLabels(): void {
    this.categorySearch = this.selectedCategoryId
      ? this.apiService.getCategoryOptions(false).find((option) => option.id === this.selectedCategoryId)?.name || this.categorySearch
      : '';
    this.subcategorySearch = this.selectedSubcategoryId
      ? this.apiService.getSubcategoryOptions(this.selectedCategoryId, false).find((option) => option.id === this.selectedSubcategoryId)?.name || this.subcategorySearch
      : '';
    this.familySearch = this.selectedFamilyId
      ? this.apiService.getFamilyOptions(this.selectedSubcategoryId, false).find((option) => option.id === this.selectedFamilyId)?.name || this.familySearch
      : '';
  }
}
