import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  CatalogProduct,
  CatalogImportOutcome,
  CatalogImportReport,
  CatalogImportRowResult,
  FamilySpecField,
  FamilyTemplate,
  ProductDescriptionBlock,
  ProductExtraSection,
  ProductTechSpecRow,
  SessionUser,
  SubscriptionPlan,
  TaxonomyOption
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService } from '../../core/services/mock-api.service';
import { DashboardMenuComponent } from '../../shared/components/dashboard-menu/dashboard-menu.component';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';
import { UiModalComponent } from '../../shared/components/ui-modal/ui-modal.component';

type FerreteriaSection = 'inicio' | 'catalogo' | 'subir' | 'metricas' | 'perfil' | 'suscripcion';
type CatalogUploadMode = 'buscar' | 'solicitud';

interface SubscriptionPlanView {
  id: SubscriptionPlan;
  title: string;
  priceLabel: string;
  description: string;
  maxCatalogLabel: string;
  csvLabel: string;
  metricsLabel: string;
}

interface TopProductMetric {
  name: string;
  views: number;
  clicks: number;
  ctrPercent: number;
  stock: number;
  price: number;
  potentialRevenue: number;
}

interface TopCategoryMetric {
  categoryName: string;
  products: number;
  views: number;
  clicks: number;
  ctrPercent: number;
}

interface MasterCatalogSelectionDraft {
  selected: boolean;
  price: number;
  stock: number;
}

interface FerreteriaSectionMeta {
  id: FerreteriaSection;
  label: string;
  description: string;
}

@Component({
  selector: 'app-dashboard-ferreteria',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UiModalComponent, UiLoaderComponent, DashboardMenuComponent],
  templateUrl: './dashboard-ferreteria.component.html',
  styleUrl: './dashboard-ferreteria.component.scss'
})
export class DashboardFerreteriaComponent implements OnInit {
  protected readonly sections: FerreteriaSectionMeta[] = [
    {
      id: 'inicio',
      label: 'Inicio',
      description: 'Consulta el estado comercial de tu catalogo, stock critico y rendimiento general de tu ferreteria.'
    },
    {
      id: 'catalogo',
      label: 'Mi Catalogo',
      description: 'Administra productos publicados, ajusta precio y stock, y manten tu oferta siempre actualizada.'
    },
    {
      id: 'subir',
      label: 'Subir Productos',
      description: 'Relaciona productos del catalogo maestro o carga nuevos items para incorporarlos a tu catalogo.'
    },
    {
      id: 'metricas',
      label: 'Metricas',
      description: 'Analiza vistas, clics, salud del catalogo y categorias con mejor desempeno comercial.'
    },
    {
      id: 'perfil',
      label: 'Perfil',
      description: 'Manten al dia los datos de tu ferreteria, ubicacion y contacto para recibir mas oportunidades.'
    },
    {
      id: 'suscripcion',
      label: 'Suscripcion',
      description: 'Revisa los limites de tu plan y habilita funciones como CSV, metricas avanzadas o mayor catalogo.'
    }
  ];

  protected currentSection: FerreteriaSection = 'inicio';
  protected catalog: CatalogProduct[] = [];
  protected catalogCategoryQuery = '';
  protected catalogSubcategoryQuery = '';
  protected catalogFamilyQuery = '';
  protected catalogProductQuery = '';
  protected catalogFilterCategoryId = '';
  protected catalogFilterSubcategoryId = '';
  protected catalogFilterFamilyId = '';
  protected catalogPage = 1;
  protected catalogPageSize = 10;
  protected readonly catalogPageSizeOptions = [5, 10, 20];

  protected formModel: CatalogProduct = this.createEmptyCatalogForm();
  protected detailDescriptionBlocksText = '';
  protected detailFeatureBulletsText = '';
  protected detailTechnicalSheetText = '';
  protected detailExtraSectionsText = '';
  protected detailGalleryText = '';
  protected categoryQuery = '';
  protected subcategoryQuery = '';
  protected familyQuery = '';
  protected specValuesDraft: Record<string, string> = {};
  protected uploadMode: CatalogUploadMode = 'buscar';
  protected uploadCategoryQuery = '';
  protected uploadSubcategoryQuery = '';
  protected uploadFamilyQuery = '';
  protected uploadFilterCategoryId = '';
  protected uploadFilterSubcategoryId = '';
  protected uploadFilterFamilyId = '';
  protected masterProductQuery = '';
  protected masterCatalogRows: CatalogProduct[] = [];
  protected masterCatalogTotal = 0;
  protected masterCatalogPage = 1;
  protected masterCatalogPageSize = 25;
  protected readonly masterCatalogPageSizeOptions = [25, 50, 100];
  protected masterSelectionDrafts: Record<string, MasterCatalogSelectionDraft> = {};
  protected isLoadingMasterCatalog = false;
  protected masterCatalogLoaded = false;
  protected masterCatalogLoadError = '';
  protected isSavingMasterSelection = false;
  protected relationError = '';
  protected relationNotice = '';
  protected requestDraft = {
    name: '',
    barcode: '',
    quantity: 1,
    price: 0
  };
  protected requestError = '';
  protected requestNotice = '';

  protected editingProductId: string | null = null;
  protected csvContent = 'nombre,precio,stock,sku\nMalla electrosoldada 4mm,18490,25,MEL-4\nCemento Alta Resistencia 25kg,5790,90,CEM-AR-25';
  protected catalogError = '';
  protected catalogNotice = '';
  protected catalogInlineError = '';
  protected catalogInlineEditId: string | null = null;
  protected catalogInlineDraft = {
    sku: '',
    price: 0,
    stock: 0
  };
  protected deleteCatalogModalOpen = false;
  protected catalogDeleteCandidate: CatalogProduct | null = null;
  protected selectedCatalogProduct: CatalogProduct | null = null;
  protected galleryPreviewModalOpen = false;
  protected galleryPreviewProduct: CatalogProduct | null = null;
  protected galleryPreviewActiveIndex = 0;
  protected csvError = '';
  protected csvNotice = '';
  protected subscriptionNotice = '';
  protected importSummaryModalOpen = false;
  protected importSummary: CatalogImportReport | null = null;

  protected totalProducts = 0;
  protected catalogProductsCount = 0;
  protected lowStock = 0;
  protected avgPrice = 0;
  protected quotationReach = 0;

  protected views = 0;
  protected clicks = 0;
  protected ctrPercent = 0;
  protected publishedProducts = 0;
  protected draftProducts = 0;
  protected outOfStockProducts = 0;
  protected criticalStockProducts = 0;
  protected inventoryValue = 0;
  protected avgStockPerProduct = 0;
  protected avgPricePublished = 0;
  protected catalogHealthScore = 0;
  protected quoteRequestsEstimate = 0;
  protected topProducts: TopProductMetric[] = [];
  protected topCategories: TopCategoryMetric[] = [];

  protected profileDraft = {
    displayName: '',
    businessName: '',
    phone: '',
    city: '',
    commune: '',
    address: ''
  };

  protected profileSaved = false;
  protected isInitialLoading = true;
  protected isSectionLoading = false;
  protected isMobileViewport = false;
  protected isMobileMenuVisible = false;
  protected readonly subscriptionPlans: SubscriptionPlanView[] = [
    {
      id: 'basico',
      title: 'Plan Basico',
      priceLabel: '$14.990 / mes',
      description: 'Catalogo inicial para comenzar en la plataforma.',
      maxCatalogLabel: 'Hasta 30 productos',
      csvLabel: 'CSV no incluido',
      metricsLabel: 'Metricas basicas'
    },
    {
      id: 'pro',
      title: 'Plan Pro',
      priceLabel: '$29.990 / mes',
      description: 'Para ferreterias con operacion estable y carga frecuente.',
      maxCatalogLabel: 'Hasta 200 productos',
      csvLabel: 'CSV incluido',
      metricsLabel: 'Metricas completas'
    },
    {
      id: 'premium',
      title: 'Plan Premium',
      priceLabel: '$49.990 / mes',
      description: 'Escalamiento total para catalogos grandes.',
      maxCatalogLabel: 'Productos ilimitados',
      csvLabel: 'CSV incluido',
      metricsLabel: 'Metricas completas'
    }
  ];

