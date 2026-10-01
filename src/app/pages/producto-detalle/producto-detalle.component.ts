import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductDetailView, ProductStoreOfferRow, ProjectSummary, SessionUser } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import {
  GeoCoordinates,
  distanceKm,
  hasValidCoordinates,
  readNearbySearchPreference
} from '../../core/utils/location.util';

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './producto-detalle.component.html',
  styleUrl: './producto-detalle.component.scss'
})
export class ProductoDetalleComponent implements OnInit {
  protected detail: ProductDetailView | null = null;
  protected isLoading = true;
  protected activeTab: 'descripcion' | 'ficha' | 'adicional' = 'descripcion';
  protected selectedImageIndex = 0;
  protected selectedStoreName = '';
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
  private openExtraSectionIds = new Set<string>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly apiService: FirebaseDataService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(async (params) => {
      this.isLoading = true;
      this.detail = null;
      const productName = params.get('product') || '';
      const nearbyPreference = readNearbySearchPreference();
      this.nearbyEnabled = !!nearbyPreference;
      this.nearbyLocation = nearbyPreference
        ? { latitude: nearbyPreference.latitude, longitude: nearbyPreference.longitude }
        : null;
      this.nearbyRadiusKm = nearbyPreference?.radiusKm || 10;

      try {
        const currentUser = this.user;
        if (currentUser) {
          await this.apiService.refreshMaestroData(currentUser.id);
        }

        this.detail = await this.apiService.loadProductDetail(productName)
          || this.apiService.getProductDetail(productName);

        this.selectedImageIndex = 0;
        this.selectedStoreName = '';
        this.selectedQuantity = 1;
        this.selectedProjectId = '';
        this.quoteFeedback = '';
        this.openExtraSectionIds.clear();
        this.loadProjects();
        this.displayStores = this.buildDisplayStores(this.detail?.stores || []);
      } finally {
        this.isLoading = false;
      }
    });
  }

  protected get user(): SessionUser | null {
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'maestro' ? currentUser : null;
  }

  protected get bestPriceStoreName(): string {
    return this.displayStores[0]?.storeName || 'Sin datos';
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
    return this.displayStores.find((store) => store.storeName === this.selectedStoreName) || null;
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

  protected selectStore(storeName: string): void {
    this.selectedStoreName = storeName;
    this.quoteFeedback = '';
  }

  protected onQuantityChange(value: number | string): void {
    const parsed = Math.floor(Number(value));
    this.selectedQuantity = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    this.quoteFeedback = '';
  }

  protected onProjectChange(projectId: string): void {
    if (projectId === this.createQuotationOptionValue) {
      this.selectedProjectId = '';
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
      this.quoteFeedback = `Cotizacion "${created.name}" creada y seleccionada.`;
    } catch (error) {
      this.createQuotationError = error instanceof Error
        ? error.message
        : 'No se pudo crear la cotizacion.';
    } finally {
      this.isCreatingQuotation = false;
    }
  }

  protected goToLoginFromQuotationModal(): void {
    void this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url }
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
      .sort((left, right) => left.price - right.price);
  }

  private loadProjects(): void {
    const currentUser = this.user;
    this.projects = currentUser ? this.apiService.getProjects(currentUser.id) : [];
  }
}
