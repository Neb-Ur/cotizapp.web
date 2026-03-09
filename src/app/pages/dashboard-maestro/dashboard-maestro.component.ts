import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FamilyProductRow,
  PreferredContactMethod,
  ProjectStatus,
  ProjectSummary,
  SessionUser,
  SubscriptionPlan,
  TaxonomyOption
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService } from '../../core/services/mock-api.service';
import { DashboardMenuComponent } from '../../shared/components/dashboard-menu/dashboard-menu.component';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';

type MaestroSection = 'inicio' | 'buscar' | 'cotizaciones' | 'historial' | 'perfil' | 'suscripcion';
type FilterSectionKey = 'brand' | 'seller' | 'price' | 'type';

interface OptionCount {
  value: string;
  count: number;
}

interface PriceRangeFilter {
  id: string;
  label: string;
  min: number;
  max: number | null;
}

interface MaestroProfileDraft {
  displayName: string;
  rut: string;
  specialty: string;
  phone: string;
  secondaryPhone: string;
  preferredContactMethod: PreferredContactMethod;
  city: string;
  commune: string;
  address: string;
}

interface SubscriptionPlanView {
  id: SubscriptionPlan;
  title: string;
  priceLabel: string;
  description: string;
  maxPendingLabel: string;
  hasHistory: boolean;
}

interface MaestroSectionMeta {
  id: MaestroSection;
  label: string;
  description: string;
}

@Component({
  selector: 'app-dashboard-maestro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DashboardMenuComponent, UiLoaderComponent],
  templateUrl: './dashboard-maestro.component.html',
  styleUrl: './dashboard-maestro.component.scss'
})
export class DashboardMaestroComponent implements OnInit {
  protected readonly sections: MaestroSectionMeta[] = [
    {
      id: 'inicio',
      label: 'Inicio',
      description: 'Revisa tu actividad reciente, cotizaciones activas y los indicadores clave de tus compras.'
    },
    {
      id: 'buscar',
      label: 'Buscar Producto',
      description: 'Explora el catalogo, filtra por taxonomia y compara alternativas para cotizar mejor tus materiales.'
    },
    {
      id: 'cotizaciones',
      label: 'Mis Cotizaciones',
      description: 'Administra tus solicitudes en curso, crea nuevos pedidos y sigue el estado de respuesta de las ferreterias.'
    },
    {
      id: 'historial',
      label: 'Historial',
      description: 'Consulta cotizaciones cerradas, decisiones tomadas y resultados previos para futuras compras.'
    },
    {
      id: 'perfil',
      label: 'Perfil',
      description: 'Actualiza tus datos de contacto, ubicacion y perfil profesional para cotizar sin friccion.'
    },
    {
      id: 'suscripcion',
      label: 'Suscripcion',
      description: 'Revisa tu plan, beneficios disponibles y capacidad para gestionar cotizaciones pendientes.'
    }
  ];

  protected currentSection: MaestroSection = 'inicio';

  protected categorySearch = '';
  protected subcategorySearch = '';
  protected familySearch = '';
  protected tableProductSearch = '';
  protected selectedCategoryId = '';
  protected selectedSubcategoryId = '';
  protected selectedFamilyId = '';
  protected brandSearch = '';
  protected selectedBrands: string[] = [];
  protected selectedSellers: string[] = [];
  protected selectedPriceRanges: string[] = [];
  protected selectedProductTypes: string[] = [];
  protected showAllBrands = false;
  protected showAllTypes = false;
  protected productFiltersOpen = false;
  protected filterSectionOpen: Record<FilterSectionKey, boolean> = {
    brand: true,
    seller: true,
    price: true,
    type: true
  };
  protected pageSize = 5;
  protected currentPage = 1;
  protected projectTarget = '';
  protected draftProjectName = '';
  protected draftProjectAddress = '';
  protected readonly pageSizeOptions = [5, 10, 20];
  protected readonly priceRanges: PriceRangeFilter[] = [
    { id: 'pr-1', label: 'Hasta $10.000', min: 0, max: 10000 },
    { id: 'pr-2', label: '$10.000 - $20.000', min: 10000, max: 20000 },
    { id: 'pr-3', label: '$20.000 - $40.000', min: 20000, max: 40000 },
    { id: 'pr-4', label: '$40.000 - $60.000', min: 40000, max: 60000 },
    { id: 'pr-5', label: '$60.000 - $100.000', min: 60000, max: 100000 },
    { id: 'pr-6', label: '$100.000 - $200.000', min: 100000, max: 200000 },
    { id: 'pr-7', label: '$200.000 o más', min: 200000, max: null }
  ];
  private familyRowsForFiltersData: FamilyProductRow[] = [];
  private tableBaseRowsData: FamilyProductRow[] = [];
  private brandOptionsData: OptionCount[] = [];
  private visibleBrandOptionsData: OptionCount[] = [];
  private productTypeOptionsData: OptionCount[] = [];
  private visibleProductTypeOptionsData: OptionCount[] = [];
  private sellerOptionsData: OptionCount[] = [];
  private filteredFamilyProductsData: FamilyProductRow[] = [];
  private paginatedFamilyProductsData: FamilyProductRow[] = [];
  private totalPagesData = 1;
  private pageStartData = 0;
  private pageEndData = 0;
  private pageNumbersData: number[] = [1];

