import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faChevronRight,
  faFolderTree,
  faSitemap,
  faPenToSquare,
  faShapes,
  faSliders,
  faTrashCan
} from '@fortawesome/free-solid-svg-icons';
import {
  AccountStatus,
  AdminMockMetrics,
  CatalogProduct,
  CatalogImportReport,
  CatalogImportRowResult,
  CatalogValidationRequest,
  CatalogValidationStatus,
  CatalogValidationType,
  SessionUser,
  SubscriptionPlan,
  TaxonomyOption,
  UserRole
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService, TaxonomyDefinitionApi } from '../../core/services/mock-api.service';
import { DashboardMenuComponent } from '../../shared/components/dashboard-menu/dashboard-menu.component';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';

type AdminSection = 'resumen' | 'metricas' | 'taxonomia' | 'productos' | 'solicitudes' | 'lotes' | 'usuarios' | 'operacion';

interface AdminMvpMetricCard {
  label: string;
  value: number;
}

interface StoreOpsRow {
  ownerId: string;
  ownerLabel: string;
  totalProducts: number;
  publishedProducts: number;
  lowStockProducts: number;
  inventoryValue: number;
}

interface MaestroOpsRow {
  ownerId: string;
  ownerLabel: string;
  pendingProjects: number;
  acceptedProjects: number;
  rejectedProjects: number;
}

interface AdminSnapshot {
  usersTotal: number;
  usersByRole: Record<UserRole, number>;
  activeUsers: number;
  blockedUsers: number;
  pendingUserValidation: number;
  validationPending: number;
  validationApproved: number;
  validationRejected: number;
  importBatches: number;
  importedRows: number;
  failedRows: number;
  pendingNewRows: number;
  possibleMatchRows: number;
  totalCatalogProducts: number;
  publishedCatalogProducts: number;
  lowStockProducts: number;
  totalInventoryValue: number;
  pendingProjects: number;
  acceptedProjects: number;
  rejectedProjects: number;
  stores: StoreOpsRow[];
  maestros: MaestroOpsRow[];
}

interface AdminUserKpiSummary {
  totalUsers: number;
  newUsers30d: number;
  payingUsers: number;
  payingRate: number;
  activeUsers: number;
  activeRate: number;
  blockedUsers: number;
  pendingUsers: number;
}

interface AdminUserTrendPoint {
  label: string;
  totalUsers: number;
  payingUsers: number;
  newUsers: number;
}

interface AdminPlanDistributionRow {
  plan: SubscriptionPlan;
  label: string;
  count: number;
  color: string;
}

interface MasterProductDraft {
  masterProductId: string;
  name: string;
  barcode: string;
  brand: string;
  productType: string;
  categoryId: string;
  subcategoryId: string;
  familyId: string;
  unitLabel: string;
  packagingLabel: string;
  shortDescription: string;
  descriptionText: string;
  imageUrl: string;
  galleryText: string;
  featureBulletsText: string;
  logisticsWeightKg: number | null;
  logisticsVolumeM3: number | null;
  logisticsPalletUnits: number | null;
}

interface AdminUserModalDraft {
  id: string;
  isNew: boolean;
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  subscriptionPlan: SubscriptionPlan;
  accountStatus: AccountStatus;
  phone: string;
  city: string;
  commune: string;
  address: string;
  businessName: string;
  rut: string;
}

interface AdminDefinitionDraft {
  id: string | null;
  codigo: string;
  etiqueta: string;
  tipoDato: 'texto' | 'numero' | 'seleccion' | 'booleano';
  esFiltrable: boolean;
  esObligatorio: boolean;
  opcionesTexto: string;
  orden: number;
}

interface MasterAttributeDraft {
  definitionId: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  required: boolean;
  options: string[];
  valueText: string;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueOption: string;
}

interface AdminSectionMeta {
  id: AdminSection;
  label: string;
  description: string;
}

@Component({
  selector: 'app-dashboard-admin-validaciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DashboardMenuComponent,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FontAwesomeModule,
    UiLoaderComponent
  ],
  templateUrl: './dashboard-admin-validaciones.component.html',
  styleUrl: './dashboard-admin-validaciones.component.scss'
})
export class DashboardAdminValidacionesComponent implements OnInit {
  protected readonly faTaxonomy = faSitemap;
  protected readonly faSitemap = faSitemap;
  protected readonly faCategory = faFolderTree;
  protected readonly faFamily = faShapes;
  protected readonly faAttribute = faSliders;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faEdit = faPenToSquare;
  protected readonly faDelete = faTrashCan;

  protected readonly sections: AdminSectionMeta[] = [
    {
      id: 'resumen',
      label: 'Resumen',
      description: 'Visualiza el estado general del marketplace, usuarios, validaciones pendientes y catalogo maestro.'
    },
    {
      id: 'metricas',
      label: 'Metricas',
      description: 'Consulta indicadores operativos, adopcion, cotizaciones y crecimiento para tomar decisiones de plataforma.'
    },
    {
      id: 'taxonomia',
      label: 'Taxonomia',
      description: 'Crea y organiza categorias, subcategorias, familias y atributos base para estructurar el catalogo.'
    },
    {
      id: 'productos',
      label: 'Mantenedor productos',
      description: 'Administra productos maestros, contenido comun, imagenes y atributos tecnicos visibles en el ecosistema.'
    },
    {
      id: 'solicitudes',
      label: 'Solicitudes',
      description: 'Revisa solicitudes de creacion o correccion de productos antes de publicarlas en el catalogo maestro.'
    },
    {
      id: 'lotes',
      label: 'Lotes CSV',
      description: 'Supervisa cargas masivas, errores por fila, coincidencias sugeridas y trazabilidad de importaciones.'
    },
    {
      id: 'usuarios',
      label: 'Usuarios',
      description: 'Gestiona cuentas, roles, estados de acceso y datos base de administradores, maestros y ferreterias.'
    },
    {
      id: 'operacion',
      label: 'Operacion',
      description: 'Monitorea la salud comercial y operativa del sistema con foco en usuarios, catalogo y cotizaciones.'
    }
  ];

  protected currentSection: AdminSection = 'resumen';
  protected users: SessionUser[] = [];
  protected importReports: CatalogImportReport[] = [];
  protected validationRequests: CatalogValidationRequest[] = [];
  protected snapshot: AdminSnapshot = this.createEmptySnapshot();
  protected adminMetrics: AdminMockMetrics = this.createEmptyAdminMetrics();
  protected userKpis: AdminUserKpiSummary = this.createEmptyUserKpis();
  protected userTrendSeries: AdminUserTrendPoint[] = [];
  protected planDistribution: AdminPlanDistributionRow[] = [];

  protected validationStatusFilter: CatalogValidationStatus | 'all' = 'pendiente';
  protected validationTypeFilter: CatalogValidationType | 'all' = 'all';
  protected validationSearch = '';

  protected masterCatalog: CatalogProduct[] = [];
  protected masterSearch = '';
  protected masterCategoryFilter = '';
  protected masterSubcategoryFilter = '';
  protected masterFamilyFilter = '';
  protected selectedMasterProduct: CatalogProduct | null = null;
  protected masterDetailDraft: MasterProductDraft = this.createEmptyMasterProductDraft();
  protected masterAttributeDrafts: MasterAttributeDraft[] = [];
  protected masterDetailModalOpen = false;
  protected masterDetailReadonly = true;
  protected selectedRequestForCreation: CatalogValidationRequest | null = null;

  protected selectedTaxCategoryId = '';
  protected selectedTaxSubcategoryId = '';
  protected selectedTaxFamilyId = '';
  protected categoryDraftName = '';
  protected categoryEditingId: string | null = null;
  protected subcategoryDraftName = '';
  protected subcategoryEditingId: string | null = null;
  protected familyDraftName = '';
  protected familyEditingId: string | null = null;
  protected definitionDraft: AdminDefinitionDraft = this.createEmptyDefinitionDraft();

  protected reportOwnerFilter = 'all';
  protected reportSearch = '';

  protected userRoleFilter: UserRole | 'all' = 'all';
  protected userStatusFilter: AccountStatus | 'all' = 'all';
  protected userSearch = '';

