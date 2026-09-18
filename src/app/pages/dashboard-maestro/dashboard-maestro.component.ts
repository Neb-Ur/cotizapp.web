import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FamilyProductRow, ProjectSummary, SessionUser, TaxonomyOption } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService } from '../../core/services/mock-api.service';
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

  protected projectTarget = '';
  protected draftProjectName = '';
  protected draftProjectAddress = '';
  protected projects: ProjectSummary[] = [];

  protected profileDraft: MaestroProfileDraft = { displayName: '', phone: '', commune: '' };
  protected profileSaved = false;
  protected profileError = '';

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
      const requested = params.get('section');
      if (this.isValidSection(requested)) {
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
    return this.authService.currentUser();
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
    this.refreshProductRows();
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
    this.router.navigate(['/dashboard/maestro/producto-detalle'], { queryParams: { product: productName } });
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
    this.router.navigate(['/dashboard/maestro/cotizaciones/nuevo']);
  }

  protected goToProjectDetail(projectId: string): void {
    this.router.navigate(['/dashboard/maestro/cotizaciones', projectId]);
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

  private async initializeDashboard(): Promise<void> {
    try {
      await this.ensureSectionData(this.currentSection, true);
    } finally {
      this.isInitialLoading = false;
    }
  }

  private async ensureSectionData(section: MaestroSection, force = false): Promise<void> {
    const currentUser = this.user;
    if (!currentUser || (!force && this.loadedSections.has(section))) return;

    this.isSectionLoading = true;
    try {
      if (section === 'buscar') {
        await this.apiService.refreshMaestroSearchSection(force);
        this.refreshProductRows();
      }

      if (section === 'inicio' || section === 'cotizaciones' || section === 'historial') {
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
      ? this.apiService.getFamilyProductRows(this.selectedFamilyId, query)
      : this.apiService.getPopularProductRows(query, 100);

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