  protected history: ProjectSummary[] = [];

  protected activeProjects = 0;
  protected estimatedSaving = 0;
  protected topSearches: string[] = [];

  protected profileDraft: MaestroProfileDraft = {
    displayName: '',
    rut: '',
    specialty: '',
    phone: '',
    secondaryPhone: '',
    preferredContactMethod: 'whatsapp' as PreferredContactMethod,
    city: '',
    commune: '',
    address: ''
  };

  protected profileSaved = false;
  protected profileError = '';
  protected quotationNotice = '';
  protected subscriptionNotice = '';
  protected referralNotice = '';
  protected isRefreshingReferralCode = false;
  protected showReferralBenefits = false;
  protected readonly referralBenefits = [
    'Bonos por referidos que completen su registro.',
    'Beneficios exclusivos por compras o cotizaciones activadas.',
    'Prioridad en futuras promociones y campañas de fidelizacion.'
  ];
  protected readonly profileContactMethods: Array<{ id: PreferredContactMethod; label: string }> = [
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'llamada', label: 'Llamada telefonica' },
    { id: 'email', label: 'Correo electronico' }
  ];
  protected get requiredProfileFieldCount(): number {
    return this.profileDraft.rut.trim() ? 7 : 6;
  }
  protected readonly subscriptionPlans: SubscriptionPlanView[] = [
    {
      id: 'basico',
      title: 'Plan Basico',
      priceLabel: '$9.990 / mes',
      description: 'Incluye funciones esenciales y 1 cotizacion pendiente.',
      maxPendingLabel: '1 cotizacion pendiente',
      hasHistory: false
    },
    {
      id: 'pro',
      title: 'Plan Pro',
      priceLabel: '$19.990 / mes',
      description: 'Hasta 5 cotizaciones pendientes, historial y comparacion completa.',
      maxPendingLabel: 'Hasta 5 cotizaciones pendientes',
      hasHistory: true
    },
    {
      id: 'premium',
      title: 'Plan Premium',
      priceLabel: '$29.990 / mes',
      description: 'Cotizaciones pendientes ilimitadas y todas las funciones avanzadas.',
      maxPendingLabel: 'Cotizaciones pendientes ilimitadas',
      hasHistory: true
    }
  ];
  protected isInitialLoading = true;
  protected isSectionLoading = false;
  protected isMobileViewport = false;
  protected isMobileMenuVisible = false;
  private readonly loadedSections = new Set<MaestroSection>();

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: MockApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.syncViewportState();
    this.route.queryParamMap.subscribe((params) => {
      const rawSection = params.get('section');
      const section = (rawSection === 'proyectos' ? 'cotizaciones' : rawSection) as MaestroSection | null;
      if (this.isValidSection(section)) {
        this.currentSection = section;
      }
      this.projectTarget = params.get('projectTarget') || '';
      this.draftProjectName = params.get('draftName') || '';
      this.draftProjectAddress = params.get('draftAddress') || '';

      if (this.loadedSections.size > 0 || !this.isInitialLoading) {
        void this.ensureSectionData(this.currentSection);
      }
    });
    this.hydrateProfileDraft();
    void this.initializeDashboard();
  }

  protected get user(): SessionUser | null {
    return this.authService.currentUser();
  }

  protected get categoryOptions(): TaxonomyOption[] {
    return this.apiService.getCategoryOptions();
  }

  protected get subcategoryOptions(): TaxonomyOption[] {
    return this.selectedCategoryId
      ? this.apiService.getSubcategoryOptions(this.selectedCategoryId)
      : [];
  }

  protected get familyOptions(): TaxonomyOption[] {
    return this.selectedSubcategoryId
      ? this.apiService.getFamilyOptions(this.selectedSubcategoryId)
      : [];
  }

  protected get selectedCategoryName(): string {
    return this.categoryOptions.find((item) => item.id === this.selectedCategoryId)?.name || '';
  }

  protected get selectedSubcategoryName(): string {
    if (!this.selectedSubcategoryId) {
      return '';
    }
    return this.apiService.getSubcategoryOptions(this.selectedCategoryId || undefined)
      .find((item) => item.id === this.selectedSubcategoryId)?.name || '';
  }

  protected get selectedFamilyName(): string {
    if (!this.selectedFamilyId) {
      return '';
    }
    return this.apiService.getFamilyOptions(this.selectedSubcategoryId || undefined)
      .find((item) => item.id === this.selectedFamilyId)?.name || '';
  }

  protected get showProductFilterPanel(): boolean {
    return !!this.selectedFamilyId;
  }

  protected get showOpenedProductFilterPanel(): boolean {
    return this.showProductFilterPanel && this.productFiltersOpen;
  }

  protected get isPickingProductForProject(): boolean {
    return !!this.projectTarget;
  }

  protected get familyRowsForFilters(): FamilyProductRow[] {
    return this.familyRowsForFiltersData;
  }

  protected get tableBaseRows(): FamilyProductRow[] {
    return this.tableBaseRowsData;
  }

  protected get brandOptions(): OptionCount[] {
    return this.brandOptionsData;
  }

  protected get visibleBrandOptions(): OptionCount[] {
    return this.visibleBrandOptionsData;
  }

  protected get productTypeOptions(): OptionCount[] {
    return this.productTypeOptionsData;
  }

  protected get visibleProductTypeOptions(): OptionCount[] {
    return this.visibleProductTypeOptionsData;
  }

  protected get sellerOptions(): OptionCount[] {
    return this.sellerOptionsData;
  }

  protected get filteredFamilyProducts(): FamilyProductRow[] {
    return this.filteredFamilyProductsData;
  }

  protected get totalPages(): number {
    return this.totalPagesData;
  }

  protected get paginatedFamilyProducts(): FamilyProductRow[] {
    return this.paginatedFamilyProductsData;
  }

  protected get pageStart(): number {
    return this.pageStartData;
  }

  protected get pageEnd(): number {
    return this.pageEndData;
  }

  protected get productTableTitle(): string {
    return this.selectedFamilyId
      ? 'Productos de la familia seleccionada y sus filtros'
      : 'Productos mas comprados (precargados)';
  }

  protected get emptyProductTableMessage(): string {
    return this.selectedFamilyId
      ? 'No hay productos para esta familia con los filtros seleccionados.'
      : 'No hay productos precargados para la busqueda actual.';
  }

  protected get currentSectionLabel(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.label || '';
  }

  protected get currentSectionDescription(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.description || '';
  }

  protected get currentSubscriptionPlan(): SubscriptionPlan {
    return this.user?.subscriptionPlan || 'basico';
  }

  protected get currentPlanView(): SubscriptionPlanView {
    return this.subscriptionPlans.find((plan) => plan.id === this.currentSubscriptionPlan) || this.subscriptionPlans[0];
  }

  protected get pendingProjects(): ProjectSummary[] {
    return this.history.filter((project) => project.status === 'pendiente');
  }

  protected get completedProjects(): ProjectSummary[] {
    return this.history.filter((project) => project.status !== 'pendiente');
  }

  protected get canAccessHistory(): boolean {
    return this.apiService.getPlanCapabilities(this.currentSubscriptionPlan).hasHistory;
  }

  protected get pendingQuotaText(): string {
    const currentUser = this.user;
    if (!currentUser) {
      return '';
    }

    const availability = this.apiService.canCreatePendingProject(currentUser.id, this.currentSubscriptionPlan);
    if (availability.limit === null) {
      return `${availability.pendingCount} cotizaciones pendientes (sin limite).`;
    }

    return `${availability.pendingCount}/${availability.limit} pendientes.`;
  }

  protected projectStatusLabel(status: ProjectStatus): string {
    if (status === 'aceptada') {
      return 'Aceptada';
    }
    if (status === 'rechazada') {
      return 'Rechazada';
    }
    return 'Pendiente';
  }

  protected setSection(section: MaestroSection): void {
    this.currentSection = section;
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

  protected onCategoryInput(value: string): void {
    this.categorySearch = value;
    const match = this.findByName(this.categoryOptions, value);

    if (!match) {
      this.selectedCategoryId = '';
      this.selectedSubcategoryId = '';
      this.selectedFamilyId = '';
      this.subcategorySearch = '';
      this.familySearch = '';
      this.resetProductFilterState();
      this.refreshProductTableState();
      return;
    }

    if (match.id !== this.selectedCategoryId) {
      this.selectedCategoryId = match.id;
      this.selectedSubcategoryId = '';
      this.selectedFamilyId = '';
      this.subcategorySearch = '';
      this.familySearch = '';
      this.resetProductFilterState();
      this.refreshProductTableState();
    }
  }

  protected onSubcategoryInput(value: string): void {
    this.subcategorySearch = value;
    if (!this.selectedCategoryId) {
      this.selectedSubcategoryId = '';
      this.selectedFamilyId = '';
      this.familySearch = '';
      this.resetProductFilterState();
      this.refreshProductTableState();
      return;
    }

    const match = this.findByName(this.subcategoryOptions, value);
    if (!match) {
      this.selectedSubcategoryId = '';
      this.selectedFamilyId = '';
      this.familySearch = '';
      this.resetProductFilterState();
      this.refreshProductTableState();
      return;
    }

    if (match.id !== this.selectedSubcategoryId) {
      this.selectedSubcategoryId = match.id;
      this.selectedFamilyId = '';
      this.familySearch = '';
      this.resetProductFilterState();
      this.refreshProductTableState();
    }
  }

  protected onFamilyInput(value: string): void {
    this.familySearch = value;
    if (!this.selectedSubcategoryId) {
      this.selectedFamilyId = '';
      this.resetProductFilterState();
      this.refreshProductTableState();
      return;
    }

    const match = this.findByName(this.familyOptions, value);
    if (!match) {
      this.selectedFamilyId = '';
      this.resetProductFilterState();
      this.refreshProductTableState();
      return;
    }

    this.selectedFamilyId = match.id;
    this.resetProductFilterState();
    this.refreshProductTableState();
  }

  protected viewProductDetails(productName: string): void {
    this.router.navigate(['/dashboard/maestro/producto-detalle'], {
      queryParams: { product: productName }
    });
  }

  protected addProductToProject(productName: string): void {
    if (!this.projectTarget) {
      return;
    }

    const targetCommands = this.projectTarget === 'nuevo'
      ? ['/dashboard/maestro/cotizaciones/nuevo']
      : ['/dashboard/maestro/cotizaciones', this.projectTarget];

    this.router.navigate(targetCommands, {
      queryParams: {
        addProduct: productName,
        draftName: this.projectTarget === 'nuevo' ? this.draftProjectName : null,
        draftAddress: this.projectTarget === 'nuevo' ? this.draftProjectAddress : null
      }
    });
  }

  protected clearSearchFilters(): void {
    this.categorySearch = '';
    this.subcategorySearch = '';
    this.familySearch = '';
    this.selectedCategoryId = '';
    this.selectedSubcategoryId = '';
    this.selectedFamilyId = '';
    this.resetProductFilterState();
    this.pageSize = 5;
    this.refreshProductTableState();
  }

  protected onTableFilterChange(): void {
    this.currentPage = 1;
    this.refreshProductTableState();
  }

  protected onPageSizeChange(value: number | string): void {
    const parsed = Number(value);
    this.pageSize = this.pageSizeOptions.includes(parsed) ? parsed : this.pageSizeOptions[0];
    this.currentPage = 1;
    this.refreshProductTableState();
  }

  protected toggleFilterSection(section: FilterSectionKey): void {
    this.filterSectionOpen = {
      ...this.filterSectionOpen,
      [section]: !this.filterSectionOpen[section]
    };
  }

  protected toggleProductFilters(): void {
    if (!this.showProductFilterPanel) {
      return;
    }
    this.productFiltersOpen = !this.productFiltersOpen;
  }

  protected toggleBrand(value: string, enabled: boolean): void {
    this.selectedBrands = this.toggleValue(this.selectedBrands, value, enabled);
    this.currentPage = 1;
    this.refreshProductTableState();
  }

  protected toggleSeller(value: string, enabled: boolean): void {
    this.selectedSellers = this.toggleValue(this.selectedSellers, value, enabled);
    this.currentPage = 1;
    this.refreshProductTableState();
  }

  protected togglePriceRange(value: string, enabled: boolean): void {
    this.selectedPriceRanges = this.toggleValue(this.selectedPriceRanges, value, enabled);
    this.currentPage = 1;
    this.refreshProductTableState();
  }

  protected toggleProductType(value: string, enabled: boolean): void {
    this.selectedProductTypes = this.toggleValue(this.selectedProductTypes, value, enabled);
    this.currentPage = 1;
    this.refreshProductTableState();
  }

  protected clearProductFilters(): void {
    this.tableProductSearch = '';
    this.brandSearch = '';
    this.selectedBrands = [];
    this.selectedSellers = [];
    this.selectedPriceRanges = [];
    this.selectedProductTypes = [];
    this.showAllBrands = false;
    this.showAllTypes = false;
    this.currentPage = 1;
    this.refreshProductTableState();
  }

  protected setShowAllBrands(value: boolean): void {
    this.showAllBrands = value;
    this.refreshProductTableState();
  }

  protected setShowAllTypes(value: boolean): void {
    this.showAllTypes = value;
    this.refreshProductTableState();
  }

  protected previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
      this.refreshProductTableState();
    }
  }

  protected nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
      this.refreshProductTableState();
    }
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.refreshProductTableState();
  }

  protected get pageNumbers(): number[] {
    return this.pageNumbersData;
  }

  protected async deleteProject(projectId: string): Promise<void> {
    if (!this.user) {
      return;
    }

    await this.apiService.deleteProject(this.user.id, projectId);
    this.quotationNotice = '';
    this.invalidateProjectSectionCache();
    await this.ensureSectionData(this.currentSection, true);
  }

  protected goToNewProject(): void {
    const currentUser = this.user;
    if (!currentUser) {
      return;
    }

    const availability = this.apiService.canCreatePendingProject(currentUser.id, this.currentSubscriptionPlan);
    if (!availability.allowed) {
      this.quotationNotice = `${availability.message} Actualiza a Plan Pro o Premium.`;
      this.currentSection = 'suscripcion';
      return;
    }

    this.quotationNotice = '';
    this.router.navigate(['/dashboard/maestro/cotizaciones/nuevo']);
  }

  protected goToProjectDetail(projectId: string): void {
    const project = this.history.find((item) => item.id === projectId);
    const section = project?.status === 'pendiente' ? 'cotizaciones' : 'historial';
    this.router.navigate(['/dashboard/maestro/cotizaciones', projectId], { queryParams: { section } });
  }

  protected async saveProfile(): Promise<void> {
    this.profileSaved = false;
    this.profileError = '';

    const validationError = this.validateProfileDraft(this.profileDraft);
    if (validationError) {
      this.profileError = validationError;
      return;
    }

    try {
      await this.authService.updateProfile({
        displayName: this.profileDraft.displayName.trim(),
        specialty: this.profileDraft.specialty.trim(),
        phone: this.profileDraft.phone.trim(),
        secondaryPhone: this.profileDraft.secondaryPhone.trim(),
        preferredContactMethod: this.profileDraft.preferredContactMethod,
        city: this.profileDraft.city.trim(),
        commune: this.profileDraft.commune.trim(),
        address: this.profileDraft.address.trim()
      });

      this.profileSaved = true;
      setTimeout(() => {
        this.profileSaved = false;
      }, 1800);
    } catch (error) {
      this.profileError = error instanceof Error ? error.message : 'No fue posible guardar tu perfil.';
    }
  }

  protected resetProfileDraft(): void {
    this.profileSaved = false;
    this.profileError = '';
    this.hydrateProfileDraft();
  }

  protected toggleReferralBenefits(): void {
    this.showReferralBenefits = !this.showReferralBenefits;
  }

  protected async copyReferralCode(): Promise<void> {
    let code = this.user?.referralCode?.trim();
    if (!code) {
      await this.refreshReferralCode();
      code = this.user?.referralCode?.trim();
    }
    if (!code) {
      return;
    }

    await this.copyText(code);
    this.referralNotice = 'Codigo copiado.';
    this.clearReferralNoticeLater();
  }

  protected shareReferralCodeViaWhatsApp(): void {
    const code = this.user?.referralCode?.trim();
    if (!code || typeof window === 'undefined') {
      return;
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(this.buildReferralShareMessage(code))}`;
    window.open(whatsappUrl, '_blank', 'noopener');
  }

  protected async refreshReferralCode(): Promise<void> {
    this.isRefreshingReferralCode = true;
    this.referralNotice = '';
    try {
      const user = await this.authService.refreshCurrentUser();
      this.hydrateProfileDraft();
      this.referralNotice = user.referralCode
        ? 'Codigo actualizado.'
        : 'Aun no fue posible obtener tu codigo. Recarga la pagina o revisa el backend.';
      this.clearReferralNoticeLater();
    } catch (error) {
      this.referralNotice = error instanceof Error ? error.message : 'No fue posible cargar tu codigo.';
      this.clearReferralNoticeLater();
    } finally {
      this.isRefreshingReferralCode = false;
    }
  }

  protected async changeSubscriptionPlan(plan: SubscriptionPlan): Promise<void> {
    if (!this.user || this.currentSubscriptionPlan === plan) {
      return;
    }

    try {
      await this.authService.updateProfile({ subscriptionPlan: plan });
      this.subscriptionNotice = `Plan actualizado a ${this.apiService.getPlanCapabilities(plan).label}.`;
      this.invalidateProjectSectionCache();
      await this.ensureSectionData(this.currentSection, true);
    } catch (error) {
      this.subscriptionNotice = error instanceof Error ? error.message : 'No fue posible actualizar el plan.';
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

  protected get completedProfileRequiredFields(): number {
    const requiredValues = [
      this.profileDraft.displayName,
      this.profileDraft.phone,
      this.profileDraft.city,
      this.profileDraft.commune,
      this.profileDraft.address,
      this.profileDraft.preferredContactMethod
    ];

    if (this.profileDraft.rut.trim()) {
      requiredValues.push(this.profileDraft.rut);
    }

    return requiredValues.filter((value) => value.toString().trim().length > 0).length;
  }

  private get normalizedPageSize(): number {
    const parsed = Number(this.pageSize);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 5;
    }
    return Math.floor(parsed);
  }

  private groupOptions(values: string[]): OptionCount[] {
    const counter = new Map<string, number>();
    values.forEach((value) => {
      counter.set(value, (counter.get(value) || 0) + 1);
    });

    return Array.from(counter.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
  }

  private inPriceRange(price: number, rangeId: string): boolean {
    const range = this.priceRanges.find((item) => item.id === rangeId);
    if (!range) {
      return false;
    }

    if (range.max === null) {
      return price >= range.min;
    }

    return price >= range.min && price < range.max;
  }

  private toggleValue(items: string[], value: string, enabled: boolean): string[] {
    if (enabled) {
      return items.includes(value) ? items : [...items, value];
    }
    return items.filter((item) => item !== value);
  }

  private resetProductFilterState(): void {
    this.tableProductSearch = '';
    this.brandSearch = '';
    this.selectedBrands = [];
    this.selectedSellers = [];
    this.selectedPriceRanges = [];
    this.selectedProductTypes = [];
    this.showAllBrands = false;
    this.showAllTypes = false;
    this.productFiltersOpen = false;
    this.currentPage = 1;
    this.filterSectionOpen = {
      brand: true,
      seller: true,
      price: true,
      type: true
    };
  }

  private refreshProductTableState(): void {
    try {
      const hasFamily = !!this.selectedFamilyId;
      this.familyRowsForFiltersData = hasFamily ? this.apiService.getFamilyProductRows(this.selectedFamilyId) : [];
      this.tableBaseRowsData = hasFamily
        ? this.familyRowsForFiltersData
        : this.apiService.getPopularProductRows('', 12);

      const brandGrouped = this.groupOptions(this.familyRowsForFiltersData.map((row) => row.brand));
      const brandQuery = this.brandSearch.trim().toLowerCase();
      this.brandOptionsData = brandQuery
        ? brandGrouped.filter((option) => option.value.toLowerCase().includes(brandQuery))
        : brandGrouped;
      this.visibleBrandOptionsData = this.showAllBrands
        ? this.brandOptionsData
        : this.brandOptionsData.slice(0, 5);

      this.productTypeOptionsData = this.groupOptions(this.familyRowsForFiltersData.map((row) => row.productType));
      this.visibleProductTypeOptionsData = this.showAllTypes
        ? this.productTypeOptionsData
        : this.productTypeOptionsData.slice(0, 5);

      const sellerCounter = new Map<string, number>();
      this.familyRowsForFiltersData.forEach((row) => {
        row.sellers.forEach((seller) => {
          sellerCounter.set(seller, (sellerCounter.get(seller) || 0) + 1);
        });
      });
      this.sellerOptionsData = Array.from(sellerCounter.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));

      const query = this.tableProductSearch.trim().toLowerCase();
      this.filteredFamilyProductsData = this.tableBaseRowsData.filter((row) => {
        const productNameOk = query ? row.productName.toLowerCase().includes(query) : true;

        if (!hasFamily) {
          return productNameOk;
        }

        const brandOk = this.selectedBrands.length === 0 || this.selectedBrands.includes(row.brand);
        const sellerOk = this.selectedSellers.length === 0 || row.sellers.some((seller) => this.selectedSellers.includes(seller));
        const typeOk = this.selectedProductTypes.length === 0 || this.selectedProductTypes.includes(row.productType);
        const priceOk = this.selectedPriceRanges.length === 0 || this.selectedPriceRanges.some((priceId) => this.inPriceRange(row.minPrice, priceId));

        return productNameOk && brandOk && sellerOk && typeOk && priceOk;
      });

      const safePageSize = this.normalizedPageSize;
      this.totalPagesData = Math.max(1, Math.ceil(this.filteredFamilyProductsData.length / safePageSize));
      this.currentPage = Math.min(Math.max(1, this.currentPage), this.totalPagesData);

      const start = (this.currentPage - 1) * safePageSize;
      const end = start + safePageSize;
      this.paginatedFamilyProductsData = this.filteredFamilyProductsData.slice(start, end);

      if (this.filteredFamilyProductsData.length === 0) {
        this.pageStartData = 0;
        this.pageEndData = 0;
      } else {
        this.pageStartData = start + 1;
        this.pageEndData = Math.min(end, this.filteredFamilyProductsData.length);
      }

      const windowSize = 7;
      const half = Math.floor(windowSize / 2);
      const from = Math.max(1, this.currentPage - half);
      const to = Math.min(this.totalPagesData, from + windowSize - 1);
      const normalizedFrom = Math.max(1, to - windowSize + 1);
      this.pageNumbersData = Array.from({ length: to - normalizedFrom + 1 }, (_, index) => normalizedFrom + index);
    } catch {
      this.familyRowsForFiltersData = [];
      this.tableBaseRowsData = [];
      this.brandOptionsData = [];
      this.visibleBrandOptionsData = [];
      this.productTypeOptionsData = [];
      this.visibleProductTypeOptionsData = [];
      this.sellerOptionsData = [];
      this.filteredFamilyProductsData = [];
      this.paginatedFamilyProductsData = [];
      this.totalPagesData = 1;
      this.pageStartData = 0;
      this.pageEndData = 0;
      this.pageNumbersData = [1];
    }
  }

  private findByName(options: TaxonomyOption[], name: string): TaxonomyOption | null {
    const normalized = name.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return options.find((option) => option.name.toLowerCase() === normalized) || null;
  }

  private isValidSection(value: MaestroSection | string | null): value is MaestroSection {
    return value === 'inicio'
      || value === 'buscar'
      || value === 'cotizaciones'
      || value === 'historial'
      || value === 'perfil'
      || value === 'suscripcion';
  }

  private async initializeDashboard(): Promise<void> {
    try {
      await this.ensureSectionData(this.currentSection, true);
    } finally {
      this.isInitialLoading = false;
    }
  }

  private async ensureSectionData(section: MaestroSection, force = false): Promise<void> {
    try {
      const currentUser = this.user;
      if (!currentUser) {
        return;
      }

      if (!force && this.loadedSections.has(section)) {
        return;
      }

      this.isSectionLoading = true;

      if (section === 'inicio') {
        await this.apiService.refreshMaestroOverview(currentUser.id, force);
        this.syncOverviewState(currentUser.id);
      }

      if (section === 'buscar') {
        await this.apiService.refreshMaestroSearchSection(force);
        this.refreshProductTableState();
      }

      if (section === 'cotizaciones' || section === 'historial') {
        await this.apiService.refreshMaestroProjectsSection(currentUser.id, force);
        this.history = this.apiService.getProjects(currentUser.id);
      }

      if (section === 'perfil') {
        if (force || !this.user?.referralCode?.trim()) {
          try {
            await this.authService.refreshCurrentUser();
          } catch {
            // El perfil puede seguir cargando con la sesion local aunque falle el refresh.
          }
        }
        this.hydrateProfileDraft();
      }

      if (section === 'suscripcion') {
        await this.apiService.refreshMaestroSubscriptionSection(currentUser.id, force);
        this.history = this.apiService.getProjects(currentUser.id);
      }

      this.loadedSections.add(section);
    } catch {
      if (section === 'inicio') {
        this.history = [];
        this.activeProjects = 0;
        this.estimatedSaving = 0;
        this.topSearches = [];
      }
      if (section === 'cotizaciones' || section === 'historial' || section === 'suscripcion') {
        this.history = [];
      }
      if (section === 'buscar') {
        this.refreshProductTableState();
      }
    } finally {
      this.isSectionLoading = false;
    }
  }

  private syncOverviewState(ownerId: string): void {
    this.history = this.apiService.getProjects(ownerId);
    const summary = this.apiService.getMaestroSummary(ownerId);
    this.activeProjects = summary.activeProjects;
    this.estimatedSaving = summary.estimatedSaving;
    this.topSearches = summary.topSearches;
  }

  private invalidateProjectSectionCache(): void {
    this.loadedSections.delete('inicio');
    this.loadedSections.delete('cotizaciones');
    this.loadedSections.delete('historial');
    this.loadedSections.delete('suscripcion');
  }

  private hydrateProfileDraft(): void {
    const currentUser = this.user;
    if (!currentUser) {
      return;
    }

    this.profileDraft = {
      displayName: currentUser.displayName,
      rut: currentUser.rut || '',
      specialty: currentUser.specialty || '',
      phone: currentUser.phone || '',
      secondaryPhone: currentUser.secondaryPhone || '',
      preferredContactMethod: currentUser.preferredContactMethod || 'whatsapp',
      city: currentUser.city || '',
      commune: currentUser.commune || '',
      address: currentUser.address || ''
    };
  }

  private validateProfileDraft(draft: MaestroProfileDraft): string {
    const displayName = draft.displayName.trim();
    const rut = this.normalizeRut(draft.rut);
    const currentRut = this.normalizeRut(this.user?.rut || '');
    const phone = draft.phone.trim();
    const secondaryPhone = draft.secondaryPhone.trim();
    const city = draft.city.trim();
    const commune = draft.commune.trim();
    const address = draft.address.trim();

    if (displayName.length < 3) {
      return 'El nombre debe tener al menos 3 caracteres.';
    }

    if (currentRut && rut !== currentRut) {
      return 'El RUT no se puede modificar.';
    }

    if (rut && !this.isValidRut(rut)) {
      return 'El RUT debe tener formato 12345678-9 o 12345678-K.';
    }

    if (!this.isValidPhone(phone)) {
      return 'El telefono principal debe tener al menos 8 digitos.';
    }

    if (secondaryPhone && !this.isValidPhone(secondaryPhone)) {
      return 'El telefono secundario no tiene un formato valido.';
    }

    if (!city) {
      return 'La ciudad es obligatoria para contacto.';
    }

    if (!commune) {
      return 'La comuna es obligatoria para contacto.';
    }

    if (!address) {
      return 'La direccion base es obligatoria para validacion interna.';
    }

    return '';
  }

  private normalizeRut(value: string): string {
    return value
      .trim()
      .replace(/\./g, '')
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  private isValidRut(value: string): boolean {
    return /^[0-9]{7,8}-[0-9K]$/.test(value);
  }

  private isValidPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
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

  private buildReferralShareMessage(code: string): string {
    const baseUrl = typeof window === 'undefined' ? 'https://appconstruct.cl' : `${window.location.origin}/registro`;
    return `Hola! Te invito a unirte a ConstruComparador. Usa mi codigo de referido ${code} al registrarte. Descarga o entra aqui: ${baseUrl}`;
  }

  private async copyText(value: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    if (typeof document === 'undefined') {
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  private clearReferralNoticeLater(): void {
    setTimeout(() => {
      this.referralNotice = '';
    }, 1800);
  }
}