  private readonly loadedSections = new Set<FerreteriaSection>();

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: MockApiService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.syncViewportState();
    this.syncDetailDraftFromFormModel();
    this.syncTaxonomyAutocompleteFromFormModel();
    this.syncSpecDraftFromFormModel();
    this.syncProfileDraftFromUser();
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

  protected get currentPlan(): SubscriptionPlan {
    return this.user?.subscriptionPlan || 'basico';
  }

  protected get currentPlanView(): SubscriptionPlanView {
    return this.subscriptionPlans.find((plan) => plan.id === this.currentPlan) || this.subscriptionPlans[0];
  }

  protected get canUseCsvImport(): boolean {
    return this.apiService.getFerreteriaPlanCapabilities(this.currentPlan).allowCsvImport;
  }

  protected get canUseAdvancedMetrics(): boolean {
    return this.apiService.getFerreteriaPlanCapabilities(this.currentPlan).allowAdvancedMetrics;
  }

  protected get categoryOptions(): TaxonomyOption[] {
    return this.apiService.getCategoryOptions();
  }

  protected get subcategoryOptions(): TaxonomyOption[] {
    if (!this.formModel.categoryId) {
      return [];
    }
    return this.apiService.getSubcategoryOptions(this.formModel.categoryId);
  }

  protected get familyOptions(): TaxonomyOption[] {
    if (!this.formModel.subcategoryId) {
      return [];
    }
    return this.apiService.getFamilyOptions(this.formModel.subcategoryId);
  }

  protected get activeFamilyTemplate(): FamilyTemplate | null {
    if (!this.formModel.familyId) {
      return null;
    }
    return this.apiService.getFamilyTemplate(this.formModel.familyId);
  }

  protected get activeFamilySpecFields(): FamilySpecField[] {
    return this.activeFamilyTemplate?.specFields || [];
  }

  protected get uploadCategoryOptions(): TaxonomyOption[] {
    return this.apiService.getCategoryOptions();
  }

  protected get uploadSubcategoryOptions(): TaxonomyOption[] {
    if (!this.uploadFilterCategoryId) {
      return [];
    }
    return this.apiService.getSubcategoryOptions(this.uploadFilterCategoryId);
  }

  protected get uploadFamilyOptions(): TaxonomyOption[] {
    if (!this.uploadFilterSubcategoryId) {
      return [];
    }
    return this.apiService.getFamilyOptions(this.uploadFilterSubcategoryId);
  }

  protected get catalogFilterCategoryOptions(): TaxonomyOption[] {
    return this.apiService.getCategoryOptions();
  }

  protected get catalogFilterSubcategoryOptions(): TaxonomyOption[] {
    if (!this.catalogFilterCategoryId) {
      return [];
    }
    return this.apiService.getSubcategoryOptions(this.catalogFilterCategoryId);
  }

  protected get catalogFilterFamilyOptions(): TaxonomyOption[] {
    if (!this.catalogFilterSubcategoryId) {
      return [];
    }
    return this.apiService.getFamilyOptions(this.catalogFilterSubcategoryId);
  }

  protected get catalogProductAutocompleteOptions(): string[] {
    return Array.from(new Set(this.catalogTaxonomyFilteredRows.map((item) => item.name.trim())))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .slice(0, 200);
  }

  protected get filteredCatalog(): CatalogProduct[] {
    const textQuery = this.catalogProductQuery.trim().toLowerCase();
    const barcodeQuery = this.normalizeBarcodeInput(this.catalogProductQuery);

    return this.catalogTaxonomyFilteredRows.filter((item) => {
      if (!textQuery && !barcodeQuery) {
        return true;
      }

      const matchesText = item.name.toLowerCase().includes(textQuery)
        || item.sku.toLowerCase().includes(textQuery)
        || item.brand.toLowerCase().includes(textQuery);
      const matchesBarcode = barcodeQuery
        ? this.normalizeBarcodeInput(item.barcode || '').includes(barcodeQuery)
        : false;
      return matchesText || matchesBarcode;
    });
  }