  protected selectedReport: CatalogImportReport | null = null;
  protected reportModalOpen = false;
  protected requestCreationModalOpen = false;

  protected notesByRequest: Record<string, string> = {};
  protected selectedSuggestionByRequest: Record<string, string> = {};
  protected userModalOpen = false;
  protected userModalReadonly = true;
  protected userModalDraft: AdminUserModalDraft = this.createEmptyUserModalDraft();

  protected notice = '';
  protected error = '';

  protected isInitialLoading = true;
  protected isSectionLoading = false;
  protected isMobileViewport = false;
  protected isMobileMenuVisible = false;
  private usersLoaded = false;
  private snapshotDataLoaded = false;
  private readonly loadedSections = new Set<AdminSection>();

  constructor(
    private readonly apiService: MockApiService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.syncViewportState();
    void this.initializeDashboard();
  }

  protected get currentUser(): SessionUser | null {
    return this.authService.currentUser();
  }

  protected get currentSectionLabel(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.label || '';
  }

  protected get currentSectionDescription(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.description || '';
  }

  protected get validationRows(): CatalogValidationRequest[] {
    const query = this.validationSearch.trim().toLowerCase();

    return this.validationRequests
      .filter((item) => this.validationStatusFilter === 'all' || item.status === this.validationStatusFilter)
      .filter((item) => this.validationTypeFilter === 'all' || item.type === this.validationTypeFilter)
      .filter((item) => {
        if (!query) {
          return true;
        }
        return item.row.name.toLowerCase().includes(query)
          || item.ownerLabel.toLowerCase().includes(query)
          || item.row.sku.toLowerCase().includes(query)
          || (item.row.barcode || '').toLowerCase().includes(query);
      });
  }

  protected get reportRows(): CatalogImportReport[] {
    const query = this.reportSearch.trim().toLowerCase();

    return this.importReports
      .filter((item) => this.reportOwnerFilter === 'all' || item.ownerId === this.reportOwnerFilter)
      .filter((item) => {
        if (!query) {
          return true;
        }
        return item.ownerLabel.toLowerCase().includes(query)
          || item.batchId.toLowerCase().includes(query);
      });
  }

  protected get categoryOptions(): TaxonomyOption[] {
    return this.apiService.getCategoryOptions();
  }

  protected get subcategoryOptions(): TaxonomyOption[] {
    if (!this.masterCategoryFilter) {
      return this.apiService.getSubcategoryOptions();
    }
    return this.apiService.getSubcategoryOptions(this.masterCategoryFilter);
  }

  protected get familyOptions(): TaxonomyOption[] {
    if (!this.masterSubcategoryFilter) {
      return this.apiService.getFamilyOptions();
    }
    return this.apiService.getFamilyOptions(this.masterSubcategoryFilter);
  }

  protected get selectedTaxSubcategories(): TaxonomyOption[] {
    return this.selectedTaxCategoryId
      ? this.apiService.getSubcategoryOptions(this.selectedTaxCategoryId)
      : [];
  }

  protected get selectedTaxFamilies(): TaxonomyOption[] {
    return this.selectedTaxSubcategoryId
      ? this.apiService.getFamilyOptions(this.selectedTaxSubcategoryId)
      : [];
  }

  protected get selectedTaxDefinitions(): TaxonomyDefinitionApi[] {
    return this.selectedTaxFamilyId
      ? this.apiService.getFamilyDefinitionRows(this.selectedTaxFamilyId)
      : [];
  }

  protected get hasSelectedTaxFamily(): boolean {
    return Boolean(this.selectedTaxFamilyId);
  }

  protected get draftSubcategoryOptions(): TaxonomyOption[] {
    return this.masterDetailDraft.categoryId
      ? this.apiService.getSubcategoryOptions(this.masterDetailDraft.categoryId)
      : this.apiService.getSubcategoryOptions();
  }

  protected get draftFamilyOptions(): TaxonomyOption[] {
    return this.masterDetailDraft.subcategoryId
      ? this.apiService.getFamilyOptions(this.masterDetailDraft.subcategoryId)
      : this.apiService.getFamilyOptions();
  }

