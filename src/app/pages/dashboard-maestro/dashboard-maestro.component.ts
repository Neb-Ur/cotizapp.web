import {normalizeWorkBudget,workBudgetTotals} from '../../core/utils/work-budget.util';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectSummary, SessionUser } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { WriteFeedbackService } from '../../core/services/write-feedback.service';
import { shareQuotationPdf } from '../../core/utils/quotation-pdf.util';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';
import { UiModalComponent } from '../../shared/components/ui-modal/ui-modal.component';
import { CatalogSearchComponent } from '../catalog-search/catalog-search.component';

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
  imports: [CommonModule, FormsModule, UiLoaderComponent, UiModalComponent, CatalogSearchComponent],
  templateUrl: './dashboard-maestro.component.html',
  styleUrls: ['./dashboard-maestro.component.scss', './dashboard-maestro-quotations.scss']
})
export class DashboardMaestroComponent implements OnInit, OnDestroy {
  private sectionLoadError = '';
  protected get dataLoadError(): string { return this.sectionLoadError || this.apiService.loadError(); }
  protected async retryDataLoad(): Promise<void> {
    await this.ensureSectionData(this.currentSection, true).catch(() => undefined);
  }

  protected readonly maxSavedQuotations = 2;
  protected readonly sections: MaestroSectionMeta[] = [
    { id: 'inicio', label: 'Inicio', description: 'Revisa tus cotizaciones recientes y el ahorro estimado.' },
    { id: 'buscar', label: 'Buscar productos', description: 'Busca materiales y compara precios entre ferreterias activas.' },
    { id: 'cotizaciones', label: 'Mis cotizaciones', description: 'Crea y edita tus listas de materiales.' },
    { id: 'historial', label: 'Historial', description: 'Consulta todas las cotizaciones que has guardado.' },
    { id: 'perfil', label: 'Perfil', description: 'Mantiene tus datos basicos de contacto.' }
  ];

  protected currentSection: MaestroSection = 'inicio';
  protected projects: ProjectSummary[] = [];

  protected profileDraft: MaestroProfileDraft = { displayName: '', phone: '', commune: '' };
  protected profileSaved = false;
  protected profileError = '';
  protected quotationNotice = '';
  protected quotationToDelete: ProjectSummary | null = null;
  protected deletingQuotation = false;
  protected deletionError = '';
  @ViewChild('pageTitle') private pageTitle?: ElementRef<HTMLElement>;

  protected isInitialLoading = true;
  protected isSectionLoading = false;
  private readonly loadedSections = new Set<MaestroSection>();
  private querySubscription?: Subscription;

  constructor(
    private readonly authService: AuthService,
    private readonly apiService: FirebaseDataService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly writeFeedback: WriteFeedbackService = new WriteFeedbackService()
  ) {}

  ngOnInit(): void {
    this.startDashboard();
  }

  private startDashboard(): void {
    this.querySubscription = this.route.queryParamMap.subscribe((params) => {
      const requested = params.get('section');
      if (this.isValidSection(requested) && this.user) {
        this.currentSection = requested;
      }
      if (!this.isInitialLoading) {
        void this.ensureSectionData(this.currentSection);
      }
    });

    this.hydrateProfileDraft();
    void this.initializeDashboard();
  }

  protected get user(): SessionUser | null {
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'maestro' ? currentUser : null;
  }

  protected get currentSectionLabel(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.label || '';
  }

