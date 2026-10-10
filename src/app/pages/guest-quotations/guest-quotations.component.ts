import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';
import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GuestQuotationService } from '../../core/services/guest-quotation.service';
import { ProjectSummary } from '../../core/models/app.models';
@Component({
  standalone: true, imports: [UiLoaderComponent, CommonModule, RouterLink],
  template: `<main class="quotes"><header><div><h1>Mis cotizaciones</h1><p>Crea y revisa tus cotizaciones sin cuenta. Para descargar el PDF necesitarás iniciar sesión como maestro.</p></div><a class="primary" routerLink="/cotizaciones/nueva">Crear cotización</a></header><p class="notice">Estas cotizaciones se conservan en este navegador. Al iniciar sesión para descargar, podrás guardarlas en tu cuenta.</p>@if (!ready) {<app-ui-loader label="Cargando tus cotizaciones…" />} @else { @for (quote of quotes; track quote.id) {<article><div><h2>{{ quote.name }}</h2><p>{{ quote.items.length }} productos · {{ quote.createdAt | date:'dd/MM/yyyy' }}</p></div><a [routerLink]="['/cotizaciones/local', quote.id]">Ver cotización <i class="pi pi-arrow-right" aria-hidden="true"></i></a><button type="button" (click)="remove(quote.id)" [attr.aria-label]="'Eliminar cotización ' + quote.name">Eliminar</button></article>} @empty {<section class="empty"><h2>Crea tu primera cotización</h2><p>Dale un nombre, agrega materiales y revisa los precios. No necesitas registrarte para empezar.</p></section>} }<p *ngIf="guest.storageWarning" role="status">{{ guest.storageWarning }}</p></main>`,
  styles: [`:host{display:block}.quotes{max-width:1080px;padding:2rem 1.25rem 4rem;margin:auto;color:#183b54}header,article{display:flex;align-items:center;gap:1rem;justify-content:space-between}header{margin-bottom:1.5rem}header>div{max-width:680px}h1{font-size:2rem}h2{font-size:1.1rem}p{color:#526b80;line-height:1.6}a{color:#12658a;font-weight:650;text-decoration:none;min-height:44px;display:inline-flex;align-items:center;gap:.5rem}.primary{background:#123b55;color:white;border-radius:10px;padding:.8rem 1.2rem;white-space:nowrap}.notice{padding:1rem;background:#f2f8fc;border-radius:12px;font-size:.9rem}article{border:1px solid #dde7ed;border-radius:16px;padding:1rem 1.25rem;margin:1rem 0;background:white}article>div{flex:1;overflow-wrap:anywhere}article h2{margin:0}article p{margin:.4rem 0}button{min-height:44px;padding:.6rem;border:0;background:transparent;color:#a13e45;font:inherit;cursor:pointer}.empty{padding:2rem;text-align:center}a:focus-visible,button:focus-visible{outline:2px solid #12658a;outline-offset:4px}@media(max-width:640px){header,article{align-items:flex-start;flex-wrap:wrap}header{flex-direction:column}article>div{flex-basis:100%}}`]
})
export class GuestQuotationsComponent  {
  protected readonly guest = inject(GuestQuotationService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected quotes: ProjectSummary[] = [];
  protected ready = false;
  constructor() { afterNextRender(() => { this.quotes = this.guest.all(); this.ready = true; this.cdr.markForCheck(); }); }
  protected remove(id: string): void { this.guest.remove(id); this.quotes = this.guest.all(); }
}
