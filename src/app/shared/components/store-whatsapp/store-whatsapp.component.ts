import { Component, Input } from '@angular/core';
import { storeWhatsappUrl } from '../../../core/utils/store-whatsapp.util';

@Component({
  selector: 'app-store-whatsapp', standalone: true,
  template: `
    @if (url; as href) {
      <a class="whatsapp-contact" [href]="href" target="_blank" rel="noopener noreferrer"
        [attr.aria-label]="label" [title]="label" (click)="$event.stopPropagation()">
        <i class="pi pi-whatsapp" aria-hidden="true"></i>
      </a>
    } @else {
      <button class="whatsapp-contact" type="button" disabled
        [attr.aria-label]="storeName + ': WhatsApp no disponible'" title="Este local no tiene un número público de WhatsApp">
        <i class="pi pi-whatsapp" aria-hidden="true"></i>
      </button>
    }
  `,
  styles: [`
    :host { display: inline-flex; vertical-align: middle; }
    .whatsapp-contact { display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; flex: 0 0 44px; box-sizing: border-box; padding: 0; border: 1px solid #147d42;
      border-radius: 8px; background: #147d42; color: #fff; font: inherit;
      text-decoration: none; cursor: pointer; }
    .whatsapp-contact i { font-size: 1.2rem; }
    a:hover { background: #106234; border-color: #106234; }
    a:focus-visible { outline: 3px solid #123b55; outline-offset: 3px; }
    button:disabled { background: #f1f4f6; border-color: #cbd2d9; color: #526274; cursor: default; }
  `]
})
export class StoreWhatsappComponent {
  @Input() phone: string | undefined = '';
  @Input() storeName = '';
  @Input() productName = '';
  @Input() productPath: string | undefined = '';
  @Input() pilot = false;
  protected get url(): string | null { return storeWhatsappUrl(this.phone, this.storeName, this.productName, this.productPath, this.pilot); }
  protected get label(): string { return `Consultar disponibilidad por WhatsApp en ${this.storeName}${this.pilot ? ' (contacto de prueba)' : ''}`; }
}
