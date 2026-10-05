import { PasswordFieldComponent } from '../../../shared/components/password-field/password-field.component';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { STRONG_PASSWORD_PATTERN } from '../../../core/utils/password-policy.util';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [PasswordFieldComponent, CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent {
  protected isSubmitting = false;
  protected errorMessage = '';
  protected successMessage = '';
  protected sessionRetained = true;
  protected readonly form = this.formBuilder.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.pattern(STRONG_PASSWORD_PATTERN)]],
    confirmPassword: ['', Validators.required]
  });

  constructor(private readonly formBuilder: FormBuilder, protected readonly authService: AuthService) {}

  protected async submit(): Promise<void> {
    if (this.isSubmitting) return;
    this.errorMessage = '';
    this.successMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const values = this.form.getRawValue();
    if (values.newPassword !== values.confirmPassword) {
      this.errorMessage = 'La confirmación no coincide con la nueva contraseña.';
      return;
    }
    this.isSubmitting = true;
    try {
      this.sessionRetained = await this.authService.changePassword(values.currentPassword, values.newPassword);
      this.form.reset();
      this.successMessage = this.sessionRetained
        ? 'Contraseña actualizada correctamente.'
        : 'Contraseña actualizada. Inicia sesión de nuevo con tu nueva contraseña.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No fue posible cambiar la contraseña.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
