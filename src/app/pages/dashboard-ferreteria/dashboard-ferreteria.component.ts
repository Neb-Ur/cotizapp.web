import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CatalogImportOutcome,
  CatalogImportReport,
  CatalogImportRowResult,
  CatalogProduct,
  SessionUser,
  TaxonomyOption
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService } from '../../core/services/mock-api.service';
import { CATALOG_IMPORT_TEMPLATE, catalogFileToCsv } from '../../core/utils/catalog-import.util';
import { DashboardMenuComponent } from '../../shared/components/dashboard-menu/dashboard-menu.component';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';
import { UiModalComponent } from '../../shared/components/ui-modal/ui-modal.component';

type FerreteriaSection = 'inicio' | 'catalogo' | 'subir' | 'perfil';
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
  imports: [CommonModule, FormsModule, UiModalComponent, UiLoaderComponent, DashboardMenuComponent],
  templateUrl: './dashboard-ferreteria.component.html',
  styleUrl: './dashboard-ferreteria.component.scss'
})
export class DashboardFerreteriaComponent implements OnInit {
  protected readonly sections: FerreteriaSectionMeta[] = [
    { id: 'inicio', label: 'Inicio', description: 'Revisa el estado basico de tu catalogo.' },
    { id: 'catalogo', label: 'Mantener catalogo', description: 'Mantiene precio, stock y publicacion de tus productos.' },
    { id: 'subir', label: 'Agregar productos', description: 'Agrega productos por Excel/CSV o individualmente.' },
    { id: 'perfil', label: 'Perfil', description: 'Mantiene los datos basicos de tu ferreteria.' }
  ];

  protected currentSection: FerreteriaSection = 'inicio';
  protected catalog: CatalogProduct[] = [];
  protected catalogSearch = '';
  protected catalogPage = 1;
  protected catalogPageSize = 20;
  protected readonly catalogPageSizeOptions = [10, 20, 50];

  protected catalogInlineEditId: string | null = null;
  protected catalogInlineDraft = { price: 0, stock: 0, isPublished: true };
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
  protected masterSelectionDrafts: Record<string, MasterCatalogSelectionDraft> = {};
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

  protected requestDraft = { name: '', barcode: '', quantity: 1, price: 0 };
  protected requestError = '';
  protected requestNotice = '';

