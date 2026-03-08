import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductDetailView, ProductStoreOfferRow, ProjectSummary, SessionUser } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService } from '../../core/services/mock-api.service';

type LocationMode = 'none' | 'user' | 'quotation';
type PriceSortMode = 'price-asc' | 'price-desc';

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './producto-detalle.component.html',
  styleUrl: './producto-detalle.component.scss'
})
export class ProductoDetalleComponent implements OnInit {
  protected detail: ProductDetailView | null = null;
  protected activeTab: 'descripcion' | 'adicional' = 'descripcion';
  protected selectedImageIndex = 0;
  protected selectedStoreName = '';
  protected selectedQuantity = 1;
  protected selectedProjectId = '';
  protected coverQuantity = 0;
  protected coverDepthCm = 8;
  protected projects: ProjectSummary[] = [];
  protected displayStores: ProductStoreOfferRow[] = [];
  protected locationMode: LocationMode = 'none';
  protected locationNotice = '';
  protected priceSort: PriceSortMode = 'price-asc';
  protected quoteFeedback = '';
  private openExtraSectionIds = new Set<string>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly apiService: MockApiService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(async (params) => {
      const productName = params.get('product') || '';
      const currentUser = this.user;
      if (currentUser) {
        await this.apiService.refreshMaestroData(currentUser.id);
      }
      this.detail = await this.apiService.loadProductDetail(productName)
        || this.apiService.getProductDetail(productName)
        || this.apiService.getProductDetail();
      this.selectedImageIndex = 0;
      this.activeTab = 'descripcion';
      this.selectedStoreName = '';
      this.selectedQuantity = 1;
      this.coverQuantity = 0;
      this.coverDepthCm = this.detail?.coverageConfig?.defaultDepthCm || 8;
      this.locationMode = 'none';
      this.locationNotice = '';
      this.priceSort = 'price-asc';
      this.quoteFeedback = '';
      this.openExtraSectionIds.clear();
      this.loadProjects();
      this.refreshDisplayStores();
    });
  }

  protected get user(): SessionUser | null {
    return this.authService.currentUser();
  }

  protected get bestPriceStoreName(): string {
    return this.detail?.stores[0]?.storeName || 'Sin datos';
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  protected get currentImageUrl(): string {
    if (!this.detail) {
      return '';
    }

    return this.detail.gallery[this.selectedImageIndex] || this.detail.imageUrl;
  }

  protected get selectedStore(): ProductStoreOfferRow | null {
    if (!this.selectedStoreName) {
      return null;
    }
    return this.displayStores.find((store) => store.storeName === this.selectedStoreName) || null;
  }

  protected get canShowAddToQuotation(): boolean {
    return !!this.selectedStore && !!this.selectedProjectId && this.selectedQuantity > 0 && !this.exceedsSelectedStock;
  }

  protected get selectedTotal(): number {
    const store = this.selectedStore;
    if (!store) {
      return 0;
    }
    return this.selectedQuantity * store.price;
  }

  protected get quantityLabel(): string {
    return this.detail?.packagingLabel || this.detail?.unitLabel || 'unidad';
  }

  protected get hasCoverageCalculator(): boolean {
    return !!this.detail?.coverageConfig;
  }

  protected get coverageDescription(): string {
    return this.detail?.coverageConfig?.description || '';
  }

  protected get shouldAskDepthCm(): boolean {
    return !!this.detail?.coverageConfig?.requiresDepthCm;
  }

  protected get neededPackagesByCoverage(): number {
    const config = this.detail?.coverageConfig;
    if (!config || this.coverQuantity <= 0) {
      return 0;
    }

    const baseAmount = config.yieldUnit === 'm3'
      ? (this.coverQuantity * Math.max(0, this.coverDepthCm)) / 100
      : this.coverQuantity;

    if (baseAmount <= 0 || config.yieldPerPackage <= 0) {
      return 0;
    }

    return Math.ceil(baseAmount / config.yieldPerPackage);
  }

  protected get exceedsSelectedStock(): boolean {
    return !!this.selectedStore && this.selectedQuantity > this.selectedStore.stock;
  }

  protected get hasProjects(): boolean {
    return this.projects.length > 0;
  }

  protected get selectedProject(): ProjectSummary | null {
    if (!this.selectedProjectId) {
      return null;
    }
    return this.projects.find((project) => project.id === this.selectedProjectId) || null;
  }

  protected get selectedProjectAddress(): string {
    return this.selectedProject?.address?.trim() || '';
  }

  protected get showDistances(): boolean {
    if (this.locationMode === 'user') {
      return true;
    }
    if (this.locationMode === 'quotation') {
      return !!this.selectedProjectAddress;
    }
    return false;
  }

  protected selectImage(index: number): void {
    this.selectedImageIndex = index;
  }

  protected selectStore(storeName: string): void {
    this.selectedStoreName = storeName;
    this.quoteFeedback = '';
  }

  protected onQuantityChange(value: number | string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      this.selectedQuantity = 1;
      return;
    }

    const quantity = Math.floor(parsed);
    if (quantity < 1) {
      this.selectedQuantity = 1;
      return;
    }

    this.selectedQuantity = quantity;
    this.quoteFeedback = '';
  }

  protected onCoverQuantityChange(value: number | string): void {
    const parsed = Number(value);
    this.coverQuantity = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    this.applyCoverageRecommendation();
    this.quoteFeedback = '';
  }

  protected onDepthChange(value: number | string): void {
    const parsed = Number(value);
    this.coverDepthCm = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    this.applyCoverageRecommendation();
    this.quoteFeedback = '';
  }

  protected onProjectChange(projectId: string): void {
    this.selectedProjectId = projectId;
    if (this.locationMode === 'quotation') {
      if (!projectId) {
        this.locationMode = 'none';
        this.locationNotice = '';
      } else if (!this.selectedProjectAddress) {
        this.locationMode = 'none';
        this.locationNotice = 'La cotizacion seleccionada no tiene direccion de obra.';
      } else {
        this.locationNotice = 'Distancias calculadas segun la direccion de la cotizacion.';
      }
    }
    this.refreshDisplayStores();
    this.quoteFeedback = '';
  }

  protected useUserLocation(): void {
    this.locationMode = 'user';
    this.locationNotice = 'Distancias calculadas segun tu ubicacion.';
    this.refreshDisplayStores();
  }

  protected useQuotationLocation(): void {
    if (!this.selectedProjectId) {
      this.locationNotice = 'Primero selecciona una cotizacion.';
      return;
    }
    if (!this.selectedProjectAddress) {
      this.locationMode = 'none';
      this.locationNotice = 'La cotizacion seleccionada no tiene direccion de obra.';
      return;
    }
    this.locationMode = 'quotation';
    this.locationNotice = 'Distancias calculadas segun la direccion de la cotizacion.';
    this.refreshDisplayStores();
  }

  protected onPriceSortChange(value: PriceSortMode | string): void {
    this.priceSort = value === 'price-desc' ? 'price-desc' : 'price-asc';
    this.refreshDisplayStores();
  }

  protected setTab(tab: 'descripcion' | 'adicional'): void {
    this.activeTab = tab;
  }

  protected isExtraSectionOpen(sectionId: string): boolean {
    return this.openExtraSectionIds.has(sectionId);
  }

  protected toggleExtraSection(sectionId: string): void {
    if (this.openExtraSectionIds.has(sectionId)) {
      this.openExtraSectionIds.delete(sectionId);
      return;
    }
    this.openExtraSectionIds.add(sectionId);
  }

  protected async addToQuotation(): Promise<void> {
    if (!this.user || !this.detail || !this.selectedStore || !this.selectedProjectId || !this.canShowAddToQuotation) {
      return;
    }

    const updated = await this.apiService.addItemToProject(this.user.id, this.selectedProjectId, {
      productName: this.detail.productName,
      quantity: this.selectedQuantity
    });

    if (!updated) {
      this.quoteFeedback = 'No se pudo agregar el producto a la cotizacion seleccionada.';
      return;
    }

    this.quoteFeedback = `Agregado a "${updated.name}": ${this.selectedQuantity} ${this.quantityLabel.toLowerCase()} en ${this.selectedStore.storeName}.`;
  }

  protected backToSearch(): void {
    this.router.navigateByUrl('/dashboard/maestro');
  }

  private applyCoverageRecommendation(): void {
    const recommended = this.neededPackagesByCoverage;
    if (recommended > 0) {
      this.selectedQuantity = recommended;
    }
  }

  private loadProjects(): void {
    const currentUser = this.user;
    if (!currentUser) {
      this.projects = [];
      this.selectedProjectId = '';
      return;
    }

    this.projects = this.apiService.getProjectsByStatus(currentUser.id, 'pendiente');
    if (this.projects.some((project) => project.id === this.selectedProjectId)) {
      return;
    }
    this.selectedProjectId = '';
    this.refreshDisplayStores();
  }

  private resolveDistance(store: ProductStoreOfferRow): number {
    if (this.locationMode === 'quotation' && this.selectedProjectAddress) {
      return this.apiService.resolveStoreDistance(store.storeName, store.distanceKm, this.selectedProjectAddress);
    }
    return store.distanceKm;
  }

  private refreshDisplayStores(): void {
    const stores = [...(this.detail?.stores || [])].map((store) => ({
      ...store,
      distanceKm: this.resolveDistance(store)
    }));

    stores.sort((left, right) => this.priceSort === 'price-asc'
      ? left.price - right.price
      : right.price - left.price);

    this.displayStores = stores;
  }
}
