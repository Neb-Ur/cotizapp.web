import { STRONG_PASSWORD_PATTERN } from '../../../core/utils/password-policy.util';
import { PasswordFieldComponent } from '../../../shared/components/password-field/password-field.component';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RegisterPayload } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';
import { resolvePostAuthUrl, sanitizeReturnUrl } from '../../../core/utils/auth-navigation.util';
import { LEGAL_IDENTITY } from '../../../core/config/legal-identity.config';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [PasswordFieldComponent, CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private static readonly STRONG_PASSWORD = STRONG_PASSWORD_PATTERN;

  protected errorMessage = '';
  protected isSubmitting = false;
  protected readonly returnUrl: string | null;
  protected readonly isCompletingProfile: boolean;
  protected readonly legalIdentity = LEGAL_IDENTITY;

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(128),
      Validators.pattern(RegisterComponent.STRONG_PASSWORD)
    ]],
    phone: [''],
    commune: [''],
    termsAccepted: [false, Validators.requiredTrue],
    privacyAcknowledged: [false, Validators.requiredTrue],
    ageConfirmed: [false, Validators.requiredTrue],
    marketingConsent: [false]
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    this.isCompletingProfile = this.route.snapshot.queryParamMap.get('completarPerfil') === '1';

    if (this.isCompletingProfile) {
      this.form.controls.email.setValue(this.route.snapshot.queryParamMap.get('email') || '');
      this.form.controls.password.clearValidators();
      this.form.controls.password.updateValueAndValidity();
    }
  }

  protected get authQueryParams(): Record<string, string> | null {
    return this.returnUrl ? { returnUrl: this.returnUrl } : null;
  }

  protected async submit(): Promise<void> {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    const payload: RegisterPayload = {
      role: 'maestro',
      name: values.name.trim().replace(/\s+/g, ' '),
      email: values.email.trim(),
      password: values.password,
      phone: values.phone.trim(),
      commune: values.commune.trim(),
      region: '',
      city: '',
      address: '',
      termsVersion: this.legalIdentity.termsVersion,
      privacyVersion: this.legalIdentity.privacyPolicyVersion,
      termsAccepted: values.termsAccepted,
      privacyAcknowledged: values.privacyAcknowledged,
      ageConfirmed: values.ageConfirmed,
      marketingConsent: values.marketingConsent
    };

    this.isSubmitting = true;
    try {
      const user = this.isCompletingProfile
        ? await this.authService.completeProfile(payload)
        : await this.authService.register(payload);
      const destination = resolvePostAuthUrl(
        user,
        this.returnUrl,
        this.authService.dashboardRouteForUser(user)
      );
      await this.router.navigateByUrl(destination);
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : (this.isCompletingProfile ? 'No se pudo completar la cuenta.' : 'No se pudo crear la cuenta.');
    } finally {
      this.isSubmitting = false;
    }
  }

  protected hasError(controlName: 'name' | 'email' | 'password' | 'phone' | 'commune'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }
}