  protected totalProducts = 0;
  protected lowStock = 0;
  protected avgPrice = 0;

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
  private readonly loadedSections = new Set<FerreteriaSection>();

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: MockApiService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.syncViewportState();
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
    this.closeMobileMenu();
    void this.ensureSectionData(section);
  }

  protected setUploadMode(mode: CatalogUploadMode): void {
    this.uploadMode = mode;
    this.relationError = '';
    this.relationNotice = '';
    this.csvError = '';
    this.csvNotice = '';
    this.requestError = '';
    this.requestNotice = '';
    if (mode === 'buscar') void this.loadMasterCatalog();
  }

  protected goToExcelImport(): void {
    this.currentSection = 'subir';
    this.setUploadMode('archivo');
  }

  protected onCatalogSearchChange(): void {
    this.catalogPage = 1;
  }

  protected onCatalogPageSizeChange(value: number | string): void {
    const parsed = Number(value);
    this.catalogPageSize = this.catalogPageSizeOptions.includes(parsed) ? parsed : 20;
    this.catalogPage = 1;
  }

  protected previousCatalogPage(): void {
    if (this.catalogPage > 1) this.catalogPage -= 1;
  }

  protected nextCatalogPage(): void {
    if (this.catalogPage < this.catalogTotalPages) this.catalogPage += 1;
  }

  protected startCatalogInlineEdit(product: CatalogProduct): void {
    this.catalogInlineEditId = product.id;
    this.catalogInlineDraft = {
      price: product.price,
      stock: product.stock,
      isPublished: product.isPublished
    };
    this.catalogError = '';
  }

  protected cancelCatalogInlineEdit(): void {
    this.catalogInlineEditId = null;
  }

  protected async saveCatalogInlineEdit(product: CatalogProduct): Promise<void> {
    if (!this.user || this.catalogInlineEditId !== product.id) return;

    const price = Math.round(Number(this.catalogInlineDraft.price) || 0);
    const stock = Math.max(0, Math.floor(Number(this.catalogInlineDraft.stock) || 0));
    if (price <= 0) {
      this.catalogError = 'El precio debe ser mayor a 0.';
      return;
    }

    try {
      this.catalog = await this.apiService.upsertCatalog(this.user.id, {
        ...product,
        price,
        stock,
        isPublished: this.catalogInlineDraft.isPublished
      });
      this.cancelCatalogInlineEdit();
      this.refreshSummary();
      this.catalogNotice = 'Precio y stock actualizados.';
      this.catalogError = '';
    } catch (error) {
      this.catalogError = error instanceof Error ? error.message : 'No se pudo actualizar el producto.';
    }
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
  }

  protected previousMasterPage(): void {
    if (this.masterPage > 1) {
      this.masterPage -= 1;
      void this.loadMasterCatalog();
    }
  }

  protected nextMasterPage(): void {
    if (this.masterPage < this.masterTotalPages) {
      this.masterPage += 1;
      void this.loadMasterCatalog();
    }
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

  protected resetCatalogImportTemplate(): void {
    this.catalogFileName = '';
    this.csvContent = CATALOG_IMPORT_TEMPLATE;
    this.csvError = '';
    this.csvNotice = '';
  }

  protected async importCatalogFile(): Promise<void> {
    if (!this.user || !this.csvContent.trim()) return;
    this.csvError = '';
    this.csvNotice = '';

    try {
      const response = await this.apiService.importCatalogBatch(
        this.user.id,
        this.user.businessName || this.user.displayName,
        this.csvContent,
        { categoryId: '', subcategoryId: '', familyId: '', brand: 'Sin marca', unitLabel: 'Unidad', isPublished: true }
      );
      this.catalog = response.catalog;
      this.importSummary = response.report;
      this.importSummaryModalOpen = true;
      this.refreshSummary();
      this.csvNotice = `Procesadas ${response.report.totalRows} fila(s).`;
    } catch (error) {
      this.csvError = error instanceof Error ? error.message : 'No se pudo procesar el archivo.';
    }
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
      this.requestNotice = 'Solicitud enviada a CotizApp para revision.';
      this.requestError = '';
      this.requestDraft = { name: '', barcode: '', quantity: 1, price: 0 };
    } catch (error) {
      this.requestError = error instanceof Error ? error.message : 'No se pudo enviar la solicitud.';
    }
  }

  protected importRows(outcome: CatalogImportOutcome): CatalogImportRowResult[] {
    return this.importSummary?.rows.filter((row) => row.outcome === outcome) || [];
  }

  protected closeImportSummaryModal(): void {
    this.importSummaryModalOpen = false;
  }

  protected async saveProfile(): Promise<void> {
    try {
      await this.authService.updateProfile(this.profileDraft);
      this.profileSaved = true;
      setTimeout(() => this.profileSaved = false, 1800);
    } catch {
      this.profileSaved = false;
    }
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
      if (section === 'inicio' || section === 'catalogo') {
        await this.apiService.refreshFerreteriaCatalogSection(currentUser.id, force);
        this.catalog = this.apiService.getCatalog(currentUser.id);
        this.refreshSummary();
      }

      if (section === 'subir') {
        await this.apiService.refreshFerreteriaUploadSection(currentUser.id, force);
        if (this.uploadMode === 'buscar') await this.loadMasterCatalog();
      }

      if (section === 'perfil') this.syncProfileDraftFromUser();
      this.loadedSections.add(section);
    } finally {
      this.isSectionLoading = false;
    }
  }

  private refreshSummary(): void {
    const published = this.catalog.filter((product) => product.isPublished);
    this.totalProducts = published.length;
    this.lowStock = published.filter((product) => product.stock > 0 && product.stock < 15).length;
    this.avgPrice = published.length
      ? Math.round(published.reduce((sum, product) => sum + product.price, 0) / published.length)
      : 0;
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
      address: currentUser.address || ''
    };
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
