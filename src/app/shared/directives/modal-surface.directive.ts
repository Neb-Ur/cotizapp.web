import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { trapDialogFocus } from '../utils/dialog-focus.util';

const surfaces = new WeakMap<Document, ModalSurfaceDirective[]>();

/** Keyboard and scroll behavior for responsive drawers that stay mounted on desktop. */
@Directive({ selector: '[appModalSurface]', standalone: true })
export class ModalSurfaceDirective implements OnChanges, OnDestroy {
  @Input() appModalSurface = false;
  @Output() surfaceClosed = new EventEmitter<void>();
  private readonly document = inject(DOCUMENT);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private active = false;
  private previousFocus: HTMLElement | null = null;
  private focusTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(): void {
    if (this.appModalSurface === this.active || !this.document.defaultView) return;
    if (!this.appModalSurface) { this.release(); return; }
    this.active = true;
    this.previousFocus = this.document.activeElement as HTMLElement | null;
    const stack = surfaces.get(this.document) || [];
    stack.push(this);
    surfaces.set(this.document, stack);
    this.document.body.classList.add('surface-open');
    this.focusTimer = setTimeout(() => {
      if (this.active) this.element.nativeElement.focus();
    });
  }

  @HostListener('keydown', ['$event'])
  protected onTab(event: Event): void {
    if (this.active) trapDialogFocus(this.element.nativeElement, event as KeyboardEvent);
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.active || surfaces.get(this.document)?.at(-1) !== this) return;
    // A dialog opened over this surface owns Escape until it is dismissed.
    if (this.document.body.classList.contains('modal-open')) return;
    event.preventDefault();
    this.surfaceClosed.emit();
  }

  ngOnDestroy(): void { this.release(); }

  private release(): void {
    clearTimeout(this.focusTimer);
    if (!this.active) return;
    this.active = false;
    const stack = (surfaces.get(this.document) || []).filter(surface => surface !== this);
    surfaces.set(this.document, stack);
    if (!stack.length) this.document.body.classList.remove('surface-open');
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
  }
}
