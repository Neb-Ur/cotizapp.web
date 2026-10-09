import { Component, ElementRef, HostListener, Input, OnDestroy, ViewChild, signal } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';

@Component({
  selector: 'app-info-panel',
  standalone: true,
  imports: [OverlayModule],
  template: `
    <button #trigger cdkOverlayOrigin #origin="cdkOverlayOrigin" type="button" class="info-trigger"
      [attr.aria-label]="label" aria-haspopup="dialog" [attr.aria-expanded]="isOpen()"
      [attr.aria-controls]="isOpen() ? panelId : null"
      (pointerenter)="onPointerEnter($event)" (pointerleave)="scheduleClose()"
      (focus)="show()" (blur)="onBlur($event)" (click)="toggle($event)">
      <i class="pi pi-info-circle" aria-hidden="true"></i>
    </button>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="isOpen()" [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="12"
      (overlayOutsideClick)="onOutsideClick($event)" (detach)="close()">
      <div #panel class="information" role="dialog" [id]="panelId" [attr.aria-label]="title"
        (pointerenter)="cancelClose()" (pointerleave)="scheduleClose()"
        (focusin)="cancelClose()" (focusout)="onBlur($event)" (click)="$event.stopPropagation()">
        <ng-content />
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: inline-flex; vertical-align: middle; flex: 0 0 auto; }
    .info-trigger { display: grid; place-items: center; width: 44px; height: 44px; min-height: 44px;
      padding: 0; border: 1px solid #c5e1f5; border-radius: 50%; background: #eff8ff;
      color: #3183b5; font-size: 1.1rem; cursor: pointer; }
    .info-trigger:hover, .info-trigger[aria-expanded="true"] { background: #dfefff; border-color: #91c6e8; }
    .info-trigger:focus-visible { outline: 2px solid #3183b5; outline-offset: 2px; }
    .information { box-sizing: border-box; width: min(340px, calc(100vw - 24px));
      max-height: min(420px, calc(100dvh - 24px)); overflow: auto; padding: .85rem 1rem;
      border: 1px solid #c5e1f5; border-radius: 12px; background: #fff;
      box-shadow: 0 6px 24px rgb(15 45 74 / 16%); overflow-wrap: anywhere;
      color: var(--ink-700); font-size: .85rem; line-height: 1.5; }
  `
})
export class InfoPanelComponent implements OnDestroy {
  private static nextId = 0;
  @Input() title = 'Información';
  @Input() label = 'Más información';
  @ViewChild('trigger', { read: ElementRef }) private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('panel', { read: ElementRef }) private panel?: ElementRef<HTMLElement>;
  protected readonly panelId = `info-popover-${InfoPanelComponent.nextId++}`;
  protected readonly isOpen = signal(false);
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 }
  ];
  private pinned = false;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private restoringFocus = false;

  protected show(): void {
    this.cancelClose();
    if (!this.restoringFocus) this.isOpen.set(true);
  }

  protected onPointerEnter(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.show();
  }

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.cancelClose();
    this.pinned = !this.pinned;
    this.isOpen.set(this.pinned);
  }

  protected cancelClose(): void { clearTimeout(this.closeTimer); }

  protected scheduleClose(): void {
    this.cancelClose();
    if (!this.pinned) this.closeTimer = setTimeout(() => this.close(), 150);
  }

  protected onBlur(event: FocusEvent): void {
    const target = event.relatedTarget as Node | null;
    if (target && (this.panel?.nativeElement.contains(target) || this.trigger?.nativeElement.contains(target))) return;
    this.close();
  }

  protected onOutsideClick(event: MouseEvent): void {
    if (!this.trigger?.nativeElement.contains(event.target as Node)) this.close();
  }

  protected close(): void {
    this.cancelClose();
    this.pinned = false;
    this.isOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.isOpen()) return;
    this.restoringFocus = true;
    this.trigger?.nativeElement.focus();
    this.close();
    this.restoringFocus = false;
  }

  ngOnDestroy(): void { this.cancelClose(); }
}
