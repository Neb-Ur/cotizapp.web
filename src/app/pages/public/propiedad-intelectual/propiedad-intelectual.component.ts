import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LEGAL_IDENTITY } from '../../../core/config/legal-identity.config';
import { IntellectualPropertyService, IpReportReceipt } from '../../../core/services/intellectual-property.service';
import { IpReport } from '../../../core/models/app.models';

@Component({
  selector: 'app-propiedad-intelectual',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './propiedad-intelectual.component.html',
  styleUrl: './propiedad-intelectual.component.scss'
})
export class PropiedadIntelectualComponent {
  protected readonly legalIdentity = LEGAL_IDENTITY;
  protected receipt: IpReportReceipt | null = null;
  protected submitting = false;
  protected error = '';
  protected statusError = '';
  protected statusResult: (Pick<IpReport, 'reference' | 'status' | 'publicStatusMessage' | 'submittedAt' | 'resolvedAt'> & { updatedAt: string }) | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    claimantName: ['', [Validators.required, Validators.minLength(3)]],
    claimantEmail: ['', [Validators.required, Validators.email]],
    organization: [''],
    capacity: ['', Validators.required],
    rightsType: ['', Validators.required],
    contentType: ['', Validators.required],
    targetType: ['other', Validators.required],
    targetId: [''],
    contentUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
    originalWorkUrl: ['', Validators.pattern(/^(|https?:\/\/.+)$/i)],
    workDescription: ['', [Validators.required, Validators.minLength(20)]],
    infringementDescription: ['', [Validators.required, Validators.minLength(20)]],
    goodFaithConfirmed: [false, Validators.requiredTrue],
    accuracyConfirmed: [false, Validators.requiredTrue],
    contactAuthorized: [false, Validators.requiredTrue],
    website: ['']
  });
  protected readonly statusForm = this.formBuilder.nonNullable.group({
    reference: ['', Validators.required],
    receiptToken: ['', [Validators.required, Validators.minLength(32)]]
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly ipService: IntellectualPropertyService,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  protected async submit(): Promise<void> {
    this.error = '';
    this.receipt = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    try {
      this.receipt = await this.ipService.create(this.form.getRawValue());
      this.form.reset({
        claimantName: '', claimantEmail: '', organization: '', capacity: '', rightsType: '', contentType: '',
        targetType: 'other', targetId: '', contentUrl: '', originalWorkUrl: '', workDescription: '',
        infringementDescription: '', goodFaithConfirmed: false, accuracyConfirmed: false,
        contactAuthorized: false, website: ''
      });
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible registrar la denuncia.';
    } finally {
      this.submitting = false;
    }
  }

  protected downloadReceipt(): void {
    if (!this.receipt) return;
    const text = [
      'COMPROBANTE DE DENUNCIA DE PROPIEDAD INTELECTUAL — COTIZAPP',
      `Referencia: ${this.receipt.reference}`,
      `Código privado: ${this.receipt.receiptToken}`,
      `Recibida: ${this.receipt.acknowledgedAt}`,
      `Revisión inicial esperada: ${this.receipt.initialReviewDueAt}`,
      '',
      'Conserva la referencia y el código privado. CotizApp no volverá a mostrar el código completo.'
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.receipt.reference.toLowerCase()}-comprobante.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected async checkStatus(): Promise<void> {
    this.statusError = '';
    this.statusResult = null;
    if (this.statusForm.invalid) {
      this.statusForm.markAllAsTouched();
      return;
    }
    try {
      const { reference, receiptToken } = this.statusForm.getRawValue();
      this.statusResult = await this.ipService.status(reference.trim(), receiptToken.trim());
    } catch (error) {
      this.statusError = error instanceof Error ? error.message : 'No fue posible consultar la denuncia.';
    }
  }
}
