import { StoreQuotationVerifierComponent } from '../../shared/components/store-quotation-verifier/store-quotation-verifier.component';
import { StoreDailyAnalytics } from '../../core/models/app.models';
import { Subscription } from 'rxjs';
import { WriteFeedbackService } from '../../core/services/write-feedback.service';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import {
  CatalogImportOutcome,
  CatalogImportReport,
  CatalogImportRowResult,
  CatalogProduct,
  SessionUser,
  TaxonomyOption
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import {
  CATALOG_IMPORT_TEMPLATE,
  catalogFileToCsv,
  catalogImportTemplateFileName,
  downloadCatalogImportErrors,
  downloadCatalogImportTemplate
} from '../../core/utils/catalog-import.util';
import { getCurrentBrowserLocation } from '../../core/utils/location.util';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';
import { UiModalComponent } from '../../shared/components/ui-modal/ui-modal.component';
import { StoreOnboardingComponent } from '../../shared/components/store-onboarding/store-onboarding.component';

type FerreteriaSection = 'inicio' | 'catalogo' | 'cotizaciones' | 'perfil';
type CatalogUploadMode = 'buscar' | 'archivo' | 'solicitud';

interface FerreteriaSectionMeta {
  id: FerreteriaSection;
  label: string;
  description: string;
}

interface MasterCatalogSelectionDraft {
  selected: boolean;
  price: number;
  stock: number;
}

@Component({
  selector: 'app-dashboard-ferreteria',
  standalone: true,
  imports: [StoreQuotationVerifierComponent, CommonModule, FormsModule, PaginatorModule, UiModalComponent, UiLoaderComponent, StoreOnboardingComponent],
  templateUrl: './dashboard-ferreteria.component.html',
  styleUrl: './dashboard-ferreteria.component.scss'
})
export class DashboardFerreteriaComponent implements OnInit, OnDestroy {
  private sectionLoadError = '';
  protected get dataLoadError(): string { return this.sectionLoadError || this.apiService.loadError(); }
  protected async retryDataLoad(): Promise<void> {
    await this.ensureSectionData(this.currentSection, true).catch(() => undefined);
  }

  protected readonly sections: FerreteriaSectionMeta[] = [
    { id: 'inicio', label: 'Inicio', description: 'Resumen de la actividad de tu ferretería.' },
    { id: 'catalogo', label: 'Mantener catálogo', description: 'Mantiene precio, stock y agrega productos cuando lo necesites.' },
    { id: 'cotizaciones', label: 'Verificar cotizaciones', description: 'Consulta el código del maestro y verifica los productos cotizados con tu ferretería.' },
    { id: 'perfil', label: 'Editar perfil', description: 'Actualiza los datos visibles y la ubicación de tu ferretería.' }
  ];

  protected currentSection: FerreteriaSection = 'inicio';
  protected catalogView: 'maintain' | 'add' = 'maintain';
  protected catalog: CatalogProduct[] = [];
  protected catalogSearch = '';
  protected catalogPage = 1;
  protected catalogPageSize = 20;
  protected readonly catalogPageSizeOptions = [10, 20, 50];

  protected catalogEditCandidate: CatalogProduct | null = null;
  protected catalogEditModalOpen = false;
  protected catalogEditDraft = {
    price: 0,
    stock: 0,
    isPublished: true,
    includesVat: true,
    validUntil: '',
    offerConditions: '',
    measurementUnit: '' as CatalogProduct['measurementUnit'],
    measurementQuantity: null as number | null
  };
  protected catalogEditError = '';
  protected catalogEditSaving = false;
  protected catalogNotice = '';
  protected catalogError = '';
  protected catalogDeleteCandidate: CatalogProduct | null = null;
  protected deleteCatalogModalOpen = false;

  protected uploadMode: CatalogUploadMode = 'buscar';
  protected masterProductQuery = '';
  protected uploadCategoryId = '';
  protected uploadSubcategoryId = '';
  protected uploadFamilyId = '';
  protected masterRows: CatalogProduct[] = [];
  protected masterPage = 1;
  protected masterPageSize = 25;
  protected masterTotal = 0;
  protected masterTotalPages = 1;
  protected masterSelectionDrafts: Partial<Record<string, MasterCatalogSelectionDraft>> = {};
  protected masterLoading = false;
  protected relationNotice = '';
  protected relationError = '';

  protected csvContent = CATALOG_IMPORT_TEMPLATE;
  protected catalogFileName = '';
  protected isReadingCatalogFile = false;
  protected csvError = '';
  protected csvNotice = '';
  protected importSummaryModalOpen = false;
  protected importSummary: CatalogImportReport | null = null;
  protected importSummaryView: Extract<CatalogImportOutcome, 'subido' | 'sin_cambios' | 'fallido'> = 'subido';

  protected requestDraft = { name: '', barcode: '', quantity: 1, price: 0 };
  protected requestError = '';
  protected requestNotice = '';

  protected totalProducts = 0;
  protected outOfStock = 0;
  protected lastCatalogUpdate = '';

  protected profileDraft = {
    displayName: '',
    businessName: '',
    phone: '',
    city: '',
    commune: '',
    address: '',
    storeLatitude: undefined as number | undefined,
    storeLongitude: undefined as number | undefined
  };
  protected profileSaved = false;
  protected profileSaving = false;
  protected profileError = '';
  protected profileLocationMessage = '';
  protected profileLocationError = '';
  protected isLocatingProfile = false;

  protected isInitialLoading = true;
  protected isSectionLoading = false;
  protected isMobileViewport = false;
  protected isMobileMenuVisible = false;
  private readonly loadedSections = new Set<FerreteriaSection>();

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: FirebaseDataService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly writeFeedback: WriteFeedbackService = new WriteFeedbackService()
  ) {}

  protected dailyReport: StoreDailyAnalytics | null = null;
  protected dashboardError = '';
  private querySubscription?: Subscription;
  protected onboardingReady = false;
  ngOnInit(): void {
    this.syncViewportState();
    this.syncProfileDraftFromUser();
    this.querySubscription = this.route.queryParamMap.subscribe(params => {
      const section = params.get('section');
      const requested = section === 'catalogo' || section === 'perfil' || section === 'cotizaciones' ? section : 'inicio';
      const action = params.get('accion');
      const mode = action === 'archivo' ? 'archivo' : 'buscar';
      const view = requested === 'catalogo' && (action === 'agregar' || action === 'archivo') ? 'add' : 'maintain';
      const changed = this.currentSection !== requested || this.catalogView !== view || this.uploadMode !== mode;
      this.currentSection = requested; this.catalogView = view; this.uploadMode = mode;
      if (this.onboardingReady && changed) void this.ensureSectionData(requested, view === 'add');
    });
  }
  ngOnDestroy(): void { this.querySubscription?.unsubscribe(); }
  protected formatReportDate(value: string): string { return new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',dateStyle:'short',timeStyle:'short'}).format(new Date(value)); }
  protected get quoteTrend(): number | null {
    return this.dailyReport?.previousQuotationCount ? Math.round((this.dailyReport.recentQuotationCount / this.dailyReport.previousQuotationCount - 1) * 100) : null;
  }
  protected get quotedCoverage(): number {
    return this.dailyReport?.catalog.published ? Math.min(100,Math.round(this.dailyReport.quotedProducts / this.dailyReport.catalog.published * 100)) : 0;
  }
  protected get stockOpportunities(): StoreDailyAnalytics['topProducts'] {
    return this.dailyReport?.topProducts.filter(product => product.stock === 0) || [];
  }

  protected finishOnboarding(): void {
    if (this.onboardingReady) return;
    this.onboardingReady = true;
    void this.initializeDashboard();
  }

  protected get user(): SessionUser | null {
    return this.authService.currentUser();
  }

  protected get currentSectionLabel(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.label || '';
  }

  protected get currentSectionDescription(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.description || '';
  }

  protected get catalogQuotaText(): string {
    return `${this.catalog.length} producto(s) cargados.`;
  }

  protected get filteredCatalog(): CatalogProduct[] {
    const query = this.catalogSearch.trim().toLowerCase();
    if (!query) return this.catalog;
    return this.catalog.filter((product) =>
      product.name.toLowerCase().includes(query)
      || product.sku.toLowerCase().includes(query)
      || (product.barcode || '').toLowerCase().includes(query)
    );
  }

  protected get catalogTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCatalog.length / this.catalogPageSize));
  }

  protected get paginatedCatalog(): CatalogProduct[] {
    const start = (this.catalogPage - 1) * this.catalogPageSize;
    return this.filteredCatalog.slice(start, start + this.catalogPageSize);
  }

  protected get catalogPageStart(): number {
    return this.filteredCatalog.length === 0 ? 0 : ((this.catalogPage - 1) * this.catalogPageSize) + 1;
  }

  protected get catalogPageEnd(): number {
    return Math.min(this.catalogPage * this.catalogPageSize, this.filteredCatalog.length);
  }

  protected get categoryOptions(): TaxonomyOption[] {
    return this.apiService.getCategoryOptions();
  }

  protected get subcategoryOptions(): TaxonomyOption[] {
    return this.uploadCategoryId ? this.apiService.getSubcategoryOptions(this.uploadCategoryId) : [];
  }

  protected get familyOptions(): TaxonomyOption[] {
    return this.uploadSubcategoryId ? this.apiService.getFamilyOptions(this.uploadSubcategoryId) : [];
  }

  protected get selectedMasterProducts(): Array<{ product: CatalogProduct; price: number; stock: number }> {
    return this.masterRows
      .map((product) => {
        const draft = this.masterSelectionDrafts[this.masterProductId(product)];
        return draft?.selected ? { product, price: Number(draft.price) || 0, stock: Number(draft.stock) || 0 } : null;
      })
      .filter((item): item is { product: CatalogProduct; price: number; stock: number } => !!item);
  }

  protected setSection(section: FerreteriaSection): void {
    this.currentSection = section;
    if (section === 'catalogo') {
      this.catalogView = 'maintain';
    }
    this.closeMobileMenu();
    void this.router.navigate([], {relativeTo:this.route,queryParams:{section,accion:null}});
    void this.ensureSectionData(section);
  }

  protected setUploadMode(mode: CatalogUploadMode, load = true): void {
    this.uploadMode = mode;
    this.relationError = '';
    this.relationNotice = '';
    this.csvError = '';
    this.csvNotice = '';
    this.requestError = '';
    this.requestNotice = '';
    if (mode === 'buscar' && load) void this.loadMasterCatalog();
  }

  protected openAddProducts(mode: CatalogUploadMode = 'buscar'): void {
    this.currentSection = 'catalogo';
    this.catalogView = 'add';
    this.setUploadMode(mode, false);
    void this.router.navigate([], {relativeTo:this.route,queryParams:{section:'catalogo',accion:mode === 'archivo' ? 'archivo' : 'agregar'}});
    this.closeMobileMenu();
    void this.ensureSectionData('catalogo', true);
  }

  protected closeAddProducts(): void {
    this.catalogView = 'maintain';
    void this.router.navigate([], {relativeTo:this.route,queryParams:{section:'catalogo'}});
  }

  protected goToExcelImport(): void {
    this.openAddProducts('archivo');
  }

  protected onCatalogSearchChange(): void {
    this.catalogPage = 1;
  }

  protected onCatalogPageChange(event: PaginatorState): void {
    this.catalogPageSize = event.rows ?? this.catalogPageSize;
    this.catalogPage = (event.page ?? 0) + 1;
  }

  protected openCatalogEdit(product: CatalogProduct): void {
    this.catalogEditCandidate = product;
    this.catalogEditDraft = {
      price: product.price,
      stock: product.stock,
      isPublished: product.isPublished,
      includesVat: product.includesVat !== false,
      validUntil: product.validUntil || '',
      offerConditions: product.offerConditions || '',
      measurementUnit: product.measurementUnit || '',
      measurementQuantity: product.measurementQuantity || null
    };
    this.catalogEditError = '';
    this.catalogEditModalOpen = true;
  }

  protected closeCatalogEdit(): void {
    if (this.catalogEditSaving) return;
    this.catalogEditCandidate = null;
    this.catalogEditModalOpen = false;
    this.catalogEditError = '';
  }

  protected async saveCatalogEdit(): Promise<void> {
    await this.writeFeedback.run('dashboard-ferreteria:saveCatalogEdit', async () => {
      const product = this.catalogEditCandidate;
      if (!this.user || !product || this.catalogEditSaving) return;

      const rawPrice = Number(this.catalogEditDraft.price);
      const rawStock = Number(this.catalogEditDraft.stock);
      const price = Math.round(rawPrice);
      const stock = Math.floor(rawStock);

      if (!Number.isFinite(rawPrice) || price <= 0) {
        this.catalogEditError = 'El precio debe ser un numero mayor a 0.';
        return;
      }
      if (!Number.isFinite(rawStock) || stock < 0) {
        this.catalogEditError = 'El stock debe ser un numero igual o mayor a 0.';
        return;
      }
      if ((this.catalogEditDraft.measurementUnit && !this.catalogEditDraft.measurementQuantity)
        || (!this.catalogEditDraft.measurementUnit && this.catalogEditDraft.measurementQuantity)) {
        this.catalogEditError = 'Para calcular el precio por unidad, indica tanto la unidad de medida como la cantidad del envase.';
        return;
      }

      const priceChanged = product.price !== price;
      const stockChanged = product.stock !== stock;
      const publishedChanged = product.isPublished !== this.catalogEditDraft.isPublished;
      const metadataChanged = product.includesVat !== this.catalogEditDraft.includesVat
        || (product.validUntil || '') !== this.catalogEditDraft.validUntil
        || (product.offerConditions || '') !== this.catalogEditDraft.offerConditions.trim()
        || (product.measurementUnit || '') !== this.catalogEditDraft.measurementUnit
        || (product.measurementQuantity || null) !== (this.catalogEditDraft.measurementQuantity || null);

      if (!priceChanged && !stockChanged && !publishedChanged && !metadataChanged) {
        this.catalogNotice = `${product.name}: sin cambios.`;
        this.catalogError = '';
        this.closeCatalogEdit();
        return;
      }

      const changes: string[] = [];
      if (priceChanged) changes.push(`precio ${this.formatCurrency(product.price)} → ${this.formatCurrency(price)}`);
      if (stockChanged) changes.push(`stock ${product.stock} → ${stock}`);
      if (publishedChanged) changes.push(this.catalogEditDraft.isPublished ? 'publicado' : 'oculto del comparador');
      if (metadataChanged) changes.push('condiciones de oferta actualizadas');

      this.catalogEditSaving = true;
      this.catalogEditError = '';

      try {
        this.catalog = await this.apiService.upsertCatalog(this.user.id, {
          ...product,
          price,
          stock,
          isPublished: this.catalogEditDraft.isPublished,
          includesVat: this.catalogEditDraft.includesVat,
          validUntil: this.catalogEditDraft.validUntil,
          offerConditions: this.catalogEditDraft.offerConditions.trim(),
          measurementUnit: this.catalogEditDraft.measurementUnit,
          measurementQuantity: this.catalogEditDraft.measurementQuantity
        });
        this.refreshSummary();
        this.catalogNotice = `${product.name}: ${changes.join(' · ')}.`;
        this.catalogError = '';
        this.catalogEditCandidate = null;
        this.catalogEditModalOpen = false;
      } catch (error) {
        this.catalogEditError = error instanceof Error ? error.message : 'No se pudo actualizar el producto.';
      } finally {
        this.catalogEditSaving = false;
      }
    });
  }

  protected requestDeleteCatalog(product: CatalogProduct): void {
    this.catalogDeleteCandidate = product;
    this.deleteCatalogModalOpen = true;
  }

  protected closeDeleteCatalogModal(): void {
    this.catalogDeleteCandidate = null;
    this.deleteCatalogModalOpen = false;
  }

  protected async confirmDeleteCatalog(): Promise<void> {
    if (!this.user || !this.catalogDeleteCandidate) return;
    try {
      this.catalog = await this.apiService.deleteCatalog(this.user.id, this.catalogDeleteCandidate.id);
      this.closeDeleteCatalogModal();
      this.catalogPage = Math.min(this.catalogPage, this.catalogTotalPages);
      this.refreshSummary();
      this.catalogNotice = 'Producto eliminado del catalogo.';
    } catch (error) {
      this.catalogError = error instanceof Error ? error.message : 'No se pudo eliminar el producto.';
    }
  }

  protected onUploadCategoryChange(categoryId: string): void {
    this.uploadCategoryId = categoryId;
    this.uploadSubcategoryId = '';
    this.uploadFamilyId = '';
    this.masterPage = 1;
    void this.loadMasterCatalog();
  }

  protected onUploadSubcategoryChange(subcategoryId: string): void {
    this.uploadSubcategoryId = subcategoryId;
    this.uploadFamilyId = '';
    this.masterPage = 1;
    void this.loadMasterCatalog();
  }

  protected onUploadFamilyChange(familyId: string): void {
    this.uploadFamilyId = familyId;
    this.masterPage = 1;
    void this.loadMasterCatalog();
  }

  protected onMasterSearchChange(): void {
    this.masterPage = 1;
    void this.loadMasterCatalog();
  }

  protected toggleMasterSelection(product: CatalogProduct, selected: boolean): void {
    const id = this.masterProductId(product);
    const current = this.masterSelectionDrafts[id] || { selected: false, price: Math.max(1, product.price), stock: 0 };
    this.masterSelectionDrafts = {
      ...this.masterSelectionDrafts,
      [id]: { ...current, selected }
    };
  }

  protected masterSelectionPrice(product: CatalogProduct): number {
    return this.masterSelectionDrafts[this.masterProductId(product)]?.price || 0;
  }

  protected masterSelectionStock(product: CatalogProduct): number {
    return this.masterSelectionDrafts[this.masterProductId(product)]?.stock || 0;
  }

  protected updateMasterSelectionPrice(product: CatalogProduct, value: number | string): void {
    this.patchMasterSelection(product, { price: Number(value) || 0 });
  }

  protected updateMasterSelectionStock(product: CatalogProduct, value: number | string): void {
    this.patchMasterSelection(product, { stock: Math.max(0, Math.floor(Number(value) || 0)) });
  }

  protected async saveSelectedMasterProducts(): Promise<void> {
    await this.writeFeedback.run('dashboard-ferreteria:saveSelectedMasterProducts', async () => {
      if (!this.user) return;
      const selected = this.selectedMasterProducts;
      if (selected.length === 0) {
        this.relationError = 'Selecciona al menos un producto.';
        return;
      }
      if (selected.some((item) => item.price <= 0)) {
        this.relationError = 'Todos los productos seleccionados deben tener precio.';
        return;
      }

      try {
        const result = await this.apiService.addCatalogProductsFromMasterBatch(
          this.user.id,
          selected.map((item) => ({
            masterProductId: this.masterProductId(item.product),
            price: item.price,
            stock: item.stock
          }))
        );
        this.catalog = result.catalog;
        this.masterSelectionDrafts = {};
        this.refreshSummary();
        this.relationNotice = `${result.createdCount} producto(s) agregado(s) y ${result.updatedCount} actualizado(s).`;
        this.relationError = '';
        await this.loadMasterCatalog();
      } catch (error) {
        this.relationError = error instanceof Error ? error.message : 'No se pudieron agregar los productos.';
      }
    });
  }

  protected onMasterPageChange(event: PaginatorState): void {
    const nextRows = event.rows ?? this.masterPageSize;
    const nextPage = (event.page ?? 0) + 1;
    if (nextRows === this.masterPageSize && nextPage === this.masterPage) return;
    this.masterPageSize = nextRows;
    this.masterPage = nextPage;
    void this.loadMasterCatalog();
  }

  protected async onCatalogFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isReadingCatalogFile = true;
    this.csvError = '';
    this.catalogFileName = file.name;
    try {
      this.csvContent = await catalogFileToCsv(file);
      this.csvNotice = `${file.name} cargado. Revisa los datos y procesa el archivo.`;
    } catch (error) {
      this.catalogFileName = '';
      this.csvError = error instanceof Error ? error.message : 'No se pudo leer el archivo.';
    } finally {
      this.isReadingCatalogFile = false;
      input.value = '';
    }
  }

  protected async downloadCatalogTemplate(): Promise<void> {
    try {
      const storeName = this.user?.businessName || this.user?.displayName || 'ferreteria';
      await downloadCatalogImportTemplate(
        catalogImportTemplateFileName(storeName),
        this.catalog.map((product) => ({
          name: product.name,
          sku: product.sku,
          price: product.price,
          stock: product.stock,
          barcode: product.barcode
        }))
      );
      this.csvError = '';
      this.csvNotice = this.catalog.length > 0
        ? `Catalogo descargado con ${this.catalog.length} producto(s). Modifica precio y stock y luego sube el mismo archivo.`
        : 'Template Trovio descargado. Tu catalogo aun no tiene productos.';
    } catch (error) {
      this.csvError = error instanceof Error ? error.message : 'No se pudo generar el template.';
    }
  }

  protected resetCatalogImportTemplate(): void {
    this.catalogFileName = '';
    this.csvContent = CATALOG_IMPORT_TEMPLATE;
    this.csvError = '';
    this.csvNotice = '';
  }

  protected async importCatalogFile(): Promise<void> {
    await this.writeFeedback.run('dashboard-ferreteria:importCatalogFile', async () => {
      if (!this.user || !this.csvContent.trim()) return;
      this.csvError = '';
      this.csvNotice = '';

      try {
        const response = await this.apiService.importCatalogBatch(
          this.user.id,
          this.user.businessName || this.user.displayName,
          this.csvContent,
          {
            categoryId: '',
            subcategoryId: '',
            familyId: '',
            brand: 'Sin marca',
            unitLabel: 'Unidad',
            isPublished: true,
            mode: 'update'
          }
        );
        this.catalog = response.catalog;
        this.importSummary = response.report;
        this.importSummaryView = response.report.failedCount > 0
          ? 'fallido'
          : (response.report.uploadedCount > 0 ? 'subido' : 'sin_cambios');
        this.importSummaryModalOpen = true;
        this.refreshSummary();
        this.csvNotice = `Procesadas ${response.report.totalRows} fila(s): ${response.report.uploadedCount} actualizadas, ${response.report.noChangeCount} sin cambios y ${response.report.failedCount} con error.`;
      } catch (error) {
        this.csvError = error instanceof Error ? error.message : 'No se pudo procesar el archivo.';
      }
    });
  }

  protected async submitProductRequest(): Promise<void> {
    if (!this.user) return;
    const name = this.requestDraft.name.trim();
    const price = Math.round(Number(this.requestDraft.price) || 0);
    if (name.length < 3 || price <= 0) {
      this.requestError = 'Ingresa nombre y precio validos.';
      return;
    }

    try {
      await this.apiService.requestCatalogProductCreation(
        this.user.id,
        this.user.businessName || this.user.displayName,
        {
          name,
          barcode: this.requestDraft.barcode.trim(),
          quantity: Math.max(1, Math.floor(Number(this.requestDraft.quantity) || 1)),
          price
        }
      );
      this.requestNotice = 'Solicitud enviada a Trovio para revision.';
      this.requestError = '';
      this.requestDraft = { name: '', barcode: '', quantity: 1, price: 0 };
    } catch (error) {
      this.requestError = error instanceof Error ? error.message : 'No se pudo enviar la solicitud.';
    }
  }

  protected importRows(outcome: CatalogImportOutcome): CatalogImportRowResult[] {
    return this.importSummary?.rows.filter((row) => row.outcome === outcome) || [];
  }

  protected setImportSummaryView(view: Extract<CatalogImportOutcome, 'subido' | 'sin_cambios' | 'fallido'>): void {
    this.importSummaryView = view;
  }

  protected async downloadImportErrors(): Promise<void> {
    const errors = this.importRows('fallido');
    if (errors.length === 0) return;

    try {
      await downloadCatalogImportErrors(
        errors.map((row) => ({
          name: row.name,
          sku: row.sku,
          price: row.price,
          stock: row.stock,
          barcode: row.barcode,
          message: row.message
        }))
      );
    } catch (error) {
      this.csvError = error instanceof Error ? error.message : 'No se pudo descargar el archivo de errores.';
    }
  }

  protected closeImportSummaryModal(): void {
    this.importSummaryModalOpen = false;
  }

  protected async updateProfileLocation(): Promise<void> {
    this.profileLocationError = '';
    this.profileLocationMessage = '';
    this.isLocatingProfile = true;
    try {
      const location = await getCurrentBrowserLocation();
      this.profileDraft.storeLatitude = location.latitude;
      this.profileDraft.storeLongitude = location.longitude;
      this.profileLocationMessage = 'Ubicacion del local actualizada. Guarda el perfil para confirmar.';
    } catch (error) {
      this.profileLocationError = error instanceof Error ? error.message : 'No se pudo obtener la ubicacion.';
    } finally {
      this.isLocatingProfile = false;
    }
  }

  protected async saveProfile(): Promise<void> {
    await this.writeFeedback.run('dashboard-ferreteria:saveProfile', async () => {
      this.profileSaved = false;
      this.profileError = '';
      this.profileSaving = true;
      try {
        await this.authService.updateProfile(this.profileDraft);
        this.profileSaved = true;
        setTimeout(() => this.profileSaved = false, 1800);
      } catch (error) {
        this.profileError = error instanceof Error ? error.message : 'No se pudo actualizar el perfil.';
      } finally {
        this.profileSaving = false;
      }
    });
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  protected toggleMobileMenu(): void {
    if (this.isMobileViewport) this.isMobileMenuVisible = !this.isMobileMenuVisible;
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuVisible = false;
  }

  protected logout(): void {
    this.closeMobileMenu();
    void this.authService.logout();
    this.router.navigateByUrl('/');
  }

  private async initializeDashboard(): Promise<void> {
    try {
      await this.ensureSectionData(this.currentSection, true);
    } finally {
      this.isInitialLoading = false;
    }
  }

  private async ensureSectionData(section: FerreteriaSection, force = false): Promise<void> {
    const currentUser = this.user;
    if (!currentUser || (!force && this.loadedSections.has(section))) return;

    this.isSectionLoading = true;
    try {
      if (section === 'inicio') {
        this.dashboardError = '';
        try {
          const result = await this.apiService.loadStoreDailyDashboard(currentUser.id);
          this.dailyReport = result.reports.find(report => report.storeId === currentUser.ferreteriaId) || result.reports[0] || null;
          this.totalProducts = this.dailyReport?.catalog.published || 0; this.outOfStock = this.dailyReport?.catalog.outOfStock || 0;
        } catch { this.dashboardError = 'No pudimos cargar el resumen diario. Puedes seguir gestionando tu catálogo.'; }
      }
      if (section === 'catalogo') {
        await this.apiService.refreshFerreteriaCatalogSection(currentUser.id, force);
        this.catalog = this.apiService.getCatalog(currentUser.id);
        this.refreshSummary();
      }

      if (section === 'catalogo') {
        await this.apiService.refreshFerreteriaUploadSection(currentUser.id, force);
        if (this.catalogView === 'add' && this.uploadMode === 'buscar') await this.loadMasterCatalog();
      }

      if (section === 'perfil') this.syncProfileDraftFromUser();
      this.sectionLoadError = '';
      this.loadedSections.add(section);
    } catch (error) {
      this.sectionLoadError = error instanceof Error ? error.message : 'No se pudo cargar esta sección. Intenta nuevamente.';
      this.loadedSections.delete(section);
    } finally {
      this.isSectionLoading = false; this.changeDetector.markForCheck();
    }
  }

  private refreshSummary(): void {
    const published = this.catalog.filter((product) => product.isPublished);
    this.totalProducts = published.length;
    this.outOfStock = published.filter((product) => product.stock === 0).length;
    this.lastCatalogUpdate = published
      .map((product) => product.updatedAt || '')
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left))[0] || '';
  }

  private async loadMasterCatalog(): Promise<void> {
    if (!this.user) return;
    this.masterLoading = true;
    try {
      const result = await this.apiService.searchMasterCatalogProducts({
        query: this.masterProductQuery,
        categoryId: this.uploadCategoryId,
        subcategoryId: this.uploadSubcategoryId,
        familyId: this.uploadFamilyId,
        excludeMasterProductIds: this.catalog.map((product) => product.masterProductId || product.id),
        page: this.masterPage,
        size: this.masterPageSize
      });
      this.masterRows = result.items;
      this.masterTotal = result.total;
      this.masterTotalPages = result.totalPages;
      this.masterPage = result.page;
    } catch (error) {
      this.relationError = error instanceof Error ? error.message : 'No se pudo cargar el catalogo maestro.';
      this.masterRows = [];
    } finally {
      this.masterLoading = false;
    }
  }

  private patchMasterSelection(product: CatalogProduct, patch: Partial<MasterCatalogSelectionDraft>): void {
    const id = this.masterProductId(product);
    const current = this.masterSelectionDrafts[id] || { selected: true, price: Math.max(1, product.price), stock: 0 };
    this.masterSelectionDrafts = { ...this.masterSelectionDrafts, [id]: { ...current, ...patch } };
  }

  private masterProductId(product: CatalogProduct): string {
    return product.masterProductId || product.id;
  }

  private syncProfileDraftFromUser(): void {
    const currentUser = this.user;
    if (!currentUser) return;
    this.profileDraft = {
      displayName: currentUser.displayName,
      businessName: currentUser.businessName || currentUser.displayName,
      phone: currentUser.phone || '',
      city: currentUser.city || '',
      commune: currentUser.commune || '',
      address: currentUser.address || '',
      storeLatitude: currentUser.storeLatitude,
      storeLongitude: currentUser.storeLongitude
    };
    this.profileLocationMessage = '';
    this.profileLocationError = '';
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncViewportState();
  }

  private syncViewportState(): void {
    if (typeof window === 'undefined') return;
    this.isMobileViewport = window.innerWidth <= 1060;
    if (!this.isMobileViewport) this.isMobileMenuVisible = false;
  }
}