  protected get filteredMasterCatalog(): CatalogProduct[] {
    const query = this.masterSearch.trim().toLowerCase();
    const normalizedBarcode = this.masterSearch.replace(/\D/g, '');

    return this.masterCatalog
      .filter((product) => !this.masterCategoryFilter || product.categoryId === this.masterCategoryFilter)
      .filter((product) => !this.masterSubcategoryFilter || product.subcategoryId === this.masterSubcategoryFilter)
      .filter((product) => !this.masterFamilyFilter || product.familyId === this.masterFamilyFilter)
      .filter((product) => {
        if (!query && !normalizedBarcode) {
          return true;
        }
        const matchesText = query
          ? product.name.toLowerCase().includes(query)
            || product.brand.toLowerCase().includes(query)
            || product.sku.toLowerCase().includes(query)
          : false;
        const matchesBarcode = normalizedBarcode
          ? (product.barcode || '').replace(/\D/g, '').includes(normalizedBarcode)
          : false;
        return matchesText || matchesBarcode;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  protected get pendingProductRequestsCount(): number {
    return this.validationRequests.filter((request) => request.status === 'pendiente').length;
  }

  protected get adminMvpMetricCards(): AdminMvpMetricCard[] {
    return [
      { label: 'Total usuarios', value: this.userKpis.totalUsers },
      { label: 'Nuevos usuarios', value: this.userKpis.newUsers30d },
      { label: 'Usuarios pago', value: this.userKpis.payingUsers },
      { label: 'Usuarios activos', value: this.userKpis.activeUsers },
      { label: 'Maestros', value: this.snapshot.usersByRole.maestro },
      { label: 'Ferreterias', value: this.snapshot.usersByRole.ferreteria },
      { label: 'Cotizaciones', value: this.snapshot.pendingProjects + this.snapshot.acceptedProjects + this.snapshot.rejectedProjects },
      { label: 'Cotizaciones aceptadas', value: this.snapshot.acceptedProjects },
      { label: 'Cotizaciones rechazadas', value: this.snapshot.rejectedProjects },
      { label: 'Productos maestros', value: this.masterCatalog.length }
    ];
  }

  protected get reportOwnerOptions(): Array<{ id: string; label: string }> {
    const map = new Map<string, string>();
    this.importReports.forEach((report) => {
      map.set(report.ownerId, report.ownerLabel);
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  protected get userRows(): SessionUser[] {
    const query = this.userSearch.trim().toLowerCase();

    return this.users
      .filter((user) => this.userRoleFilter === 'all' || user.role === this.userRoleFilter)
      .filter((user) => this.userStatusFilter === 'all' || this.userStatus(user) === this.userStatusFilter)
      .filter((user) => {
        if (!query) {
          return true;
        }
        return user.displayName.toLowerCase().includes(query)
          || user.email.toLowerCase().includes(query)
          || (user.businessName || '').toLowerCase().includes(query);
      });
  }

  protected get pendingRequestsCount(): number {
    return this.validationRequests.filter((item) => item.status === 'pendiente').length;
  }

  protected get resolvedRequestsCount(): number {
    return this.validationRequests.filter((item) => item.status !== 'pendiente').length;
  }

  protected setSection(section: AdminSection): void {
    this.currentSection = section;
    if (this.isMobileViewport) {
      this.closeMobileMenu();
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    void this.ensureSectionData(section);
  }

  protected onMasterCategoryFilterChange(): void {
    if (this.masterCategoryFilter && !this.subcategoryOptions.some((option) => option.id === this.masterSubcategoryFilter)) {
      this.masterSubcategoryFilter = '';
      this.masterFamilyFilter = '';
    }
  }

  protected onMasterSubcategoryFilterChange(): void {
    if (this.masterSubcategoryFilter && !this.familyOptions.some((option) => option.id === this.masterFamilyFilter)) {
      this.masterFamilyFilter = '';
    }
  }

  protected clearMasterFilters(): void {
    this.masterSearch = '';
    this.masterCategoryFilter = '';
    this.masterSubcategoryFilter = '';
    this.masterFamilyFilter = '';
  }

  protected selectTaxCategory(categoryId: string): void {
    this.selectedTaxCategoryId = categoryId;
    if (!this.selectedTaxSubcategories.some((item) => item.id === this.selectedTaxSubcategoryId)) {
      this.selectedTaxSubcategoryId = this.selectedTaxSubcategories[0]?.id || '';
    }
    this.selectTaxSubcategory(this.selectedTaxSubcategoryId);
  }

  protected selectTaxSubcategory(subcategoryId: string): void {
    this.selectedTaxSubcategoryId = subcategoryId;
    if (!this.selectedTaxFamilies.some((item) => item.id === this.selectedTaxFamilyId)) {
      this.selectedTaxFamilyId = this.selectedTaxFamilies[0]?.id || '';
    }
    if (this.definitionDraft.id && !this.selectedTaxDefinitions.some((item) => item.id === this.definitionDraft.id)) {
      this.resetDefinitionDraft();
    }
  }

  protected selectTaxFamily(familyId: string): void {
    this.selectedTaxFamilyId = familyId;
    if (this.definitionDraft.id && !this.selectedTaxDefinitions.some((item) => item.id === this.definitionDraft.id)) {
      this.resetDefinitionDraft();
    }
  }

  protected editCategory(category: TaxonomyOption): void {
    this.categoryEditingId = category.id;
    this.categoryDraftName = category.name;
  }

  protected editSubcategory(subcategory: TaxonomyOption): void {
    this.subcategoryEditingId = subcategory.id;
    this.subcategoryDraftName = subcategory.name;
    this.selectedTaxCategoryId = subcategory.parentId || this.selectedTaxCategoryId;
    this.selectTaxCategory(this.selectedTaxCategoryId);
  }

  protected editFamily(family: TaxonomyOption): void {
    this.familyEditingId = family.id;
    this.familyDraftName = family.name;
    this.selectedTaxSubcategoryId = family.parentId || this.selectedTaxSubcategoryId;
    this.selectTaxSubcategory(this.selectedTaxSubcategoryId);
    this.selectTaxFamily(family.id);
  }

  protected editDefinition(definition: TaxonomyDefinitionApi): void {
    this.definitionDraft = {
      id: definition.id,
      codigo: definition.codigo,
      etiqueta: definition.etiqueta,
      tipoDato: definition.tipoDato,
      esFiltrable: Boolean(definition.esFiltrable),
      esObligatorio: Boolean(definition.esObligatorio),
      opcionesTexto: (definition.opcionesJson || []).join('\n'),
      orden: definition.orden || 0
    };
  }

  protected resetDefinitionDraft(): void {
    this.definitionDraft = this.createEmptyDefinitionDraft();
  }

  protected resetTaxonomyDrafts(): void {
    this.categoryEditingId = null;
    this.categoryDraftName = '';
    this.subcategoryEditingId = null;
    this.subcategoryDraftName = '';
    this.familyEditingId = null;
    this.familyDraftName = '';
    this.resetDefinitionDraft();
  }

  protected async saveCategory(): Promise<void> {
    if (!this.categoryDraftName.trim()) {
      this.error = 'Ingresa un nombre de categoria.';
      return;
    }

    try {
      const category = this.categoryEditingId
        ? await this.apiService.updateCategory(this.categoryEditingId, this.categoryDraftName)
        : await this.apiService.createCategory(this.categoryDraftName);
      this.selectedTaxCategoryId = category.id;
      this.notice = this.categoryEditingId ? 'Categoria actualizada.' : 'Categoria creada.';
      this.categoryDraftName = '';
      this.categoryEditingId = null;
      this.selectTaxCategory(this.selectedTaxCategoryId);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible guardar la categoria.';
    }
  }

  protected async saveSubcategory(): Promise<void> {
    if (!this.selectedTaxCategoryId || !this.subcategoryDraftName.trim()) {
      this.error = 'Selecciona una categoria e ingresa un nombre para la subcategoria.';
      return;
    }

    try {
      const subcategory = this.subcategoryEditingId
        ? await this.apiService.updateSubcategory(this.subcategoryEditingId, this.selectedTaxCategoryId, this.subcategoryDraftName)
        : await this.apiService.createSubcategory(this.selectedTaxCategoryId, this.subcategoryDraftName);
      this.selectedTaxSubcategoryId = subcategory.id;
      this.notice = this.subcategoryEditingId ? 'Subcategoria actualizada.' : 'Subcategoria creada.';
      this.subcategoryDraftName = '';
      this.subcategoryEditingId = null;
      this.selectTaxSubcategory(this.selectedTaxSubcategoryId);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible guardar la subcategoria.';
    }
  }

  protected async saveFamily(): Promise<void> {
    if (!this.selectedTaxSubcategoryId || !this.familyDraftName.trim()) {
      this.error = 'Selecciona una subcategoria e ingresa un nombre para la familia.';
      return;
    }

    try {
      const family = this.familyEditingId
        ? await this.apiService.updateFamily(this.familyEditingId, this.selectedTaxSubcategoryId, this.familyDraftName)
        : await this.apiService.createFamily(this.selectedTaxSubcategoryId, this.familyDraftName);
      this.selectedTaxFamilyId = family.id;
      this.notice = this.familyEditingId ? 'Familia actualizada.' : 'Familia creada.';
      this.familyDraftName = '';
      this.familyEditingId = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible guardar la familia.';
    }
  }

  protected async saveDefinition(): Promise<void> {
    if (!this.selectedTaxFamilyId) {
      this.error = 'Selecciona una familia para administrar atributos.';
      return;
    }
    if (!this.definitionDraft.codigo.trim() || !this.definitionDraft.etiqueta.trim()) {
      this.error = 'Codigo y etiqueta son obligatorios.';
      return;
    }

    const payload = {
      codigo: this.definitionDraft.codigo.trim(),
      etiqueta: this.definitionDraft.etiqueta.trim(),
      tipoDato: this.definitionDraft.tipoDato,
      esFiltrable: this.definitionDraft.esFiltrable,
      esObligatorio: this.definitionDraft.esObligatorio,
      opcionesJson: this.parseMultiline(this.definitionDraft.opcionesTexto),
      orden: this.definitionDraft.orden
    };

    try {
      if (this.definitionDraft.id) {
        await this.apiService.updateFamilyDefinition(this.selectedTaxFamilyId, this.definitionDraft.id, payload);
        this.notice = 'Definicion actualizada.';
      } else {
        await this.apiService.createFamilyDefinition(this.selectedTaxFamilyId, payload);
        this.notice = 'Definicion creada.';
      }
      this.resetDefinitionDraft();
      this.syncMasterAttributeDrafts();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible guardar la definicion.';
    }
  }

  protected async deleteCategory(category: TaxonomyOption): Promise<void> {
    try {
      await this.apiService.deleteCategory(category.id);
      if (this.selectedTaxCategoryId === category.id) {
        this.selectedTaxCategoryId = '';
        this.selectedTaxSubcategoryId = '';
        this.selectedTaxFamilyId = '';
      }
      this.notice = 'Categoria eliminada.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible eliminar la categoria.';
    }
  }

  protected async deleteSubcategory(subcategory: TaxonomyOption): Promise<void> {
    try {
      await this.apiService.deleteSubcategory(subcategory.id);
      if (this.selectedTaxSubcategoryId === subcategory.id) {
        this.selectedTaxSubcategoryId = '';
        this.selectedTaxFamilyId = '';
      }
      this.notice = 'Subcategoria eliminada.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible eliminar la subcategoria.';
    }
  }

  protected async deleteFamily(family: TaxonomyOption): Promise<void> {
    try {
      await this.apiService.deleteFamily(family.id);
      if (this.selectedTaxFamilyId === family.id) {
        this.selectedTaxFamilyId = '';
      }
      this.notice = 'Familia eliminada.';
      this.syncMasterAttributeDrafts();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible eliminar la familia.';
    }
  }

  protected async deleteDefinition(definition: TaxonomyDefinitionApi): Promise<void> {
    if (!this.selectedTaxFamilyId) {
      return;
    }

    try {
      await this.apiService.deleteFamilyDefinition(this.selectedTaxFamilyId, definition.id);
      this.notice = 'Definicion eliminada.';
      this.syncMasterAttributeDrafts();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible eliminar la definicion.';
    }
  }

  protected async openMasterProductView(product: CatalogProduct): Promise<void> {
    this.selectedMasterProduct = product;
    this.masterDetailReadonly = true;
    this.masterDetailModalOpen = true;
    await this.loadMasterProductDetail(product);
  }

  protected async openMasterProductEdit(product: CatalogProduct): Promise<void> {
    this.selectedMasterProduct = product;
    this.masterDetailReadonly = false;
    this.masterDetailModalOpen = true;
    await this.loadMasterProductDetail(product);
  }

  protected openMasterProductCreate(): void {
    const firstCategoryId = this.masterCategoryFilter || this.selectedTaxCategoryId || this.categoryOptions[0]?.id || '';
    const subcategories = firstCategoryId ? this.apiService.getSubcategoryOptions(firstCategoryId) : this.apiService.getSubcategoryOptions();
    const firstSubcategoryId = this.masterSubcategoryFilter || this.selectedTaxSubcategoryId || subcategories[0]?.id || '';
    const families = firstSubcategoryId ? this.apiService.getFamilyOptions(firstSubcategoryId) : this.apiService.getFamilyOptions();
    const firstFamilyId = this.masterFamilyFilter || this.selectedTaxFamilyId || families[0]?.id || '';

    this.selectedMasterProduct = null;
    this.masterDetailReadonly = false;
    this.masterDetailDraft = {
      ...this.createEmptyMasterProductDraft(),
      categoryId: firstCategoryId,
      subcategoryId: firstSubcategoryId,
      familyId: firstFamilyId
    };
    this.masterAttributeDrafts = this.buildAttributeDrafts(firstFamilyId);
    this.masterDetailModalOpen = true;
  }

  protected closeMasterProductModal(): void {
    this.masterDetailModalOpen = false;
    this.masterDetailReadonly = true;
    this.selectedMasterProduct = null;
    this.masterDetailDraft = this.createEmptyMasterProductDraft();
    this.masterAttributeDrafts = [];
  }

  protected onDraftCategoryChange(): void {
    const options = this.draftSubcategoryOptions;
    if (!options.some((option) => option.id === this.masterDetailDraft.subcategoryId)) {
      this.masterDetailDraft.subcategoryId = options[0]?.id || '';
      this.masterDetailDraft.familyId = '';
    }
    this.onDraftSubcategoryChange();
  }

  protected onDraftSubcategoryChange(): void {
    const options = this.draftFamilyOptions;
    if (!options.some((option) => option.id === this.masterDetailDraft.familyId)) {
      this.masterDetailDraft.familyId = options[0]?.id || '';
    }
    this.syncMasterAttributeDrafts();
  }

  protected async saveMasterProduct(): Promise<void> {
    if (this.masterDetailReadonly) {
      return;
    }

    const name = this.masterDetailDraft.name.trim();
    const brand = this.masterDetailDraft.brand.trim();
    if (name.length < 3) {
      this.error = 'El nombre del producto debe tener al menos 3 caracteres.';
      return;
    }
    if (!this.masterDetailDraft.categoryId || !this.masterDetailDraft.subcategoryId || !this.masterDetailDraft.familyId) {
      this.error = 'Debes seleccionar categoria, subcategoria y familia.';
      return;
    }

    const featureBullets = this.parseMultiline(this.masterDetailDraft.featureBulletsText);
    const gallery = this.parseGallery(this.masterDetailDraft.galleryText);
    const descriptionText = this.masterDetailDraft.descriptionText.trim();

    try {
      const payload = {
        name,
        barcode: this.masterDetailDraft.barcode,
        brand,
        productType: this.masterDetailDraft.productType.trim() || 'Producto ferretero',
        categoryId: this.masterDetailDraft.categoryId,
        subcategoryId: this.masterDetailDraft.subcategoryId,
        familyId: this.masterDetailDraft.familyId,
        unitLabel: this.masterDetailDraft.unitLabel.trim() || 'Unidad',
        packagingLabel: this.masterDetailDraft.packagingLabel.trim() || 'Unidad',
        shortDescription: this.masterDetailDraft.shortDescription.trim() || descriptionText,
        descriptionBlocks: descriptionText ? [{ text: descriptionText }] : undefined,
        imageUrl: this.masterDetailDraft.imageUrl.trim(),
        gallery,
        featureBullets,
        logisticsWeightKg: this.masterDetailDraft.logisticsWeightKg ?? undefined,
        logisticsVolumeM3: this.masterDetailDraft.logisticsVolumeM3 ?? undefined,
        logisticsPalletUnits: this.masterDetailDraft.logisticsPalletUnits ?? undefined,
        descriptionText
      };

      const targetMasterId = this.selectedMasterProduct?.masterProductId || this.selectedMasterProduct?.id;
      const updated = targetMasterId
        ? await this.apiService.updateMasterCatalogProduct(targetMasterId, payload)
        : await this.apiService.createMasterCatalogProduct(payload);

      if (!updated) {
        this.error = 'No fue posible guardar el producto maestro.';
        return;
      }

      await this.apiService.saveMasterProductAttributes(
        updated.masterProductId || updated.id,
        this.serializeMasterAttributeDrafts()
      );

      this.notice = targetMasterId
        ? `Producto maestro ${updated.name} actualizado.`
        : `Producto maestro ${updated.name} creado.`;
      this.error = '';
      this.masterCatalog = this.apiService.getMasterCatalogProducts();
      this.closeMasterProductModal();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible guardar el producto maestro.';
    }
  }

  protected openRequestCreationDetail(request: CatalogValidationRequest): void {
    this.selectedRequestForCreation = request;
    this.masterDetailDraft = this.mapRequestToDraft(request);
    this.masterAttributeDrafts = this.buildAttributeDrafts(this.masterDetailDraft.familyId);
    this.masterDetailReadonly = false;
    this.requestCreationModalOpen = true;
  }

  protected closeRequestCreationModal(): void {
    this.requestCreationModalOpen = false;
    this.masterDetailReadonly = true;
    this.selectedRequestForCreation = null;
    this.masterDetailDraft = this.createEmptyMasterProductDraft();
    this.masterAttributeDrafts = [];
  }

  protected async createProductFromRequestDetail(): Promise<void> {
    if (!this.selectedRequestForCreation) {
      this.error = 'No hay solicitud seleccionada.';
      return;
    }

    if (this.masterDetailDraft.name.trim().length < 3) {
      this.error = 'Ingresa un nombre de producto valido (minimo 3 caracteres).';
      return;
    }

    if (!this.masterDetailDraft.categoryId || !this.masterDetailDraft.subcategoryId || !this.masterDetailDraft.familyId) {
      this.error = 'Debes seleccionar categoria, subcategoria y familia.';
      return;
    }

    const request = this.selectedRequestForCreation;
    await this.resolveValidation(
      request,
      'aprobar_nuevo',
      undefined,
      {
        name: this.masterDetailDraft.name.trim(),
        barcode: this.masterDetailDraft.barcode,
        brand: this.masterDetailDraft.brand.trim() || 'Sin marca',
        productType: this.masterDetailDraft.productType.trim() || 'Producto ferretero',
        categoryId: this.masterDetailDraft.categoryId,
        subcategoryId: this.masterDetailDraft.subcategoryId,
        familyId: this.masterDetailDraft.familyId,
        unitLabel: this.masterDetailDraft.unitLabel.trim() || 'Unidad',
        packagingLabel: this.masterDetailDraft.packagingLabel.trim() || 'Unidad',
        shortDescription: this.masterDetailDraft.shortDescription.trim(),
        descriptionText: this.masterDetailDraft.descriptionText.trim(),
        imageUrl: this.masterDetailDraft.imageUrl.trim(),
        gallery: this.parseGallery(this.masterDetailDraft.galleryText),
        featureBullets: this.parseMultiline(this.masterDetailDraft.featureBulletsText),
        attributes: this.serializeMasterAttributeDrafts(),
        logisticsWeightKg: this.masterDetailDraft.logisticsWeightKg ?? undefined,
        logisticsVolumeM3: this.masterDetailDraft.logisticsVolumeM3 ?? undefined,
        logisticsPalletUnits: this.masterDetailDraft.logisticsPalletUnits ?? undefined
      }
    );

    if (!this.error) {
      this.closeRequestCreationModal();
    }
  }

  protected async deleteMasterProduct(product: CatalogProduct): Promise<void> {
    this.notice = '';
    this.error = '';

    try {
      await this.apiService.deleteMasterCatalogProduct(product.masterProductId || product.id);
      this.masterCatalog = this.apiService.getMasterCatalogProducts();
      this.notice = `Producto maestro ${product.name} eliminado.`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible eliminar el producto maestro.';
    }
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

  protected async refreshAll(): Promise<void> {
    this.notice = '';
    this.error = '';
    await this.ensureSectionData(this.currentSection, true);
  }

  protected async resolveAsMatch(request: CatalogValidationRequest): Promise<void> {
    const selected = this.selectedSuggestionByRequest[request.id] || request.suggestions[0]?.masterProductId;
    if (!selected) {
      this.error = 'Selecciona un match sugerido para aprobar.';
      return;
    }
    await this.resolveValidation(request, 'aprobar_match', selected);
  }

  protected async resolveAsNew(request: CatalogValidationRequest): Promise<void> {
    await this.resolveValidation(request, 'aprobar_nuevo');
  }

  protected async rejectValidation(request: CatalogValidationRequest): Promise<void> {
    await this.resolveValidation(request, 'rechazar');
  }

  protected openUserView(user: SessionUser): void {
    this.userModalReadonly = true;
    this.userModalDraft = this.mapUserToModalDraft(user);
    this.userModalOpen = true;
  }

  protected openUserEdit(user: SessionUser): void {
    this.userModalReadonly = false;
    this.userModalDraft = this.mapUserToModalDraft(user);
    this.userModalOpen = true;
  }

  protected openUserCreate(): void {
    this.userModalReadonly = false;
    this.userModalDraft = this.createEmptyUserModalDraft();
    this.userModalOpen = true;
  }

  protected closeUserModal(): void {
    this.userModalOpen = false;
    this.userModalReadonly = true;
    this.userModalDraft = this.createEmptyUserModalDraft();
  }

  protected async saveUserModal(): Promise<void> {
    this.notice = '';
    this.error = '';

    try {
      if (this.userModalDraft.isNew) {
        const created = await this.authService.adminCreateUser({
          role: this.userModalDraft.role,
          name: this.userModalDraft.displayName.trim(),
          email: this.userModalDraft.email.trim(),
          password: this.userModalDraft.password,
          phone: this.userModalDraft.phone.trim(),
          city: this.userModalDraft.city.trim(),
          commune: this.userModalDraft.commune.trim(),
          address: this.userModalDraft.address.trim(),
          subscriptionPlan: this.userModalDraft.role === 'admin' ? 'premium' : this.userModalDraft.subscriptionPlan,
          accountStatus: this.userModalDraft.accountStatus,
          businessName: this.userModalDraft.businessName.trim() || undefined,
          rut: this.userModalDraft.rut.trim() || undefined
        });

        this.notice = `Usuario ${created.displayName} creado.`;
        this.closeUserModal();
        this.markUserDataStale();
        await this.ensureSectionData(this.currentSection, true);
        return;
      }

      const user = this.users.find((item) => item.id === this.userModalDraft.id);
      if (!user) {
        this.error = 'No fue posible encontrar el usuario seleccionado.';
        return;
      }

      const updated = await this.authService.adminUpdateUser(user.id, {
        role: this.userModalDraft.role,
        subscriptionPlan: this.userModalDraft.role === 'admin' ? 'premium' : this.userModalDraft.subscriptionPlan || user.subscriptionPlan || 'basico',
        accountStatus: this.userModalDraft.accountStatus,
        displayName: this.userModalDraft.displayName.trim(),
        phone: this.userModalDraft.phone.trim(),
        city: this.userModalDraft.city.trim(),
        commune: this.userModalDraft.commune.trim(),
        address: this.userModalDraft.address.trim()
      });
      if (!updated) {
        this.error = 'No fue posible actualizar el usuario.';
        return;
      }

      this.notice = `Usuario ${updated.displayName} actualizado.`;
      this.closeUserModal();
      this.markUserDataStale();
      await this.ensureSectionData(this.currentSection, true);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible guardar el usuario.';
    }
  }

  protected async quickBlock(user: SessionUser): Promise<void> {
    try {
      const updated = await this.authService.adminUpdateUser(user.id, {
        accountStatus: 'bloqueado'
      });
      if (!updated) {
        this.error = 'No fue posible bloquear el usuario.';
        return;
      }
      this.notice = `Usuario ${updated.displayName} bloqueado.`;
      this.markUserDataStale();
      await this.ensureSectionData(this.currentSection, true);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible bloquear el usuario.';
    }
  }

  protected async deleteUser(user: SessionUser): Promise<void> {
    try {
      const deleted = await this.authService.adminDeleteUser(user.id);
      if (!deleted) {
        this.error = 'No fue posible eliminar el usuario.';
        return;
      }
      this.notice = `Usuario ${user.displayName} eliminado.`;
      this.markUserDataStale();
      await this.ensureSectionData(this.currentSection, true);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible eliminar el usuario.';
    }
  }

  protected openReport(report: CatalogImportReport): void {
    this.selectedReport = report;
    this.reportModalOpen = true;
  }

  protected closeReportModal(): void {
    this.reportModalOpen = false;
    this.selectedReport = null;
  }

  protected reportRowsByOutcome(outcome: CatalogImportRowResult['outcome']): CatalogImportRowResult[] {
    return this.selectedReport?.rows.filter((row) => row.outcome === outcome) || [];
  }

  protected logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/');
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  protected roleLabel(role: UserRole): string {
    if (role === 'maestro') {
      return 'Maestro';
    }
    if (role === 'ferreteria') {
      return 'Ferreteria';
    }
    return 'Admin';
  }

  protected statusLabel(status: AccountStatus): string {
    if (status === 'activo') {
      return 'Activo';
    }
    if (status === 'bloqueado') {
      return 'Bloqueado';
    }
    return 'Pendiente';
  }

  protected userStatus(user: SessionUser): AccountStatus {
    return user.accountStatus || 'pendiente';
  }

  protected planLabel(plan: SubscriptionPlan): string {
    if (plan === 'pro') {
      return 'Pro';
    }
    if (plan === 'premium') {
      return 'Premium';
    }
    return 'Basico';
  }

  protected categoryLabel(categoryId: string): string {
    return this.categoryOptions.find((item) => item.id === categoryId)?.name || categoryId;
  }

  protected subcategoryLabel(subcategoryId: string): string {
    return this.apiService.getSubcategoryOptions().find((item) => item.id === subcategoryId)?.name || subcategoryId;
  }

  protected familyLabel(familyId: string): string {
    return this.apiService.getFamilyOptions().find((item) => item.id === familyId)?.name || familyId;
  }

  protected goToSection(section: AdminSection): void {
    this.setSection(section);
  }

  protected usageBarWidth(value: number, max: number): number {
    if (max <= 0) {
      return 0;
    }
    return Math.max(6, Math.round((value / max) * 100));
  }

  protected usageSeriesMax(field: 'searches' | 'quotations' | 'imports'): number {
    return Math.max(
      1,
      ...this.adminMetrics.usageSeries.map((item) => item[field])
    );
  }

  protected userTrendMax(field: 'totalUsers' | 'payingUsers' | 'newUsers'): number {
    return Math.max(
      1,
      ...this.userTrendSeries.map((point) => point[field])
    );
  }

  protected userTrendLinePoints(field: 'totalUsers' | 'payingUsers'): string {
    if (this.userTrendSeries.length === 0) {
      return '';
    }

    const max = this.userTrendMax('totalUsers');
    const minY = 4;
    const maxY = 56;
    const usableHeight = maxY - minY;
    const steps = Math.max(1, this.userTrendSeries.length - 1);

    return this.userTrendSeries
      .map((point, index) => {
        const x = Math.round((index / steps) * 1000) / 10;
        const normalized = max > 0 ? point[field] / max : 0;
        const y = Math.round((maxY - (normalized * usableHeight)) * 10) / 10;
        return `${x},${y}`;
      })
      .join(' ');
  }

  protected donutStyle(percent: number, color: string, track = '#e6edf6'): string {
    const bounded = Math.max(0, Math.min(100, percent));
    return `conic-gradient(${color} 0 ${bounded}%, ${track} ${bounded}% 100%)`;
  }

  protected multiDonutStyle(segments: Array<{ value: number; color: string }>, track = '#e6edf6'): string {
    const total = segments.reduce((acc, segment) => acc + Math.max(0, segment.value), 0);
    if (total <= 0) {
      return `conic-gradient(${track} 0 100%)`;
    }

    let start = 0;
    const slices = segments.map((segment) => {
      const ratio = (Math.max(0, segment.value) / total) * 100;
      const end = Math.min(100, start + ratio);
      const slice = `${segment.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
      start = end;
      return slice;
    });

    if (start < 100) {
      slices.push(`${track} ${start.toFixed(2)}% 100%`);
    }

    return `conic-gradient(${slices.join(', ')})`;
  }

  protected userStatusDonutStyle(): string {
    return this.multiDonutStyle([
      { value: this.userKpis.activeUsers, color: '#2d9a65' },
      { value: this.userKpis.pendingUsers, color: '#d08a1c' },
      { value: this.userKpis.blockedUsers, color: '#b83636' }
    ]);
  }

  protected planDistributionDonutStyle(): string {
    return this.multiDonutStyle(
      this.planDistribution.map((item) => ({ value: item.count, color: item.color }))
    );
  }

  protected userGrowthPercent(field: 'totalUsers' | 'payingUsers'): number {
    if (this.userTrendSeries.length < 2) {
      return 0;
    }

    const first = this.userTrendSeries[0][field];
    const last = this.userTrendSeries[this.userTrendSeries.length - 1][field];
    if (first <= 0) {
      return 0;
    }

    return Number((((last - first) / first) * 100).toFixed(1));
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncViewportState();
  }

  private async resolveValidation(
    request: CatalogValidationRequest,
    action: 'aprobar_match' | 'aprobar_nuevo' | 'rechazar',
    selectedMasterProductId?: string,
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
      logisticsWeightKg?: number;
      logisticsVolumeM3?: number;
      logisticsPalletUnits?: number;
    }
  ): Promise<void> {
    this.notice = '';
    this.error = '';

    try {
      const updated = await this.apiService.resolveCatalogValidationRequest(request.id, action, {
        selectedMasterProductId,
        adminId: this.currentUser?.id,
        adminNote: this.notesByRequest[request.id] || '',
        masterDraft
      });

      if (!updated) {
        this.error = 'No se encontro la solicitud seleccionada.';
        return;
      }

      this.notice = action === 'rechazar'
        ? 'Solicitud rechazada.'
        : 'Solicitud aprobada y aplicada correctamente.';
      this.markValidationDataStale();
      await this.ensureSectionData(this.currentSection, true);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo resolver la solicitud.';
    }
  }

  private async initializeDashboard(): Promise<void> {
    try {
      await this.ensureSectionData(this.currentSection, true);
    } finally {
      this.isInitialLoading = false;
    }
  }

  private async ensureSectionData(section: AdminSection, force = false): Promise<void> {
    if (!force && this.loadedSections.has(section)) {
      return;
    }

    this.isSectionLoading = true;
    try {
      if (section === 'resumen' || section === 'operacion') {
        await this.ensureSnapshotDependenciesLoaded(force);
      }

      if (section === 'metricas') {
        await Promise.all([
          this.ensureUsersLoaded(force),
          this.ensureSnapshotDependenciesLoaded(force),
          this.apiService.refreshAdminMetricsSection(force)
        ]);
        this.adminMetrics = this.apiService.getAdminMockMetrics();
        this.syncMasterCatalogState();
        this.syncSummaryState();
      }

      if (section === 'taxonomia') {
        await this.apiService.refreshAdminTaxonomySection(force);
        this.syncTaxonomySelection();
      }

      if (section === 'productos') {
        await this.apiService.refreshAdminProductsSection(force);
        this.syncMasterCatalogState();
        this.syncTaxonomySelection();
        this.syncMasterAttributeDrafts();
      }

      if (section === 'solicitudes') {
        await this.apiService.refreshAdminRequestsSection(force);
        this.syncValidationRequestsState();
      }

      if (section === 'lotes') {
        await this.apiService.refreshAdminImportsSection(force);
        this.syncImportReportsState();
      }

      if (section === 'usuarios') {
        await this.ensureUsersLoaded(force);
      }

      this.loadedSections.add(section);
    } finally {
      this.isSectionLoading = false;
    }
  }

  private async ensureUsersLoaded(force = false): Promise<void> {
    if (!force && this.usersLoaded) {
      return;
    }

    try {
      this.users = await this.authService.listUsersForAdmin();
      this.usersLoaded = true;
    } catch (error) {
      this.users = [];
      this.usersLoaded = false;
      this.error = error instanceof Error ? error.message : 'No fue posible cargar usuarios.';
    }
  }

  private async ensureSnapshotDependenciesLoaded(force = false): Promise<void> {
    await this.ensureUsersLoaded(force);
    if (!force && this.snapshotDataLoaded) {
      this.syncSummaryState();
      return;
    }

    await this.apiService.refreshAdminSnapshotSection(this.users, force);
    this.syncImportReportsState();
    this.syncValidationRequestsState();
    this.snapshotDataLoaded = true;
    this.syncSummaryState();
  }

  private syncImportReportsState(): void {
    this.importReports = this.apiService.getCatalogImportReports('all')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private syncValidationRequestsState(): void {
    this.validationRequests = this.apiService.getCatalogValidationQueue('all')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    this.syncDrafts();
  }

  private syncMasterCatalogState(): void {
    this.masterCatalog = this.apiService.getMasterCatalogProducts();
  }

  private syncSummaryState(): void {
    this.snapshot = this.buildSnapshot();
    this.userKpis = this.buildUserKpis();
    this.userTrendSeries = this.buildUserTrendSeries();
    this.planDistribution = this.buildPlanDistribution();
  }

  private markUserDataStale(): void {
    this.usersLoaded = false;
    this.snapshotDataLoaded = false;
    this.loadedSections.delete('usuarios');
    this.loadedSections.delete('resumen');
    this.loadedSections.delete('metricas');
    this.loadedSections.delete('operacion');
  }

  private markValidationDataStale(): void {
    this.snapshotDataLoaded = false;
    this.loadedSections.delete('solicitudes');
    this.loadedSections.delete('productos');
    this.loadedSections.delete('resumen');
    this.loadedSections.delete('metricas');
    this.loadedSections.delete('operacion');
  }

  private syncDrafts(): void {
    const suggestionDraft: Record<string, string> = {};

    this.validationRequests.forEach((request) => {
      if (request.suggestions.length > 0) {
        suggestionDraft[request.id] = request.suggestions[0].masterProductId;
      }
    });

    this.selectedSuggestionByRequest = suggestionDraft;
  }

  private buildSnapshot(): AdminSnapshot {
    const usersByRole: Record<UserRole, number> = {
      maestro: 0,
      ferreteria: 0,
      admin: 0
    };

    this.users.forEach((user) => {
      usersByRole[user.role] += 1;
    });

    const ferreterias = this.users.filter((user) => user.role === 'ferreteria');
    const maestros = this.users.filter((user) => user.role === 'maestro');

    const stores: StoreOpsRow[] = ferreterias.map((store) => {
      const catalog = this.apiService.getCatalog(store.id);
      const published = catalog.filter((item) => item.isPublished).length;
      const lowStock = catalog.filter((item) => item.stock < 15).length;
      const inventoryValue = catalog.reduce((acc, item) => acc + (item.stock * item.price), 0);
      return {
        ownerId: store.id,
        ownerLabel: store.businessName || store.displayName,
        totalProducts: catalog.length,
        publishedProducts: published,
        lowStockProducts: lowStock,
        inventoryValue
      };
    });

    const maestrosOps: MaestroOpsRow[] = maestros.map((maestro) => ({
      ownerId: maestro.id,
      ownerLabel: maestro.displayName,
      pendingProjects: this.apiService.getProjectsByStatus(maestro.id, 'pendiente').length,
      acceptedProjects: this.apiService.getProjectsByStatus(maestro.id, 'aceptada').length,
      rejectedProjects: this.apiService.getProjectsByStatus(maestro.id, 'rechazada').length
    }));

    const importedRows = this.importReports.reduce((acc, report) => acc + report.uploadedCount, 0);
    const failedRows = this.importReports.reduce((acc, report) => acc + report.failedCount, 0);
    const pendingNewRows = this.importReports.reduce((acc, report) => acc + report.pendingNewCount, 0);
    const possibleMatchRows = this.importReports.reduce((acc, report) => acc + report.possibleMatchCount, 0);

    const snapshot: AdminSnapshot = {
      usersTotal: this.users.length,
      usersByRole,
      activeUsers: this.users.filter((user) => this.userStatus(user) === 'activo').length,
      blockedUsers: this.users.filter((user) => this.userStatus(user) === 'bloqueado').length,
      pendingUserValidation: this.users.filter((user) => !user.adminValidated || this.userStatus(user) === 'pendiente').length,
      validationPending: this.validationRequests.filter((item) => item.status === 'pendiente').length,
      validationApproved: this.validationRequests.filter((item) => item.status === 'aprobado').length,
      validationRejected: this.validationRequests.filter((item) => item.status === 'rechazado').length,
      importBatches: this.importReports.length,
      importedRows,
      failedRows,
      pendingNewRows,
      possibleMatchRows,
      totalCatalogProducts: stores.reduce((acc, store) => acc + store.totalProducts, 0),
      publishedCatalogProducts: stores.reduce((acc, store) => acc + store.publishedProducts, 0),
      lowStockProducts: stores.reduce((acc, store) => acc + store.lowStockProducts, 0),
      totalInventoryValue: stores.reduce((acc, store) => acc + store.inventoryValue, 0),
      pendingProjects: maestrosOps.reduce((acc, maestro) => acc + maestro.pendingProjects, 0),
      acceptedProjects: maestrosOps.reduce((acc, maestro) => acc + maestro.acceptedProjects, 0),
      rejectedProjects: maestrosOps.reduce((acc, maestro) => acc + maestro.rejectedProjects, 0),
      stores: stores.sort((left, right) => right.totalProducts - left.totalProducts),
      maestros: maestrosOps.sort((left, right) => right.pendingProjects - left.pendingProjects)
    };

    return snapshot;
  }

  private createEmptySnapshot(): AdminSnapshot {
    return {
      usersTotal: 0,
      usersByRole: { maestro: 0, ferreteria: 0, admin: 0 },
      activeUsers: 0,
      blockedUsers: 0,
      pendingUserValidation: 0,
      validationPending: 0,
      validationApproved: 0,
      validationRejected: 0,
      importBatches: 0,
      importedRows: 0,
      failedRows: 0,
      pendingNewRows: 0,
      possibleMatchRows: 0,
      totalCatalogProducts: 0,
      publishedCatalogProducts: 0,
      lowStockProducts: 0,
      totalInventoryValue: 0,
      pendingProjects: 0,
      acceptedProjects: 0,
      rejectedProjects: 0,
      stores: [],
      maestros: []
    };
  }

  private createEmptyAdminMetrics(): AdminMockMetrics {
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

  private buildUserKpis(): AdminUserKpiSummary {
    const totalUsers = this.users.length;
    const activeUsers = this.users.filter((user) => this.userStatus(user) === 'activo').length;
    const blockedUsers = this.users.filter((user) => this.userStatus(user) === 'bloqueado').length;
    const pendingUsers = Math.max(0, totalUsers - activeUsers - blockedUsers);

    const paidUsers = this.users
      .filter((user) => user.role !== 'admin')
      .filter((user) => user.subscriptionPlan === 'pro' || user.subscriptionPlan === 'premium')
      .length;

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const datedUsers = this.users.filter((user) => user.createdAt && !Number.isNaN(Date.parse(user.createdAt)));
    const datedNewUsers = datedUsers.filter((user) => {
      const createdAt = Date.parse(user.createdAt as string);
      return createdAt >= (now - thirtyDaysMs);
    }).length;
    const fallbackNewUsers = Math.max(1, Math.round(totalUsers * 0.14));
    const newUsers30d = datedUsers.length > 0 ? datedNewUsers : fallbackNewUsers;

    const payingRate = totalUsers > 0 ? Number(((paidUsers / totalUsers) * 100).toFixed(1)) : 0;
    const activeRate = totalUsers > 0 ? Number(((activeUsers / totalUsers) * 100).toFixed(1)) : 0;

    return {
      totalUsers,
      newUsers30d,
      payingUsers: paidUsers,
      payingRate,
      activeUsers,
      activeRate,
      blockedUsers,
      pendingUsers
    };
  }

  private buildUserTrendSeries(): AdminUserTrendPoint[] {
    const baseSeries = this.adminMetrics.usageSeries;
    if (baseSeries.length === 0) {
      return [];
    }

    const maxSearches = Math.max(1, ...baseSeries.map((point) => point.searches));
    const totalUsers = Math.max(1, this.userKpis.totalUsers);
    const payingUsers = Math.max(0, this.userKpis.payingUsers);
    const weeklyTotalGrowth = Math.max(1, Math.round(this.userKpis.newUsers30d * 0.28));
    const weeklyPayingGrowth = Math.max(0, Math.round(weeklyTotalGrowth * 0.45));

    return baseSeries.map((point, index) => {
      const progress = (index + 1) / baseSeries.length;
      const activityPulse = (point.searches / maxSearches) * 0.06;
      const totalBaseline = totalUsers - weeklyTotalGrowth;
      const totalProjected = totalBaseline + (weeklyTotalGrowth * progress);
      const totalWithPulse = Math.round(totalProjected * (0.97 + activityPulse));
      const boundedTotal = Math.max(1, Math.min(totalUsers, totalWithPulse));

      const payingBaseline = Math.max(0, payingUsers - weeklyPayingGrowth);
      const payingProjected = payingBaseline + (weeklyPayingGrowth * progress);
      const payingWithPulse = Math.round(payingProjected * (0.97 + (activityPulse * 0.7)));
      const boundedPaying = Math.max(0, Math.min(boundedTotal, Math.min(payingUsers, payingWithPulse)));

      const dayNewUsers = Math.max(
        0,
        Math.round((this.userKpis.newUsers30d / baseSeries.length) * (0.72 + (point.searches / maxSearches) * 0.58))
      );

      return {
        label: point.label,
        totalUsers: boundedTotal,
        payingUsers: boundedPaying,
        newUsers: dayNewUsers
      };
    });
  }

  private buildPlanDistribution(): AdminPlanDistributionRow[] {
    const usersWithoutAdmin = this.users.filter((user) => user.role !== 'admin');
    const countByPlan = usersWithoutAdmin.reduce<Record<SubscriptionPlan, number>>((acc, user) => {
      const plan = user.subscriptionPlan || 'basico';
      acc[plan] += 1;
      return acc;
    }, {
      basico: 0,
      pro: 0,
      premium: 0
    });

    return [
      { plan: 'basico', label: 'Basico', count: countByPlan.basico, color: '#5a78a4' },
      { plan: 'pro', label: 'Pro', count: countByPlan.pro, color: '#1f4b84' },
      { plan: 'premium', label: 'Premium', count: countByPlan.premium, color: '#2d9a65' }
    ];
  }

  private createEmptyUserKpis(): AdminUserKpiSummary {
    return {
      totalUsers: 0,
      newUsers30d: 0,
      payingUsers: 0,
      payingRate: 0,
      activeUsers: 0,
      activeRate: 0,
      blockedUsers: 0,
      pendingUsers: 0
    };
  }

  private createEmptyMasterProductDraft(): MasterProductDraft {
    return {
      masterProductId: '',
      name: '',
      barcode: '',
      brand: '',
      productType: '',
      categoryId: '',
      subcategoryId: '',
      familyId: '',
      unitLabel: 'Unidad',
      packagingLabel: 'Unidad',
      shortDescription: '',
      descriptionText: '',
      imageUrl: '',
      galleryText: '',
      featureBulletsText: '',
      logisticsWeightKg: null,
      logisticsVolumeM3: null,
      logisticsPalletUnits: null
    };
  }

  private createEmptyDefinitionDraft(): AdminDefinitionDraft {
    return {
      id: null,
      codigo: '',
      etiqueta: '',
      tipoDato: 'texto',
      esFiltrable: true,
      esObligatorio: false,
      opcionesTexto: '',
      orden: 1
    };
  }

  private createEmptyUserModalDraft(): AdminUserModalDraft {
    return {
      id: '',
      isNew: true,
      email: '',
      password: '',
      displayName: '',
      role: 'ferreteria',
      subscriptionPlan: 'basico',
      accountStatus: 'activo',
      phone: '',
      city: '',
      commune: '',
      address: '',
      businessName: '',
      rut: ''
    };
  }

  private mapUserToModalDraft(user: SessionUser): AdminUserModalDraft {
    return {
      id: user.id,
      isNew: false,
      email: user.email,
      password: '',
      displayName: user.displayName,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan || 'basico',
      accountStatus: user.accountStatus || 'pendiente',
      phone: user.phone || '',
      city: user.city || '',
      commune: user.commune || '',
      address: user.address || '',
      businessName: user.businessName || '',
      rut: user.rut || ''
    };
  }

  private mapProductToDraft(product: CatalogProduct): MasterProductDraft {
    const logisticWeight = this.extractTechnicalNumericValue(product.technicalSheet, 'peso logistico');
    const logisticVolume = this.extractTechnicalNumericValue(product.technicalSheet, 'volumen logistico');
    const palletUnits = this.extractTechnicalNumericValue(product.technicalSheet, 'unidades por pallet');

    return {
      masterProductId: product.masterProductId || product.id,
      name: product.name,
      barcode: product.barcode || '',
      brand: product.brand,
      productType: product.productType,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      familyId: product.familyId,
      unitLabel: product.unitLabel || 'Unidad',
      packagingLabel: product.packagingLabel || 'Unidad',
      shortDescription: product.shortDescription || '',
      descriptionText: product.descriptionBlocks[0]?.text || product.shortDescription || '',
      imageUrl: product.imageUrl || '',
      galleryText: product.gallery.join(', '),
      featureBulletsText: product.featureBullets.join('\n'),
      logisticsWeightKg: logisticWeight,
      logisticsVolumeM3: logisticVolume,
      logisticsPalletUnits: palletUnits
    };
  }

  private mapRequestToDraft(request: CatalogValidationRequest): MasterProductDraft {
    const defaults = this.createEmptyMasterProductDraft();
    const firstCategory = this.apiService.getCategoryOptions()[0]?.id || '';
    const categoryId = request.row.categoryId || firstCategory;
    const subcategoryOptions = this.apiService.getSubcategoryOptions(categoryId);
    const subcategoryId = request.row.subcategoryId || subcategoryOptions[0]?.id || '';
    const familyOptions = this.apiService.getFamilyOptions(subcategoryId);
    const familyId = request.row.familyId || familyOptions[0]?.id || '';

    return {
      ...defaults,
      name: request.row.name,
      barcode: request.row.barcode || '',
      brand: request.row.brand || 'Sin marca',
      categoryId,
      subcategoryId,
      familyId,
      unitLabel: request.row.unitLabel || 'Unidad',
      shortDescription: `${request.row.name} agregado desde solicitud de ferreteria.`,
      descriptionText: `${request.row.name} aprobado por administracion para incorporarse al catalogo maestro.`,
      featureBulletsText: 'Producto validado por admin\nFicha pendiente de enriquecimiento'
    };
  }

  private async loadMasterProductDetail(product: CatalogProduct): Promise<void> {
    try {
      const detail = await this.apiService.getMasterCatalogProductDetail(product.masterProductId || product.id);
      this.masterDetailDraft = this.mapProductToDraft(detail.product || product);
      this.masterAttributeDrafts = this.buildAttributeDrafts(this.masterDetailDraft.familyId, detail.attributes);
    } catch {
      this.masterDetailDraft = this.mapProductToDraft(product);
      this.masterAttributeDrafts = this.buildAttributeDrafts(this.masterDetailDraft.familyId);
    }
  }

  private buildAttributeDrafts(familyId: string, existing: any[] = []): MasterAttributeDraft[] {
    if (!familyId) {
      return [];
    }

    return this.apiService.getFamilyDefinitionRows(familyId)
      .slice()
      .sort((left, right) => (left.orden || 0) - (right.orden || 0) || left.etiqueta.localeCompare(right.etiqueta))
      .map((definition) => {
        const value = existing.find((item) => item.definicionAtributoId === definition.id);
        return {
          definitionId: definition.id,
          label: definition.etiqueta,
          type: this.mapDefinitionType(definition.tipoDato),
          required: Boolean(definition.esObligatorio),
          options: definition.opcionesJson || [],
          valueText: value?.valorTexto || '',
          valueNumber: typeof value?.valorNumero === 'number' ? value.valorNumero : null,
          valueBoolean: typeof value?.valorBooleano === 'boolean' ? value.valorBooleano : null,
          valueOption: value?.valorOpcion || ''
        };
      });
  }

  private mapDefinitionType(type: TaxonomyDefinitionApi['tipoDato']): MasterAttributeDraft['type'] {
    if (type === 'numero') {
      return 'number';
    }
    if (type === 'seleccion') {
      return 'select';
    }
    if (type === 'booleano') {
      return 'boolean';
    }
    return 'text';
  }

  private syncMasterAttributeDrafts(): void {
    const current = new Map(this.masterAttributeDrafts.map((item) => [item.definitionId, item]));
    this.masterAttributeDrafts = this.buildAttributeDrafts(this.masterDetailDraft.familyId).map((draft) => {
      const previous = current.get(draft.definitionId);
      return previous ? { ...draft, ...previous } : draft;
    });
  }

  private serializeMasterAttributeDrafts(): Array<{
    definicionAtributoId: string;
    valorTexto?: string | null;
    valorNumero?: number | null;
    valorBooleano?: boolean | null;
    valorOpcion?: string | null;
  }> {
    return this.masterAttributeDrafts.map((item) => ({
      definicionAtributoId: item.definitionId,
      valorTexto: item.type === 'text' ? (item.valueText.trim() || null) : null,
      valorNumero: item.type === 'number' ? item.valueNumber : null,
      valorBooleano: item.type === 'boolean' ? item.valueBoolean : null,
      valorOpcion: item.type === 'select' ? (item.valueOption || null) : null
    }));
  }

  private syncTaxonomySelection(): void {
    const categories = this.categoryOptions;
    if (!categories.some((item) => item.id === this.selectedTaxCategoryId)) {
      this.selectedTaxCategoryId = categories[0]?.id || '';
    }

    const subcategories = this.selectedTaxSubcategories;
    if (!subcategories.some((item) => item.id === this.selectedTaxSubcategoryId)) {
      this.selectedTaxSubcategoryId = subcategories[0]?.id || '';
    }

    const families = this.selectedTaxFamilies;
    if (!families.some((item) => item.id === this.selectedTaxFamilyId)) {
      this.selectedTaxFamilyId = families[0]?.id || '';
    }

    if (this.definitionDraft.id && !this.selectedTaxDefinitions.some((item) => item.id === this.definitionDraft.id)) {
      this.resetDefinitionDraft();
    }
  }

  private parseMultiline(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseGallery(value: string): string[] {
    return value
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private extractTechnicalNumericValue(
    rows: Array<{ label: string; value: string }>,
    labelFragment: string
  ): number | null {
    const row = rows.find((item) => item.label.toLowerCase().includes(labelFragment));
    if (!row) {
      return null;
    }
    const normalized = Number.parseFloat(row.value.replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(normalized) ? normalized : null;
  }

  private syncViewportState(): void {
    if (typeof window === 'undefined') {
      return;
    }
    this.isMobileViewport = window.innerWidth <= 1040;
    if (!this.isMobileViewport) {
      this.isMobileMenuVisible = false;
    }
  }
}
