import { Component, ElementRef, HostListener, ViewChild, inject, afterNextRender } from '@angular/core';
import { PilotService } from '../../../core/services/pilot.service';

@Component({
  selector: 'app-pilot-banner', standalone: true,
  template: `
    @if (pilot.enabled()) {
      <div class="pilot-widget">
        @if (open) {
          <aside id="pilot-information" class="pilot-information" role="note" aria-labelledby="pilot-information-title">
            <div class="pilot-heading">
              <strong id="pilot-information-title">Estamos en etapa de prueba</strong>
              <button type="button" class="pilot-close" (click)="close()" aria-label="Cerrar información de prueba"><i class="pi pi-times" aria-hidden="true"></i></button>
            </div>
            <p>Los locales actuales son ficticios y sus precios y stock son simulados. No realizan ventas ni tienen establecimientos para visitar.</p>
            <a href="/contacto">Danos tu opinión <i class="pi pi-arrow-up-right" aria-hidden="true"></i></a>
          </aside>
        }
        <button #trigger type="button" class="pilot-trigger" (click)="open = !open"
          [attr.aria-expanded]="open" aria-controls="pilot-information" aria-label="Información: sitio en etapa de prueba">
          <i class="pi pi-info-circle" aria-hidden="true"></i><span>En prueba</span>
        </button>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    :host-context(body.cookie-banner-open) .pilot-widget { display: none; }
    .pilot-widget { position: fixed; left: max(12px, env(safe-area-inset-left));
      bottom: max(12px, env(safe-area-inset-bottom)); z-index: 1100; }
    .pilot-trigger { display: inline-flex; align-items: center; gap: 7px; min-height: 44px;
      padding: 9px 13px; border: 1px solid #ffd4a3; border-radius: 999px; background: #fff0df;
      color: #0f2d4a; font: inherit; font-size: 12px; font-weight: 700;
      box-shadow: 0 4px 16px #0f2d4a24; cursor: pointer; }
    .pilot-trigger > i { font-size: 18px; }
    .pilot-information { position: absolute; bottom: calc(100% + 10px); left: 0;
      width: min(340px, calc(100vw - 32px)); box-sizing: border-box;
      max-height: min(60dvh, 360px); overflow-y: auto; overscroll-behavior: contain;
      padding: 16px; border: 1px solid #ffd4a3; border-radius: 16px;
      background: #fffaf4; color: #0f2d4a; box-shadow: 0 12px 32px #0f2d4a26;
      font-size: 13px; line-height: 1.5; }
    .pilot-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .pilot-close { flex: 0 0 44px; height: 44px; border: 0; border-radius: 8px;
      background: transparent; color: #0f2d4a; cursor: pointer; }
    .pilot-information p { margin: 8px 0 16px; }
    .pilot-information a { color: #964600; font-weight: 700; text-decoration: underline; }
    .pilot-information a i { margin-left: 4px; }
    button:focus-visible, a:focus-visible { outline: 3px solid #0f2d4a; outline-offset: 3px; }
  `]
})
export class PilotBannerComponent {
  protected readonly pilot = inject(PilotService);
  private readonly element = inject(ElementRef<HTMLElement>);
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  protected open = false;
  constructor() { afterNextRender(() => this.pilot.initialize()); }
  protected close(): void { this.open = false; this.trigger?.nativeElement.focus(); }
  @HostListener('document:click', ['$event'])
  protected onOutsideClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.open = false;
  }
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.open) return;
    if (this.element.nativeElement.contains(document.activeElement)) this.close();
    else this.open = false;
  }
}
