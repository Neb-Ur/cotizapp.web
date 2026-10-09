import { PasswordFieldComponent } from '../../../shared/components/password-field/password-field.component';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import {
  AuthService,
  LOGIN_SUPPORT_ERROR_MESSAGE,
  ProfileCompletionRequiredError
} from '../../../core/services/auth.service';
import { resolvePostAuthUrl, sanitizeReturnUrl } from '../../../core/utils/auth-navigation.util';
import { BrandMarkComponent } from '../../../shared/components/brand-mark/brand-mark.component';
import { UiLoaderComponent } from '../../../shared/components/ui-loader/ui-loader.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [PasswordFieldComponent, CommonModule, ReactiveFormsModule, RouterLink, BrandMarkComponent, UiLoaderComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  protected errorMessage = '';
  protected supportBannerMessage = '';
  protected isSubmitting = false;
  protected readonly returnUrl: string | null;

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    remember: [true]
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    if (this.route.snapshot.queryParamMap.get('reason') === 'inactivity') {
      this.errorMessage = 'Tu sesión se cerró después de 30 minutos sin actividad. Inicia sesión nuevamente.';
    }
  }

  protected get backLink(): UrlTree {
    return this.router.parseUrl(this.returnUrl || '/');
  }

  protected get authQueryParams(): Record<string, string> | null {
    return this.returnUrl ? { returnUrl: this.returnUrl } : null;
  }

  protected async submit(): Promise<void> {
    this.errorMessage = '';
    this.supportBannerMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    this.isSubmitting = true;

    try {
      const user = await this.authService.login(values);
      const destination = resolvePostAuthUrl(
        user,
        this.returnUrl,
        this.authService.dashboardRouteForUser(user)
      );
      await this.router.navigateByUrl(destination);
    } catch (error) {
      if (error instanceof ProfileCompletionRequiredError) {
        await this.router.navigate(['/registro'], {
          queryParams: {
            completarPerfil: '1',
            email: error.email,
            returnUrl: this.returnUrl || undefined
          }
        });
        return;
      }
      const message = error instanceof Error ? error.message : 'No fue posible iniciar sesion.';
      if (message === LOGIN_SUPPORT_ERROR_MESSAGE) {
        this.supportBannerMessage = message;
        return;
      }
      this.errorMessage = message;
    } finally {
      this.isSubmitting = false;
    }
  }

  protected hasError(control: 'email' | 'password'): boolean {
    const item = this.form.controls[control];
    return item.invalid && (item.touched || item.dirty);
  }
}
