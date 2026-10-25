import {QuotationStatusComponent} from '../../shared/components/quotation-status/quotation-status.component';
import {quotationStatus,type QuotationStatus} from '../../core/utils/quotation-workflow.util';
import {WorkBudgetEditorComponent} from '../../shared/components/work-budget-editor/work-budget-editor.component';
import {PaintingCalculatorComponent} from '../../shared/components/painting-calculator/painting-calculator.component';
import {emptyWorkBudget,restoreWorkBudgetDraft,normalizeWorkBudget,normalizePaintingPlan,calculatePainting,workBudgetTotals,paintingTemplatePending,type WorkBudget,type PaintingPlan} from '../../core/utils/work-budget.util';
import { productPath } from '../../core/utils/product-url.util';
import { offerConditionLabel } from '../../core/utils/offer-condition.util';
import { GuestQuotationService } from '../../core/services/guest-quotation.service';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';
import { InfoPanelComponent } from '../../shared/components/info-panel/info-panel.component';
import { PilotService } from '../../core/services/pilot.service';
import { quotationWhatsappUrl } from '../../core/utils/quotation-whatsapp.util';
import { WriteFeedbackService } from '../../core/services/write-feedback.service';
import { DataModeService } from '../../core/services/data-mode.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import {
  ProjectComparisonStrategy,
  ProjectItem,
  ProjectQuotationView,
  SearchProximity,
  SavedQuotationOffer,
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
import { QuotationPdfService } from '../../core/services/quotation-pdf.service';

@Component({
  selector: 'app-proyecto-detalle',
  standalone: true,
  imports: [QuotationStatusComponent,WorkBudgetEditorComponent, PaintingCalculatorComponent, UiLoaderComponent, InfoPanelComponent, CommonModule, FormsModule],
  templateUrl: './proyecto-detalle.component.html',
  styleUrl: './proyecto-detalle.component.scss'
})
export class ProyectoDetalleComponent implements OnInit, OnDestroy {
  protected readonly conditionLabel = offerConditionLabel;
  protected isLoading = true;
  protected loadError = '';
  private loadGeneration = 0;
  private importedGuestId = '';
  private handledDownloadIntent = false;
  private pendingQueryCleanupProjectId = '';
  protected isPreparingPdf = false;
  protected get isLocalQuotation(): boolean { return this.route.snapshot?.data?.['localQuotation'] === true; }
  private routeSubscription?: Subscription;
  private get draftStorageKey(): string { return `cotizapp-project-draft:${this.dataMode.mode()}:${this.user?.id || 'guest'}`; }
  protected workflowStatus:QuotationStatus='draft';
  protected workflowUpdatedAt='';
  protected statusBusy=false;
  protected workflowNotice='';
  protected get copyNotice(){return this.route.snapshot?.queryParamMap?.get('duplicada')==='1' ? 'Esta copia es un borrador con precios actuales. Completa cliente y dirección, y revisa cantidades y costos antes de enviarla.' : '';}
  protected async changeStatus(status:QuotationStatus):Promise<void>{
    if(this.isNewProject || this.isSaving || this.statusBusy)return;
    if(this.hasUnsavedChanges){this.workflowNotice='Guarda los cambios antes de actualizar el seguimiento.';return;}
    if((status==='sent'||status==='accepted')&&!this.hasQuotation){this.workflowNotice='Completa los materiales y costos antes de marcarla enviada o aceptada.';return;}
    const requestedProjectId=this.projectId;const ownerId=this.user?.id;
    this.statusBusy=true;this.workflowNotice='';
    try{
      if(this.isLocalQuotation){
        const updated=this.guestQuotations?.update(this.projectId,{workflowStatus:status});
        if(!updated)throw new Error('No encontramos esta cotización.');
        this.workflowStatus=quotationStatus(updated.workflowStatus);this.workflowUpdatedAt=updated.workflowUpdatedAt || '';
      }else if(this.user){
        const updated=await this.apiService.updateProjectStatus(this.user.id,this.projectId,status,this.workflowStatus,this.verificationCode);
        if(this.projectId!==requestedProjectId || this.user?.id!==ownerId)return;
        this.workflowStatus=quotationStatus(updated.workflowStatus);this.workflowUpdatedAt=updated.workflowUpdatedAt || '';
      }
      this.workflowNotice='Estado actualizado. No se envió ningún mensaje al cliente.';
    }catch(error){this.workflowNotice=error instanceof Error?error.message:'No se pudo cambiar el estado.';}
    finally{this.statusBusy=false;this.changeDetector?.markForCheck();}
  }
  protected projectId = '';
  protected isNewProject = true;
  protected projectName = '';
  protected projectAddress = '';
  protected projectDescription = '';
  protected workBudget:WorkBudget=emptyWorkBudget();
  protected paintingPlan?:PaintingPlan;
  protected get paintProducts(){return this.apiService.getMasterCatalogProducts?.() || [];}
  protected get showPaintingCalculator(){return this.route.snapshot?.queryParamMap?.get('herramienta') === 'pintura';}
  protected get budgetTotals(){try{return workBudgetTotals(this.totalWithIva,this.workBudget);}catch{return null;}}
  protected get budgetError(){try{normalizeWorkBudget(this.workBudget);return '';}catch(error){return error instanceof Error?error.message:'Revisa el presupuesto.';}}
  protected get customerTotal(){return this.workBudget.enabled ? this.budgetTotals?.total || 0 : this.totalWithIva;}
  protected async applyPaintingPlan(plan:PaintingPlan):Promise<void>{
    if(this.isSaving)return;
    const normalized=normalizePaintingPlan(plan)!;
    const calculation=calculatePainting(normalized);
    this.paintingPlan=normalized;
    this.projectItems=[...this.projectItems.filter(item=>item.calculationSource!=='painting'),{productName:normalized.productName,productoMaestroId:normalized.productId,quantity:calculation.packages,calculationSource:'painting'}];
    this.persistDraftIfNeeded();
    this.saveNotice='Pintura agregada. Revisa los materiales, precios y disponibilidad.';
    if(!this.isNewProject&&!this.isLocalQuotation)await this.saveProject(false,false);
  }

