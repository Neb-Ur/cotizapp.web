import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RegisterPayload, UserRole } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  protected step = 1;
  protected selectedRole: UserRole | null = null;
  protected errorMessage = '';
  protected isSubmitting = false;

  protected readonly form = this.formBuilder.nonNullable.group({
    role: ['maestro' as UserRole, Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    commune: ['', [Validators.required, Validators.minLength(2)]],
    businessName: [''],
    rut: [''],
    address: ['']
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  protected chooseRole(role: UserRole): void {
    this.selectedRole = role;
    this.form.controls.role.setValue(role);
    this.syncRoleValidators(role);
    this.step = 2;
    this.errorMessage = '';
  }

  protected backToStepOne(): void {
    this.step = 1;
    this.errorMessage = '';
  }

  protected async submit(): Promise<void> {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    const payload: RegisterPayload = {
      role: values.role,
      name: values.name.trim().replace(/\s+/g, ' '),
      email: values.email.trim(),
      password: values.password,
      phone: values.phone.trim(),
      commune: values.commune.trim(),
      region: '',
      city: '',
      address: values.role === 'ferreteria' ? values.address.trim() : '',
      businessName: values.role === 'ferreteria' ? values.businessName.trim() : undefined,
      rut: values.role === 'ferreteria' ? values.rut.trim() : undefined
    };

    this.isSubmitting = true;
    try {
      const user = await this.authService.register(payload);
      await this.router.navigateByUrl(this.authService.dashboardRouteForUser(user));
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
    } finally {
      this.isSubmitting = false;
    }
  }

  protected hasError(controlName: 'name' | 'email' | 'password' | 'phone' | 'commune' | 'businessName' | 'rut' | 'address'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  private syncRoleValidators(role: UserRole): void {
    const businessName = this.form.controls.businessName;
    const rut = this.form.controls.rut;
    const address = this.form.controls.address;

    if (role === 'ferreteria') {
      businessName.setValidators([Validators.required, Validators.minLength(2)]);
      rut.setValidators([Validators.required, Validators.minLength(7)]);
      address.setValidators([Validators.required, Validators.minLength(4)]);
    } else {
      businessName.clearValidators();
      rut.clearValidators();
      address.clearValidators();
      businessName.setValue('');
      rut.setValue('');
      address.setValue('');
    }

    businessName.updateValueAndValidity();
    rut.updateValueAndValidity();
    address.updateValueAndValidity();
  }
}
