import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { API_BASE_URL } from '../../../core/config/api.config';

@Component({
  selector: 'app-unsubscribe',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './unsubscribe.component.html',
  styleUrl: './unsubscribe.component.scss'
})
export class UnsubscribeComponent {
  protected sent = false;
  protected submitting = false;
  protected error = '';
  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    website: ['']
  });

  constructor(private readonly formBuilder: FormBuilder) {}

  protected async submit(): Promise<void> {
    this.error = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    try {
      const response = await fetch(`${API_BASE_URL}/marketing/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.form.getRawValue())
      });
      if (!response.ok) throw new Error('No fue posible registrar la solicitud.');
      this.sent = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible registrar la solicitud.';
    } finally {
      this.submitting = false;
    }
  }
}
