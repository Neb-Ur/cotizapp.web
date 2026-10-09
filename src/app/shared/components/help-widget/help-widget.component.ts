import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { API_BASE_URL } from '../../../core/config/api.config';
import { LEGAL_IDENTITY } from '../../../core/config/legal-identity.config';
import { AuthService } from '../../../core/services/auth.service';
import { UiModalComponent } from '../ui-modal/ui-modal.component';

@Component({
  selector: 'app-help-widget',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, UiModalComponent],
  templateUrl: './help-widget.component.html',
  styleUrl: './help-widget.component.scss'
})
export class HelpWidgetComponent {
  protected readonly legalIdentity = LEGAL_IDENTITY;
  protected menuOpen = false;
  protected reportOpen = false;
  protected reportSent = false;
  protected isSubmitting = false;
  protected errorMessage = '';

  protected readonly categories = [
    'Problema con una cotización',
    'Producto o precio incorrecto',
    'No puedo iniciar sesión',
    'La página no funciona correctamente',
    'Otro problema'
  ];

  protected readonly reportForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    category: [this.categories[0], Validators.required],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1500)]],
    website: [''],
    privacyAcknowledged: [false, Validators.requiredTrue]
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  protected get whatsappUrl(): string {
    const text = `Hola, necesito ayuda con Trovio. Estoy en la página ${this.safePagePath}.`;
    return `${this.legalIdentity.whatsappUrl}?text=${encodeURIComponent(text)}`;
  }

  protected toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  protected closeMenu(): void {
    this.menuOpen = false;
  }

  protected openReport(): void {
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.reportForm.patchValue({
        name: currentUser.displayName,
        email: currentUser.email
      });
    }

    this.menuOpen = false;
    this.reportSent = false;
    this.errorMessage = '';
    this.reportOpen = true;
  }

  protected closeReport(): void {
    if (this.isSubmitting) return;
    this.reportOpen = false;
    this.reportSent = false;
    this.errorMessage = '';
  }

  protected async submitReport(): Promise<void> {
    this.reportSent = false;
    this.errorMessage = '';
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    const values = this.reportForm.getRawValue();
    const user = this.authService.currentUser();
    const context = [
      'Reporte enviado desde el botón de ayuda.',
      `Categoría: ${values.category}`,
      `Página: ${this.safePagePath}`,
      `Rol: ${user?.role ?? 'invitado'}`,
      '',
      values.description.trim()
    ].join('\n');

    this.isSubmitting = true;
    try {
      const response = await fetch(`${API_BASE_URL}/solicitudes-contacto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'Otro',
          name: values.name.trim(),
          email: values.email.trim(),
          message: context,
          businessName: '',
          phone: '',
          commune: '',
          website: values.website,
          privacyAcknowledged: values.privacyAcknowledged,
          privacyVersion: this.legalIdentity.privacyPolicyVersion
        })
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || 'No se pudo enviar el reporte.');

      this.reportSent = true;
      this.reportForm.controls.description.reset('');
      this.reportForm.controls.privacyAcknowledged.reset(false);
      this.reportForm.controls.category.reset(this.categories[0]);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo enviar el reporte.';
    } finally {
      this.isSubmitting = false;
    }
  }

  protected hasError(name: 'name' | 'email' | 'category' | 'description'): boolean {
    const control = this.reportForm.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.menuOpen = false;
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menuOpen = false;
  }

  private get safePagePath(): string {
    return (this.router.url.split('?')[0].split('#')[0] || '/').slice(0, 300);
  }
}