  protected get catalogTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCatalog.length / this.catalogPageSize));
  }

  protected get paginatedCatalog(): CatalogProduct[] {
    const page = this.resolvedCatalogPage;
    const start = (page - 1) * this.catalogPageSize;
    const end = start + this.catalogPageSize;
    return this.filteredCatalog.slice(start, end);
  }

  protected get catalogPageStart(): number {
    if (this.filteredCatalog.length === 0) {
      return 0;
    }
    return ((this.resolvedCatalogPage - 1) * this.catalogPageSize) + 1;
  }

  protected get catalogPageEnd(): number {
    if (this.filteredCatalog.length === 0) {
      return 0;
    }
    return Math.min(this.resolvedCatalogPage * this.catalogPageSize, this.filteredCatalog.length);
  }

  protected get catalogPageNumbers(): number[] {
    const total = this.catalogTotalPages;
    const current = this.resolvedCatalogPage;
    const windowSize = 7;
    const half = Math.floor(windowSize / 2);
    const from = Math.max(1, current - half);
    const to = Math.min(total, from + windowSize - 1);
    const normalizedFrom = Math.max(1, to - windowSize + 1);
    return Array.from({ length: to - normalizedFrom + 1 }, (_, index) => normalizedFrom + index);
  }

  protected get catalogQuotaText(): string {
    const currentUser = this.user;
    if (!currentUser) {
      return '';
    }

    const availability = this.apiService.canAddCatalogProduct(currentUser.id, this.currentPlan);
    if (availability.limit === null) {
      return `${availability.currentCount} productos cargados (sin limite).`;
    }
    return `${availability.currentCount}/${availability.limit} productos cargados.`;
  }

  protected get filteredMasterCatalogRows(): CatalogProduct[] {
    return this.masterCatalogRows;
  }

  protected get masterCatalogTotalPages(): number {
    return Math.max(1, Math.ceil(this.masterCatalogTotal / this.masterCatalogPageSize));
  }

  protected get resolvedMasterCatalogPage(): number {
    return Math.min(Math.max(1, this.masterCatalogPage), this.masterCatalogTotalPages);
  }

  protected get paginatedMasterCatalogRows(): CatalogProduct[] {
    return this.filteredMasterCatalogRows;
  }

  protected get masterCatalogPageStart(): number {
    if (this.masterCatalogTotal === 0 || this.filteredMasterCatalogRows.length === 0) {
      return 0;
    }
    return ((this.resolvedMasterCatalogPage - 1) * this.masterCatalogPageSize) + 1;
  }

  protected get masterCatalogPageEnd(): number {
    if (this.masterCatalogTotal === 0 || this.filteredMasterCatalogRows.length === 0) {
      return 0;
    }
    return this.masterCatalogPageStart + this.filteredMasterCatalogRows.length - 1;
  }

  protected get masterCatalogPageNumbers(): number[] {
    const total = this.masterCatalogTotalPages;
    const current = this.resolvedMasterCatalogPage;
    const windowSize = 7;
    const half = Math.floor(windowSize / 2);
    const from = Math.max(1, current - half);
    const to = Math.min(total, from + windowSize - 1);
    const normalizedFrom = Math.max(1, to - windowSize + 1);
    return Array.from({ length: to - normalizedFrom + 1 }, (_, index) => normalizedFrom + index);
  }

  protected get galleryPreviewImages(): string[] {
    return this.resolveProductGallery(this.galleryPreviewProduct);
  }

  protected get galleryPreviewActiveImage(): string {
    return this.galleryPreviewImages[this.galleryPreviewActiveIndex] || this.galleryPreviewImages[0] || '';
  }

  protected get selectedMasterCatalogCount(): number {
    return this.selectedMasterCatalogProducts.length;
  }

  protected setSection(section: FerreteriaSection): void {
    this.currentSection = section;
    if (section === 'subir' && this.uploadMode === 'buscar') {
      this.masterProductQuery = '';
      this.relationError = '';
      this.relationNotice = '';
    }
    if (this.isMobileViewport) {
      this.closeMobileMenu();
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    void this.ensureSectionData(section);
  }

  protected toggleMobileMenu(): void {
    if (!this.isMobileViewport) {
      return;
    }
    this.isMobileMenuVisible = !this.isMobileMenuVisible;
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuVisible = false;
  }

  protected onCategoryChange(categoryId: string): void {
    this.formModel.categoryId = categoryId;
    this.formModel.subcategoryId = '';
    this.formModel.familyId = '';
    this.categoryQuery = this.optionNameById(this.categoryOptions, categoryId);
    this.subcategoryQuery = '';
    this.familyQuery = '';
    this.specValuesDraft = {};
  }

  protected onSubcategoryChange(subcategoryId: string): void {
    this.formModel.subcategoryId = subcategoryId;
    this.formModel.familyId = '';
    this.subcategoryQuery = this.optionNameById(this.subcategoryOptions, subcategoryId);
    this.familyQuery = '';
    this.specValuesDraft = {};
  }

  protected onCategoryAutocomplete(value: string): void {
    this.categoryQuery = value;
    const matched = this.resolveAutocompleteOption(this.categoryOptions, value);
    if (!matched) {
      this.formModel.categoryId = '';
      this.formModel.subcategoryId = '';
      this.formModel.familyId = '';
      this.subcategoryQuery = '';
      this.familyQuery = '';
      this.specValuesDraft = {};
      return;
    }
    this.onCategoryChange(matched.id);
  }

  protected onSubcategoryAutocomplete(value: string): void {
    this.subcategoryQuery = value;
    const matched = this.resolveAutocompleteOption(this.subcategoryOptions, value);
    if (!matched) {
      this.formModel.subcategoryId = '';
      this.formModel.familyId = '';
      this.familyQuery = '';
      this.specValuesDraft = {};
      return;
    }
    this.onSubcategoryChange(matched.id);
  }

  protected onFamilyAutocomplete(value: string): void {
    this.familyQuery = value;
    const matched = this.resolveAutocompleteOption(this.familyOptions, value);
    if (!matched) {
      this.formModel.familyId = '';
      this.specValuesDraft = {};
      return;
    }
    this.onFamilyChange(matched.id);
  }

  protected onFamilyChange(familyId: string): void {
    this.formModel.familyId = familyId;
    this.familyQuery = this.optionNameById(this.familyOptions, familyId);
    this.syncSpecDraftFromFormModel();
    this.applyTemplateDraftSuggestions();
  }

  protected onSpecValueChange(fieldId: string, value: string): void {
    this.specValuesDraft = {
      ...this.specValuesDraft,
      [fieldId]: value
    };
  }

  protected specValue(fieldId: string): string {
    return this.specValuesDraft[fieldId] || '';
  }

  protected setUploadMode(mode: CatalogUploadMode): void {
    this.uploadMode = mode;
    this.catalogError = '';
    this.catalogNotice = '';
    this.relationError = '';
    this.relationNotice = '';
    this.requestError = '';
    this.requestNotice = '';
    if (mode === 'buscar') {
      void this.loadMasterCatalogPage();
    }
  }

  protected onMasterProductAutocomplete(value: string): void {
    this.masterProductQuery = value;
    this.masterCatalogPage = 1;
    void this.loadMasterCatalogPage();
    this.relationError = '';
    this.relationNotice = '';
  }

  protected onUploadCategoryAutocomplete(value: string): void {
    this.uploadCategoryQuery = value;
    const matched = this.resolveAutocompleteOption(this.uploadCategoryOptions, value);
    if (!matched) {
      this.uploadFilterCategoryId = '';
      this.uploadFilterSubcategoryId = '';
      this.uploadFilterFamilyId = '';
      this.uploadSubcategoryQuery = '';
      this.uploadFamilyQuery = '';
      this.masterCatalogPage = 1;
      void this.loadMasterCatalogPage();
      return;
    }

    this.uploadFilterCategoryId = matched.id;
    this.uploadFilterSubcategoryId = '';
    this.uploadFilterFamilyId = '';
    this.uploadCategoryQuery = matched.name;
    this.uploadSubcategoryQuery = '';
    this.uploadFamilyQuery = '';
    this.masterCatalogPage = 1;
    void this.loadMasterCatalogPage();
  }

  protected onUploadSubcategoryAutocomplete(value: string): void {
    this.uploadSubcategoryQuery = value;
    const matched = this.resolveAutocompleteOption(this.uploadSubcategoryOptions, value);
    if (!matched) {
      this.uploadFilterSubcategoryId = '';
      this.uploadFilterFamilyId = '';
      this.uploadFamilyQuery = '';
      this.masterCatalogPage = 1;
      void this.loadMasterCatalogPage();
      return;
    }

    this.uploadFilterSubcategoryId = matched.id;
    this.uploadFilterFamilyId = '';
    this.uploadSubcategoryQuery = matched.name;
    this.uploadFamilyQuery = '';
    this.masterCatalogPage = 1;
    void this.loadMasterCatalogPage();
  }

  protected onUploadFamilyAutocomplete(value: string): void {
    this.uploadFamilyQuery = value;
    const matched = this.resolveAutocompleteOption(this.uploadFamilyOptions, value);
    if (!matched) {
      this.uploadFilterFamilyId = '';
      this.masterCatalogPage = 1;
      void this.loadMasterCatalogPage();
      return;
    }

    this.uploadFilterFamilyId = matched.id;
    this.uploadFamilyQuery = matched.name;
    this.masterCatalogPage = 1;
    void this.loadMasterCatalogPage();
  }

  protected clearUploadTaxonomyFilters(): void {
    this.uploadCategoryQuery = '';
    this.uploadSubcategoryQuery = '';
    this.uploadFamilyQuery = '';
    this.uploadFilterCategoryId = '';
    this.uploadFilterSubcategoryId = '';
    this.uploadFilterFamilyId = '';
    this.masterCatalogPage = 1;
    void this.loadMasterCatalogPage();
  }

  protected onMasterCatalogPageSizeChange(value: number | string): void {
    const parsed = Number(value);
    this.masterCatalogPageSize = this.masterCatalogPageSizeOptions.includes(parsed) ? parsed : this.masterCatalogPageSizeOptions[0];
    this.masterCatalogPage = 1;
    void this.loadMasterCatalogPage();
  }

  protected previousMasterCatalogPage(): void {
    if (this.resolvedMasterCatalogPage <= 1) {
      return;
    }
    this.masterCatalogPage = this.resolvedMasterCatalogPage - 1;
    void this.loadMasterCatalogPage();
  }

  protected nextMasterCatalogPage(): void {
    if (this.resolvedMasterCatalogPage >= this.masterCatalogTotalPages) {
      return;
    }
    this.masterCatalogPage = this.resolvedMasterCatalogPage + 1;
    void this.loadMasterCatalogPage();
  }

  protected goToMasterCatalogPage(page: number): void {
    if (page < 1 || page > this.masterCatalogTotalPages) {
      return;
    }
    this.masterCatalogPage = page;
    void this.loadMasterCatalogPage();
  }

  protected onCatalogCategoryAutocomplete(value: string): void {
    this.catalogCategoryQuery = value;
    const matched = this.resolveAutocompleteOption(this.catalogFilterCategoryOptions, value);
    if (!matched) {
      this.catalogFilterCategoryId = '';
      this.catalogFilterSubcategoryId = '';
      this.catalogFilterFamilyId = '';
      this.catalogSubcategoryQuery = '';
      this.catalogFamilyQuery = '';
      this.catalogPage = 1;
      return;
    }

    this.catalogFilterCategoryId = matched.id;
    this.catalogFilterSubcategoryId = '';
    this.catalogFilterFamilyId = '';
    this.catalogSubcategoryQuery = '';
    this.catalogFamilyQuery = '';
    this.catalogCategoryQuery = matched.name;
    this.catalogPage = 1;
  }

  protected onCatalogSubcategoryAutocomplete(value: string): void {
    this.catalogSubcategoryQuery = value;
    const matched = this.resolveAutocompleteOption(this.catalogFilterSubcategoryOptions, value);
    if (!matched) {
      this.catalogFilterSubcategoryId = '';
      this.catalogFilterFamilyId = '';
      this.catalogFamilyQuery = '';
      this.catalogPage = 1;
      return;
    }

    this.catalogFilterSubcategoryId = matched.id;
    this.catalogFilterFamilyId = '';
    this.catalogFamilyQuery = '';
    this.catalogSubcategoryQuery = matched.name;
    this.catalogPage = 1;
  }

  protected onCatalogFamilyAutocomplete(value: string): void {
    this.catalogFamilyQuery = value;
    const matched = this.resolveAutocompleteOption(this.catalogFilterFamilyOptions, value);
    if (!matched) {
      this.catalogFilterFamilyId = '';
      this.catalogPage = 1;
      return;
    }

    this.catalogFilterFamilyId = matched.id;
    this.catalogFamilyQuery = matched.name;
    this.catalogPage = 1;
  }

  protected onCatalogProductInput(value: string): void {
    this.catalogProductQuery = value;
    this.catalogPage = 1;
  }

  protected clearCatalogFilters(): void {
    this.catalogCategoryQuery = '';
    this.catalogSubcategoryQuery = '';
    this.catalogFamilyQuery = '';
    this.catalogProductQuery = '';
    this.catalogFilterCategoryId = '';
    this.catalogFilterSubcategoryId = '';
    this.catalogFilterFamilyId = '';
    this.catalogPage = 1;
  }

  protected onCatalogPageSizeChange(value: number | string): void {
    const parsed = Number(value);
    this.catalogPageSize = this.catalogPageSizeOptions.includes(parsed) ? parsed : 10;
    this.catalogPage = 1;
  }

  protected previousCatalogPage(): void {
    if (this.resolvedCatalogPage <= 1) {
      return;
    }
    this.catalogPage = this.resolvedCatalogPage - 1;
  }

  protected nextCatalogPage(): void {
    if (this.resolvedCatalogPage >= this.catalogTotalPages) {
      return;
    }
    this.catalogPage = this.resolvedCatalogPage + 1;
  }

  protected goToCatalogPage(page: number): void {
    if (page < 1 || page > this.catalogTotalPages) {
      return;
    }
    this.catalogPage = page;
  }

  protected async submitProductRequest(): Promise<void> {
    const currentUser = this.user;
    if (!currentUser) {
      return;
    }

    this.requestError = '';
    this.requestNotice = '';

    try {
      const request = await this.apiService.requestCatalogProductCreation(
        currentUser.id,
        currentUser.businessName || currentUser.displayName,
        this.requestDraft
      );
      this.requestNotice = request.type === 'posible_match'
        ? 'Solicitud enviada. Admin revisara posibles coincidencias y te avisara.'
        : 'Solicitud enviada a admin para crear y asignar el producto.';
      this.requestDraft = {
        name: '',
        barcode: '',
        quantity: 1,
        price: 0
      };
    } catch (error) {
      this.requestError = error instanceof Error ? error.message : 'No se pudo enviar la solicitud.';
    }
  }

  protected isMasterProductSelected(product: CatalogProduct): boolean {
    return this.masterSelectionDrafts[this.masterProductId(product)]?.selected ?? false;
  }

  protected masterSelectionPrice(product: CatalogProduct): number {
    return this.masterSelectionDrafts[this.masterProductId(product)]?.price ?? (product.price || 0);
  }

  protected masterSelectionStock(product: CatalogProduct): number {
    return this.masterSelectionDrafts[this.masterProductId(product)]?.stock ?? 0;
  }

  protected toggleMasterProductSelection(product: CatalogProduct, selected: boolean): void {
    const productId = this.masterProductId(product);
    const current = this.masterSelectionDrafts[productId];
    this.masterSelectionDrafts = {
      ...this.masterSelectionDrafts,
      [productId]: {
        selected,
        price: current?.price ?? product.price ?? 0,
        stock: current?.stock ?? 0
      }
    };
    this.relationError = '';
    this.relationNotice = '';
  }

  protected updateMasterSelectionPrice(product: CatalogProduct, value: number | string): void {
    const productId = this.masterProductId(product);
    const parsedValue = Number(value);
    this.masterSelectionDrafts = {
      ...this.masterSelectionDrafts,
      [productId]: {
        selected: this.isMasterProductSelected(product),
        price: Number.isFinite(parsedValue) ? parsedValue : 0,
        stock: this.masterSelectionStock(product)
      }
    };
  }

  protected updateMasterSelectionStock(product: CatalogProduct, value: number | string): void {
    const productId = this.masterProductId(product);
    const parsedValue = Number(value);
    this.masterSelectionDrafts = {
      ...this.masterSelectionDrafts,
      [productId]: {
        selected: this.isMasterProductSelected(product),
        price: this.masterSelectionPrice(product),
        stock: Number.isFinite(parsedValue) ? parsedValue : 0
      }
    };
  }

  protected selectAllVisibleMasterProducts(): void {
    const nextDrafts = { ...this.masterSelectionDrafts };
    for (const product of this.paginatedMasterCatalogRows) {
      const productId = this.masterProductId(product);
      nextDrafts[productId] = {
        selected: true,
        price: nextDrafts[productId]?.price ?? product.price ?? 0,
        stock: nextDrafts[productId]?.stock ?? 0
      };
    }
    this.masterSelectionDrafts = nextDrafts;
    this.relationError = '';
    this.relationNotice = '';
  }

  protected clearSelectedMasterProducts(): void {
    const nextDrafts = { ...this.masterSelectionDrafts };
    for (const product of this.paginatedMasterCatalogRows) {
      const productId = this.masterProductId(product);
      if (!nextDrafts[productId]) {
        continue;
      }
      nextDrafts[productId] = {
        ...nextDrafts[productId],
        selected: false
      };
    }
    this.masterSelectionDrafts = nextDrafts;
  }

  protected openMasterProductGallery(product: CatalogProduct): void {
    const images = this.resolveProductGallery(product);
    if (images.length === 0) {
      return;
    }

    this.galleryPreviewProduct = product;
    this.galleryPreviewActiveIndex = 0;
    this.galleryPreviewModalOpen = true;
  }

  protected closeMasterProductGallery(): void {
    this.galleryPreviewModalOpen = false;
    this.galleryPreviewProduct = null;
    this.galleryPreviewActiveIndex = 0;
  }

  protected selectGalleryPreviewImage(index: number): void {
    if (index < 0 || index >= this.galleryPreviewImages.length) {
      return;
    }
    this.galleryPreviewActiveIndex = index;
  }

  protected async saveSelectedMasterProducts(): Promise<void> {
    const currentUser = this.user;
    if (!currentUser) {
      return;
    }

    const selectedRelations = this.selectedMasterCatalogProducts;
    if (selectedRelations.length === 0) {
      this.relationError = 'Selecciona al menos un producto del catalogo maestro.';
      return;
    }

    const invalidPrice = selectedRelations.find((item) => item.price <= 0);
    if (invalidPrice) {
      this.relationError = `Ingresa un precio valido para ${invalidPrice.product.name}.`;
      return;
    }

    const invalidStock = selectedRelations.find((item) => item.stock < 0);
    if (invalidStock) {
      this.relationError = `El stock no puede ser negativo para ${invalidStock.product.name}.`;
      return;
    }

    const availability = this.apiService.canAddCatalogProduct(currentUser.id, this.currentPlan);
    const remaining = availability.limit === null
      ? null
      : Math.max(0, availability.limit - (availability.currentCount || 0));
    if (remaining !== null && selectedRelations.length > remaining) {
      this.relationError = `${availability.message} Solo puedes agregar ${remaining} producto(s) mas con tu plan actual.`;
      return;
    }

    this.isSavingMasterSelection = true;
    this.relationError = '';
    this.relationNotice = '';

    try {
      const result = await this.apiService.addCatalogProductsFromMasterBatch(
        currentUser.id,
        selectedRelations.map((item) => ({
          masterProductId: this.masterProductId(item.product),
          price: item.price,
          stock: item.stock
        }))
      );

      this.catalog = result.catalog;
      this.refreshSummary();
      this.pruneMasterSelectionDrafts();
      void this.loadMasterCatalogPage();

      const messageParts: string[] = [];
      if (result.createdCount > 0) {
        messageParts.push(`${result.createdCount} creado(s)`);
      }
      if (result.updatedCount > 0) {
        messageParts.push(`${result.updatedCount} actualizado(s)`);
      }
      this.relationNotice = messageParts.length > 0
        ? `Productos guardados en tu catalogo: ${messageParts.join(', ')}.`
        : 'Productos guardados en tu catalogo.';
    } catch (error) {
      this.relationError = error instanceof Error ? error.message : 'No se pudieron guardar los productos seleccionados.';
    } finally {
      this.isSavingMasterSelection = false;
    }
  }

  protected async submitCatalog(): Promise<void> {
    const currentUser = this.user;
    if (!currentUser) {
      return;
    }

    this.catalogError = '';
    this.catalogNotice = '';

    const formError = this.validateCatalogForm();
    if (formError) {
      this.catalogError = formError;
      return;
    }

    if (!this.editingProductId) {
      const availability = this.apiService.canAddCatalogProduct(currentUser.id, this.currentPlan);
      if (!availability.allowed) {
        this.catalogError = `${availability.message} Cambia a Plan Pro o Premium para ampliar capacidad.`;
        this.currentSection = 'suscripcion';
        return;
      }
    }

    const familyTemplate = this.activeFamilyTemplate;
    const specValues = this.collectSpecValuesForTemplate();
    const manualTechnicalSheet = this.parseTechnicalSheet(this.detailTechnicalSheetText);
    const templateTechnicalSheet = this.buildTemplateTechnicalSheet(specValues, familyTemplate);

    const payload: CatalogProduct = {
      ...this.formModel,
      id: this.editingProductId || this.formModel.id,
      name: this.formModel.name.trim(),
      brand: this.formModel.brand.trim(),
      productType: this.formModel.productType.trim(),
      sku: this.formModel.sku.trim().toUpperCase(),
      unitLabel: this.formModel.unitLabel.trim() || 'Unidad',
      packagingLabel: this.formModel.packagingLabel.trim() || this.formModel.unitLabel.trim() || 'Unidad',
      imageUrl: this.formModel.imageUrl.trim(),
      shortDescription: this.formModel.shortDescription.trim(),
      descriptionBlocks: this.parseDescriptionBlocks(this.detailDescriptionBlocksText),
      featureBullets: this.parseLineList(this.detailFeatureBulletsText),
      technicalSheet: this.mergeTechnicalRows(manualTechnicalSheet, templateTechnicalSheet),
      extraSections: this.parseExtraSections(this.detailExtraSectionsText),
      gallery: this.resolveGallery(),
      specValues,
      templateVersion: familyTemplate?.version || 1
    };

    try {
      const wasEditing = !!this.editingProductId;
      this.catalog = await this.apiService.upsertCatalog(currentUser.id, payload);
      this.resetCatalogForm();
      this.refreshSummary();
      this.catalogNotice = wasEditing ? 'Producto actualizado correctamente.' : 'Producto agregado al catalogo.';
      this.currentSection = 'catalogo';
    } catch (error) {
      this.catalogError = error instanceof Error ? error.message : 'No se pudo guardar el producto en catalogo.';
    }
  }

  protected trackByCatalogProduct(_index: number, product: CatalogProduct): string {
    return this.masterProductId(product);
  }

  protected editCatalog(product: CatalogProduct): void {
    this.uploadMode = 'solicitud';
    this.editingProductId = product.id;
    this.formModel = { ...product };
    this.syncDetailDraftFromFormModel();
    this.syncTaxonomyAutocompleteFromFormModel();
    this.syncSpecDraftFromFormModel();
    this.currentSection = 'subir';
  }

  protected startCatalogInlineEdit(product: CatalogProduct): void {
    this.catalogInlineError = '';
    this.catalogNotice = '';
    this.catalogInlineEditId = product.id;
    this.catalogInlineDraft = {
      sku: product.sku,
      price: product.price,
      stock: product.stock
    };
  }

  protected cancelCatalogInlineEdit(): void {
    this.catalogInlineEditId = null;
    this.catalogInlineError = '';
    this.catalogInlineDraft = {
      sku: '',
      price: 0,
      stock: 0
    };
  }

  protected async saveCatalogInlineEdit(product: CatalogProduct): Promise<void> {
    const currentUser = this.user;
    if (!currentUser || this.catalogInlineEditId !== product.id) {
      return;
    }

    this.catalogInlineError = '';
    this.catalogNotice = '';

    const normalizedSku = this.catalogInlineDraft.sku.trim().toUpperCase();
    const normalizedPrice = Math.round(Number(this.catalogInlineDraft.price) || 0);
    const normalizedStock = Math.floor(Number(this.catalogInlineDraft.stock) || 0);

    if (normalizedSku.length < 2) {
      this.catalogInlineError = 'El SKU debe tener al menos 2 caracteres.';
      return;
    }
    if (this.isCatalogSkuDuplicated(normalizedSku, product.id)) {
      this.catalogInlineError = 'Ya existe otro producto con ese SKU.';
      return;
    }
    if (normalizedPrice <= 0) {
      this.catalogInlineError = 'El precio debe ser mayor a 0.';
      return;
    }
    if (normalizedStock < 0) {
      this.catalogInlineError = 'El stock no puede ser negativo.';
      return;
    }

    const payload: CatalogProduct = {
      ...product,
      sku: normalizedSku,
      price: normalizedPrice,
      stock: normalizedStock
    };

    try {
      this.catalog = await this.apiService.upsertCatalog(currentUser.id, payload);
      this.refreshSummary();
      if (this.selectedCatalogProduct?.id === product.id) {
        this.selectedCatalogProduct = payload;
      }
      this.cancelCatalogInlineEdit();
      this.catalogNotice = 'SKU, precio y stock actualizados.';
    } catch (error) {
      this.catalogInlineError = error instanceof Error ? error.message : 'No se pudo actualizar el producto.';
    }
  }

  protected requestDeleteCatalog(product: CatalogProduct): void {
    this.catalogDeleteCandidate = product;
    this.deleteCatalogModalOpen = true;
  }

  protected closeDeleteCatalogModal(): void {
    this.deleteCatalogModalOpen = false;
    this.catalogDeleteCandidate = null;
  }

  protected async confirmDeleteCatalog(): Promise<void> {
    if (!this.user || !this.catalogDeleteCandidate) {
      return;
    }

    const productId = this.catalogDeleteCandidate.id;

    this.catalogNotice = '';
    this.catalogError = '';
    this.catalogInlineError = '';
    try {
      this.catalog = await this.apiService.deleteCatalog(this.user.id, productId);
      if (this.editingProductId === productId) {
        this.resetCatalogForm();
      }
      if (this.catalogInlineEditId === productId) {
        this.cancelCatalogInlineEdit();
      }
      if (this.selectedCatalogProduct?.id === productId) {
        this.selectedCatalogProduct = null;
      }
      this.closeDeleteCatalogModal();
      this.clampCatalogPage();
      this.refreshSummary();
      this.catalogNotice = 'Producto eliminado del catalogo.';
    } catch (error) {
      this.catalogError = error instanceof Error ? error.message : 'No se pudo eliminar el producto.';
    }
  }

  protected toggleCatalogDetail(product: CatalogProduct): void {
    if (this.selectedCatalogProduct?.id === product.id) {
      this.selectedCatalogProduct = null;
      return;
    }
    this.selectedCatalogProduct = product;
  }

  protected closeCatalogDetail(): void {
    this.selectedCatalogProduct = null;
  }

  protected catalogSpecRows(product: CatalogProduct): ProductTechSpecRow[] {
    const template = this.apiService.getFamilyTemplate(product.familyId);
    const source = product.specValues || {};
    const rows: ProductTechSpecRow[] = [];

    if (template) {
      template.specFields.forEach((field) => {
        const rawValue = (source[field.id] || '').trim();
        if (!rawValue) {
          return;
        }
        rows.push({
          label: field.label,
          value: field.unitLabel ? `${rawValue} ${field.unitLabel}` : rawValue
        });
      });
    }

    const covered = new Set((template?.specFields || []).map((field) => field.id));
    Object.entries(source).forEach(([key, rawValue]) => {
      const value = rawValue.trim();
      if (!value || covered.has(key)) {
        return;
      }
      rows.push({
        label: this.prettifySpecLabel(key),
        value
      });
    });

    return rows;
  }

  protected resetCatalogForm(): void {
    this.editingProductId = null;
    this.catalogError = '';
    this.formModel = this.createEmptyCatalogForm();
    this.syncDetailDraftFromFormModel();
    this.syncTaxonomyAutocompleteFromFormModel();
    this.syncSpecDraftFromFormModel();
  }

  protected async importCsv(): Promise<void> {
    const currentUser = this.user;
    if (!currentUser || !this.csvContent.trim()) {
      return;
    }

    this.csvError = '';
    this.csvNotice = '';

    if (!this.canUseCsvImport) {
      this.csvError = 'Tu plan actual no permite importacion CSV. Cambia a Plan Pro o Premium.';
      this.currentSection = 'suscripcion';
      return;
    }

    const defaultCategoryId = this.formModel.categoryId || this.categoryOptions[0]?.id || '';
    const defaultSubcategoryId = this.formModel.subcategoryId || this.apiService.getSubcategoryOptions(defaultCategoryId)[0]?.id || '';
    const defaultFamilyId = this.formModel.familyId || this.apiService.getFamilyOptions(defaultSubcategoryId)[0]?.id || '';

    try {
      const response = await this.apiService.importCatalogBatch(
        currentUser.id,
        currentUser.businessName || currentUser.displayName,
        this.csvContent,
        this.currentPlan,
        {
        categoryId: defaultCategoryId,
        subcategoryId: defaultSubcategoryId,
        familyId: defaultFamilyId,
        brand: this.formModel.brand.trim() || 'Sin marca',
        unitLabel: this.formModel.unitLabel.trim() || 'Unidad',
        isPublished: true
        }
      );

      this.catalog = response.catalog;
      this.importSummary = response.report;
      this.importSummaryModalOpen = true;
      this.refreshSummary();
      this.csvNotice = `Carga procesada: ${response.report.uploadedCount} subidos, ${response.report.failedCount} fallidos, ${response.report.pendingNewCount} nuevos en validacion y ${response.report.possibleMatchCount} posibles match.`;
      this.currentSection = 'catalogo';
    } catch (error) {
      this.csvError = error instanceof Error ? error.message : 'No se pudo procesar la importacion CSV.';
    }
  }

  protected async saveProfile(): Promise<void> {
    try {
      await this.authService.updateProfile(this.profileDraft);
      this.profileSaved = true;
      setTimeout(() => {
        this.profileSaved = false;
      }, 1800);
    } catch {
      this.profileSaved = false;
    }
  }

  protected logout(): void {
    this.closeMobileMenu();
    this.authService.logout();
    this.router.navigateByUrl('/');
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  protected importRows(outcome: CatalogImportOutcome): CatalogImportRowResult[] {
    return this.importSummary?.rows.filter((row) => row.outcome === outcome) || [];
  }

  protected closeImportSummaryModal(): void {
    this.importSummaryModalOpen = false;
  }

  protected categoryName(categoryId: string): string {
    return this.categoryOptions.find((item) => item.id === categoryId)?.name || '-';
  }

  protected subcategoryName(subcategoryId: string): string {
    return this.apiService.getSubcategoryOptions()
      .find((item) => item.id === subcategoryId)?.name || '-';
  }

  protected familyName(familyId: string): string {
    return this.apiService.getFamilyOptions()
      .find((item) => item.id === familyId)?.name || '-';
  }

  protected async changeSubscriptionPlan(plan: SubscriptionPlan): Promise<void> {
    if (!this.user || this.currentPlan === plan) {
      return;
    }

    try {
      await this.authService.updateProfile({ subscriptionPlan: plan });
      const planLabel = this.apiService.getFerreteriaPlanCapabilities(plan).label;
      this.subscriptionNotice = `Plan actualizado a ${planLabel}.`;
      this.refreshSummary();
    } catch (error) {
      this.subscriptionNotice = error instanceof Error ? error.message : 'No fue posible actualizar el plan.';
    }
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
    if (!currentUser) {
      return;
    }

    if (!force && this.loadedSections.has(section)) {
      return;
    }

    this.isSectionLoading = true;
    try {
      if (section === 'inicio') {
        await this.apiService.refreshFerreteriaOverview(currentUser.id);
        this.refreshSummary();
      }

      if (section === 'catalogo') {
        await this.apiService.refreshFerreteriaCatalogSection(currentUser.id);
        this.catalog = this.apiService.getCatalog(currentUser.id);
        this.clampCatalogPage();
        if (this.catalogInlineEditId && !this.catalog.some((item) => item.id === this.catalogInlineEditId)) {
          this.cancelCatalogInlineEdit();
        }
        if (this.catalogDeleteCandidate && !this.catalog.some((item) => item.id === this.catalogDeleteCandidate?.id)) {
          this.closeDeleteCatalogModal();
        }
        if (this.selectedCatalogProduct) {
          this.selectedCatalogProduct = this.catalog.find((item) => item.id === this.selectedCatalogProduct?.id) || null;
        }
      }

      if (section === 'subir') {
        await this.apiService.refreshFerreteriaUploadSection(currentUser.id);
        this.pruneMasterSelectionDrafts();
        if (this.uploadMode === 'buscar') {
          await this.loadMasterCatalogPage();
        }
      }

      if (section === 'metricas') {
        await this.apiService.refreshFerreteriaMetricsSection(currentUser.id);
        this.refreshSummary();
      }

      if (section === 'perfil') {
        this.syncProfileDraftFromUser();
      }

      if (section === 'suscripcion') {
        await this.apiService.refreshFerreteriaSubscriptionSection(currentUser.id, force);
      }

      this.loadedSections.add(section);
    } finally {
      this.isSectionLoading = false;
    }
  }

  private refreshSummary(): void {
    if (!this.user) {
      return;
    }

    const mvpMetrics = this.apiService.getFerreteriaMvpMetrics(this.user.id);
    this.catalogProductsCount = mvpMetrics.totalProducts;
    this.totalProducts = mvpMetrics.publishedProducts;
    this.publishedProducts = mvpMetrics.publishedProducts;
    this.lowStock = mvpMetrics.lowStockProducts;
    this.outOfStockProducts = mvpMetrics.outOfStockProducts;
    this.avgPrice = mvpMetrics.avgPricePublished;
    this.avgPricePublished = mvpMetrics.avgPricePublished;
    this.quotationReach = mvpMetrics.quotationReach;
  }

  private syncProfileDraftFromUser(): void {
    const currentUser = this.user;
    if (!currentUser) {
      return;
    }

    this.profileDraft = {
      displayName: currentUser.displayName,
      businessName: currentUser.businessName || currentUser.displayName,
      phone: currentUser.phone || '',
      city: currentUser.city || '',
      commune: currentUser.commune || '',
      address: currentUser.address || ''
    };
  }

  private validateCatalogForm(): string {
    const name = this.formModel.name.trim();
    const sku = this.formModel.sku.trim().toUpperCase();
    const familyTemplate = this.activeFamilyTemplate;
    const specValues = this.collectSpecValuesForTemplate();
    const features = this.parseLineList(this.detailFeatureBulletsText);
    const descriptionBlocks = this.parseDescriptionBlocks(this.detailDescriptionBlocksText);
    const technicalSheet = this.mergeTechnicalRows(
      this.parseTechnicalSheet(this.detailTechnicalSheetText),
      this.buildTemplateTechnicalSheet(specValues, familyTemplate)
    );
    const extraSections = this.parseExtraSections(this.detailExtraSectionsText);

    if (name.length < 3) {
      return 'El nombre del producto debe tener al menos 3 caracteres.';
    }
    if (!this.formModel.categoryId || !this.formModel.subcategoryId || !this.formModel.familyId) {
      return 'Selecciona categoria, subcategoria y familia.';
    }
    if (this.formModel.brand.trim().length < 2) {
      return 'Ingresa una marca valida.';
    }
    if (this.formModel.productType.trim().length < 3) {
      return 'Ingresa el tipo de producto.';
    }
    if (this.formModel.packagingLabel.trim().length < 2) {
      return 'Ingresa la presentacion o empaque del producto.';
    }
    if (sku.length < 2) {
      return 'El SKU es obligatorio.';
    }
    if (this.isSkuDuplicated(sku)) {
      return 'Ya existe un producto con ese SKU.';
    }
    if (this.formModel.price <= 0) {
      return 'El precio debe ser mayor a 0.';
    }
    if (this.formModel.stock < 0) {
      return 'El stock no puede ser negativo.';
    }
    if (this.formModel.shortDescription.trim().length < 20) {
      return 'Agrega un resumen corto de al menos 20 caracteres.';
    }
    if (features.length < 2) {
      return 'Ingresa al menos 2 caracteristicas (una por linea).';
    }
    if (descriptionBlocks.length === 0) {
      return 'Ingresa al menos 1 bloque de descripcion.';
    }
    if (technicalSheet.length < 3) {
      return 'Ingresa al menos 3 filas en la ficha tecnica.';
    }
    if (extraSections.length === 0) {
      return 'Ingresa al menos 1 seccion adicional.';
    }
    if (familyTemplate) {
      const missingRequired = familyTemplate.specFields
        .filter((field) => field.required)
        .filter((field) => !specValues[field.id]?.trim())
        .map((field) => field.label);
      if (missingRequired.length > 0) {
        return `Completa los campos obligatorios de la familia: ${missingRequired.join(', ')}.`;
      }
    }

    return '';
  }

  private isSkuDuplicated(candidateSku: string): boolean {
    return this.catalog.some((item) =>
      item.sku.trim().toUpperCase() === candidateSku
      && item.id !== this.editingProductId
    );
  }

  private isCatalogSkuDuplicated(candidateSku: string, productId: string): boolean {
    return this.catalog.some((item) =>
      item.sku.trim().toUpperCase() === candidateSku
      && item.id !== productId
    );
  }

  private get catalogTaxonomyFilteredRows(): CatalogProduct[] {
    return this.catalog.filter((item) => {
      const categoryOk = !this.catalogFilterCategoryId || item.categoryId === this.catalogFilterCategoryId;
      const subcategoryOk = !this.catalogFilterSubcategoryId || item.subcategoryId === this.catalogFilterSubcategoryId;
      const familyOk = !this.catalogFilterFamilyId || item.familyId === this.catalogFilterFamilyId;
      return categoryOk && subcategoryOk && familyOk;
    });
  }

  private get selectedMasterCatalogProducts(): Array<{
    product: CatalogProduct;
    price: number;
    stock: number;
  }> {
    const linkedMasterIds = new Set(this.catalog.map((item) => this.masterProductId(item)));

    return Object.entries(this.masterSelectionDrafts)
      .filter(([, draft]) => draft.selected)
      .filter(([productId]) => !linkedMasterIds.has(productId))
      .map(([productId, draft]) => {
        const product = this.masterCatalogProductCache.get(productId);
        if (!product) {
          return null;
        }
        return {
          product,
          price: draft.price,
          stock: draft.stock
        };
      })
      .filter((item): item is { product: CatalogProduct; price: number; stock: number } => item !== null);
  }

  private get resolvedCatalogPage(): number {
    return Math.min(Math.max(1, this.catalogPage), this.catalogTotalPages);
  }

  private clampCatalogPage(): void {
    this.catalogPage = this.resolvedCatalogPage;
  }

  private masterProductId(product: CatalogProduct): string {
    const rawId = (product.masterProductId || product.id || '').trim();
    if (rawId) {
      return rawId;
    }

    return [
      product.name || 'producto',
      product.brand || 'sin-marca',
      product.categoryId || 'sin-categoria',
      product.subcategoryId || 'sin-subcategoria',
      product.familyId || 'sin-familia'
    ].join('|').toLowerCase();
  }

  private pruneMasterSelectionDrafts(): void {
    const linkedIds = new Set(this.catalog.map((product) => this.masterProductId(product)));
    const nextDrafts: Record<string, MasterCatalogSelectionDraft> = {};

    for (const [productId, draft] of Object.entries(this.masterSelectionDrafts)) {
      if (linkedIds.has(productId)) {
        continue;
      }
      nextDrafts[productId] = draft;
    }

    this.masterSelectionDrafts = nextDrafts;
  }

  private readonly masterCatalogProductCache = new Map<string, CatalogProduct>();
  private masterCatalogRequestSeq = 0;

  private async loadMasterCatalogPage(): Promise<void> {
    const currentUser = this.user;
    if (!currentUser) {
      this.masterCatalogRows = [];
      this.masterCatalogTotal = 0;
      this.masterCatalogLoaded = true;
      return;
    }

    const requestSeq = ++this.masterCatalogRequestSeq;
    this.isLoadingMasterCatalog = true;
    this.masterCatalogLoadError = '';

    try {
      const linkedMasterIds = this.catalog
        .map((item) => this.masterProductId(item))
        .filter(Boolean);

      const response = await this.apiService.searchMasterCatalogProducts({
        query: this.masterProductQuery,
        categoryId: this.uploadFilterCategoryId || undefined,
        subcategoryId: this.uploadFilterSubcategoryId || undefined,
        familyId: this.uploadFilterFamilyId || undefined,
        excludeMasterProductIds: linkedMasterIds,
        page: this.masterCatalogPage,
        size: this.masterCatalogPageSize
      });

      if (requestSeq !== this.masterCatalogRequestSeq) {
        return;
      }

      this.masterCatalogRows = response.items;
      this.masterCatalogTotal = response.total;
      this.masterCatalogPage = response.page;
      this.masterCatalogPageSize = response.size;
      this.masterCatalogLoaded = true;

      for (const product of response.items) {
        this.masterCatalogProductCache.set(this.masterProductId(product), product);
      }
    } catch (error) {
      if (requestSeq !== this.masterCatalogRequestSeq) {
        return;
      }
      this.masterCatalogRows = [];
      this.masterCatalogTotal = 0;
      this.masterCatalogLoaded = true;
      this.masterCatalogLoadError = error instanceof Error ? error.message : 'No fue posible cargar el catalogo maestro.';
    } finally {
      if (requestSeq === this.masterCatalogRequestSeq) {
        this.isLoadingMasterCatalog = false;
      }
    }
  }

  private createEmptyCatalogForm(): CatalogProduct {
    return {
      id: '',
      name: '',
      categoryId: '',
      subcategoryId: '',
      familyId: '',
      brand: '',
      productType: '',
      unitLabel: 'Unidad',
      packagingLabel: 'Unidad',
      price: 0,
      stock: 0,
      sku: '',
      imageUrl: '',
      isPublished: true,
      shortDescription: '',
      descriptionBlocks: [],
      featureBullets: [],
      technicalSheet: [],
      extraSections: [],
      gallery: [],
      specValues: {},
      templateVersion: 1
    };
  }

  private syncDetailDraftFromFormModel(): void {
    this.detailFeatureBulletsText = this.formModel.featureBullets.join('\n');
    this.detailGalleryText = this.formModel.gallery.join('\n');
    this.detailDescriptionBlocksText = this.formModel.descriptionBlocks
      .map((block) => block.title ? `${block.title}: ${block.text}` : block.text)
      .join('\n');
    this.detailTechnicalSheetText = this.formModel.technicalSheet
      .map((row) => `${row.label}: ${row.value}`)
      .join('\n');
    this.detailExtraSectionsText = this.formModel.extraSections
      .map((section) => `${section.title}|${section.points.join('; ')}`)
      .join('\n');
  }

  private syncTaxonomyAutocompleteFromFormModel(): void {
    this.categoryQuery = this.optionNameById(this.categoryOptions, this.formModel.categoryId);
    this.subcategoryQuery = this.optionNameById(this.subcategoryOptions, this.formModel.subcategoryId);
    this.familyQuery = this.optionNameById(this.familyOptions, this.formModel.familyId);
  }

  private syncSpecDraftFromFormModel(): void {
    const template = this.activeFamilyTemplate;
    if (!template) {
      this.specValuesDraft = {};
      return;
    }

    const source = this.formModel.specValues || {};
    const next: Record<string, string> = {};
    template.specFields.forEach((field) => {
      next[field.id] = (source[field.id] || '').trim();
    });
    this.specValuesDraft = next;
  }

  private applyTemplateDraftSuggestions(): void {
    const template = this.activeFamilyTemplate;
    if (!template) {
      return;
    }

    if (!this.formModel.shortDescription.trim()) {
      this.formModel.shortDescription = template.descriptionHint;
    }

    if (!this.detailFeatureBulletsText.trim() && template.featureSuggestions.length > 0) {
      this.detailFeatureBulletsText = template.featureSuggestions.join('\n');
    }

    if (!this.detailExtraSectionsText.trim() && template.usageGuidelines.length > 0) {
      this.detailExtraSectionsText = `Uso recomendado|${template.usageGuidelines.join('; ')}`;
    }
  }

  private collectSpecValuesForTemplate(): Record<string, string> {
    const template = this.activeFamilyTemplate;
    if (!template) {
      return {};
    }

    const next: Record<string, string> = {};
    template.specFields.forEach((field) => {
      next[field.id] = (this.specValuesDraft[field.id] || '').trim();
    });
    return next;
  }

  private optionNameById(options: TaxonomyOption[], id: string): string {
    return options.find((item) => item.id === id)?.name || '';
  }

  private resolveAutocompleteOption(options: TaxonomyOption[], inputValue: string): TaxonomyOption | null {
    const normalized = inputValue.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const exactMatch = options.find((item) => item.name.toLowerCase() === normalized);
    if (exactMatch) {
      return exactMatch;
    }

    const prefixMatches = options.filter((item) => item.name.toLowerCase().startsWith(normalized));
    return prefixMatches.length === 1 ? prefixMatches[0] : null;
  }

  private normalizeBarcodeInput(value: string): string {
    return value.replace(/\D/g, '').slice(0, 14);
  }

  private prettifySpecLabel(rawKey: string): string {
    return rawKey
      .split(/[_-]+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  private resolveGallery(): string[] {
    const gallery = this.parseLineList(this.detailGalleryText);
    const imageUrl = this.formModel.imageUrl.trim();
    if (gallery.length === 0 && imageUrl) {
      return [imageUrl];
    }
    return gallery;
  }

  private resolveProductGallery(product: CatalogProduct | null): string[] {
    if (!product) {
      return [];
    }

    const images = [
      ...(product.gallery || []),
      product.imageUrl || ''
    ]
      .map((item) => item.trim())
      .filter(Boolean);

    return Array.from(new Set(images));
  }

  private parseLineList(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private parseDescriptionBlocks(value: string): ProductDescriptionBlock[] {
    return this.parseLineList(value).map((line) => {
      const [first, ...rest] = line.split(':');
      if (rest.length === 0) {
        return { text: first.trim() };
      }
      return {
        title: first.trim(),
        text: rest.join(':').trim()
      };
    }).filter((block) => block.text.length > 0);
  }

  private parseTechnicalSheet(value: string): ProductTechSpecRow[] {
    return this.parseLineList(value).map((line, index) => {
      const [first, ...rest] = line.split(':');
      if (rest.length === 0) {
        return {
          label: `Dato ${index + 1}`,
          value: first.trim()
        };
      }
      return {
        label: first.trim(),
        value: rest.join(':').trim()
      };
    }).filter((row) => row.value.length > 0);
  }

  private buildTemplateTechnicalSheet(
    specValues: Record<string, string>,
    template: FamilyTemplate | null
  ): ProductTechSpecRow[] {
    if (!template) {
      return [];
    }

    return template.specFields
      .map((field) => {
        const value = (specValues[field.id] || '').trim();
        if (!value) {
          return null;
        }
        const withUnit = field.unitLabel ? `${value} ${field.unitLabel}` : value;
        return {
          label: field.label,
          value: withUnit
        };
      })
      .filter((row): row is ProductTechSpecRow => row !== null);
  }

  private mergeTechnicalRows(baseRows: ProductTechSpecRow[], templateRows: ProductTechSpecRow[]): ProductTechSpecRow[] {
    const merged = new Map<string, ProductTechSpecRow>();
    [...baseRows, ...templateRows].forEach((row) => {
      const key = row.label.trim().toLowerCase();
      if (!key) {
        return;
      }
      merged.set(key, row);
    });
    return Array.from(merged.values());
  }

  private parseExtraSections(value: string): ProductExtraSection[] {
    return this.parseLineList(value).map((line, index) => {
      const [titleChunk, pointsChunk = ''] = line.split('|');
      const points = pointsChunk
        .split(';')
        .map((point) => point.trim())
        .filter(Boolean);
      return {
        id: this.editingProductId
          ? `${this.editingProductId}-extra-${index + 1}`
          : `extra-${index + 1}`,
        title: titleChunk.trim() || `Seccion ${index + 1}`,
        points
      };
    }).filter((section) => section.points.length > 0);
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncViewportState();
  }

  private syncViewportState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.isMobileViewport = window.innerWidth <= 1060;
    if (!this.isMobileViewport) {
      this.isMobileMenuVisible = false;
    }
  }
}
