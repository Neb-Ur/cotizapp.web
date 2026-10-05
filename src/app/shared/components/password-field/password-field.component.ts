import { CommonModule } from '@angular/common';
import { Component, ContentChild, ElementRef, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <span class="password-field">
      <ng-content />
      <button class="password-visibility-toggle" type="button"
        [disabled]="disabled" [attr.aria-pressed]="visible"
        [attr.aria-label]="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        [attr.title]="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        (click)="toggleVisibility()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          <path *ngIf="visible" d="m3 3 18 18" />
        </svg>
      </button>
    </span>
  `,
  styleUrl: './password-field.component.scss'
})
export class PasswordFieldComponent {
  @ContentChild('passwordInput', { read: ElementRef }) private input?: ElementRef<HTMLInputElement>;
  protected visible = false;

  protected get disabled(): boolean {
    return !this.input || this.input.nativeElement.matches(':disabled');
  }

  protected toggleVisibility(): void {
    if (!this.input || this.disabled) return;
    this.visible = !this.visible;
    this.input.nativeElement.type = this.visible ? 'text' : 'password';
  }
}
