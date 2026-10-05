import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import {
  AccountStatus,
  CatalogProduct,
  CatalogValidationRequest,
  CatalogValidationStatus,
  CatalogValidationType,
  ContactRequest,
  ContactRequestStatus,
  AdminAuditEntry,
  GovernanceEvidence,
  GovernanceEvidenceOutcome,
  GovernanceEvidenceType,
  GovernanceSummary,
  IpReport,
  IpReportStatus,
  PriceReport,
  PriceReportStatus,
  PrivacyRequest,
  PrivacyRequestStatus,
  SessionUser,
  SecurityIncident,
  SecurityIncidentSeverity,
  SecurityIncidentStatus,
  TaxonomyOption,
  UserRole
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService, TaxonomyDefinitionApi } from '../../core/services/firebase-data.service';
import { PrivacyDataService } from '../../core/services/privacy-data.service';
import { GovernanceDataService } from '../../core/services/governance-data.service';
import { IntellectualPropertyService } from '../../core/services/intellectual-property.service';
import { CATALOG_IMPORT_TEMPLATE, catalogFileToCsv, catalogImportTemplateFileName, downloadCatalogImportTemplate } from '../../core/utils/catalog-import.util';
import { CHILE_CITY_OPTIONS, communesForCity } from '../../core/utils/chile-locations.util';
import { getCurrentBrowserLocation, hasValidCoordinates } from '../../core/utils/location.util';
import { DashboardMenuComponent } from '../../shared/components/dashboard-menu/dashboard-menu.component';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';

type AdminSection = 'ferreterias' | 'productos' | 'solicitudes' | 'contacto' | 'precios' | 'propiedad' | 'privacidad' | 'gobierno' | 'usuarios';

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
  imageSourceType: NonNullable<CatalogProduct['imageRights']>['sourceType'];
  imageProvider: string;
  imageSourceTermsUrl: string;
  imageAuthorizationReference: string;
  imageContainsThirdPartyMarks: boolean;
  trademarkAuthorizationReference: string;
  contentSourceType: NonNullable<CatalogProduct['contentRights']>['sourceType'];
  contentSourceUrl: string;
  contentAuthorizationReference: string;
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
  accountStatus: AccountStatus;
  phone: string;
  city: string;
  commune: string;
  address: string;
  businessName: string;
  rut: string;
  storeLatitude: number | null;
  storeLongitude: number | null;
}

const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{12,128}$/;

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
    PasswordFieldComponent,
    CommonModule,
    FormsModule,
    DashboardMenuComponent,
    ButtonModule,
    CardModule,
    CheckboxModule,
    DividerModule,
    SelectModule,
    InputNumberModule,
    InputTextModule,
    TextareaModule,
    PaginatorModule,
    SelectButtonModule,
    TableModule,
    UiLoaderComponent
  ],
  templateUrl: './dashboard-admin-validaciones.component.html',
  styleUrl: './dashboard-admin-validaciones.component.scss'
})
export class DashboardAdminValidacionesComponent implements OnInit {
  private sectionLoadError = '';
  protected get dataLoadError(): string { return this.sectionLoadError || this.apiService.loadError(); }
  protected async retryDataLoad(): Promise<void> {
    await this.ensureSectionData(this.currentSection, true).catch(() => undefined);
  }

  protected readonly storeCityOptions = CHILE_CITY_OPTIONS;
  protected readonly catalogViewOptions = [
    { label: 'Productos', value: 'productos', icon: 'pi pi-box' },
    { label: 'Taxonomía', value: 'taxonomia', icon: 'pi pi-sitemap' }
  ];
  protected readonly definitionTypeOptions = [
    { label: 'Texto', value: 'texto' },
    { label: 'Número', value: 'numero' },
    { label: 'Selección', value: 'seleccion' },
    { label: 'Sí / No', value: 'booleano' }
  ];

