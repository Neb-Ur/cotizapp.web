import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LEGAL_IDENTITY } from '../../../core/config/legal-identity.config';
import { API_BASE_URL } from '../../../core/config/api.config';

@Component({
  selector: 'app-price-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './price-report.component.html',
  styleUrl: './price-report.component.scss'
})
export class PriceReportComponent {
  protected submitting = false;
  protected reference = '';
  protected error = '';
  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    productName: [this.route.snapshot.queryParamMap.get('product') || '', Validators.required],
    storeName: [this.route.snapshot.queryParamMap.get('store') || '', Validators.required],
    storeId: [this.route.snapshot.queryParamMap.get('storeId') || '', Validators.required],
    offerId: [this.route.snapshot.queryParamMap.get('offerId') || '', Validators.required],
    displayedPrice: [Number(this.route.snapshot.queryParamMap.get('price') || 0), [Validators.required, Validators.min(0)]],
    observedPrice: [0, [Validators.required, Validators.min(0)]],
    details: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    website: [''],
    privacyAcknowledged: [false, Validators.requiredTrue]
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly route: ActivatedRoute,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  protected async submit(): Promise<void> {
    this.error = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    try {
      const response = await fetch(`${API_BASE_URL}/price-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.form.getRawValue(), privacyVersion: LEGAL_IDENTITY.privacyPolicyVersion, contentUrl: this.document.location.href })
      });
      const body = await response.json() as { data?: { reference?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || 'No fue posible registrar el reclamo.');
      this.reference = body.data?.reference || '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible registrar el reclamo.';
    } finally {
      this.submitting = false;
    }
  }
}
