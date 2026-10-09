import { BrandMarkComponent } from '../../shared/components/brand-mark/brand-mark.component';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoreAgreementOverview } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { StoreAgreementService } from '../../core/services/store-agreement.service';

@Component({
  selector: 'app-store-agreement',
  standalone: true,
  imports: [BrandMarkComponent, CommonModule, FormsModule, RouterLink],
  templateUrl: './store-agreement.component.html',
  styleUrl: './store-agreement.component.scss'
})
export class StoreAgreementComponent implements OnInit {
  protected overview: StoreAgreementOverview | null = null;
  protected loading = true;
  protected saving = false;
  protected error = '';
  protected notice = '';
  protected draft = {
    legalName: '',
    storeTaxId: '',
    signerName: '',
    signerTaxId: '',
    signerTitle: '',
    accepted: false,
    authorityConfirmed: false,
    catalogCommitmentConfirmed: false
  };

  constructor(
    private readonly agreements: StoreAgreementService,
    private readonly auth: AuthService,
    private readonly router: Router,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  protected get acceptanceReady(): boolean {
    return this.draft.legalName.trim().length >= 2
      && this.draft.storeTaxId.trim().length >= 8
      && this.draft.signerName.trim().length >= 3
      && this.draft.signerTaxId.trim().length >= 8
      && this.draft.signerTitle.trim().length >= 2
      && this.draft.accepted
      && this.draft.authorityConfirmed
      && this.draft.catalogCommitmentConfirmed;
  }

  protected async accept(): Promise<void> {
    if (!this.overview || !this.acceptanceReady || this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      await this.agreements.accept({
        version: this.overview.version,
        ...this.draft
      });
      await this.load();
      this.notice = 'Contrato aceptado y comprobante registrado. Ya puedes administrar el catálogo.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible registrar la aceptación.';
    } finally {
      this.saving = false;
    }
  }

  protected goToDashboard(): void {
    void this.router.navigateByUrl('/dashboard/ferreteria');
  }

  protected printCopy(): void {
    this.document.defaultView?.print();
  }

  protected downloadCopy(): void {
    if (!this.overview) return;
    const agreement = this.overview;
    const lines = [
      `ACUERDO DE PARTICIPACIÓN EN LA MARCHA BLANCA Trovio — VERSIÓN ${agreement.version}`,
      `Vigente desde: ${agreement.effectiveDate}`,
      '',
      `Responsable: ${agreement.provider.legalName}${agreement.provider.taxId ? ` · RUT ${agreement.provider.taxId}` : ''}`,
      'Contacto: formulario /contacto de Trovio',
      `Ferretería: ${agreement.store.legalName} · RUT ${agreement.store.taxId}`,
      `Sucursal: ${agreement.store.branchName} · ${agreement.store.address}, ${agreement.store.commune}`,
      '',
      ...agreement.clauses.flatMap((clause, index) => [`${index + 1}. ${clause.title}`, clause.text, '']),
      `Huella del documento: ${agreement.documentHash}`,
      agreement.agreement ? `Aceptado: ${agreement.agreement.aceptadoEn} · Registro ${agreement.agreement.id}` : 'Pendiente de aceptación.'
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `contrato-cotizapp-ferreteria-v${agreement.version}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.overview = await this.agreements.current();
      this.draft.legalName = this.overview.store.legalName;
      this.draft.storeTaxId = this.overview.store.taxId;
      this.draft.signerName = this.overview.agreement?.firmante?.nombre || this.auth.currentUser()?.displayName || '';
      this.draft.signerTaxId = this.overview.agreement?.firmante?.rut || '';
      this.draft.signerTitle = this.overview.agreement?.firmante?.cargo || '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No fue posible cargar el contrato.';
    } finally {
      this.loading = false;
    }
  }
}
