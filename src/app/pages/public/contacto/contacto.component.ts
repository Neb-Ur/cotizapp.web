import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API_BASE_URL } from '../../../core/config/api.config';
import { LEGAL_IDENTITY } from '../../../core/config/legal-identity.config';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './contacto.component.html',
  styleUrl: './contacto.component.scss'
})
export class ContactoComponent implements OnInit {
  protected readonly legalIdentity = LEGAL_IDENTITY;
  protected sent = false;
  protected isSubmitting = false;
  protected errorMessage = '';

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    type: ['Maestro', Validators.required],
    businessName: [''],
    phone: [''],
    commune: [''],
    message: ['', [Validators.required, Validators.minLength(8)]],
    website: ['']
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('type')?.toLowerCase() === 'ferreteria') {
      this.form.controls.type.setValue('Ferreteria');
    }
    this.syncStoreValidators();
    this.form.controls.type.valueChanges.subscribe(() => this.syncStoreValidators());
  }

  protected get isStoreRequest(): boolean {
    return this.form.controls.type.value === 'Ferreteria';
  }

  protected async submit(): Promise<void> {
    this.sent = false;
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    try {
      const response = await fetch(`${API_BASE_URL}/solicitudes-contacto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.form.getRawValue())
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || 'No se pudo enviar la solicitud.');

      const type = this.form.controls.type.value;
      this.sent = true;
      this.form.reset({
        name: '', email: '', type, businessName: '', phone: '', commune: '', message: '', website: ''
      });
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo enviar la solicitud.';
    } finally {
      this.isSubmitting = false;
    }
  }

  protected hasError(name: 'name' | 'email' | 'businessName' | 'phone' | 'commune' | 'message'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  private syncStoreValidators(): void {
    const validators = this.isStoreRequest ? [Validators.required, Validators.minLength(2)] : [];
    this.form.controls.businessName.setValidators(validators);
    this.form.controls.phone.setValidators(this.isStoreRequest ? [Validators.required, Validators.minLength(8)] : []);
    this.form.controls.commune.setValidators(validators);
    this.form.controls.businessName.updateValueAndValidity({ emitEvent: false });
    this.form.controls.phone.updateValueAndValidity({ emitEvent: false });
    this.form.controls.commune.updateValueAndValidity({ emitEvent: false });
  }
}
