import { Component, Input, signal } from '@angular/core';
import { UiModalComponent } from '../ui-modal/ui-modal.component';

@Component({
  selector: 'app-info-panel',
  standalone: true,
  imports: [UiModalComponent],
  template: `
    <button type="button" class="info-trigger" [attr.aria-label]="label" [attr.title]="label"
      aria-haspopup="dialog" [attr.aria-expanded]="isOpen()" (click)="open($event)">
      <i class="pi pi-info-circle" aria-hidden="true"></i>
    </button>
    <app-ui-modal [open]="isOpen()" [title]="title" size="sm" (closed)="isOpen.set(false)">
      <div class="information"><ng-content /></div>
    </app-ui-modal>
  `,
  styles: `
    :host { display: inline-flex; vertical-align: middle; flex: 0 0 auto; }
    .info-trigger { display: grid; place-items: center; width: 44px; height: 44px; min-height: 44px;
      padding: 0; border: 1px solid var(--border-soft); border-radius: 50%; background: #fff;
      color: var(--navy-800); font-size: 1.1rem; cursor: pointer; }
    .info-trigger:hover { background: var(--ink-50); border-color: var(--orange); }
    .info-trigger:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
    .information { min-width: 0; overflow-wrap: anywhere; color: var(--ink-700); font-size: .9rem; line-height: 1.5; }
  `
})
export class InfoPanelComponent {
  @Input() title = 'Información';
  @Input() label = 'Más información';
  protected readonly isOpen = signal(false);
  protected open(event: Event): void {
    event.stopPropagation();
    this.isOpen.set(true);
  }
}