  protected get currentSectionDescription(): string {
    return this.sections.find((section) => section.id === this.currentSection)?.description || '';
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

  protected goToNewProject(): void {
    if (!this.user) return;
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

  protected async copyQuotationCode(project: ProjectSummary): Promise<void> {
    if (!project.verificationCode) return;
    try {
      await navigator.clipboard.writeText(project.verificationCode);
      this.quotationNotice = 'Código copiado. Preséntalo en el local para verificar tu cotización.';
    } catch {
      this.quotationNotice = 'No se pudo copiar automáticamente. Selecciona el código visible y cópialo para presentarlo en el local.';
    }
  }

  protected projectTotal(project:ProjectSummary):number {
    try{return workBudgetTotals(project.totalOptimal,normalizeWorkBudget(project.workBudget)).total;}catch{return project.totalOptimal;}
  }

  protected async shareProject(project: ProjectSummary): Promise<void> {
    const quotation = this.apiService.buildProjectQuotation(
      project.items,
      project.proximity,
      project.singleStoreName,
      project.singleStoreId,
      project.pricingOffers
    );
    if (quotation.lines.length === 0 && (!project.workBudget?.enabled || this.projectTotal(project)<=0)) {
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
        projectDescription: project.description || '',
        workBudget:project.workBudget,
        paintingPlan:project.paintingPlan,
        pricesCapturedAt: project.pricesCapturedAt,
        validUntil: project.validUntil,
        verificationCode: project.verificationCode,
        maestroName: this.user?.displayName || '',
        quotation,
        proximity: project.proximity
      });
      if(result==='cancelled')return;
      this.quotationNotice = result === 'shared'
        ? 'Cotizacion lista para enviar al cliente.'
        : 'Tu navegador no permite compartir el PDF directamente; se descargo para que puedas enviarlo.';
    } catch (error) {
      this.quotationNotice = error instanceof Error ? error.message : 'No se pudo preparar la cotizacion para enviar.';
    }
  }

  protected deleteProject(projectId: string): void {
    if (this.deletingQuotation) return;
    this.deletionError = '';
    this.quotationToDelete = this.projects.find(project => project.id === projectId) || null;
  }

  protected closeDeleteQuotation(): void {
    if (!this.deletingQuotation) this.quotationToDelete = null;
  }

  protected async confirmDeleteQuotation(): Promise<void> {
    if (!this.user || !this.quotationToDelete || this.deletingQuotation) return;
    const projectId = this.quotationToDelete.id;
    this.deletingQuotation = true;
    this.deletionError = '';
    try {
      await this.writeFeedback.run('dashboard-maestro:deleteProject', async () => {
        await this.apiService.deleteProject(this.user!.id, projectId);
      });
      this.quotationToDelete = null;
      this.quotationNotice = 'Cotización eliminada.';
      this.loadedSections.delete('inicio');
      this.loadedSections.delete('cotizaciones');
      this.loadedSections.delete('historial');
      await this.ensureSectionData(this.currentSection, true);
      setTimeout(() => this.pageTitle?.nativeElement.focus());
    } catch (error) {
      this.deletionError = error instanceof Error ? error.message : 'No pudimos eliminar la cotización. Vuelve a intentarlo.';
    } finally {
      this.deletingQuotation = false;
    }
  }

  protected async saveProfile(): Promise<void> {
    await this.writeFeedback.run('dashboard-maestro:saveProfile', async () => {
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
    });
  }

  protected resetProfileDraft(): void {
    this.profileSaved = false;
    this.profileError = '';
    this.hydrateProfileDraft();
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  private async initializeDashboard(): Promise<void> {
    try {
      await this.ensureSectionData(this.currentSection);
    } finally {
      this.isInitialLoading = false;
    }
  }

  private async ensureSectionData(section: MaestroSection, force = false): Promise<void> {
    // The catalog section loads its own data inside CatalogSearchComponent.
    if (section === 'buscar') return;
    const currentUser = this.user;
    if (!currentUser) return;
    if (!force && this.loadedSections.has(section)) return;

    this.isSectionLoading = true;
    try {
      if (section === 'inicio' || section === 'cotizaciones' || section === 'historial') {
        await this.apiService.refreshMaestroProjectsSection(currentUser.id, force);
        if (this.user?.id !== currentUser.id) return;
        this.projects = [...this.apiService.getProjects(currentUser.id)]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      }

      if (section === 'perfil') {
        this.hydrateProfileDraft();
      }

      this.sectionLoadError = '';
      this.loadedSections.add(section);
    } catch (error) {
      if (this.user?.id !== currentUser.id) return;
      this.sectionLoadError = error instanceof Error ? error.message : 'No se pudo cargar esta sección. Intenta nuevamente.';
      this.loadedSections.delete(section);
    } finally {
      this.isSectionLoading = false;
    }
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

  private isValidSection(value: string | null): value is MaestroSection {
    return value === 'inicio' || value === 'buscar' || value === 'cotizaciones' || value === 'historial' || value === 'perfil';
  }

  ngOnDestroy(): void {
    this.querySubscription?.unsubscribe();
  }
}
