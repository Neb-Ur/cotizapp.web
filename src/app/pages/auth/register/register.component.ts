import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RegisterPayload } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  protected errorMessage = '';
  protected isSubmitting = false;

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    commune: ['', [Validators.required, Validators.minLength(2)]]
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

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
      address: ''
    };

    this.isSubmitting = true;
    try {
      const user = await this.authService.register(payload);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const destination = returnUrl?.startsWith('/')
        ? returnUrl
        : this.authService.dashboardRouteForUser(user);
      await this.router.navigateByUrl(destination);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
    } finally {
      this.isSubmitting = false;
    }
  }

  protected hasError(controlName: 'name' | 'email' | 'password' | 'phone' | 'commune'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }
}
