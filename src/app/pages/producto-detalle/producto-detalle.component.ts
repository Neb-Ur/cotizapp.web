import { offerConditionLabel } from '../../core/utils/offer-condition.util';
import { StoreWhatsappComponent } from '../../shared/components/store-whatsapp/store-whatsapp.component';
import { GUEST_QUOTATION_LIMIT_MESSAGE, GuestQuotationService } from '../../core/services/guest-quotation.service';
import { InfoPanelComponent } from '../../shared/components/info-panel/info-panel.component';
import { ProductImageDirective } from '../../shared/directives/product-image.directive';
import { productSlug } from '../../core/utils/product-url.util';
import { QuotationSelectionService } from '../../core/services/quotation-selection.service';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { SearchFilters, ProductDetailView, ProductStoreOfferRow, ProjectSummary, SessionUser, ProductGalleryPhoto } from '../../core/models/app.models';
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
  imports: [InfoPanelComponent, ProductImageDirective, CommonModule, FormsModule, RouterLink, UiModalComponent, StoreWhatsappComponent],
  templateUrl: './producto-detalle.component.html',
  styleUrl: './producto-detalle.component.scss'
})
export class ProductoDetalleComponent implements OnInit, OnDestroy {
  protected readonly conditionLabel = offerConditionLabel;
  protected catalogPath(kind:string,name:string):string {return `/${kind}/${productSlug(name)}`;}
  protected readonly guestQuotations = inject(GuestQuotationService);
  private readonly quotationSelection = inject(QuotationSelectionService);
  protected isAddingToQuotation = false;
  private readonly platformId = inject(PLATFORM_ID);
  protected offersLoading = true;
  protected offersError = '';
  private readonly changeDetector = inject(ChangeDetectorRef);
  private routeSubscription?: Subscription;
  private loadGeneration = 0;
  private offersRequestId = 0;
  private requestedStoreName = '';
  private requestedStoreId: string | null = null;
  private requestedOfferId = '';
  protected detail: ProductDetailView | null = null;
  protected isLoading = true;
  protected loadError = '';
  protected activeTab: 'descripcion' | 'ficha' | 'adicional' = 'descripcion';
  protected selectedImageIndex = 0;
  protected selectedStoreName = '';
  protected selectedStoreId = '';
  protected selectedOfferId = '';
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
  protected get hasPilotOffers():boolean { return this.displayStores.some(store=>store.pilot === true); }
  protected isStoreAvailable(store:ProductStoreOfferRow):boolean { return store.stock > 0 && store.price > 0; }
  protected get displayedStoreCount():number{return new Set(this.displayStores.map(store=>store.storeId||store.storeName)).size;}
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

  private vehicleFilters: Pick<SearchFilters, 'vehicleBrandId' | 'vehicleModelId' | 'vehicleYear'> = {};

  protected get vehicleFilterApplied(): boolean { return !!this.vehicleFilters.vehicleBrandId; }

