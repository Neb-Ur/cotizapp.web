import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, LOGIN_SUPPORT_ERROR_MESSAGE } from '../../../core/services/auth.service';
import { UiLoaderComponent } from '../../../shared/components/ui-loader/ui-loader.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, UiLoaderComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  protected errorMessage = '';
  protected supportBannerMessage = '';
  protected isSubmitting = false;

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true]
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

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
      this.router.navigateByUrl(this.authService.dashboardRouteForUser(user));
    } catch (error) {
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
