import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';

let modalId = 0;

@Component({
  selector: 'app-ui-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-modal.component.html',
  styleUrl: './ui-modal.component.scss'
})
export class UiModalComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() title = 'Detalle';
  @Input() eyebrow = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() closeDisabled = false;
  @Input() closeOnBackdrop = true;

  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;

  protected readonly titleId = `ui-modal-title-${++modalId}`;
  private previouslyFocused: HTMLElement | null = null;

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;

    if (this.open) {
      this.previouslyFocused = this.document.activeElement as HTMLElement | null;
      this.document.body.classList.add('modal-open');
      setTimeout(() => this.dialog?.nativeElement.focus());
      return;
    }

    this.restorePageState();
  }

  ngOnDestroy(): void {
    this.restorePageState();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open) this.close();
  }

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop) this.close();
  }

  protected trapFocus(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const focusable = Array.from(this.dialog?.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || []);
    if (focusable.length === 0) {
      event.preventDefault();
      this.dialog?.nativeElement.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (keyboardEvent.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected close(): void {
    if (this.closeDisabled) return;
    this.closed.emit();
  }

  private restorePageState(): void {
    this.document.body.classList.remove('modal-open');
    if (this.previouslyFocused?.isConnected) this.previouslyFocused.focus();
    this.previouslyFocused = null;
  }
}