  ngOnInit(): void {
    this.routeSubscription = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(async ([routeParams, params]) => {
      this.vehicleFilters = {vehicleBrandId:params.get('vehiculoMarcaId') || undefined, vehicleModelId:params.get('vehiculoModeloId') || undefined, vehicleYear:params.get('vehiculoAnio') ? Number(params.get('vehiculoAnio')) : undefined};
      const generation = ++this.loadGeneration;
      this.requestedStoreName = params.get('ferreteria') || '';
      this.requestedStoreId = params.get('ferreteriaId');
      this.requestedOfferId = params.get('ofertaId') || '';
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
        this.selectedOfferId = '';
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
          detail && currentUser
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
    if (this.detail) void this.refreshOffers(this.detail, this.loadGeneration,
      this.selectedStoreName || this.requestedStoreName,
      this.selectedStoreId || this.requestedStoreId,
      this.selectedOfferId || this.requestedOfferId);
  }

  private async refreshOffers(sheet: ProductDetailView, generation: number, requestedStore = this.requestedStoreName, requestedStoreId = this.requestedStoreId, requestedOfferId = this.requestedOfferId): Promise<void> {
    const requestId = ++this.offersRequestId;
    this.offersLoading = true;
    this.offersError = '';
    try {
      const detail = this.vehicleFilters.vehicleBrandId
        ? await this.apiService.loadProductOffers(sheet, this.vehicleFilters)
        : await this.apiService.loadProductOffers(sheet);
      if (generation !== this.loadGeneration || requestId !== this.offersRequestId) return;
      this.detail = detail;
      this.selectedImageIndex=Math.min(this.selectedImageIndex,Math.max(0,this.galleryImages.length-1));
      this.displayStores = this.buildDisplayStores(detail.stores);
      this.seoService.updateProduct(detail);
      const matches = this.displayStores.filter(store => this.isStoreAvailable(store) && (requestedStoreId
        ? this.storeSelectionId(store) === requestedStoreId : store.storeName === requestedStore)
        && (!requestedOfferId || store.offerId === requestedOfferId));
      if (matches.length === 1) {
        this.selectedStoreName = matches[0].storeName;
        this.selectedStoreId = this.storeSelectionId(matches[0]);
        this.selectedOfferId = matches[0].offerId || '';
      }
      for (const store of this.displayStores) {
        if (store.offerId && !this.recordedViews.has(store.offerId)) {
          this.recordedViews.add(store.offerId);
          void this.apiService.recordOfferEvent(store.offerId, 'view');
        }
      }
    } catch {
      if (generation === this.loadGeneration && requestId === this.offersRequestId) this.offersError = 'No fue posible cargar los precios. Intenta nuevamente.';
    } finally {
      if (generation === this.loadGeneration && requestId === this.offersRequestId) {
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
    return this.currentGalleryImage?.url || '';
  }
  protected get galleryImages(): ProductGalleryPhoto[] {
    if(!this.detail)return [];
    const generic=[...new Set((this.detail.gallery?.length?this.detail.gallery:[this.detail.imageUrl]).filter(Boolean))].map(url=>({url}));
    return [...generic,...(this.detail.storePhotos||[])];
  }
  protected get currentGalleryImage(): ProductGalleryPhoto | undefined {
    return this.galleryImages[this.selectedImageIndex]||this.galleryImages[0];
  }
  protected galleryImageKey(index:number,image:ProductGalleryPhoto):string {
    return `${image.offerId||'catalogo'}:${image.id||image.url||index}`;
  }
  protected hasStorePhotos(store:ProductStoreOfferRow):boolean {
    return !!store.offerId && !!store.storeId && this.galleryImages.some(photo=>photo.offerId===store.offerId&&photo.storeId===store.storeId);
  }
  protected showStorePhotos(store:ProductStoreOfferRow,event?:Event):void {
    event?.stopPropagation();
    const index=this.galleryImages.findIndex(photo=>photo.offerId===store.offerId&&photo.storeId===store.storeId);
    if(index>=0){this.selectImage(index);if(typeof document!=='undefined')document.querySelector('.gallery-panel')?.scrollIntoView({behavior:'smooth',block:'start'});}
  }

  protected get selectedStore(): ProductStoreOfferRow | null {
    return this.displayStores.find((store) => this.isStoreAvailable(store) && this.storeSelectionId(store) === this.selectedStoreId
      && (!this.selectedOfferId || store.offerId === this.selectedOfferId)) || null;
  }

  protected get selectedQuotationName(): string { return this.projects.find(project => project.id === this.selectedProjectId)?.name || ''; }
  protected get canUseQuotations(): boolean { const session = this.authService.currentUser(); return !session || session.role === 'maestro'; }

  protected get canShowAddToQuotation(): boolean {
    return this.canUseQuotations && !!this.selectedStore && !!this.selectedProjectId && this.selectedQuantity > 0 && !this.exceedsSelectedStock;
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

  protected selectStore(storeName: string, storeId: string, offerId = ''): void {
    if (!this.displayStores.some(store=>this.isStoreAvailable(store) && this.storeSelectionId(store)===storeId && (!offerId || store.offerId===offerId))) return;
    this.selectedStoreName = storeName;
    this.selectedStoreId = storeId;
    this.selectedOfferId = offerId;
    const photoIndex=this.galleryImages.findIndex(photo=>photo.storeId===storeId&&(!offerId||photo.offerId===offerId));
    if(photoIndex>=0)this.selectedImageIndex=photoIndex;
    void this.apiService.recordOfferEvent(this.selectedStore?.offerId, 'select');
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
      this.openCreateQuotationModal();
      return;
    }

    this.selectedProjectId = projectId;
    this.quotationSelection.select(this.user?.id || 'guest', projectId);
    this.quoteFeedback = '';
  }

  protected get canCreateQuotation(): boolean { return this.user ? this.projects.length < 2 : this.guestQuotations.canCreate(); }
  protected get quotationLimitMessage(): string { return this.user ? 'Puedes guardar hasta 2 cotizaciones. Elimina una para crear otra.' : GUEST_QUOTATION_LIMIT_MESSAGE; }

  protected openCreateQuotationModal(): void {
    if (!this.canUseQuotations) return;
    if (!this.canCreateQuotation) { this.quoteFeedback = this.quotationLimitMessage; return; }
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
    if (this.isCreatingQuotation) return;
    const currentUser = this.user;
    const name = this.newQuotationName.trim();

    if (!this.canUseQuotations) return;
    if (!this.canCreateQuotation) { this.createQuotationError = this.quotationLimitMessage; return; }

    if (!name) {
      this.createQuotationError = 'Escribe un nombre para la cotizacion.';
      return;
    }

    this.isCreatingQuotation = true;
    this.createQuotationError = '';

    try {
      const created = currentUser
        ? await this.apiService.saveProject(currentUser.id, name, [], this.newQuotationAddress)
        : this.guestQuotations.create(name, this.newQuotationAddress);
      this.projects = currentUser ? [...this.apiService.getProjects(currentUser.id)] : this.guestQuotations.all();
      if (!this.projects.some(project => project.id === created.id)) this.projects = [...this.projects, created];
      this.selectedProjectId = created.id;
      this.quotationSelection.select(currentUser?.id || 'guest', created.id);
      this.isCreateQuotationModalOpen = false;
      this.quoteFeedback = `Cotización “${created.name}” creada y seleccionada. Usa “Agregar a cotización” para incluir este producto.`;
    } catch (error) {
      this.createQuotationError = error instanceof Error
        ? error.message
        : 'No se pudo crear la cotizacion.';
    } finally {
      this.isCreatingQuotation = false; this.changeDetector.markForCheck();
    }
  }

  protected goToLoginFromQuotationModal(existingAccount = false): void {
    const returnUrl = this.router.serializeUrl(this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: {
        crearCotizacion: '1',
        ferreteria: this.selectedStoreName || null,
        ferreteriaId: this.selectedStoreId || null,
        ofertaId: this.selectedOfferId || null,
        cantidad: this.selectedQuantity
      },
      queryParamsHandling: 'merge'
    }));

    void this.router.navigate([existingAccount ? '/login' : '/registro'], {
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
    if (this.isAddingToQuotation || !this.detail || !this.selectedProjectId || !this.canShowAddToQuotation) return;
    this.isAddingToQuotation = true; this.quoteFeedback = ''; this.changeDetector.markForCheck();
    try {
      const item = { productName: this.detail.productName, productoMaestroId: this.detail.productoMaestroId,
        storeId: this.selectedStore?.storeId, storeName: this.selectedStore?.storeName,
        productoFerreteriaId: this.selectedStore?.offerId, quantity: this.selectedQuantity };
      const updated = this.user
        ? await this.apiService.addItemToProject(this.user.id, this.selectedProjectId, item)
        : this.guestQuotations.add(this.selectedProjectId, item);
      if (!this.user) this.projects = this.guestQuotations.all();
      this.quoteFeedback = updated ? `Agregado a “${updated.name}”: ${this.selectedQuantity} ${this.quantityLabel.toLowerCase()}.` : 'No se pudo agregar el producto a la cotización.';
    } catch (error) { this.quoteFeedback = error instanceof Error ? error.message : 'No se pudo agregar el producto. Intenta nuevamente.'; }
    finally { this.isAddingToQuotation = false; this.changeDetector.markForCheck(); }
  }

  protected goToSelectedQuotation(): void {
    if (!this.selectedProjectId) return;
    void this.router.navigate(this.user ? ['/dashboard/maestro/cotizaciones', this.selectedProjectId] : ['/cotizaciones/local', this.selectedProjectId]);
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
        const availability = Number(this.isStoreAvailable(right)) - Number(this.isStoreAvailable(left));
        if (availability) return availability;
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
    this.projects = currentUser ? this.apiService.getProjects(currentUser.id) : this.guestQuotations.all();
    {
      const ownerId = currentUser?.id || 'guest';
      const candidate = this.selectedProjectId || this.quotationSelection.read(ownerId);
      this.selectedProjectId = this.projects.some(project => project.id === candidate) ? candidate : '';
      if (this.projects.length && candidate && !this.selectedProjectId) this.quotationSelection.select(ownerId, '');
    }
  }

  private clearCreateQuotationIntent(): void {
    const url = this.router.parseUrl(this.router.url);
    delete url.queryParams['crearCotizacion'];
    delete url.queryParams['ferreteria'];
    delete url.queryParams['ferreteriaId'];
    delete url.queryParams['ofertaId'];
    delete url.queryParams['cantidad'];
    this.location.replaceState(this.router.serializeUrl(url));
  }
}