  protected pricingOffers?: SavedQuotationOffer[];
  protected validUntil = '';
  protected pricesCapturedAt = '';
  protected verificationCode = '';
  private savedFingerprint = '';
  private quotationFingerprint():string {return JSON.stringify([this.projectName,this.projectAddress,this.projectDescription,this.workBudget,this.paintingPlan,this.projectItems,this.projectProximity,this.selectedSingleStoreName,this.selectedSingleStoreId]);}
  protected get hasUnsavedChanges():boolean {return !this.isNewProject && this.savedFingerprint !== this.quotationFingerprint();}
  protected async copyVerificationCode():Promise<void>{try{await navigator.clipboard.writeText(this.verificationCode);this.saveNotice='Código copiado.';}catch{this.saveNotice='Puedes seleccionar y copiar el código visible.';}}
  protected get quotationExpired(): boolean { return !!this.validUntil && Date.parse(this.validUntil) <= Date.now(); }
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
    private readonly pilot: PilotService | null = null,
    private readonly changeDetector: ChangeDetectorRef | null = null,
    private readonly guestQuotations: GuestQuotationService | null = null,
    private readonly pdf: QuotationPdfService = new QuotationPdfService()
  ) {}

  ngOnInit(): void {
    this.routeSubscription = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, queryParams]) => {
      const projectId = params.get('projectId') || 'nuevo';
      if (projectId === this.pendingQueryCleanupProjectId && !queryParams.get('addProduct')
        && !queryParams.get('draftName') && !queryParams.get('draftAddress')) {
        this.pendingQueryCleanupProjectId = '';
        return;
      }
      this.pendingQueryCleanupProjectId = '';
      void this.loadQuotation(projectId, queryParams.get('draftName') || '',
        queryParams.get('draftAddress') || '', queryParams.get('addProduct') || '');
    });
  }

  protected retryLoad(): void {
    void this.loadQuotation(this.route.snapshot.paramMap.get('projectId') || 'nuevo',
      this.route.snapshot.queryParamMap.get('draftName') || '', this.route.snapshot.queryParamMap.get('draftAddress') || '',
      this.route.snapshot.queryParamMap.get('addProduct') || '');
  }

  private async loadQuotation(incomingId: string, draftName = '', draftAddress = '', addProduct = ''): Promise<void> {
    const generation = ++this.loadGeneration;
    this.isLoading = true; this.loadError = '';
    this.projectId = incomingId; this.isNewProject = incomingId === 'nuevo';
    this.changeDetector?.markForCheck();
    try {
      const currentUser = this.user;
      if (currentUser) await this.apiService.refreshMaestroData(currentUser.id);
      else await this.apiService.refreshPublicCatalogSection(true);
      if (generation !== this.loadGeneration) return;
      await this.loadProject(incomingId, draftName, draftAddress);
      if (generation !== this.loadGeneration) return;
      if (addProduct.trim()) {
        const projectTarget = `${this.isLocalQuotation ? 'local:' : ''}${this.isNewProject ? 'nuevo' : this.projectId}`;
        void this.router.navigate([productPath(addProduct.trim())], {queryParams:{projectTarget,draftName:this.isNewProject?this.projectName:null,draftAddress:this.isNewProject?this.projectAddress:null}});
      }
      if (this.user && this.route.snapshot?.queryParamMap?.get('descargar') === '1' && !this.handledDownloadIntent) {
        this.handledDownloadIntent = true;
        await this.exportQuotation();
      }
    } catch (error) {
      if (generation === this.loadGeneration) this.loadError = error instanceof Error ? error.message : 'No se pudo cargar la cotización.';
    } finally {
      if (generation === this.loadGeneration) { this.isLoading = false; this.changeDetector?.markForCheck(); }
    }
  }

  ngOnDestroy(): void { this.loadGeneration++; this.routeSubscription?.unsubscribe(); }

  protected get user(): SessionUser | null {
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'maestro' ? currentUser : null;
  }

  protected get productOptions(): string[] {
    return this.apiService.getProductOptions({}, this.projectProximity);
  }

  protected get mixedQuotation(): ProjectQuotationView {
    return this.apiService.buildProjectQuotation(this.projectItems, this.projectProximity, undefined, undefined, this.pricingOffers);
  }

  protected get quotation(): ProjectQuotationView {
    return this.apiService.buildProjectQuotation(
      this.projectItems,
      this.projectProximity,
      this.selectedSingleStoreName || undefined,
      this.selectedSingleStoreId || undefined,
      this.pricingOffers
    );
  }

  protected get comparisonStrategies(): ProjectComparisonStrategy[] {
    return this.apiService.getProjectComparisonStrategies(
      this.projectItems,
      this.projectAddress,
      this.projectProximity,
      this.quotation.appliedStoreName,
      this.quotation.appliedStoreId,
      this.pricingOffers
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
      : 'Todos los locales';
  }



  protected get hasQuotation(): boolean {
    return !this.budgetError && !paintingTemplatePending(this.workBudget) && (this.quotation.lines.length > 0 || (this.workBudget.enabled && this.customerTotal > 0))
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
    if(this.projectItems[index]?.calculationSource==='painting')this.paintingPlan=undefined;
    this.projectItems = this.projectItems.filter((_, itemIndex) => itemIndex !== index);
    this.saveNotice = '';
    this.persistDraftIfNeeded();
  }

  protected onProductChange(item:ProjectItem):void {
    const product=this.paintProducts.find(p=>p.name===item.productName);
    item.productoMaestroId=product?.masterProductId || product?.id;
    item.productoFerreteriaId=undefined;item.storeId=undefined;item.storeName=undefined;
    if(item.calculationSource==='painting'){item.calculationSource=undefined;this.paintingPlan=undefined;}
    this.persistDraftIfNeeded();
  }

  protected getRowUnitPrice(item: ProjectItem): number {
    return this.quotation.lines[this.projectItems.indexOf(item)]?.unitPrice || 0;
  }

  protected getRowCondition(item: ProjectItem): string {
    return this.conditionLabel(this.quotation.lines[this.projectItems.indexOf(item)]?.condition);
  }

  protected getRowBestStore(item: ProjectItem): string {
    return this.quotation.lines[this.projectItems.indexOf(item)]?.bestStoreName || 'Sin datos';
  }

  protected getRowTotal(item: ProjectItem): number {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    return this.getRowUnitPrice(item) * quantity;
  }

  protected async saveProject(renewPrices = false, navigateAfterSave = true): Promise<void> {
    await this.writeFeedback.run('proyecto-detalle:saveProject', async () => {
      if (this.isSaving || this.statusBusy) return;
      if(this.budgetError){this.saveNotice=this.budgetError;return;}
      this.isSaving = true;
      try {
      const currentUser = this.user;
      if (currentUser && this.isLocalQuotation && this.isNewProject) {
        this.persistDraftIfNeeded();
        await this.router.navigate(['/dashboard/maestro/cotizaciones/nuevo']);
        return;
      }
      if (this.isLocalQuotation || !currentUser) {
        if (!this.guestQuotations) return;
        const data = { workflowStatus:'draft' as const, name: this.projectName.trim() || 'Mi cotización', address: this.projectAddress,
          description: this.projectDescription, workBudget:this.workBudget, paintingPlan:this.paintingPlan, items: this.projectItems, proximity: this.projectProximity,
          singleStoreName: this.selectedSingleStoreName, singleStoreId: this.selectedSingleStoreId,
          totalOptimal: this.totalWithIva, saving: this.quotation.mixedSaving };
        if (this.isNewProject) {
          const created = this.guestQuotations.create(data.name, data.address, data.items);
          this.guestQuotations.update(created.id, data); this.clearDraft();
          this.workflowStatus=quotationStatus(created.workflowStatus);this.workflowUpdatedAt=created.workflowUpdatedAt || '';
          this.projectId = created.id; this.isNewProject = false; this.workBudget=normalizeWorkBudget(created.workBudget ?? this.workBudget);
          this.savedFingerprint = this.quotationFingerprint();
          if (navigateAfterSave) void this.router.navigate(['/cotizaciones/local', created.id]);
        } else { this.guestQuotations.update(this.projectId, data); this.savedFingerprint = this.quotationFingerprint(); }
        this.workflowStatus='draft';this.workflowUpdatedAt=new Date().toISOString();
        this.saveNotice = 'Cotización guardada en este navegador como borrador.';
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
            this.projectDescription, this.workBudget, this.paintingPlan ?? null
          );
          this.saveNotice = 'Cotizacion creada correctamente.';
          this.clearDraft();
          if (this.importedGuestId) this.guestQuotations?.remove(this.importedGuestId);
          this.workflowStatus=quotationStatus(created.workflowStatus);this.workflowUpdatedAt=created.workflowUpdatedAt || '';
          this.projectId = created.id; this.isNewProject = false;
          this.verificationCode = created.verificationCode || ''; this.validUntil = created.validUntil || '';
          this.pricesCapturedAt = created.pricesCapturedAt || ''; this.pricingOffers = created.pricingOffers;
          this.workBudget=normalizeWorkBudget(created.workBudget ?? this.workBudget);
          this.savedFingerprint = this.quotationFingerprint();
          if (navigateAfterSave) this.router.navigate(['/dashboard/maestro/cotizaciones', created.id]);
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
        this.projectDescription,
        renewPrices, this.workBudget, this.paintingPlan ?? null
      );
      if (!updated) {
        this.saveNotice = 'No se pudo actualizar la cotizacion.';
        return;
      }

      this.workflowStatus=quotationStatus(updated.workflowStatus);this.workflowUpdatedAt=updated.workflowUpdatedAt || '';
      this.workBudget=normalizeWorkBudget(updated.workBudget ?? this.workBudget);
      this.verificationCode = updated.verificationCode || "";
      this.pricingOffers = updated.pricingOffers;
      this.validUntil = updated.validUntil || '';
      this.pricesCapturedAt = updated.pricesCapturedAt || '';
      this.savedFingerprint = this.quotationFingerprint();
      this.saveNotice = renewPrices ? 'Precios de la cotización actualizados.' : 'Cotización actualizada conservando los precios guardados.';
      } catch (error) { this.saveNotice = error instanceof Error ? error.message : 'No se pudo guardar la cotización.'; }
      finally { this.isSaving = false; }

    });
  }

  protected async goToSearchForProduct(): Promise<void> {
    if (this.isSaving) return;
    if (this.isNewProject || this.hasUnsavedChanges) {
      if (!this.projectName.trim()) this.projectName = 'Mi cotización';
      await this.saveProject(false, false);
      if (this.isNewProject || this.hasUnsavedChanges) return;
    }
    const projectTarget = this.isLocalQuotation ? `local:${this.isNewProject ? 'nuevo' : this.projectId}` : (this.isNewProject ? 'nuevo' : this.projectId);
    this.persistDraftIfNeeded();
    clearNearbySearchPreference();
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
      this.singleStoreNotice = 'Este local ya no tiene todos los productos disponibles.';
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
        this.singleStoreNotice = 'No se pudo guardar el local seleccionado.';
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
      this.locationNotice = 'La cotizacion ahora considera todos los locales.';
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
      this.locationNotice = `La cotizacion ahora considera locales hasta ${radiusKm} km.`;
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
    if (!await this.preparePdf()) return;

    try {
      const result = await this.pdf.share({
        projectName: this.projectName.trim() || 'Cotizacion',
        projectAddress: this.projectAddress,
      projectDescription: this.projectDescription, workBudget:this.workBudget, paintingPlan:this.paintingPlan,
      validUntil: this.validUntil || undefined,
      verificationCode: this.verificationCode || undefined,
      pricesCapturedAt: this.pricesCapturedAt || undefined,
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
    if (!this.user || this.isLocalQuotation || !this.hasQuotation || this.isNewProject || this.hasUnsavedChanges) return;
    try {
      const url = quotationWhatsappUrl(this.whatsappNumber, this.projectName, this.formatCurrency(this.customerTotal), this.pilot?.enabled() === true, this.validUntil || undefined, this.verificationCode || undefined, this.workBudget.enabled);
      this.pdf.download({projectName:this.projectName, projectAddress:this.projectAddress, projectDescription:this.projectDescription, workBudget:this.workBudget, paintingPlan:this.paintingPlan, verificationCode:this.verificationCode || undefined, validUntil:this.validUntil || undefined, pricesCapturedAt:this.pricesCapturedAt || undefined,
        maestroName:this.user?.displayName || '', quotation:this.quotation, proximity:this.projectProximity, pilot:this.pilot?.enabled() === true});
      window.open(url, '_blank', 'noopener,noreferrer');
      this.shareNotice = 'PDF descargado. Adjunta el archivo en WhatsApp y revisa el mensaje antes de enviarlo.';
    } catch (error) { this.shareNotice = error instanceof Error ? error.message : 'No se pudo preparar el envío.'; }
  }

  protected async exportQuotation(): Promise<void> {
    if (this.isPreparingPdf) return;
    this.isPreparingPdf = true;
    try {
      if (!await this.preparePdf()) return;
      this.pdf.download({
      projectName: this.projectName.trim() || 'Cotizacion',
      projectAddress: this.projectAddress,
      projectDescription: this.projectDescription, workBudget:this.workBudget, paintingPlan:this.paintingPlan,
      validUntil: this.validUntil || undefined,
      verificationCode: this.verificationCode || undefined,
      pricesCapturedAt: this.pricesCapturedAt || undefined,
      pilot: this.pilot?.enabled() === true,
      maestroName: this.user?.displayName || '',
      quotation: this.quotation,
      proximity: this.projectProximity
    });
    } catch (error) { this.saveNotice = error instanceof Error ? error.message : 'No se pudo exportar la cotización.'; }
    finally { this.isPreparingPdf = false; this.changeDetector?.markForCheck(); }
  }

  private async preparePdf(): Promise<boolean> {
    if (this.isSaving || this.statusBusy || !this.hasQuotation) return false;
    if (!this.user || this.isLocalQuotation) {
      if (!this.guestQuotations) return false;
      this.persistDraftIfNeeded();
      let guestId = this.isLocalQuotation && !this.isNewProject ? this.projectId : this.importedGuestId;
      const data = { workflowStatus:'draft' as const, name: this.projectName.trim() || 'Mi cotización', address: this.projectAddress,
        description: this.projectDescription, workBudget:this.workBudget, paintingPlan:this.paintingPlan, items: this.projectItems, proximity: this.projectProximity,
        singleStoreName: this.selectedSingleStoreName, singleStoreId: this.selectedSingleStoreId };
      if (!guestId) guestId = this.guestQuotations.create(data.name, data.address, data.items).id;
      this.guestQuotations.update(guestId, data);
      const returnUrl = `/dashboard/maestro/cotizaciones/nuevo?cotizacionLocal=${encodeURIComponent(guestId)}&descargar=1`;
      if (this.user) await this.router.navigateByUrl(returnUrl);
      else await this.router.navigate(['/login'], { queryParams: { returnUrl } });
      return false;
    }
    if (this.isNewProject || this.hasUnsavedChanges) await this.saveProject();
    return !!this.user && !this.isNewProject && !this.hasUnsavedChanges && this.hasQuotation;
  }

  protected backToProjects(): void {
    this.persistDraftIfNeeded();
    if (this.isLocalQuotation || !this.user) { void this.router.navigate(['/cotizaciones']); return; }
    this.router.navigate(['/dashboard/maestro'], {
      queryParams: { section: this.user ? 'cotizaciones' : 'buscar' }
    });
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  private async loadProject(projectId: string, draftName = '', draftAddress = ''): Promise<void> {
    this.saveNotice = '';
    this.importedGuestId = '';
    this.workflowStatus='draft';this.workflowUpdatedAt='';this.workflowNotice='';
    this.projectId = projectId;
    this.isNewProject = projectId === 'nuevo';

    const importedId = this.route.snapshot?.queryParamMap?.get('cotizacionLocal') || '';
    const localQuote = this.guestQuotations?.get(this.isLocalQuotation && !this.isNewProject ? projectId : importedId);
    if ((this.isLocalQuotation && !this.isNewProject) || importedId) {
      if (!localQuote) throw new Error('No encontramos esta cotización en tu navegador.');
      this.importedGuestId = importedId;
      this.workflowStatus=quotationStatus(localQuote.workflowStatus);this.workflowUpdatedAt=localQuote.workflowUpdatedAt || '';
      this.projectName = localQuote.name; this.projectAddress = localQuote.address || ''; this.projectDescription = localQuote.description || '';
      this.workBudget=restoreWorkBudgetDraft(localQuote.workBudget);this.paintingPlan=normalizePaintingPlan(localQuote.paintingPlan);
      this.projectItems = localQuote.items.map(item => ({ ...item })); this.projectProximity = localQuote.proximity;
      this.selectedSingleStoreName = localQuote.singleStoreName || ''; this.selectedSingleStoreId = localQuote.singleStoreId || '';
      this.pricingOffers = undefined; this.verificationCode = ''; this.validUntil = ''; this.pricesCapturedAt = '';
      this.savedFingerprint = this.quotationFingerprint();
      return;
    }
    if (this.isNewProject) {
      const draft = this.readDraft();
      const nearbyPreference = readNearbySearchPreference();
      this.pricingOffers = undefined; this.validUntil = ''; this.pricesCapturedAt = ''; this.verificationCode = ''; this.savedFingerprint = '';
      this.projectName = draftName || draft?.name || '';
      this.projectAddress = draftAddress || draft?.address || '';
      this.projectDescription = draft?.description || '';
      this.workBudget=restoreWorkBudgetDraft(draft?.workBudget);this.paintingPlan=normalizePaintingPlan(draft?.paintingPlan);
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
    if (!project) throw new Error('No encontramos esta cotización. Vuelve a mis cotizaciones o reintenta la carga.');

    this.workflowStatus=quotationStatus(project.workflowStatus);this.workflowUpdatedAt=project.workflowUpdatedAt || '';
    this.projectName = project.name;
    this.projectAddress = project.address || '';
    this.projectDescription = project.description || '';
    this.workBudget=normalizeWorkBudget(project.workBudget);this.paintingPlan=normalizePaintingPlan(project.paintingPlan);
    this.pricingOffers = project.pricingOffers; this.validUntil = project.validUntil || ''; this.pricesCapturedAt = project.pricesCapturedAt || ''; this.verificationCode = project.verificationCode || '';
    this.projectProximity = project.proximity;
    this.selectedSingleStoreName = project.singleStoreName || '';
    this.selectedSingleStoreId = project.singleStoreId || '';
    this.syncNearbyPreference();
    this.projectItems = project.items.map((item) => ({
      ...item,
          productName: item.productName,
      quantity: item.quantity
    }));
    this.savedFingerprint = this.quotationFingerprint();
  }



  protected persistDraftIfNeeded(): void {
    if (typeof window === 'undefined') return;
    if (this.importedGuestId && this.isNewProject && this.guestQuotations?.get(this.importedGuestId)) {
      this.guestQuotations.update(this.importedGuestId, { name: this.projectName, address: this.projectAddress, description: this.projectDescription, workBudget:this.workBudget, paintingPlan:this.paintingPlan, items: this.projectItems, proximity: this.projectProximity, singleStoreName: this.selectedSingleStoreName, singleStoreId: this.selectedSingleStoreId });
    }
    if (this.isLocalQuotation && !this.isNewProject && this.guestQuotations) {
      const updated=this.guestQuotations.update(this.projectId, { name: this.projectName, address: this.projectAddress, description: this.projectDescription, workBudget:this.workBudget, paintingPlan:this.paintingPlan, items: this.projectItems, proximity: this.projectProximity, singleStoreName: this.selectedSingleStoreName, singleStoreId: this.selectedSingleStoreId });
      this.workflowStatus=quotationStatus(updated.workflowStatus);this.workflowUpdatedAt=updated.workflowUpdatedAt || '';
      this.savedFingerprint = this.quotationFingerprint(); return;
    }
    if (!this.isNewProject) {
      return;
    }

    const payload = {
      name: this.projectName,
      address: this.projectAddress,
      description: this.projectDescription, workBudget:this.workBudget, paintingPlan:this.paintingPlan,
      items: this.projectItems,
      proximity: this.projectProximity,
      singleStoreId: this.quotation.appliedStoreId,
      singleStoreName: this.quotation.appliedStoreName
    };
    try { window.localStorage.setItem(this.draftStorageKey, JSON.stringify(payload)); } catch { /* Browser storage is optional. */ }
  }

  private readDraft(): {
    name: string;
    address: string;
    description?: string;
    workBudget?:WorkBudget; paintingPlan?:PaintingPlan;
    items: ProjectItem[];
    proximity?: SearchProximity;
    singleStoreName?: string;
    singleStoreId?: string;
  } | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      window.localStorage.removeItem('construcomparador-project-draft');
      const raw = window.localStorage.getItem(this.draftStorageKey);
      if (!raw) return null;
      return JSON.parse(raw) as {
        name: string;
        address: string;
        description?: string;
        workBudget?:WorkBudget; paintingPlan?:PaintingPlan;
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
    try { window.localStorage.removeItem(this.draftStorageKey); } catch { /* Storage is optional. */ }
  }

  private async persistExistingPurchaseSelection(): Promise<boolean> {
    const currentUser = this.user;
    if (!currentUser || this.isNewProject || this.isLocalQuotation) { this.persistDraftIfNeeded(); return true; }

    const updated = await this.apiService.updateProject(
      currentUser.id,
      this.projectId,
      this.projectName.trim() || 'Cotizacion',
      this.projectItems,
      this.projectAddress,
      this.projectProximity,
      this.quotation.appliedStoreName,
      this.quotation.appliedStoreId,
      this.projectDescription, false, this.workBudget, this.paintingPlan ?? null
    );

    if(updated){
      this.workflowStatus=quotationStatus(updated.workflowStatus);this.workflowUpdatedAt=updated.workflowUpdatedAt || '';
      this.verificationCode=updated.verificationCode || '';
      this.pricingOffers=updated.pricingOffers;
      this.validUntil=updated.validUntil || '';
      this.pricesCapturedAt=updated.pricesCapturedAt || '';
      this.savedFingerprint=this.quotationFingerprint();
    }
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
    this.pendingQueryCleanupProjectId = this.projectId;
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