  protected readonly sections: AdminSectionMeta[] = [
    {
      id: 'ferreterias',
      label: 'Ferreterias',
      description: 'Activa cuentas, revisa catalogos y realiza la carga inicial de productos.'
    },
    {
      id: 'productos',
      label: 'Catalogo maestro',
      description: 'Administra productos, categorias, subcategorias, familias y atributos.'
    },
    {
      id: 'solicitudes',
      label: 'Solicitudes',
      description: 'Resuelve productos que las ferreterias no encuentran en el catalogo maestro.'
    },
    {
      id: 'contacto',
      label: 'Solicitudes de acceso',
      description: 'Gestiona solicitudes comerciales de ferreterias y mensajes de contacto.'
    },
    {
      id: 'precios',
      label: 'Reclamos de precios',
      description: 'Verifica diferencias, corrige ofertas y conserva la evidencia histórica del cambio.'
    },
    {
      id: 'privacidad',
      label: 'Derechos de datos',
      description: 'Atiende solicitudes de acceso, rectificación, supresión, oposición, bloqueo y portabilidad.'
    },
    {
      id: 'propiedad',
      label: 'Propiedad intelectual',
      description: 'Revisa denuncias y aplica retiro preventivo, reposición o retiro definitivo del contenido.'
    },
    {
      id: 'gobierno',
      label: 'Gobierno de datos',
      description: 'Registra incidentes, pruebas, evaluaciones y trazabilidad administrativa.'
    },
    {
      id: 'usuarios',
      label: 'Usuarios',
      description: 'Gestiona las cuentas y sus estados de acceso.'
    }
  ];
  protected currentSection: AdminSection = 'ferreterias';
  protected catalogAdminView: 'productos' | 'taxonomia' = 'productos';
  protected users: SessionUser[] = [];
  protected validationRequests: CatalogValidationRequest[] = [];
  protected contactRequests: ContactRequest[] = [];
  protected contactStatusFilter: ContactRequestStatus | 'all' = 'pendiente';
  protected privacyRequests: PrivacyRequest[] = [];
  protected privacyStatusFilter: PrivacyRequestStatus | 'all' = 'recibida';
  protected privacyResolutionDrafts: Record<string, string> = {};
  protected ipReports: IpReport[] = [];
  protected ipStatusFilter: IpReportStatus | 'all' = 'recibida';
  protected ipResolutionDrafts: Record<string, string> = {};
  protected ipPublicMessageDrafts: Record<string, string> = {};
  protected priceReports: PriceReport[] = [];
  protected priceStatusFilter: PriceReportStatus | 'all' = 'recibido';
  protected priceResolutionDrafts: Record<string, string> = {};
  protected correctedPriceDrafts: Record<string, number | null> = {};
  protected governanceSummary: GovernanceSummary | null = null;
  protected securityIncidents: SecurityIncident[] = [];
  protected governanceEvidence: GovernanceEvidence[] = [];
  protected adminAuditEntries: AdminAuditEntry[] = [];
  protected incidentDraft = {
    title: '', description: '', severity: 'media' as SecurityIncidentSeverity,
    detectedAt: '', systemsText: '', dataCategoriesText: '', affectedPeopleEstimate: 0,
    containmentActions: ''
  };
  protected evidenceDraft = {
    type: 'revision_controles' as GovernanceEvidenceType,
    outcome: 'conforme' as GovernanceEvidenceOutcome,
    title: '', owner: '', performedAt: '', nextReviewAt: '', notes: '', evidenceUrl: ''
  };

  protected validationStatusFilter: CatalogValidationStatus | 'all' = 'pendiente';
  protected validationTypeFilter: CatalogValidationType | 'all' = 'all';
  protected validationSearch = '';

  protected masterCatalog: CatalogProduct[] = [];
  protected masterSearch = '';
  protected masterCategoryFilter = '';
  protected masterSubcategoryFilter = '';
  protected masterFamilyFilter = '';
  protected masterPage = 1;
  protected masterPageSize = 20;
  protected masterTotal = 0;
  protected readonly masterPageSizeOptions = [10, 20, 50];
  protected masterCatalogLoading = false;
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

  protected userRoleFilter: UserRole | 'all' = 'all';
  protected userStatusFilter: AccountStatus | 'all' = 'all';
  protected userSearch = '';

  protected onboardingStoreOwnerId = '';
  protected onboardingCsvContent = CATALOG_IMPORT_TEMPLATE;
  protected onboardingFileName = '';
  protected onboardingLoading = false;
  protected onboardingError = '';
  protected onboardingNotice = '';
  protected selectedStoreCatalogLabel = '';
  protected selectedStoreCatalog: CatalogProduct[] = [];
  protected selectedStore: SessionUser | null = null;
  protected ferreteriaView: 'list' | 'create' | 'detail' = 'list';
  protected selectedStoreCatalogLoading = false;
  protected selectedStoreCatalogSearch = '';
  protected selectedStoreCatalogPage = 1;
  protected selectedStoreCatalogPageSize = 20;
  protected readonly selectedStoreCatalogPageSizeOptions = [10, 20, 50];
  protected storeSearch = '';
  protected storeCityFilter = '';
  protected storeCommuneFilter = '';
  protected storePage = 1;
  protected storePageSize = 20;
  protected readonly storePageSizeOptions = [10, 20, 50];
  protected storeCreateDraft: AdminUserModalDraft = this.createEmptyUserModalDraft();
  protected storeCreateSaving = false;
  protected storeCreateError = '';
  protected storeCreateLocationMessage = '';
  protected storeCreateLocating = false;

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
  private catalogProductsLoaded = false;
  private catalogTaxonomyLoaded = false;
  private readonly loadedSections = new Set<AdminSection>();

