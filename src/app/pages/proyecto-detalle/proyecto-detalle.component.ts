import { PilotService } from '../../core/services/pilot.service';
import { quotationWhatsappUrl } from '../../core/utils/quotation-whatsapp.util';
import { WriteFeedbackService } from '../../core/services/write-feedback.service';
import { DataModeService } from '../../core/services/data-mode.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import {
  ProjectComparisonStrategy,
  ProjectItem,
  ProjectQuotationView,
  SearchProximity,
  SessionUser
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import {
  clearNearbySearchPreference,
  getCurrentBrowserLocation,
  readNearbySearchPreference,
  saveNearbySearchPreference
} from '../../core/utils/location.util';
import { shareQuotationPdf, downloadQuotationPdf } from '../../core/utils/quotation-pdf.util';

@Component({
  selector: 'app-proyecto-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proyecto-detalle.component.html',
  styleUrl: './proyecto-detalle.component.scss'
})
export class ProyectoDetalleComponent implements OnInit {
  private get draftStorageKey(): string { return `cotizapp-project-draft:${this.dataMode.mode()}:${this.user?.id || 'guest'}`; }
  protected projectId = '';
  protected isNewProject = true;
  protected projectName = '';
  protected projectAddress = '';
  protected projectDescription = '';
  protected whatsappNumber = '';
  protected shareNotice = '';
  protected projectItems: ProjectItem[] = [];
  protected isSaving = false;
  protected saveNotice = '';
  protected projectProximity?: SearchProximity;
  protected selectedSingleStoreName = '';
  protected selectedSingleStoreId = '';
  protected singleStoreNotice = '';
  protected readonly nearbyRadiusOptions = [5, 10, 20, 50];
  protected locationNotice = '';
  protected locationError = '';
  protected isLocating = false;

