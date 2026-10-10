import { Component, inject, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MaterialListService } from '../../../core/services/material-list.service';
@Component({
  selector: 'app-quotation-steps', standalone: true, imports: [RouterLink],
  template: `<nav aria-label="Pasos para cotizar" class="steps"><ol><li [class.active]="step === 1"><span>1</span> Busca materiales</li><li [class.active]="step === 2"><span>2</span> Arma tu lista</li><li [class.active]="step === 3"><span>3</span> Guarda tu cotización</li></ol><a routerLink="/lista">Mi lista ({{ list.items().length }}) <i class="pi pi-arrow-right" aria-hidden="true"></i></a></nav>`,
  styles: [`:host{display:block;margin-bottom:1.25rem}.steps{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.25rem;border:1px solid #dbe7ee;border-radius:16px;background:#f5fafd;color:#526b80;font-size:.85rem}ol{display:flex;flex-wrap:wrap;gap:1.25rem;list-style:none;margin:0;padding:0}li{display:flex;gap:.45rem;align-items:center}li span{display:grid;place-items:center;border-radius:50%;width:1.5rem;height:1.5rem;background:#e4edf4}.active{color:#123750;font-weight:700}.active span{background:#d2edf9}a{color:#12658a;white-space:nowrap;font-weight:700;text-decoration:none}a:focus-visible{outline:2px solid #12658a;outline-offset:4px}@media(max-width:640px){.steps{align-items:flex-start;padding:.85rem;flex-direction:column}ol{gap:.7rem;font-size:.75rem}li{gap:.3rem}li span{width:1.2rem;height:1.2rem}}`]
})
export class QuotationStepsComponent {
  @Input() step = 1;
  protected readonly list = inject(MaterialListService);
}
