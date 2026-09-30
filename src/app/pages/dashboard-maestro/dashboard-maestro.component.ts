import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FamilyProductRow, ProjectSummary, SearchProximity, SessionUser, TaxonomyOption } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService } from '../../core/services/mock-api.service';
import {
  GeoCoordinates,
  clearNearbySearchPreference,
  getCurrentBrowserLocation,
  readNearbySearchPreference,
  saveNearbySearchPreference
} from '../../core/utils/location.util';
import { shareQuotationPdf } from '../../core/utils/quotation-pdf.util';
import { DashboardMenuComponent } from '../../shared/components/dashboard-menu/dashboard-menu.component';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';

type MaestroSection = 'inicio' | 'buscar' | 'cotizaciones' | 'historial' | 'perfil';

interface MaestroSectionMeta {
  id: MaestroSection;
  label: string;
  description: string;
}

interface MaestroProfileDraft {
  displayName: string;
  phone: string;
  commune: string;
}

@Component({
  selector: 'app-dashboard-maestro',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardMenuComponent, UiLoaderComponent],
  templateUrl: './dashboard-maestro.component.html',
  styleUrl: './dashboard-maestro.component.scss'
})
export class DashboardMaestroComponent implements OnInit {
  protected readonly maxSavedQuotations = 2;
  protected readonly sections: MaestroSectionMeta[] = [
    { id: 'inicio', label: 'Inicio', description: 'Revisa tus cotizaciones recientes y el ahorro estimado.' },
    { id: 'buscar', label: 'Buscar productos', description: 'Busca materiales y compara precios entre ferreterias activas.' },
    { id: 'cotizaciones', label: 'Mis cotizaciones', description: 'Crea y edita tus listas de materiales.' },
    { id: 'historial', label: 'Historial', description: 'Consulta todas las cotizaciones que has guardado.' },
    { id: 'perfil', label: 'Perfil', description: 'Mantiene tus datos basicos de contacto.' }
  ];

  protected currentSection: MaestroSection = 'inicio';
  protected categorySearch = '';
  protected subcategorySearch = '';
  protected familySearch = '';
  protected tableProductSearch = '';
  protected selectedCategoryId = '';
  protected selectedSubcategoryId = '';
  protected selectedFamilyId = '';
  protected productRows: FamilyProductRow[] = [];
  protected pageSize = 10;
  protected currentPage = 1;
  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly nearbyRadiusOptions = [5, 10, 20, 50];
  protected nearbyEnabled = false;
  protected nearbyRadiusKm = 10;
  protected maestroLocation: GeoCoordinates | null = null;
  protected nearbyMessage = '';
  protected nearbyError = '';
  protected isLocatingNearby = false;

  protected projectTarget = '';
  protected draftProjectName = '';
  protected draftProjectAddress = '';
  protected projects: ProjectSummary[] = [];

  protected profileDraft: MaestroProfileDraft = { displayName: '', phone: '', commune: '' };
  protected profileSaved = false;
  protected profileError = '';
  protected quotationNotice = '';

  protected isInitialLoading = true;
  protected isSectionLoading = false;
  protected isPublicCatalogRefreshing = false;
  protected isMobileViewport = false;
  protected isMobileMenuVisible = false;
  private readonly loadedSections = new Set<MaestroSection>();
  private productSearchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: MockApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.syncViewportState();
    if (!this.user) {
      this.currentSection = 'buscar';
    }
    const savedNearby = readNearbySearchPreference();
    if (savedNearby) {
      this.nearbyEnabled = true;
      this.maestroLocation = {
        latitude: savedNearby.latitude,
        longitude: savedNearby.longitude
      };
      this.nearbyRadiusKm = savedNearby.radiusKm;
      this.nearbyMessage = `Mostrando ferreterias a hasta ${this.nearbyRadiusKm} km de tu ubicacion.`;
    }

    this.route.queryParamMap.subscribe((params) => {
      const requested = params.get('section');
      if (this.isValidSection(requested) && (this.user || requested === 'buscar')) {
        this.currentSection = requested;
      }

      this.projectTarget = params.get('projectTarget') || '';
      this.draftProjectName = params.get('draftName') || '';
      this.draftProjectAddress = params.get('draftAddress') || '';

      if (!this.isInitialLoading) {
        void this.ensureSectionData(this.currentSection);
      }
    });

