import {quotationStatus,quotationStatusLabels} from '../../core/utils/quotation-workflow.util';
import { UiModalComponent } from '../../shared/components/ui-modal/ui-modal.component';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';
import { Component, afterNextRender, inject, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GuestQuotationService } from '../../core/services/guest-quotation.service';
import { ProjectSummary } from '../../core/models/app.models';
@Component({
  standalone: true, imports: [UiLoaderComponent, CommonModule, RouterLink, UiModalComponent],
  template: `<main class="quotes"><header><div><h1 #pageTitle tabindex="-1">Mis cotizaciones</h1><p>Crea y revisa tus cotizaciones sin cuenta. Para descargar el PDF necesitarás iniciar sesión como maestro.</p></div><a *ngIf="!ready || !quotes.length" class="primary" routerLink="/cotizaciones/nueva">Crear cotización</a><a *ngIf="ready && quotes.length" class="primary" [routerLink]="['/cotizaciones/local',quotes[0].id]">Continuar cotización</a></header><p class="notice">Sin cuenta puedes crear una cotización, que se conserva en este navegador. Con una cuenta de maestro puedes guardar hasta 50.</p><p *ngIf="ready && quotes.length" class="limit-notice">Ya tienes una cotización sin cuenta. Puedes editarla o eliminarla para crear otra.</p>@if (!ready) {<app-ui-loader label="Cargando tus cotizaciones…" />} @else { @for (quote of quotes; track quote.id) {<article><div><h2>{{ quote.name }}</h2><p>{{ statusLabel(quote) }} · {{ quote.workBudget?.enabled ? 'Presupuesto de trabajo · ' : '' }}{{ quote.items.length }} productos · {{ quote.createdAt | date:'dd/MM/yyyy' }}</p></div><a [routerLink]="['/cotizaciones/local', quote.id]">Ver cotización <i class="pi pi-arrow-right" aria-hidden="true"></i></a><button type="button" (click)="remove(quote.id)" [attr.aria-label]="'Eliminar cotización ' + quote.name">Eliminar</button></article>} @empty {<section class="empty"><h2>Crea tu primera cotización</h2><p>Dale un nombre, agrega productos y revisa los precios. No necesitas registrarte para empezar.</p></section>} }<p *ngIf="guest.storageWarning" role="status">{{ guest.storageWarning }}</p></main>
    <app-ui-modal [open]="!!quotationToDelete" title="¿Eliminar cotización?" size="sm" tone="danger" (closed)="quotationToDelete = null">
      <p>Se eliminará “{{ quotationToDelete?.name }}” de este navegador junto con sus productos. Esta acción no se puede deshacer.</p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-outline" (click)="quotationToDelete = null">Conservar cotización</button>
        <button type="button" class="btn btn-danger" (click)="confirmRemove()">Eliminar cotización</button>
      </div>
    </app-ui-modal>`,
  styles: [`:host{display:block}.quotes{max-width:1080px;padding:2rem 1.25rem 4rem;margin:auto;color:#183b54}header,article{display:flex;align-items:center;gap:1rem;justify-content:space-between}header{margin-bottom:1.5rem}header>div{max-width:680px}h1{font-size:2rem}h2{font-size:1.1rem}p{color:#526b80;line-height:1.6}a{color:#12658a;font-weight:650;text-decoration:none;min-height:44px;display:inline-flex;align-items:center;gap:.5rem}.primary{background:#123b55;color:white;border-radius:10px;padding:.8rem 1.2rem;white-space:nowrap}.notice{padding:1rem;background:#f2f8fc;border-radius:12px;font-size:.9rem}article{border:1px solid #dde7ed;border-radius:16px;padding:1rem 1.25rem;margin:1rem 0;background:white}article>div{flex:1;overflow-wrap:anywhere}article h2{margin:0}article p{margin:.4rem 0}article button{min-height:44px;padding:.6rem;border:0;background:transparent;color:#a13e45;font:inherit;cursor:pointer}.empty{padding:2rem;text-align:center}a:focus-visible,button:focus-visible{outline:2px solid #12658a;outline-offset:4px}@media(max-width:640px){header,article{align-items:flex-start;flex-wrap:wrap}header{flex-direction:column}article>div{flex-basis:100%}}`]
})
export class GuestQuotationsComponent  {
  protected readonly guest = inject(GuestQuotationService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected quotes: ProjectSummary[] = [];
  protected ready = false;
  protected statusLabel(quote:ProjectSummary){return quotationStatusLabels[quotationStatus(quote.workflowStatus)];}
  protected quotationToDelete: ProjectSummary | null = null;
  @ViewChild('pageTitle') private pageTitle?: ElementRef<HTMLElement>;
  constructor() { afterNextRender(() => { this.quotes = this.guest.all(); this.ready = true; this.cdr.markForCheck(); }); }
  protected remove(id: string): void {
    this.quotationToDelete = this.quotes.find(quote => quote.id === id) || null;
  }
  protected confirmRemove(): void {
    if (!this.quotationToDelete) return;
    this.guest.remove(this.quotationToDelete.id);
    this.quotes = this.guest.all();
    this.quotationToDelete = null;
    setTimeout(() => this.pageTitle?.nativeElement.focus());
  }
}