  constructor(private readonly dataMode: DataModeService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly apiService: FirebaseDataService
,
    private readonly writeFeedback: WriteFeedbackService = new WriteFeedbackService(),
    private readonly pilot: PilotService | null = null
  ) {}

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(async ([params, queryParams]) => {
      try {
        const incomingId = params.get('projectId') || 'nuevo';
        const draftName = queryParams.get('draftName') || '';
        const draftAddress = queryParams.get('draftAddress') || '';
        const addProduct = queryParams.get('addProduct') || '';

        const currentUser = this.user;
        if (currentUser) {
          await this.apiService.refreshMaestroData(currentUser.id);
        }

        await this.loadProject(incomingId, draftName, draftAddress);

        if (addProduct.trim()) {
          this.projectItems = [...this.projectItems, { productName: addProduct.trim(), quantity: 1 }];
          this.saveNotice = `Producto agregado: ${addProduct}.`;
          this.persistDraftIfNeeded();
          this.clearAddProductQueryParams();
        }
      } catch (error) {
        this.saveNotice = error instanceof Error ? error.message : 'No se pudo cargar la cotización.';
      }
    });
  }

  protected get user(): SessionUser | null {
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'maestro' ? currentUser : null;
  }

  protected get productOptions(): string[] {
    return this.apiService.getProductOptions({}, this.projectProximity);
  }

  protected get mixedQuotation(): ProjectQuotationView {
    return this.apiService.buildProjectQuotation(this.projectItems, this.projectProximity);
  }

  protected get quotation(): ProjectQuotationView {
    return this.apiService.buildProjectQuotation(
      this.projectItems,
      this.projectProximity,
      this.selectedSingleStoreName || undefined,
      this.selectedSingleStoreId || undefined
    );
  }

  protected get comparisonStrategies(): ProjectComparisonStrategy[] {
    return this.apiService.getProjectComparisonStrategies(
      this.projectItems,
      this.projectAddress,
      this.projectProximity,
      this.quotation.appliedStoreName,
      this.quotation.appliedStoreId
    );
  }

  protected get singleStoreOptions() {
    return this.mixedQuotation.singleStoreOptions;
  }

  protected get hasAppliedSingleStore(): boolean {
    return !!this.quotation.appliedStoreName;
  }

  protected get singleStoreSelectionInvalid(): boolean {
    return !!(this.selectedSingleStoreName || this.selectedSingleStoreId) && this.quotation.selectionAvailable === false;
  }

  protected get proximityEnabled(): boolean {
    return !!this.projectProximity;
  }

  protected get proximityLabel(): string {
    return this.projectProximity
      ? `Cerca de mi · hasta ${this.projectProximity.radiusKm} km`
      : 'Todas las ferreterias';
  }



  protected get hasQuotation(): boolean {
    return this.quotation.lines.length > 0
      && this.quotation.lines.every((line) => line.unitPrice > 0);
  }

  protected get hasItemsInTable(): boolean {
    return this.projectItems.length > 0;
  }

  protected get unavailableItemCount(): number {
    return this.quotation.lines.filter((line) => line.unitPrice <= 0).length;
  }

  protected get validItemCount(): number {
    return this.projectItems.filter((item) => item.productName.trim()).length;
  }

  protected get totalQuantity(): number {
    return this.projectItems.reduce((total, item) => {
      const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
      return total + quantity;
    }, 0);
  }

  protected get totalWithIva(): number {
    return this.quotation.optimalTotal;
  }

  protected removeProjectItem(index: number): void {
    this.projectItems = this.projectItems.filter((_, itemIndex) => itemIndex !== index);
    this.saveNotice = '';
    this.persistDraftIfNeeded();
  }

  protected getRowUnitPrice(item: ProjectItem): number {
    return this.quotation.lines[this.projectItems.indexOf(item)]?.unitPrice || 0;
  }

  protected getRowBestStore(item: ProjectItem): string {
    return this.quotation.lines[this.projectItems.indexOf(item)]?.bestStoreName || 'Sin datos';
  }

  protected getRowTotal(item: ProjectItem): number {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    return this.getRowUnitPrice(item) * quantity;
  }

  protected async saveProject(): Promise<void> {
    await this.writeFeedback.run('proyecto-detalle:saveProject', async () => {
      if (this.isSaving) return;
      this.isSaving = true;
      try {
      const currentUser = this.user;
      if (!currentUser) {
        this.persistDraftIfNeeded();
        await this.router.navigate(['/registro'], {
          queryParams: { returnUrl: '/dashboard/maestro/cotizaciones/nuevo' }
        });
        return;
      }

      const name = this.projectName.trim();
      if (!name) {
        return;
      }

      if (this.isNewProject) {
        try {
          const created = await this.apiService.saveProject(
            currentUser.id,
            name,
            this.projectItems,
            this.projectAddress,
            this.projectProximity,
            this.quotation.appliedStoreName,
            this.quotation.appliedStoreId,
            this.projectDescription
          );
          this.saveNotice = 'Cotizacion creada correctamente.';
          this.clearDraft();
          this.router.navigate(['/dashboard/maestro/cotizaciones', created.id]);
        } catch (error) {
          this.saveNotice = error instanceof Error
            ? error.message
            : 'No se pudo guardar la cotizacion.';
        }
        return;
      }

      const updated = await this.apiService.updateProject(
        currentUser.id,
        this.projectId,
        name,
        this.projectItems,
        this.projectAddress,
        this.projectProximity,
        this.quotation.appliedStoreName,
        this.quotation.appliedStoreId,
        this.projectDescription
      );
      if (!updated) {
        this.saveNotice = 'No se pudo actualizar la cotizacion.';
        return;
      }

      this.saveNotice = 'Cotizacion actualizada correctamente.';
      } catch (error) { this.saveNotice = error instanceof Error ? error.message : 'No se pudo guardar la cotización.'; }
      finally { this.isSaving = false; }

    });
  }

  protected goToSearchForProduct(): void {
    const projectTarget = this.isNewProject ? 'nuevo' : this.projectId;
    this.persistDraftIfNeeded();
    this.syncNearbyPreference();
    this.router.navigate(['/buscar'], {
      queryParams: {
        projectTarget,
        draftName: this.isNewProject ? this.projectName : null,
        draftAddress: this.isNewProject ? this.projectAddress : null
      }
    });
  }

  protected async applySingleStore(storeName: string, storeId?: string): Promise<void> {
    const option = this.singleStoreOptions.find((item) => storeId ? item.storeId === storeId : item.storeName === storeName);
    if (!option) {
      this.singleStoreNotice = 'Esta ferreteria ya no tiene todos los productos disponibles.';
      return;
    }

    const previous = this.selectedSingleStoreName;
    const previousId = this.selectedSingleStoreId;
    this.selectedSingleStoreName = storeName;
    this.selectedSingleStoreId = option.storeId || '';
    this.singleStoreNotice = `${storeName} aplicada a todos los productos de la cotizacion.`;
    this.persistDraftIfNeeded();

    if (!this.isNewProject) {
      const saved = await this.persistExistingPurchaseSelection();
      if (!saved) {
        this.selectedSingleStoreName = previous;
        this.selectedSingleStoreId = previousId;
        this.singleStoreNotice = 'No se pudo guardar la ferreteria seleccionada.';
      }
    }
  }

  protected async useMixedPurchase(): Promise<void> {
    if (!this.selectedSingleStoreName && !this.selectedSingleStoreId) return;

    const previous = this.selectedSingleStoreName;
    const previousId = this.selectedSingleStoreId;
    this.selectedSingleStoreName = '';
    this.selectedSingleStoreId = '';
    this.singleStoreNotice = 'Volviste a la compra combinada de menor precio.';
    this.persistDraftIfNeeded();

    if (!this.isNewProject) {
      const saved = await this.persistExistingPurchaseSelection();
      if (!saved) {
        this.selectedSingleStoreName = previous;
        this.selectedSingleStoreId = previousId;
        this.singleStoreNotice = 'No se pudo actualizar la estrategia de compra.';
      }
    }
  }

  protected singleStoreDifference(total: number): number {
    return Math.max(0, total - this.mixedQuotation.mixedTotal);
  }

  protected async toggleProjectProximity(): Promise<void> {
    this.locationError = '';
    this.locationNotice = '';

    if (this.projectProximity) {
      this.projectProximity = undefined;
      clearNearbySearchPreference();
      this.locationNotice = 'La cotizacion ahora considera todas las ferreterias.';
      this.persistDraftIfNeeded();
      return;
    }

    this.isLocating = true;
    try {
      const current = await getCurrentBrowserLocation();
      const saved = readNearbySearchPreference();
      const radiusKm = saved?.radiusKm && this.nearbyRadiusOptions.includes(saved.radiusKm)
        ? saved.radiusKm
        : 10;

      this.projectProximity = {
        latitude: current.latitude,
        longitude: current.longitude,
        radiusKm
      };
      this.syncNearbyPreference();
      this.locationNotice = `La cotizacion ahora considera ferreterias a hasta ${radiusKm} km.`;
      this.persistDraftIfNeeded();
    } catch (error) {
      this.locationError = error instanceof Error ? error.message : 'No se pudo obtener tu ubicacion.';
    } finally {
      this.isLocating = false;
    }
  }

  protected onProjectRadiusChange(value: number | string): void {
    if (!this.projectProximity) return;
    const parsed = Number(value);
    const radiusKm = this.nearbyRadiusOptions.includes(parsed) ? parsed : 10;
    this.projectProximity = {
      ...this.projectProximity,
      radiusKm
    };
    this.syncNearbyPreference();
    this.locationNotice = `Radio actualizado a ${radiusKm} km. Guarda la cotizacion para conservar el cambio.`;
    this.persistDraftIfNeeded();
  }

  protected async shareQuotation(): Promise<void> {
    if (!this.hasQuotation || this.isNewProject) {
      return;
    }

    try {
      const result = await shareQuotationPdf({
        projectName: this.projectName.trim() || 'Cotizacion',
        projectAddress: this.projectAddress,
      projectDescription: this.projectDescription,
      pilot: this.pilot?.enabled() === true,
        maestroName: this.user?.displayName || '',
        quotation: this.quotation,
        proximity: this.projectProximity
      });

      if (result === 'cancelled') return;
      this.saveNotice = result === 'shared'
        ? 'Cotizacion lista para enviar al cliente.'
        : 'El PDF se descargo para que puedas enviarlo al cliente.';
    } catch (error) {
      this.saveNotice = error instanceof Error
        ? error.message
        : 'No se pudo preparar la cotizacion para enviar.';
    }
  }

  protected sendViaWhatsapp(): void {
    if (!this.hasQuotation) return;
    try {
      const url = quotationWhatsappUrl(this.whatsappNumber, this.projectName, this.formatCurrency(this.totalWithIva), this.pilot?.enabled() === true);
      downloadQuotationPdf({projectName:this.projectName, projectAddress:this.projectAddress, projectDescription:this.projectDescription,
        maestroName:this.user?.displayName || '', quotation:this.quotation, proximity:this.projectProximity, pilot:this.pilot?.enabled() === true});
      window.open(url, '_blank', 'noopener,noreferrer');
      this.shareNotice = 'PDF descargado. Adjunta el archivo en WhatsApp y revisa el mensaje antes de enviarlo.';
    } catch (error) { this.shareNotice = error instanceof Error ? error.message : 'No se pudo preparar el envío.'; }
  }

  protected exportQuotation(): void {
    if (!this.hasQuotation) {
      return;
    }

    try { downloadQuotationPdf({
      projectName: this.projectName.trim() || 'Cotizacion',
      projectAddress: this.projectAddress,
      projectDescription: this.projectDescription,
      pilot: this.pilot?.enabled() === true,
      maestroName: this.user?.displayName || '',
      quotation: this.quotation,
      proximity: this.projectProximity
    });
    } catch (error) { this.saveNotice = error instanceof Error ? error.message : 'No se pudo exportar la cotización.'; }
  }

  protected backToProjects(): void {
    this.persistDraftIfNeeded();
    this.router.navigate(['/dashboard/maestro'], {
      queryParams: { section: this.user ? 'cotizaciones' : 'buscar' }
    });
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  private async loadProject(projectId: string, draftName = '', draftAddress = ''): Promise<void> {
    this.saveNotice = '';
    this.projectId = projectId;
    this.isNewProject = projectId === 'nuevo';

    if (this.isNewProject) {
      const draft = this.readDraft();
      const nearbyPreference = readNearbySearchPreference();
      this.projectName = draftName || draft?.name || '';
      this.projectAddress = draftAddress || draft?.address || '';
      this.projectDescription = draft?.description || '';
      this.projectItems = (draft?.items || []).map((item) => ({
        ...item,
          productName: item.productName,
        quantity: item.quantity
      }));
      this.projectProximity = draft?.proximity || nearbyPreference || undefined;
      this.selectedSingleStoreName = draft?.singleStoreName || '';
      this.selectedSingleStoreId = draft?.singleStoreId || '';
      return;
    }

    const currentUser = this.user;
    if (!currentUser) {
      return;
    }

    const project = this.apiService.getProjectById(currentUser.id, projectId);
    if (!project) {
      await this.apiService.refreshMaestroData(currentUser.id);
      const refreshed = this.apiService.getProjectById(currentUser.id, projectId);
      if (!refreshed) {
        this.backToProjects();
        return;
      }
      this.projectName = refreshed.name;
      this.projectAddress = refreshed.address || '';
      this.projectDescription = refreshed.description || '';
      this.projectProximity = refreshed.proximity;
      this.selectedSingleStoreName = refreshed.singleStoreName || '';
      this.selectedSingleStoreId = refreshed.singleStoreId || '';
      this.syncNearbyPreference();
      this.projectItems = refreshed.items.map((item) => ({
        ...item,
          productName: item.productName,
        quantity: item.quantity
      }));
      return;
    }

    this.projectName = project.name;
    this.projectAddress = project.address || '';
    this.projectDescription = project.description || '';
    this.projectProximity = project.proximity;
    this.selectedSingleStoreName = project.singleStoreName || '';
    this.selectedSingleStoreId = project.singleStoreId || '';
    this.syncNearbyPreference();
    this.projectItems = project.items.map((item) => ({
      ...item,
          productName: item.productName,
      quantity: item.quantity
    }));
  }



  private persistDraftIfNeeded(): void {
    if (!this.isNewProject || typeof window === 'undefined') {
      return;
    }

    const payload = {
      name: this.projectName,
      address: this.projectAddress,
      description: this.projectDescription,
      items: this.projectItems,
      proximity: this.projectProximity,
      singleStoreId: this.quotation.appliedStoreId,
      singleStoreName: this.quotation.appliedStoreName
    };
    window.localStorage.setItem(this.draftStorageKey, JSON.stringify(payload));
  }

  private readDraft(): {
    name: string;
    address: string;
    description?: string;
    items: ProjectItem[];
    proximity?: SearchProximity;
    singleStoreName?: string;
    singleStoreId?: string;
  } | null {
    if (typeof window === 'undefined') {
      return null;
    }

    window.localStorage.removeItem('construcomparador-project-draft');
    const raw = window.localStorage.getItem(this.draftStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as {
        name: string;
        address: string;
        description?: string;
        items: ProjectItem[];
        proximity?: SearchProximity;
        singleStoreName?: string;
        singleStoreId?: string;
      };
    } catch {
      return null;
    }
  }

  private clearDraft(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(this.draftStorageKey);
  }

  private async persistExistingPurchaseSelection(): Promise<boolean> {
    const currentUser = this.user;
    if (!currentUser || this.isNewProject) return true;

    const updated = await this.apiService.updateProject(
      currentUser.id,
      this.projectId,
      this.projectName.trim() || 'Cotizacion',
      this.projectItems,
      this.projectAddress,
      this.projectProximity,
      this.quotation.appliedStoreName,
      this.quotation.appliedStoreId,
      this.projectDescription
    );

    return !!updated;
  }

  private syncNearbyPreference(): void {
    if (!this.projectProximity) {
      clearNearbySearchPreference();
      return;
    }

    saveNearbySearchPreference({
      latitude: this.projectProximity.latitude,
      longitude: this.projectProximity.longitude,
      radiusKm: this.projectProximity.radiusKm
    });
  }

  private clearAddProductQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParamsHandling: 'merge',
      queryParams: {
        addProduct: null,
        draftName: null,
        draftAddress: null
      }
    });
  }
}
