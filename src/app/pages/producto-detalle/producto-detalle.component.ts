import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { ProductDetailView, ProductStoreOfferRow, ProjectSummary, SessionUser } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { SeoService } from '../../core/services/seo.service';
import { UiModalComponent } from '../../shared/components/ui-modal/ui-modal.component';
import {
  GeoCoordinates,
  distanceKm,
  getCurrentBrowserLocation,
  hasValidCoordinates,
  readNearbySearchPreference
} from '../../core/utils/location.util';

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UiModalComponent],
  templateUrl: './producto-detalle.component.html',
  styleUrl: './producto-detalle.component.scss'
})
export class ProductoDetalleComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  protected offersLoading = true;
  protected offersError = '';
  private readonly changeDetector = inject(ChangeDetectorRef);
  private routeSubscription?: Subscription;
  private loadGeneration = 0;
  protected detail: ProductDetailView | null = null;
  protected isLoading = true;
  protected loadError = '';
  protected activeTab: 'descripcion' | 'ficha' | 'adicional' = 'descripcion';
  protected selectedImageIndex = 0;
  protected selectedStoreName = '';
  protected selectedStoreId = '';
  protected selectedQuantity = 1;
  protected selectedProjectId = '';
  protected projects: ProjectSummary[] = [];
  protected readonly createQuotationOptionValue = '__create_quotation__';
  protected isCreateQuotationModalOpen = false;
  protected newQuotationName = '';
  protected newQuotationAddress = '';
  protected createQuotationError = '';
  protected isCreatingQuotation = false;
  protected displayStores: ProductStoreOfferRow[] = [];
  protected quoteFeedback = '';
  protected nearbyEnabled = false;
  protected nearbyRadiusKm = 10;
  protected nearbyLocation: GeoCoordinates | null = null;
  protected locationLoading = false;
  protected locationError = '';
  protected storeSort: 'price' | 'distance' = 'price';
  private openExtraSectionIds = new Set<string>();
  private readonly recordedViews = new Set<string>();
  private handledCreateQuotationIntent = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly apiService: FirebaseDataService,
    private readonly location: Location,
    private readonly seoService: SeoService
  ) {}

  ngOnInit(): void {
    this.routeSubscription = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(async ([routeParams, params]) => {
      const generation = ++this.loadGeneration;
      this.isLoading = true;
      this.loadError = '';
      this.offersLoading = true;
      this.offersError = '';
      this.displayStores = [];
      this.detail = null;
      const legacyProductName = params.get('product') || '';
      let productName = legacyProductName;
      const nearbyPreference = readNearbySearchPreference();
      this.nearbyEnabled = !!nearbyPreference;
      this.nearbyLocation = nearbyPreference
        ? { latitude: nearbyPreference.latitude, longitude: nearbyPreference.longitude }
        : null;
      this.nearbyRadiusKm = nearbyPreference?.radiusKm || 10;

      try {
        const currentUser = this.user;
        if (currentUser) {
          void this.apiService.refreshMaestroProjectsSection(currentUser.id)
            .then(() => { if (generation === this.loadGeneration) { this.loadProjects(); this.changeDetector.markForCheck(); } })
            .catch(() => undefined);
        }

        const detail = await this.apiService.loadProductSheet(productName || undefined, routeParams.get('slug') || undefined);
        if (generation !== this.loadGeneration) return;
        this.detail = detail;

        if (this.detail) {
          this.seoService.updateProduct(this.detail);
        } else {
          this.seoService.markProductNotFound();
        }

        this.selectedImageIndex = 0;
        this.selectedStoreName = '';
        this.selectedStoreId = '';
        this.selectedQuantity = 1;
        this.selectedProjectId = '';
        this.quoteFeedback = '';
        this.storeSort = 'price';
        this.openExtraSectionIds.clear();
        this.loadProjects();
        this.displayStores = this.buildDisplayStores(this.detail?.stores || []);

        const requestedQuantity = Math.floor(Number(params.get('cantidad')));
        if (Number.isFinite(requestedQuantity) && requestedQuantity > 0) {
          this.selectedQuantity = requestedQuantity;
        }

        if (detail && isPlatformBrowser(this.platformId)) {
          void this.refreshOffers(detail, generation, params.get('ferreteria') || '', params.get('ferreteriaId'));
        }

        if (
          currentUser
          && params.get('crearCotizacion') === '1'
          && !this.handledCreateQuotationIntent
        ) {
          this.handledCreateQuotationIntent = true;
          this.openCreateQuotationModal();
          this.clearCreateQuotationIntent();
        }
      } catch (error) {
        if (generation !== this.loadGeneration) return;
        this.loadError = error instanceof Error ? error.message : 'No fue posible cargar el producto. Intenta nuevamente.';
      } finally {
        if (generation === this.loadGeneration) {
          this.isLoading = false;
          this.changeDetector.markForCheck();
        }
      }
    });
  }

  protected retryOffers(): void {
    if (this.detail) void this.refreshOffers(this.detail, this.loadGeneration);
  }

  private async refreshOffers(sheet: ProductDetailView, generation: number, requestedStore = '', requestedStoreId: string | null = null): Promise<void> {
    this.offersLoading = true;
    this.offersError = '';
    try {
      const detail = await this.apiService.loadProductOffers(sheet);
      if (generation !== this.loadGeneration) return;
      this.detail = detail;
      this.displayStores = this.buildDisplayStores(detail.stores);
      this.seoService.updateProduct(detail);
      const matches = this.displayStores.filter(store => requestedStoreId
        ? store.storeId === requestedStoreId : store.storeName === requestedStore);
      if (matches.length === 1) {
        this.selectedStoreName = matches[0].storeName;
        this.selectedStoreId = this.storeSelectionId(matches[0]);
      }
      for (const store of this.displayStores) {
        if (store.offerId && !this.recordedViews.has(store.offerId)) {
          this.recordedViews.add(store.offerId);
          void this.apiService.recordOfferEvent(store.offerId, 'view');
        }
      }
    } catch {
      if (generation === this.loadGeneration) this.offersError = 'No fue posible cargar los precios. Intenta nuevamente.';
    } finally {
      if (generation === this.loadGeneration) {
        this.offersLoading = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  ngOnDestroy(): void {
    this.loadGeneration++;
    this.routeSubscription?.unsubscribe();
  }

  protected get user(): SessionUser | null {
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'maestro' ? currentUser : null;
  }

  protected get bestPriceStoreName(): string {
    return this.displayStores
      .filter((store) => store.comparisonEligible)
      .sort((left, right) => left.price - right.price)[0]?.storeName || 'Sin oferta comparable';
  }

  protected get visibleMinPrice(): number {
    return this.displayStores.length > 0
      ? Math.min(...this.displayStores.map((store) => store.price))
      : 0;
  }

  protected get visibleMaxPrice(): number {
    return this.displayStores.length > 0
      ? Math.max(...this.displayStores.map((store) => store.price))
      : 0;
  }

  protected get currentImageUrl(): string {
    if (!this.detail) return '';
    return this.detail.gallery[this.selectedImageIndex] || this.detail.imageUrl;
  }

  protected get selectedStore(): ProductStoreOfferRow | null {
    return this.displayStores.find((store) => this.storeSelectionId(store) === this.selectedStoreId) || null;
  }

  protected get canShowAddToQuotation(): boolean {
    return !!this.selectedStore && !!this.selectedProjectId && this.selectedQuantity > 0 && !this.exceedsSelectedStock;
  }

  protected get selectedTotal(): number {
    return (this.selectedStore?.price || 0) * this.selectedQuantity;
  }

  protected get quantityLabel(): string {
    return this.detail?.packagingLabel || this.detail?.unitLabel || 'unidad';
  }

  protected get exceedsSelectedStock(): boolean {
    return !!this.selectedStore && this.selectedQuantity > this.selectedStore.stock;
  }

  protected get hasProjects(): boolean {
    return this.projects.length > 0;
  }

  protected selectImage(index: number): void {
    this.selectedImageIndex = index;
  }

  protected storeSelectionId(store: ProductStoreOfferRow): string {
    return store.storeId || store.offerId || store.storeName;
  }

  protected selectStore(storeName: string, storeId: string): void {
    void this.apiService.recordOfferEvent(this.displayStores.find(store => this.storeSelectionId(store) === storeId)?.offerId, 'select');
    this.selectedStoreName = storeName;
    this.selectedStoreId = storeId;
    this.quoteFeedback = '';
  }

  protected onQuantityChange(value: number | string): void {
    const parsed = Math.floor(Number(value));
    this.selectedQuantity = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    this.quoteFeedback = '';
  }

  protected storeTotal(store: ProductStoreOfferRow): number {
    return store.price * this.selectedQuantity;
  }

  protected async enableLocationDistances(): Promise<void> {
    this.locationLoading = true;
    this.locationError = '';

    try {
      this.nearbyLocation = await getCurrentBrowserLocation();
      this.displayStores = this.buildDisplayStores(this.detail?.stores || []);
    } catch (error) {
      this.locationError = error instanceof Error
        ? error.message
        : 'No fue posible obtener tu ubicación.';
    } finally {
      this.locationLoading = false;
    }
  }

  protected onStoreSortChange(sort: 'price' | 'distance'): void {
    if (sort === 'distance' && !this.nearbyLocation) return;
    this.storeSort = sort;
    this.displayStores = this.buildDisplayStores(this.detail?.stores || []);
  }

  protected onProjectChange(projectId: string): void {
    if (projectId === this.createQuotationOptionValue) {
      this.selectedProjectId = '';
      if (!this.user) {
        this.goToLoginFromQuotationModal();
        return;
      }
      this.openCreateQuotationModal();
      return;
    }

    this.selectedProjectId = projectId;
    this.quoteFeedback = '';
  }

  protected openCreateQuotationModal(): void {
    this.newQuotationName = '';
    this.newQuotationAddress = '';
    this.createQuotationError = '';
    this.isCreateQuotationModalOpen = true;
  }

  protected closeCreateQuotationModal(): void {
    if (this.isCreatingQuotation) return;
    this.isCreateQuotationModalOpen = false;
    this.createQuotationError = '';
  }

  protected async createQuotation(): Promise<void> {
    const currentUser = this.user;
    const name = this.newQuotationName.trim();

    if (!currentUser) {
      this.createQuotationError = 'Inicia sesion como maestro para crear una cotizacion.';
      return;
    }

    if (!name) {
      this.createQuotationError = 'Escribe un nombre para la cotizacion.';
      return;
    }

    this.isCreatingQuotation = true;
    this.createQuotationError = '';

    try {
      const created = await this.apiService.saveProject(
        currentUser.id,
        name,
        [],
        this.newQuotationAddress
      );
      this.projects = [...this.apiService.getProjects(currentUser.id)];
      this.selectedProjectId = created.id;
      this.isCreateQuotationModalOpen = false;

      if (this.selectedStore && this.detail && !this.exceedsSelectedStock) {
        const updated = await this.apiService.addItemToProject(currentUser.id, created.id, {
          productName: this.detail.productName,
          productoMaestroId: this.detail.productoMaestroId,
          storeId: this.selectedStore?.storeId,
          storeName: this.selectedStore?.storeName,
          productoFerreteriaId: this.selectedStore?.offerId,
          quantity: this.selectedQuantity
        });

        if (updated) {
          this.quoteFeedback = `Cotización "${created.name}" creada con ${this.selectedQuantity} ${this.quantityLabel.toLowerCase()} agregada(s).`;
        } else {
          this.quoteFeedback = `Cotización "${created.name}" creada, pero no fue posible agregar el producto. Presiona "Agregar a cotización" para intentarlo nuevamente.`;
        }
      } else {
        this.quoteFeedback = `Cotización "${created.name}" creada. Selecciona una ferretería y presiona "Agregar a cotización" para incluir el producto.`;
      }
    } catch (error) {
      this.createQuotationError = error instanceof Error
        ? error.message
        : 'No se pudo crear la cotizacion.';
    } finally {
      this.isCreatingQuotation = false;
    }
  }

  protected goToLoginFromQuotationModal(): void {
    const returnUrl = this.router.serializeUrl(this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: {
        crearCotizacion: '1',
        ferreteria: this.selectedStoreName || null,
        ferreteriaId: this.selectedStoreId || null,
        cantidad: this.selectedQuantity
      },
      queryParamsHandling: 'merge'
    }));

    void this.router.navigate(['/login'], {
      queryParams: { returnUrl }
    });
  }

  protected setTab(tab: 'descripcion' | 'ficha' | 'adicional'): void {
    this.activeTab = tab;
  }

  protected isExtraSectionOpen(sectionId: string): boolean {
    return this.openExtraSectionIds.has(sectionId);
  }

  protected toggleExtraSection(sectionId: string): void {
    if (this.openExtraSectionIds.has(sectionId)) {
      this.openExtraSectionIds.delete(sectionId);
    } else {
      this.openExtraSectionIds.add(sectionId);
    }
  }

  protected async addToQuotation(): Promise<void> {
    if (!this.user || !this.detail || !this.selectedProjectId || !this.canShowAddToQuotation) return;

    const updated = await this.apiService.addItemToProject(this.user.id, this.selectedProjectId, {
      productName: this.detail.productName,
          productoMaestroId: this.detail.productoMaestroId,
          storeId: this.selectedStore?.storeId,
          storeName: this.selectedStore?.storeName,
          productoFerreteriaId: this.selectedStore?.offerId,
      quantity: this.selectedQuantity
    });

    this.quoteFeedback = updated
      ? `Agregado a "${updated.name}": ${this.selectedQuantity} ${this.quantityLabel.toLowerCase()}.`
      : 'No se pudo agregar el producto a la cotizacion.';
  }

  protected backToSearch(): void {
    this.router.navigate(['/buscar']);
  }

  protected formatDistance(value: number | undefined): string {
    if (value === undefined) return '';
    if (value < 1) return `${Math.round(value * 1000)} m`;
    return `${value.toFixed(1)} km`;
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  protected measurementLabel(unit: ProductStoreOfferRow['measurementUnit']): string {
    const labels: Record<string, string> = {
      kg: 'kg',
      l: 'litro',
      m: 'metro',
      m2: 'm²',
      m3: 'm³',
      unidad: 'unidad'
    };
    return unit ? labels[unit] || unit : '';
  }

  private buildDisplayStores(stores: ProductStoreOfferRow[]): ProductStoreOfferRow[] {
    return stores
      .map((store) => {
        if (!this.nearbyLocation || !hasValidCoordinates(store.latitude, store.longitude)) {
          return { ...store, distanceKm: undefined };
        }

        return {
          ...store,
          distanceKm: distanceKm(
            this.nearbyLocation,
            { latitude: store.latitude, longitude: store.longitude as number }
          )
        };
      })
      .filter((store) => !this.nearbyEnabled
        || (store.distanceKm !== undefined && store.distanceKm <= this.nearbyRadiusKm))
      .sort((left, right) => {
        if (this.storeSort === 'distance') {
          const leftDistance = left.distanceKm ?? Number.POSITIVE_INFINITY;
          const rightDistance = right.distanceKm ?? Number.POSITIVE_INFINITY;
          return leftDistance - rightDistance || left.price - right.price || left.storeName.localeCompare(right.storeName, 'es');
        }
        return left.price - right.price || left.storeName.localeCompare(right.storeName, 'es');
      });
  }

  private loadProjects(): void {
    const currentUser = this.user;
    this.projects = currentUser ? this.apiService.getProjects(currentUser.id) : [];
  }

  private clearCreateQuotationIntent(): void {
    const url = this.router.parseUrl(this.router.url);
    delete url.queryParams['crearCotizacion'];
    delete url.queryParams['ferreteria'];
    delete url.queryParams['ferreteriaId'];
    delete url.queryParams['cantidad'];
    this.location.replaceState(this.router.serializeUrl(url));
  }
}