    this.hydrateProfileDraft();
    void this.initializeDashboard();
  }

  protected get user(): SessionUser | null {
    if (this.route.snapshot.data['publicCatalog']) return null;
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'maestro' ? currentUser : null;
  }

  protected get currentSectionLabel(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.label || '';
  }

  protected get currentSectionDescription(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.description || '';
  }

  protected get categoryOptions(): TaxonomyOption[] {
    return this.apiService.getCategoryOptions();
  }

  protected get subcategoryOptions(): TaxonomyOption[] {
    return this.selectedCategoryId ? this.apiService.getSubcategoryOptions(this.selectedCategoryId) : [];
  }

  protected get familyOptions(): TaxonomyOption[] {
    return this.selectedSubcategoryId ? this.apiService.getFamilyOptions(this.selectedSubcategoryId) : [];
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
    return Math.max(1, Math.ceil(this.productRows.length / this.pageSize));
  }

  protected get paginatedProductRows(): FamilyProductRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.productRows.slice(start, start + this.pageSize);
  }

  protected get pageStart(): number {
    return this.productRows.length === 0 ? 0 : ((this.currentPage - 1) * this.pageSize) + 1;
  }

  protected get pageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.productRows.length);
  }

  protected get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1).slice(
      Math.max(0, this.currentPage - 4),
      Math.max(0, this.currentPage - 4) + 7
    );
  }

  protected get recentProjects(): ProjectSummary[] {
    return this.projects.slice(0, 5);
  }

  protected get totalEstimatedSaving(): number {
    return this.projects.reduce((sum, project) => sum + (project.saving || 0), 0);
  }

  protected get canCreateQuotation(): boolean {
    return this.projects.length < this.maxSavedQuotations;
  }

  protected get quotationLimitText(): string {
    return `${this.projects.length}/${this.maxSavedQuotations} cotizaciones guardadas`;
  }

  protected get currentProximity(): SearchProximity | undefined {
    if (!this.nearbyEnabled || !this.maestroLocation) return undefined;
    return {
      latitude: this.maestroLocation.latitude,
      longitude: this.maestroLocation.longitude,
      radiusKm: this.nearbyRadiusKm
    };
  }

  protected setSection(section: MaestroSection): void {
    this.currentSection = section;
    this.closeMobileMenu();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    void this.ensureSectionData(section);
  }

  protected toggleMobileMenu(): void {
    if (this.isMobileViewport) this.isMobileMenuVisible = !this.isMobileMenuVisible;
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuVisible = false;
  }

  protected async toggleNearbySearch(): Promise<void> {
    this.nearbyError = '';
    this.nearbyMessage = '';

    if (this.nearbyEnabled) {
      this.nearbyEnabled = false;
      this.maestroLocation = null;
      clearNearbySearchPreference();
      this.currentPage = 1;
      this.refreshProductRows();
      return;
    }

    this.isLocatingNearby = true;
    try {
      this.maestroLocation = await getCurrentBrowserLocation();
      this.nearbyEnabled = true;
      this.nearbyMessage = `Mostrando ferreterias a hasta ${this.nearbyRadiusKm} km de tu ubicacion.`;
      saveNearbySearchPreference({
        latitude: this.maestroLocation.latitude,
        longitude: this.maestroLocation.longitude,
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
      ? `Mostrando ferreterias a hasta ${this.nearbyRadiusKm} km de tu ubicacion.`
      : '';
    if (this.nearbyEnabled && this.maestroLocation) {
      saveNearbySearchPreference({
        latitude: this.maestroLocation.latitude,
        longitude: this.maestroLocation.longitude,
        radiusKm: this.nearbyRadiusKm
      });
    }
    this.currentPage = 1;
    this.refreshProductRows();
  }

  protected formatDistance(value: number | undefined): string {
    if (value === undefined) return '';
    if (value < 1) return `${Math.round(value * 1000)} m`;
    return `${value.toFixed(1)} km`;
  }

  protected onCategoryInput(value: string): void {
    this.categorySearch = value;
    const match = this.findByName(this.categoryOptions, value);
    this.selectedCategoryId = match?.id || '';
    this.selectedSubcategoryId = '';
    this.selectedFamilyId = '';
    this.subcategorySearch = '';
    this.familySearch = '';
    this.currentPage = 1;
    this.refreshProductRows();
  }

  protected onSubcategoryInput(value: string): void {
    this.subcategorySearch = value;
    const match = this.findByName(this.subcategoryOptions, value);
    this.selectedSubcategoryId = match?.id || '';
    this.selectedFamilyId = '';
    this.familySearch = '';
    this.currentPage = 1;
    this.refreshProductRows();
  }

  protected onFamilyInput(value: string): void {
    this.familySearch = value;
    const match = this.findByName(this.familyOptions, value);
    this.selectedFamilyId = match?.id || '';
    this.currentPage = 1;
    this.refreshProductRows();
  }

  protected onProductSearchChange(): void {
    this.currentPage = 1;
    if (this.productSearchTimer) {
      clearTimeout(this.productSearchTimer);
    }
    this.productSearchTimer = setTimeout(() => {
      this.productSearchTimer = null;
      this.refreshProductRows();
    }, 180);
  }

  protected clearSearchFilters(): void {
    this.categorySearch = '';
    this.subcategorySearch = '';
    this.familySearch = '';
    this.tableProductSearch = '';
    this.selectedCategoryId = '';
    this.selectedSubcategoryId = '';
    this.selectedFamilyId = '';
    this.currentPage = 1;
    this.refreshProductRows();
  }

  protected onPageSizeChange(value: number | string): void {
    const parsed = Number(value);
    this.pageSize = this.pageSizeOptions.includes(parsed) ? parsed : 10;
    this.currentPage = 1;
  }

  protected previousPage(): void {
    if (this.currentPage > 1) this.currentPage -= 1;
  }

  protected nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage += 1;
  }

  protected goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  protected viewProductDetails(productName: string): void {
    this.router.navigate(['/producto'], {
      queryParams: { product: productName }
    });
  }

  protected addProductToProject(productName: string): void {
    if (!this.projectTarget) return;

    const commands = this.projectTarget === 'nuevo'
      ? ['/dashboard/maestro/cotizaciones/nuevo']
      : ['/dashboard/maestro/cotizaciones', this.projectTarget];

    this.router.navigate(commands, {
      queryParams: {
        addProduct: productName,
        draftName: this.projectTarget === 'nuevo' ? this.draftProjectName : null,
        draftAddress: this.projectTarget === 'nuevo' ? this.draftProjectAddress : null
      }
    });
  }

  protected goToNewProject(): void {
    if (!this.user) {
      this.router.navigate(['/dashboard/maestro/cotizaciones/nuevo']);
      return;
    }
    if (!this.canCreateQuotation) {
      this.quotationNotice = 'Ya tienes 2 cotizaciones guardadas. Elimina una para crear otra.';
      return;
    }
    this.quotationNotice = '';
    this.router.navigate(['/dashboard/maestro/cotizaciones/nuevo']);
  }

  protected goToProjectDetail(projectId: string): void {
    this.router.navigate(['/dashboard/maestro/cotizaciones', projectId]);
  }

  protected async shareProject(project: ProjectSummary): Promise<void> {
    const quotation = this.apiService.buildProjectQuotation(
      project.items,
      project.proximity,
      project.singleStoreName
    );
    if (quotation.lines.length === 0) {
      this.quotationNotice = 'Esta cotizacion no tiene productos para enviar.';
      return;
    }
    if (quotation.lines.some((line) => line.unitPrice <= 0)) {
      this.quotationNotice = project.proximity
        ? `Faltan ofertas con stock dentro de ${project.proximity.radiusKm} km. Amplia el radio antes de enviar.`
        : 'Faltan ofertas con stock para completar esta cotizacion.';
      return;
    }

    try {
      const result = await shareQuotationPdf({
        projectName: project.name,
        projectAddress: project.address || '',
        maestroName: this.user?.displayName || '',
        quotation,
        proximity: project.proximity
      });
      this.quotationNotice = result === 'shared'
        ? 'Cotizacion lista para enviar al cliente.'
        : 'Tu navegador no permite compartir el PDF directamente; se descargo para que puedas enviarlo.';
    } catch (error) {
      this.quotationNotice = error instanceof Error ? error.message : 'No se pudo preparar la cotizacion para enviar.';
    }
  }

  protected async deleteProject(projectId: string): Promise<void> {
    if (!this.user) return;
    await this.apiService.deleteProject(this.user.id, projectId);
    this.loadedSections.delete('inicio');
    this.loadedSections.delete('cotizaciones');
    this.loadedSections.delete('historial');
    await this.ensureSectionData(this.currentSection, true);
  }

  protected async saveProfile(): Promise<void> {
    this.profileSaved = false;
    this.profileError = '';

    if (this.profileDraft.displayName.trim().length < 2) {
      this.profileError = 'Ingresa tu nombre.';
      return;
    }

    try {
      await this.authService.updateProfile({
        displayName: this.profileDraft.displayName.trim(),
        phone: this.profileDraft.phone.trim(),
        commune: this.profileDraft.commune.trim()
      });
      this.profileSaved = true;
      setTimeout(() => this.profileSaved = false, 1800);
    } catch (error) {
      this.profileError = error instanceof Error ? error.message : 'No fue posible guardar tu perfil.';
    }
  }

  protected resetProfileDraft(): void {
    this.profileSaved = false;
    this.profileError = '';
    this.hydrateProfileDraft();
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  protected logout(): void {
    this.closeMobileMenu();
    void this.authService.logout();
    this.router.navigateByUrl('/');
  }

  protected goToLogin(): void {
    this.router.navigate(['/login']);
  }

  private async initializeDashboard(): Promise<void> {
    try {
      await this.ensureSectionData(this.currentSection);
    } finally {
      this.isInitialLoading = false;
    }
  }

  private async ensureSectionData(section: MaestroSection, force = false): Promise<void> {
    const currentUser = this.user;
    if (!force && this.loadedSections.has(section)) return;
    if (!currentUser && section !== 'buscar') return;

    this.isSectionLoading = true;
    try {
      if (section === 'buscar') {
        if (currentUser) {
          await this.apiService.refreshMaestroSearchSection(force);
          this.refreshProductRows();
        } else {
          this.isPublicCatalogRefreshing = true;

          // The service restores browser cache before its first await, so cached
          // products can render immediately while the network refresh continues.
          const initialLoad = this.apiService.refreshPublicCatalogSection(force);
          this.refreshProductRows();

          void initialLoad
            .then(() => {
              this.refreshProductRows();
              return this.apiService.refreshPublicCatalogEnhancements(force);
            })
            .then(() => this.refreshProductRows())
            .catch(() => undefined)
            .finally(() => {
              this.isPublicCatalogRefreshing = false;
            });
        }
      }

      if (currentUser && (section === 'inicio' || section === 'cotizaciones' || section === 'historial')) {
        await this.apiService.refreshMaestroProjectsSection(currentUser.id, force);
        this.projects = [...this.apiService.getProjects(currentUser.id)]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      }

      if (section === 'perfil') {
        this.hydrateProfileDraft();
      }

      this.loadedSections.add(section);
    } finally {
      this.isSectionLoading = false;
    }
  }

  private refreshProductRows(): void {
    const query = this.tableProductSearch.trim();
    this.productRows = this.selectedFamilyId
      ? this.apiService.getFamilyProductRows(this.selectedFamilyId, query, this.currentProximity)
      : this.apiService.getPopularProductRows(query, 100, this.currentProximity);

    this.currentPage = Math.min(this.currentPage, this.totalPages);
  }

  private hydrateProfileDraft(): void {
    const currentUser = this.user;
    if (!currentUser) return;
    this.profileDraft = {
      displayName: currentUser.displayName || '',
      phone: currentUser.phone || '',
      commune: currentUser.commune || ''
    };
  }

  private findByName(options: TaxonomyOption[], value: string): TaxonomyOption | null {
    const normalized = value.trim().toLowerCase();
    return options.find((option) => option.name.toLowerCase() === normalized) || null;
  }

  private isValidSection(value: string | null): value is MaestroSection {
    return value === 'inicio' || value === 'buscar' || value === 'cotizaciones' || value === 'historial' || value === 'perfil';
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
