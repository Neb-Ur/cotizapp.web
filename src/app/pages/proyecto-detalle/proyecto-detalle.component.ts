import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import {
  ProjectComparisonStrategy,
  ProjectItem,
  ProjectQuotationView,
  ProjectStatus,
  SessionUser
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { MockApiService } from '../../core/services/mock-api.service';

@Component({
  selector: 'app-proyecto-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proyecto-detalle.component.html',
  styleUrl: './proyecto-detalle.component.scss'
})
export class ProyectoDetalleComponent implements OnInit {
  private readonly draftStorageKey = 'construcomparador-project-draft';
  private readonly ivaRate = 0.19;
  protected projectId = '';
  protected isNewProject = true;
  protected projectStatus: ProjectStatus = 'pendiente';
  protected projectName = '';
  protected projectAddress = '';
  protected projectItems: ProjectItem[] = [];
  protected saveNotice = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly apiService: MockApiService
  ) {}

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(async ([params, queryParams]) => {
      const incomingId = params.get('projectId') || 'nuevo';
      const draftName = queryParams.get('draftName') || '';
      const draftAddress = queryParams.get('draftAddress') || '';
      const addProduct = queryParams.get('addProduct') || '';

      const currentUser = this.user;
      if (currentUser) {
        await this.apiService.refreshMaestroData(currentUser.id);
      }

      await this.loadProject(incomingId, draftName, draftAddress);

      if (addProduct.trim() && this.canEditQuotation) {
        this.projectItems = [...this.projectItems, { productName: addProduct.trim(), quantity: 1 }];
        this.saveNotice = `Producto agregado: ${addProduct}.`;
        this.persistDraftIfNeeded();
        this.clearAddProductQueryParams();
      } else if (addProduct.trim()) {
        this.saveNotice = `No puedes agregar productos a una cotizacion ${this.projectStatusLabel.toLowerCase()}.`;
        this.clearAddProductQueryParams();
      }
    });
  }

  protected get user(): SessionUser | null {
    return this.authService.currentUser();
  }

  protected get productOptions(): string[] {
    return this.apiService.getProductOptions();
  }

  protected get quotation(): ProjectQuotationView {
    return this.apiService.buildProjectQuotation(this.projectItems);
  }

  protected get comparisonStrategies(): ProjectComparisonStrategy[] {
    if (!this.canViewAdvancedComparison) {
      return [];
    }
    return this.apiService.getProjectComparisonStrategies(this.projectItems, this.projectAddress);
  }

  protected get currentPlan(): 'basico' | 'pro' | 'premium' {
    return this.user?.subscriptionPlan || 'basico';
  }

  protected get canViewAdvancedComparison(): boolean {
    return this.currentPlan !== 'basico';
  }

  protected get canEditQuotation(): boolean {
    return this.isNewProject || this.projectStatus === 'pendiente';
  }

  protected get projectStatusLabel(): string {
    if (this.projectStatus === 'aceptada') {
      return 'Aceptada';
    }
    if (this.projectStatus === 'rechazada') {
      return 'Rechazada';
    }
    return 'Pendiente';
  }

  protected get hasQuotation(): boolean {
    return this.quotation.lines.length > 0;
  }

  protected get hasItemsInTable(): boolean {
    return this.projectItems.length > 0;
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

  protected get netTotal(): number {
    return this.quotation.optimalTotal;
  }

  protected get ivaAmount(): number {
    return Math.round(this.netTotal * this.ivaRate);
  }

  protected get totalWithIva(): number {
    return this.netTotal + this.ivaAmount;
  }

  protected removeProjectItem(index: number): void {
    if (!this.canEditQuotation) {
      return;
    }
    this.projectItems = this.projectItems.filter((_, itemIndex) => itemIndex !== index);
    this.saveNotice = '';
    this.persistDraftIfNeeded();
  }

  protected getRowUnitPrice(item: ProjectItem): number {
    const productName = item.productName.trim();
    if (!productName) {
      return 0;
    }
    return this.apiService.getBestOfferForProduct(productName)?.price || 0;
  }

  protected getRowBestStore(item: ProjectItem): string {
    const productName = item.productName.trim();
    if (!productName) {
      return 'Sin tienda';
    }
    return this.apiService.getBestOfferForProduct(productName)?.storeName || 'Sin tienda';
  }

  protected getRowTotal(item: ProjectItem): number {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    return this.getRowUnitPrice(item) * quantity;
  }

  protected async saveProject(): Promise<void> {
    const currentUser = this.user;
    if (!currentUser) {
      return;
    }

    const name = this.projectName.trim();
    if (!name) {
      return;
    }

    if (this.isNewProject) {
      const availability = this.apiService.canCreatePendingProject(currentUser.id, this.currentPlan);
      if (!availability.allowed) {
        this.saveNotice = `${availability.message} Cambia a Plan Pro o Premium para crear mas.`;
        return;
      }

      const created = await this.apiService.saveProject(currentUser.id, name, this.projectItems, this.projectAddress, this.currentPlan);
      this.saveNotice = 'Cotizacion creada correctamente.';
      this.clearDraft();
      this.router.navigate(['/dashboard/maestro/cotizaciones', created.id]);
      return;
    }

    if (!this.canEditQuotation) {
      this.saveNotice = `No puedes editar una cotizacion ${this.projectStatusLabel.toLowerCase()}.`;
      return;
    }

    const updated = await this.apiService.updateProject(currentUser.id, this.projectId, name, this.projectItems, this.projectAddress);
    if (!updated) {
      this.saveNotice = 'No se pudo actualizar la cotizacion.';
      return;
    }

    this.saveNotice = 'Cotizacion actualizada correctamente.';
  }

  protected goToSearchForProduct(): void {
    if (!this.canEditQuotation) {
      this.saveNotice = `No puedes agregar items a una cotizacion ${this.projectStatusLabel.toLowerCase()}.`;
      return;
    }

    const projectTarget = this.isNewProject ? 'nuevo' : this.projectId;
    this.persistDraftIfNeeded();
    this.router.navigate(['/dashboard/maestro'], {
      queryParams: {
        section: 'buscar',
        projectTarget,
        draftName: this.isNewProject ? this.projectName : null,
        draftAddress: this.isNewProject ? this.projectAddress : null
      }
    });
  }

  protected exportQuotation(): void {
    if (!this.hasQuotation) {
      return;
    }

    const exportedAt = new Date();
    const pdfLines = this.buildQuotationPdfLines(exportedAt);
    const blob = this.buildPdfBlob(pdfLines);
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    const filename = `${this.toFileSafeName(this.projectName.trim() || 'cotizacion')}-${this.buildFilenameDate(exportedAt)}.pdf`;
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  protected backToProjects(): void {
    this.persistDraftIfNeeded();
    const section = this.projectStatus === 'pendiente' ? 'cotizaciones' : 'historial';
    this.router.navigate(['/dashboard/maestro'], { queryParams: { section } });
  }

  protected formatCurrency(value: number): string {
    return this.apiService.formatCurrency(value);
  }

  private async loadProject(projectId: string, draftName = '', draftAddress = ''): Promise<void> {
    this.saveNotice = '';
    this.projectId = projectId;
    this.isNewProject = projectId === 'nuevo';

    if (this.isNewProject) {
      this.projectStatus = 'pendiente';
      const draft = this.readDraft();
      this.projectName = draftName || draft?.name || '';
      this.projectAddress = draftAddress || draft?.address || '';
      this.projectItems = (draft?.items || []).map((item) => ({
        productName: item.productName,
        quantity: item.quantity
      }));
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
      this.projectStatus = refreshed.status || 'pendiente';
      this.projectItems = refreshed.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity
      }));
      return;
    }

    this.projectName = project.name;
    this.projectAddress = project.address || '';
    this.projectStatus = project.status || 'pendiente';
    this.projectItems = project.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity
    }));
  }

  protected markQuotationAccepted(): void {
    void this.updateQuotationStatus('aceptada');
  }

  protected markQuotationRejected(): void {
    void this.updateQuotationStatus('rechazada');
  }

  private async updateQuotationStatus(status: ProjectStatus): Promise<void> {
    if (this.isNewProject || this.projectStatus !== 'pendiente' || !this.hasQuotation) {
      return;
    }

    const currentUser = this.user;
    if (!currentUser) {
      return;
    }

    const updated = await this.apiService.updateProjectStatus(currentUser.id, this.projectId, status);
    if (!updated) {
      this.saveNotice = 'No se pudo actualizar el estado de la cotizacion.';
      return;
    }

    this.projectStatus = updated.status;
    this.saveNotice = `Cotizacion marcada como ${this.projectStatusLabel.toLowerCase()}.`;
  }


  private persistDraftIfNeeded(): void {
    if (!this.isNewProject || typeof window === 'undefined') {
      return;
    }

    const payload = {
      name: this.projectName,
      address: this.projectAddress,
      items: this.projectItems
    };
    window.localStorage.setItem(this.draftStorageKey, JSON.stringify(payload));
  }

  private readDraft(): { name: string; address: string; items: ProjectItem[] } | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.localStorage.getItem(this.draftStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as { name: string; address: string; items: ProjectItem[] };
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

  private buildQuotationPdfLines(exportedAt: Date): string[] {
    const maestroName = this.user?.displayName?.trim() || 'No definido';
    const projectTitle = this.projectName.trim() || 'Sin titulo';
    const workAddress = this.projectAddress.trim() || 'Sin direccion de obra';
    const lines: string[] = [];

    lines.push('COTIZACION DE MATERIALES');
    lines.push(`Proyecto: ${projectTitle}`);
    lines.push(`Maestro: ${maestroName}`);
    lines.push(`Fecha de exportacion: ${this.formatExportDate(exportedAt)}`);
    lines.push(`Direccion de obra: ${workAddress}`);
    lines.push('');
    lines.push('DETALLE DE ARTICULOS');

    this.quotation.lines.forEach((line, index) => {
      lines.push(`${index + 1}. ${line.productName}`);
      lines.push(`Cantidad: ${line.quantity}`);
      lines.push(`Mejor tienda: ${line.bestStoreName}`);
      lines.push(`Precio unitario: ${this.formatCurrency(line.unitPrice)}`);
      lines.push(`Subtotal: ${this.formatCurrency(line.subtotal)}`);
      lines.push('');
    });

    lines.push('RESUMEN DE COTIZACION');
    lines.push(`Total neto: ${this.formatCurrency(this.netTotal)}`);
    lines.push(`IVA (19%): ${this.formatCurrency(this.ivaAmount)}`);
    lines.push(`Total con IVA: ${this.formatCurrency(this.totalWithIva)}`);
    lines.push(`Ahorro estimado: ${this.formatCurrency(this.quotation.mixedSaving)}`);
    lines.push(`Mejor tienda global: ${this.quotation.bestStore.storeName}`);
    lines.push(`Total tienda global: ${this.formatCurrency(this.quotation.bestStore.total)}`);
    lines.push('');
    lines.push('TOTALES POR FERRETERIA');

    this.quotation.totalsByStore.forEach((storeRow) => {
      lines.push(`${storeRow.storeName}: ${this.formatCurrency(storeRow.total)}`);
    });

    lines.push('');
    lines.push('Documento generado por ConstruComparador.');

    return lines.flatMap((line) => this.wrapLine(line, 95));
  }

  private buildPdfBlob(lines: string[]): Blob {
    const pageChunks = this.chunkLines(lines, 50);
    const objects: string[] = [];
    const pageObjectIds: number[] = [];

    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push('');

    pageChunks.forEach((pageLines, index) => {
      const pageObjectId = 3 + (index * 2);
      const contentObjectId = pageObjectId + 1;
      pageObjectIds.push(pageObjectId);

      const pageContent = this.buildPdfPageContent(pageLines);
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${3 + (pageChunks.length * 2)} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
      );
      objects.push(`<< /Length ${pageContent.length} >>\nstream\n${pageContent}\nendstream`);
    });

    const fontObjectId = 3 + (pageChunks.length * 2);
    objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

    let documentContent = '%PDF-1.4\n';
    const objectOffsets: number[] = new Array(fontObjectId + 1).fill(0);

    objects.forEach((objectValue, index) => {
      const objectId = index + 1;
      objectOffsets[objectId] = documentContent.length;
      documentContent += `${objectId} 0 obj\n${objectValue}\nendobj\n`;
    });

    const xrefStart = documentContent.length;
    documentContent += `xref\n0 ${objects.length + 1}\n`;
    documentContent += '0000000000 65535 f \n';
    objectOffsets.slice(1, objects.length + 1).forEach((offset) => {
      documentContent += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    });

    documentContent += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return new Blob([documentContent], { type: 'application/pdf' });
  }

  private buildPdfPageContent(lines: string[]): string {
    const escapedLines = lines.map((line) => this.escapePdfText(line));
    const commands: string[] = [
      'BT',
      '/F1 11 Tf',
      '14 TL',
      '40 800 Td'
    ];

    escapedLines.forEach((line, index) => {
      if (index > 0) {
        commands.push('T*');
      }
      commands.push(`(${line}) Tj`);
    });

    commands.push('ET');
    return commands.join('\n');
  }

  private escapePdfText(value: string): string {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ');

    return normalized
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private wrapLine(value: string, maxLength: number): string[] {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return [''];
    }

    const words = normalized.split(' ');
    const wrapped: string[] = [];
    let current = '';

    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxLength) {
        current = candidate;
        return;
      }

      if (current) {
        wrapped.push(current);
      }

      if (word.length <= maxLength) {
        current = word;
        return;
      }

      let overflow = word;
      while (overflow.length > maxLength) {
        wrapped.push(`${overflow.slice(0, maxLength - 1)}-`);
        overflow = overflow.slice(maxLength - 1);
      }
      current = overflow;
    });

    if (current) {
      wrapped.push(current);
    }

    return wrapped;
  }

  private chunkLines(lines: string[], chunkSize: number): string[][] {
    const chunks: string[][] = [];
    for (let index = 0; index < lines.length; index += chunkSize) {
      chunks.push(lines.slice(index, index + chunkSize));
    }
    return chunks.length > 0 ? chunks : [[]];
  }

  private formatExportDate(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private buildFilenameDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}`;
  }

  private toFileSafeName(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'cotizacion';
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