  constructor(private readonly apiService: FirebaseDataService,
    private readonly authService: AuthService,
    private readonly privacyDataService: PrivacyDataService,
    private readonly governanceDataService: GovernanceDataService,
    private readonly intellectualPropertyService: IntellectualPropertyService,
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

  protected get contactRequestRows(): ContactRequest[] {
    return this.contactRequests.filter((request) => (
      this.contactStatusFilter === 'all' || request.status === this.contactStatusFilter
    ));
  }

  protected get privacyRequestRows(): PrivacyRequest[] {
    return this.privacyRequests.filter((request) => (
      this.privacyStatusFilter === 'all' || request.status === this.privacyStatusFilter
    ));
  }

  protected get ipReportRows(): IpReport[] {
    return this.ipReports.filter((report) => this.ipStatusFilter === 'all' || report.status === this.ipStatusFilter);
  }

  protected get priceReportRows(): PriceReport[] {
    return this.priceReports.filter((report) => this.priceStatusFilter === 'all' || report.status === this.priceStatusFilter);
  }

  protected async setPriceReportStatus(report: PriceReport, status: Exclude<PriceReportStatus, 'recibido'>): Promise<void> {
    this.notice = '';
    this.error = '';
    const resolution = (this.priceResolutionDrafts[report.id] || '').trim();
    const correctedPrice = this.correctedPriceDrafts[report.id];
    if (resolution.length < 10 || (status === 'corregido' && (correctedPrice === null || correctedPrice === undefined || correctedPrice < 0))) {
      this.error = 'Registra un fundamento y, si corriges la oferta, el precio verificado.';
      return;
    }
    try {
      const updated = await this.apiService.updatePriceReportForAdmin(report.id, status, resolution, correctedPrice ?? undefined);
      this.priceReports = this.priceReports.map((item) => item.id === updated.id ? updated : item);
      this.notice = status === 'corregido'
        ? 'Precio corregido; el valor anterior y el nuevo quedaron registrados en el historial.'
        : 'Reclamo de precio actualizado.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible actualizar el reclamo.';
    }
  }

  protected ipRightLabel(value: IpReport['rightsType']): string {
    return value === 'copyright' ? 'Derecho de autor' : value === 'trademark' ? 'Marca comercial' : 'Derecho de autor y marca';
  }

  protected async setIpReportStatus(report: IpReport, status: IpReportStatus): Promise<void> {
    this.notice = '';
    this.error = '';
    const resolution = (this.ipResolutionDrafts[report.id] || '').trim();
    const publicMessage = (this.ipPublicMessageDrafts[report.id] || '').trim();
    if (resolution.length < 10 || publicMessage.length < 10) {
      this.error = 'Registra el fundamento interno y un mensaje para el denunciante antes de cambiar el estado.';
      return;
    }
    try {
      const updated = await this.intellectualPropertyService.updateForAdmin(report.id, status, resolution, publicMessage);
      this.ipReports = this.ipReports.map((item) => item.id === updated.id ? updated : item);
      this.notice = status === 'retiro_preventivo' || status === 'retiro_definitivo'
        ? 'Contenido retirado y denuncia actualizada.'
        : 'Denuncia de propiedad intelectual actualizada.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible actualizar la denuncia.';
    }
  }

  protected privacyRequestLabel(type: string): string {
    const labels: Record<string, string> = {
      access: 'Acceso',
      rectification: 'Rectificación',
      deletion: 'Supresión',
      objection: 'Oposición',
      blocking: 'Bloqueo temporal',
      portability: 'Portabilidad'
    };
    return labels[type] || type;
  }

  protected async setPrivacyRequestStatus(request: PrivacyRequest, status: PrivacyRequestStatus): Promise<void> {
    this.notice = '';
    this.error = '';
    const resolution = (this.privacyResolutionDrafts[request.id] || '').trim();
    if ((status === 'completada' || status === 'rechazada') && resolution.length < 10) {
      this.error = 'Registra una respuesta fundada antes de cerrar la solicitud.';
      return;
    }
    try {
      const updated = await this.privacyDataService.updateRequestForAdmin(request.id, status, resolution);
      this.privacyRequests = this.privacyRequests.map((item) => item.id === updated.id ? updated : item);
      this.notice = 'Solicitud de derechos actualizada.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo actualizar la solicitud.';
    }
  }

  protected async setContactRequestStatus(request: ContactRequest, status: ContactRequestStatus): Promise<void> {
    this.notice = '';
    this.error = '';
    try {
      const updated = await this.apiService.updateContactRequestStatus(request.id, status);
      this.contactRequests = this.contactRequests.map((item) => item.id === updated.id ? updated : item);
      this.notice = 'Solicitud actualizada correctamente.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo actualizar la solicitud.';
    }
  }

  protected governanceEvidenceLabel(type: GovernanceEvidenceType): string {
    const labels: Record<GovernanceEvidenceType, string> = {
      revision_controles: 'Revisión de controles',
      prueba_recuperacion: 'Prueba de recuperación',
      evaluacion_impacto: 'Evaluación de impacto',
      revision_encargados: 'Revisión de encargados',
      revision_accesos: 'Revisión de accesos',
      confidencialidad_personal: 'Confidencialidad del personal'
    };
    return labels[type];
  }

  protected async recordSecurityIncident(): Promise<void> {
    this.notice = '';
    this.error = '';
    try {
      await this.governanceDataService.createIncident({
        title: this.incidentDraft.title,
        description: this.incidentDraft.description,
        severity: this.incidentDraft.severity,
        detectedAt: this.incidentDraft.detectedAt,
        systems: this.commaSeparatedValues(this.incidentDraft.systemsText),
        dataCategories: this.commaSeparatedValues(this.incidentDraft.dataCategoriesText),
        affectedPeopleEstimate: this.incidentDraft.affectedPeopleEstimate,
        containmentActions: this.incidentDraft.containmentActions
      });
      this.incidentDraft = {
        title: '', description: '', severity: 'media', detectedAt: '', systemsText: '',
        dataCategoriesText: '', affectedPeopleEstimate: 0, containmentActions: ''
      };
      await this.loadGovernanceDashboard();
      this.notice = 'Incidente registrado. Evalúa de inmediato si corresponde notificar a la Agencia y a los titulares.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible registrar el incidente.';
    }
  }

  protected async setIncidentStatus(incident: SecurityIncident, status: SecurityIncidentStatus): Promise<void> {
    this.notice = '';
    this.error = '';
    try {
      await this.governanceDataService.updateIncident(incident.id, status, incident.containmentActions || '');
      await this.loadGovernanceDashboard();
      this.notice = 'Estado del incidente actualizado y trazado.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible actualizar el incidente.';
    }
  }

  protected async recordGovernanceEvidence(): Promise<void> {
    this.notice = '';
    this.error = '';
    try {
      await this.governanceDataService.createEvidence({ ...this.evidenceDraft });
      this.evidenceDraft = {
        type: 'revision_controles', outcome: 'conforme', title: '', owner: '',
        performedAt: '', nextReviewAt: '', notes: '', evidenceUrl: ''
      };
      await this.loadGovernanceDashboard();
      this.notice = 'Evidencia de cumplimiento registrada.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible registrar la evidencia.';
    }
  }

  protected get onboardingFerreterias(): SessionUser[] {
    return this.users
      .filter((user) => user.role === 'ferreteria')
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
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

  protected get pendingProductRequestsCount(): number {
    return this.validationRequests.filter((request) => request.status === 'pendiente').length;
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
    if (section === 'ferreterias') {
      this.closeStoreCatalog();
    }
    if (section === 'productos') {
      this.catalogAdminView = 'productos';
    }
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
    void this.loadAdminMasterCatalog(1);
  }

  protected onMasterSubcategoryFilterChange(): void {
    if (this.masterSubcategoryFilter && !this.familyOptions.some((option) => option.id === this.masterFamilyFilter)) {
      this.masterFamilyFilter = '';
    }
    void this.loadAdminMasterCatalog(1);
  }

  protected onMasterFamilyFilterChange(): void {
    void this.loadAdminMasterCatalog(1);
  }

  protected searchMasterCatalog(): void {
    void this.loadAdminMasterCatalog(1);
  }

  protected clearMasterFilters(): void {
    this.masterSearch = '';
    this.masterCategoryFilter = '';
    this.masterSubcategoryFilter = '';
    this.masterFamilyFilter = '';
    void this.loadAdminMasterCatalog(1);
  }

  protected onMasterPageChange(event: PaginatorState): void {
    this.masterPageSize = event.rows ?? this.masterPageSize;
    void this.loadAdminMasterCatalog((event.page ?? 0) + 1);
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
    await this.ensureMasterDefinitionsLoaded();
    this.selectedMasterProduct = product;
    this.masterDetailReadonly = true;
    this.masterDetailModalOpen = true;
    await this.loadMasterProductDetail(product);
  }

  protected async openMasterProductEdit(product: CatalogProduct): Promise<void> {
    await this.ensureMasterDefinitionsLoaded();
    this.selectedMasterProduct = product;
    this.masterDetailReadonly = false;
    this.masterDetailModalOpen = true;
    await this.loadMasterProductDetail(product);
  }

  protected async openMasterProductCreate(): Promise<void> {
    await this.ensureMasterDefinitionsLoaded();
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
    if ((this.masterDetailDraft.imageUrl.trim() || gallery.length > 0) && !this.validImageRightsDraft()) {
      this.error = 'Completa la procedencia y respaldo de derechos de la imagen. Si contiene marcas de terceros, registra también su autorización.';
      return;
    }
    if (!this.validContentRightsDraft()) {
      this.error = 'Registra la fuente o autorización de la descripción y ficha técnica.';
      return;
    }

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
        imageRights: this.serializeImageRightsDraft(),
        contentRights: this.serializeContentRightsDraft(),
        gallery,
        featureBullets,
        logisticsWeightKg: this.masterDetailDraft.logisticsWeightKg ?? undefined,
        logisticsVolumeM3: this.masterDetailDraft.logisticsVolumeM3 ?? undefined,
        logisticsPalletUnits: this.masterDetailDraft.logisticsPalletUnits ?? undefined,
        descriptionText
      };

      const targetMasterId = this.selectedMasterProduct?.masterProductId || this.selectedMasterProduct?.id;
      const updated = targetMasterId
        ? await this.apiService.updateMasterCatalogProduct(targetMasterId, payload, false)
        : await this.apiService.createMasterCatalogProduct(payload, false);

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
      this.closeMasterProductModal();
      await this.loadAdminMasterCatalog(targetMasterId ? this.masterPage : 1);
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
    if ((this.masterDetailDraft.imageUrl.trim() || this.parseGallery(this.masterDetailDraft.galleryText).length > 0) && !this.validImageRightsDraft()) {
      this.error = 'Completa la procedencia y respaldo de derechos de la imagen antes de crear la ficha.';
      return;
    }
    if (!this.validContentRightsDraft()) {
      this.error = 'Registra la fuente o autorización de la descripción y ficha técnica.';
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
        imageRights: this.serializeImageRightsDraft(),
        contentRights: this.serializeContentRightsDraft(),
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
      await this.apiService.deleteMasterCatalogProduct(product.masterProductId || product.id, false);
      await this.loadAdminMasterCatalog(this.masterPage);
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
        if (this.userModalDraft.role === 'ferreteria') {
          this.error = 'Crea las ferreterías desde su sección para registrar también la ubicación del local.';
          return;
        }
        if (!STRONG_PASSWORD_PATTERN.test(this.userModalDraft.password)) {
          this.error = 'La contraseña debe tener 12 o más caracteres e incluir mayúscula, minúscula, número y símbolo.';
          return;
        }
        const created = await this.authService.adminCreateUser({
          role: this.userModalDraft.role,
          name: this.userModalDraft.displayName.trim(),
          email: this.userModalDraft.email.trim(),
          password: this.userModalDraft.password,
          phone: this.userModalDraft.phone.trim(),
          city: this.userModalDraft.city.trim(),
          commune: this.userModalDraft.commune.trim(),
          address: this.userModalDraft.address.trim(),
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

  protected get ferreteriaRows(): SessionUser[] {
    return this.onboardingFerreterias;
  }

  protected get ferreteriaCityOptions(): string[] {
    return [...new Set(this.ferreteriaRows.map((store) => store.city?.trim()).filter((city): city is string => !!city))]
      .sort((left, right) => left.localeCompare(right));
  }

  protected get ferreteriaCommuneOptions(): string[] {
    const stores = this.storeCityFilter
      ? this.ferreteriaRows.filter((store) => store.city === this.storeCityFilter)
      : this.ferreteriaRows;
    return [...new Set(stores.map((store) => store.commune?.trim()).filter((commune): commune is string => !!commune))]
      .sort((left, right) => left.localeCompare(right));
  }

  protected get filteredFerreteriaRows(): SessionUser[] {
    const query = this.storeSearch.trim().toLowerCase();
    return this.ferreteriaRows.filter((store) => {
      const matchesSearch = !query || [
        store.businessName,
        store.displayName,
        store.email,
        store.rut,
        store.phone
      ].some((value) => value?.toLowerCase().includes(query));
      const matchesCity = !this.storeCityFilter || store.city === this.storeCityFilter;
      const matchesCommune = !this.storeCommuneFilter || store.commune === this.storeCommuneFilter;
      return matchesSearch && matchesCity && matchesCommune;
    });
  }

  protected get paginatedFerreteriaRows(): SessionUser[] {
    const start = (this.storePage - 1) * this.storePageSize;
    return this.filteredFerreteriaRows.slice(start, start + this.storePageSize);
  }

  protected onStoreFiltersChange(): void {
    this.storePage = 1;
  }

  protected onStoreCityChange(): void {
    if (this.storeCommuneFilter && !this.ferreteriaCommuneOptions.includes(this.storeCommuneFilter)) {
      this.storeCommuneFilter = '';
    }
    this.onStoreFiltersChange();
  }

  protected clearStoreFilters(): void {
    this.storeSearch = '';
    this.storeCityFilter = '';
    this.storeCommuneFilter = '';
    this.storePage = 1;
  }

  protected onStorePageChange(event: PaginatorState): void {
    this.storePageSize = event.rows ?? this.storePageSize;
    this.storePage = (event.page ?? 0) + 1;
  }

  protected get filteredSelectedStoreCatalog(): CatalogProduct[] {
    const query = this.selectedStoreCatalogSearch.trim().toLowerCase();
    if (!query) return this.selectedStoreCatalog;
    return this.selectedStoreCatalog.filter((product) =>
      product.name.toLowerCase().includes(query)
      || (product.sku || '').toLowerCase().includes(query)
      || (product.barcode || '').toLowerCase().includes(query)
    );
  }

  protected get paginatedSelectedStoreCatalog(): CatalogProduct[] {
    const start = (this.selectedStoreCatalogPage - 1) * this.selectedStoreCatalogPageSize;
    return this.filteredSelectedStoreCatalog.slice(start, start + this.selectedStoreCatalogPageSize);
  }

  protected openStoreCreate(): void {
    this.storeCreateDraft = this.createEmptyUserModalDraft();
    this.storeCreateDraft.role = 'ferreteria';
    this.storeCreateDraft.accountStatus = 'activo';
    this.storeCreateError = '';
    this.storeCreateLocationMessage = '';
    this.ferreteriaView = 'create';
  }

  protected get storeCreateCommuneOptions(): string[] {
    return communesForCity(this.storeCreateDraft.city);
  }

  protected onStoreCreateCityChange(): void {
    if (!this.storeCreateCommuneOptions.includes(this.storeCreateDraft.commune)) {
      this.storeCreateDraft.commune = '';
    }
  }

  protected async useCurrentLocationForStore(): Promise<void> {
    this.storeCreateError = '';
    this.storeCreateLocationMessage = '';
    this.storeCreateLocating = true;
    try {
      const location = await getCurrentBrowserLocation();
      this.storeCreateDraft.storeLatitude = location.latitude;
      this.storeCreateDraft.storeLongitude = location.longitude;
      this.storeCreateLocationMessage = 'Ubicación capturada. Verifica que corresponda al local antes de crear la cuenta.';
    } catch (error) {
      this.storeCreateError = error instanceof Error ? error.message : 'No fue posible obtener la ubicación.';
    } finally {
      this.storeCreateLocating = false;
    }
  }

  protected async createStore(): Promise<void> {
    const draft = this.storeCreateDraft;
    if (!draft.businessName.trim() || !draft.displayName.trim() || !draft.email.trim()
      || !draft.city || !draft.commune || !draft.address.trim()) {
      this.storeCreateError = 'Completa los datos de acceso, ciudad, comuna y dirección del local.';
      return;
    }
    if (!STRONG_PASSWORD_PATTERN.test(draft.password)) {
      this.storeCreateError = 'La contraseña debe tener 12 o más caracteres e incluir mayúscula, minúscula, número y símbolo.';
      return;
    }
    if (!hasValidCoordinates(draft.storeLatitude, draft.storeLongitude)) {
      this.storeCreateError = 'Captura o ingresa una ubicación válida para habilitar las búsquedas por proximidad.';
      return;
    }

    this.storeCreateSaving = true;
    this.storeCreateError = '';
    this.notice = '';
    try {
      const created = await this.authService.adminCreateUser({
        role: 'ferreteria',
        name: draft.displayName.trim(),
        email: draft.email.trim(),
        password: draft.password,
        phone: draft.phone.trim(),
        city: draft.city.trim(),
        commune: draft.commune.trim(),
        address: draft.address.trim(),
        accountStatus: draft.accountStatus,
        businessName: draft.businessName.trim(),
        rut: draft.rut.trim() || undefined,
        storeLatitude: draft.storeLatitude,
        storeLongitude: draft.storeLongitude as number
      });

      this.notice = `${created.businessName || created.displayName} fue creada correctamente.`;
      this.markUserDataStale();
      await this.ensureUsersLoaded(true);
      await this.inspectStoreCatalog(created);
    } catch (error) {
      this.storeCreateError = error instanceof Error ? error.message : 'No fue posible crear la ferretería.';
    } finally {
      this.storeCreateSaving = false;
    }
  }

  protected async inspectStoreCatalog(store: SessionUser): Promise<void> {
    this.selectedStore = store;
    this.selectedStoreCatalogLabel = store.businessName || store.displayName;
    this.selectedStoreCatalog = [];
    this.selectedStoreCatalogSearch = '';
    this.selectedStoreCatalogPage = 1;
    this.onboardingStoreOwnerId = store.id;
    this.resetOnboardingCatalogTemplate();
    this.ferreteriaView = 'detail';
    this.selectedStoreCatalogLoading = true;
    this.error = '';
    try {
      await this.apiService.refreshFerreteriaCatalogSection(store.id, true);
      this.selectedStoreCatalog = [...this.apiService.getCatalog(store.id)];
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo cargar el catálogo de la ferretería.';
    } finally {
      this.selectedStoreCatalogLoading = false;
    }
  }

  protected closeStoreCatalog(): void {
    this.ferreteriaView = 'list';
    this.selectedStore = null;
    this.selectedStoreCatalogLabel = '';
    this.selectedStoreCatalog = [];
    this.selectedStoreCatalogSearch = '';
    this.selectedStoreCatalogPage = 1;
    this.selectedStoreCatalogLoading = false;
    this.onboardingStoreOwnerId = '';
    this.storeCreateError = '';
    this.resetOnboardingCatalogTemplate();
  }

  protected onSelectedStoreCatalogSearchChange(): void {
    this.selectedStoreCatalogPage = 1;
  }

  protected onSelectedStoreCatalogPageChange(event: PaginatorState): void {
    this.selectedStoreCatalogPageSize = event.rows ?? this.selectedStoreCatalogPageSize;
    this.selectedStoreCatalogPage = (event.page ?? 0) + 1;
  }

  protected async activateStore(store: SessionUser): Promise<void> {
    try {
      const updated = await this.authService.adminUpdateUser(store.id, { accountStatus: 'activo' });
      if (!updated) {
        this.error = 'No fue posible activar la ferreteria.';
        return;
      }
      this.notice = `${updated.businessName || updated.displayName} activada.`;
      this.markUserDataStale();
      await this.ensureSectionData('ferreterias', true);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible activar la ferreteria.';
    }
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


  protected categoryLabel(categoryId: string): string {
    return this.categoryOptions.find((item) => item.id === categoryId)?.name || categoryId;
  }

  protected subcategoryLabel(subcategoryId: string): string {
    return this.apiService.getSubcategoryOptions().find((item) => item.id === subcategoryId)?.name || subcategoryId;
  }

  protected familyLabel(familyId: string): string {
    return this.apiService.getFamilyOptions().find((item) => item.id === familyId)?.name || familyId;
  }

  protected async onOnboardingCatalogFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.onboardingError = '';
    this.onboardingNotice = '';
    this.onboardingFileName = file.name;

    try {
      this.onboardingCsvContent = await catalogFileToCsv(file);
      this.onboardingNotice = `${file.name} está listo para procesar.`;
    } catch (error) {
      this.onboardingFileName = '';
      this.onboardingError = error instanceof Error ? error.message : 'No se pudo leer el archivo.';
    } finally {
      input.value = '';
    }
  }

  protected async downloadOnboardingCatalogTemplate(): Promise<void> {
    try {
      const store = this.onboardingFerreterias.find((user) => user.id === this.onboardingStoreOwnerId);
      const storeName = store?.businessName || store?.displayName || 'ferreteria';
      await downloadCatalogImportTemplate(catalogImportTemplateFileName(storeName));
      this.onboardingError = '';
      this.onboardingNotice = 'Template CotizApp descargado. Pasa la informacion de la ferreteria a la hoja Productos y luego sube ese archivo.';
    } catch (error) {
      this.onboardingError = error instanceof Error ? error.message : 'No se pudo generar el template.';
    }
  }

  protected resetOnboardingCatalogTemplate(): void {
    this.onboardingFileName = '';
    this.onboardingCsvContent = CATALOG_IMPORT_TEMPLATE;
    this.onboardingError = '';
    this.onboardingNotice = '';
  }

  protected async importInitialCatalog(): Promise<void> {
    const store = this.onboardingFerreterias.find((user) => user.id === this.onboardingStoreOwnerId);
    if (!store) {
      this.onboardingError = 'Selecciona una ferreteria.';
      return;
    }
    if (!this.onboardingCsvContent.trim()) {
      this.onboardingError = 'Carga un archivo o pega los datos del catalogo.';
      return;
    }

    this.onboardingLoading = true;
    this.onboardingError = '';
    this.onboardingNotice = '';

    try {
      const response = await this.apiService.importCatalogBatch(
        store.id,
        store.businessName || store.displayName,
        this.onboardingCsvContent,
        {
          categoryId: '',
          subcategoryId: '',
          familyId: '',
          brand: 'Sin marca',
          unitLabel: 'Unidad',
          isPublished: true
        }
      );

      this.onboardingNotice = `Carga inicial procesada para ${store.businessName || store.displayName}: ${response.report.uploadedCount} producto(s) cargados, ${response.report.pendingNewCount + response.report.possibleMatchCount} pendiente(s) de revision y ${response.report.failedCount} fila(s) con error.`;
      await this.apiService.refreshFerreteriaCatalogSection(store.id, true);
      this.selectedStoreCatalog = [...this.apiService.getCatalog(store.id)];
      this.selectedStoreCatalogPage = 1;
    } catch (error) {
      this.onboardingError = error instanceof Error ? error.message : 'No fue posible cargar el catalogo inicial.';
    } finally {
      this.onboardingLoading = false;
    }
  }

  protected goToSection(section: AdminSection): void {
    this.setSection(section);
  }

  protected setCatalogAdminView(view: 'productos' | 'taxonomia'): void {
    if (this.catalogAdminView === view) return;
    this.catalogAdminView = view;
    void this.loadCatalogAdminView(view);
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  protected logout(): void {
    this.closeMobileMenu();
    void this.authService.logout();
    this.router.navigateByUrl('/');
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
    if (!force && this.loadedSections.has(section)) return;

    this.isSectionLoading = true;
    try {
      if (section === 'ferreterias') {
        await this.ensureUsersLoaded(force);
      }

      if (section === 'productos') {
        await this.ensureCatalogAdminViewData(this.catalogAdminView, force);
      }

      if (section === 'solicitudes') {
        await this.apiService.refreshAdminRequestsSection(force);
        this.syncValidationRequestsState();
      }

      if (section === 'contacto') {
        this.contactRequests = await this.apiService.getContactRequestsForAdmin();
      }

      if (section === 'precios') {
        this.priceReports = await this.apiService.getPriceReportsForAdmin();
        this.priceReports.forEach((report) => {
          this.priceResolutionDrafts[report.id] = report.resolution || '';
          this.correctedPriceDrafts[report.id] = report.observedPrice;
        });
      }

      if (section === 'privacidad') {
        this.privacyRequests = await this.privacyDataService.listRequestsForAdmin();
        this.privacyRequests.forEach((request) => {
          this.privacyResolutionDrafts[request.id] = request.resolution || '';
        });
      }

      if (section === 'propiedad') {
        this.ipReports = await this.intellectualPropertyService.listForAdmin();
        this.ipReports.forEach((report) => {
          this.ipResolutionDrafts[report.id] = report.resolution || '';
          this.ipPublicMessageDrafts[report.id] = report.publicStatusMessage || '';
        });
      }

      if (section === 'gobierno') {
        await this.loadGovernanceDashboard();
      }

      if (section === 'usuarios') {
        await this.ensureUsersLoaded(force);
      }

      this.sectionLoadError = '';
      this.loadedSections.add(section);
    } catch (error) {
      this.sectionLoadError = error instanceof Error ? error.message : 'No se pudo cargar esta sección. Intenta nuevamente.';
      this.loadedSections.delete(section);
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

  private async loadGovernanceDashboard(): Promise<void> {
    const dashboard = await this.governanceDataService.dashboard();
    this.governanceSummary = dashboard.summary;
    this.securityIncidents = dashboard.incidents;
    this.governanceEvidence = dashboard.evidence;
    this.adminAuditEntries = dashboard.audit;
  }

  private commaSeparatedValues(value: string): string[] {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  private syncValidationRequestsState(): void {
    this.validationRequests = this.apiService.getCatalogValidationQueue('all')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    this.syncDrafts();
  }

  private async loadCatalogAdminView(view: 'productos' | 'taxonomia', force = false): Promise<void> {
    this.isSectionLoading = true;
    try {
      await this.ensureCatalogAdminViewData(view, force);
    } finally {
      this.isSectionLoading = false;
    }
  }

  private async ensureCatalogAdminViewData(view: 'productos' | 'taxonomia', force = false): Promise<void> {
    if (view === 'productos') {
      if (!force && this.catalogProductsLoaded) return;
      await this.apiService.refreshAdminProductsTaxonomySection(force);
      await this.loadAdminMasterCatalog(1);
      this.catalogProductsLoaded = true;
      return;
    }

    if (!force && this.catalogTaxonomyLoaded) return;
    await this.apiService.refreshAdminTaxonomySection(force);
    this.syncTaxonomySelection();
    this.catalogTaxonomyLoaded = true;
  }

  private async ensureMasterDefinitionsLoaded(): Promise<void> {
    if (this.catalogTaxonomyLoaded) return;
    await this.apiService.refreshAdminTaxonomySection();
    this.catalogTaxonomyLoaded = true;
  }

  private async loadAdminMasterCatalog(page = this.masterPage): Promise<void> {
    this.masterCatalogLoading = true;
    try {
      const result = await this.apiService.getAdminMasterCatalogPage({
        query: this.masterSearch,
        categoryId: this.masterCategoryFilter,
        subcategoryId: this.masterSubcategoryFilter,
        familyId: this.masterFamilyFilter,
        page,
        size: this.masterPageSize
      });
      this.masterCatalog = result.items;
      this.masterPage = result.page;
      this.masterPageSize = result.size;
      this.masterTotal = result.total;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible cargar el catálogo maestro.';
    } finally {
      this.masterCatalogLoading = false;
    }
  }

  private markUserDataStale(): void {
    this.usersLoaded = false;
    this.loadedSections.delete('usuarios');
    this.loadedSections.delete('ferreterias');
  }

  private markValidationDataStale(): void {
    this.loadedSections.delete('solicitudes');
    this.loadedSections.delete('productos');
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
      imageSourceType: '',
      imageProvider: '',
      imageSourceTermsUrl: '',
      imageAuthorizationReference: '',
      imageContainsThirdPartyMarks: false,
      trademarkAuthorizationReference: '',
      contentSourceType: '',
      contentSourceUrl: '',
      contentAuthorizationReference: '',
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
      role: 'maestro',
      accountStatus: 'pendiente',
      phone: '',
      city: '',
      commune: '',
      address: '',
      businessName: '',
      rut: '',
      storeLatitude: null,
      storeLongitude: null
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
      accountStatus: user.accountStatus || 'pendiente',
      phone: user.phone || '',
      city: user.city || '',
      commune: user.commune || '',
      address: user.address || '',
      businessName: user.businessName || '',
      rut: user.rut || '',
      storeLatitude: user.storeLatitude ?? null,
      storeLongitude: user.storeLongitude ?? null
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
      imageSourceType: product.imageRights?.sourceType || '',
      imageProvider: product.imageRights?.provider || '',
      imageSourceTermsUrl: product.imageRights?.sourceTermsUrl || '',
      imageAuthorizationReference: product.imageRights?.authorizationReference || '',
      imageContainsThirdPartyMarks: product.imageRights?.containsThirdPartyMarks === true,
      trademarkAuthorizationReference: product.imageRights?.trademarkAuthorizationReference || '',
      contentSourceType: product.contentRights?.sourceType || '',
      contentSourceUrl: product.contentRights?.sourceUrl || '',
      contentAuthorizationReference: product.contentRights?.authorizationReference || '',
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

  private validImageRightsDraft(): boolean {
    const draft = this.masterDetailDraft;
    if (!draft.imageUrl.trim()) return true;
    if (!draft.imageSourceType || draft.imageProvider.trim().length < 2 || draft.imageAuthorizationReference.trim().length < 3) return false;
    if ((draft.imageSourceType === 'ai_generated' || draft.imageSourceType === 'licensed_stock')
      && !/^https?:\/\//i.test(draft.imageSourceTermsUrl.trim())) return false;
    return !draft.imageContainsThirdPartyMarks || draft.trademarkAuthorizationReference.trim().length >= 3;
  }

  private serializeImageRightsDraft(): NonNullable<CatalogProduct['imageRights']> {
    return {
      sourceType: this.masterDetailDraft.imageSourceType,
      provider: this.masterDetailDraft.imageProvider.trim(),
      sourceTermsUrl: this.masterDetailDraft.imageSourceTermsUrl.trim(),
      authorizationReference: this.masterDetailDraft.imageAuthorizationReference.trim(),
      containsThirdPartyMarks: this.masterDetailDraft.imageContainsThirdPartyMarks,
      trademarkAuthorizationReference: this.masterDetailDraft.trademarkAuthorizationReference.trim()
    };
  }

  private validContentRightsDraft(): boolean {
    return !!this.masterDetailDraft.contentSourceType
      && this.masterDetailDraft.contentAuthorizationReference.trim().length >= 3;
  }

  private serializeContentRightsDraft(): NonNullable<CatalogProduct['contentRights']> {
    return {
      sourceType: this.masterDetailDraft.contentSourceType,
      sourceUrl: this.masterDetailDraft.contentSourceUrl.trim(),
      authorizationReference: this.masterDetailDraft.contentAuthorizationReference.trim()
    };
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
