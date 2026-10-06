import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PrivacyOverview, PrivacyRequestType, SessionUser } from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { CookieConsentService } from '../../core/services/cookie-consent.service';
import { AccountDeletionReceipt, PrivacyDataService } from '../../core/services/privacy-data.service';
import { UiModalComponent } from '../../shared/components/ui-modal/ui-modal.component';

interface ProfileDraft {
  displayName: string;
  phone: string;
  city: string;
  commune: string;
  region: string;
  address: string;
}

@Component({
  selector: 'app-privacy-center',
  standalone: true,
  imports: [PasswordFieldComponent, CommonModule, FormsModule, RouterLink, UiModalComponent],
  templateUrl: './privacy-center.component.html',
  styleUrl: './privacy-center.component.scss'
})
export class PrivacyCenterComponent implements OnInit {
  protected overview: PrivacyOverview | null = null;
  protected loading = true;
  protected busyAction = '';
  protected notice = '';
  protected error = '';
  protected selectedRequestType: PrivacyRequestType | '' = '';
  protected requestDetails = '';
  protected legalTermsAccepted = false;
  protected legalPrivacyAcknowledged = false;
  protected legalAgeConfirmed = false;
  protected marketingConsent = false;
  protected deleteEmail = '';
  protected deletePassword = '';
  protected deleteConfirmed = false;
  protected deletePanelOpen = false;
  protected deletionReceipt: AccountDeletionReceipt | null = null;
  protected profileDraft: ProfileDraft = this.emptyProfileDraft();

  protected readonly requestOptions: Array<{ value: PrivacyRequestType; label: string; help: string }> = [
    { value: 'access', label: 'Acceso', help: 'Consulta qué datos tratamos, su origen, finalidad y destinatarios.' },
    { value: 'rectification', label: 'Rectificación', help: 'Solicita corregir información que no puedas editar directamente.' },
    { value: 'deletion', label: 'Supresión', help: 'Solicita eliminar datos específicos cuando corresponda.' },
    { value: 'objection', label: 'Oposición', help: 'Solicita detener el uso publicitario de tus datos u otro tratamiento cuando corresponda.' },
    { value: 'blocking', label: 'Bloqueo temporal', help: 'Suspende temporalmente el tratamiento mientras se revisa tu solicitud.' },
    { value: 'portability', label: 'Copia de datos', help: 'Solicita tus datos en un formato estructurado y reutilizable.' }
  ];

  constructor(
    protected readonly auth: AuthService,
    protected readonly cookies: CookieConsentService,
    private readonly privacyData: PrivacyDataService,
    private readonly router: Router,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  ngOnInit(): void {
    void this.loadOverview();
  }

  protected get user(): SessionUser | null {
    return this.auth.currentUser();
  }

  protected get legalAcceptanceIncomplete(): boolean {
    return !this.legalTermsAccepted || !this.legalPrivacyAcknowledged || !this.legalAgeConfirmed;
  }

  protected get deleteReady(): boolean {
    return !!this.deletePassword && this.deleteConfirmed && this.deleteEmail.trim().toLowerCase() === (this.user?.email || '').toLowerCase();
  }

  protected get selectedRequestHelp(): string {
    return this.requestOptions.find((option) => option.value === this.selectedRequestType)?.help || '';
  }

  protected get cookieSummary(): string {
    const consent = this.cookies.consent();
    if (!consent) return 'Aún no has elegido tus preferencias de cookies.';
    return consent.preferences ? 'Preferencias autorizadas. Analítica no utilizada.' : 'Solo cookies estrictamente necesarias.';
  }

  protected async acceptLegalDocuments(): Promise<void> {
    if (this.legalAcceptanceIncomplete) return;
    await this.runAction('legal', async () => {
      this.overview = await this.privacyData.acceptCurrentLegalDocuments(this.marketingConsent, this.overview!.currentVersions);
      await this.auth.refreshCurrentUser();
      this.notice = 'Aceptación registrada con versión, fecha, hora y cuenta asociada.';
      await this.router.navigateByUrl(this.auth.dashboardRouteForUser(this.user));
    });
  }

  protected async rejectLegalDocuments(): Promise<void> {
    if (this.busyAction === 'legal') return;
    const logout = this.auth.logout();
    await this.router.navigateByUrl('/login');
    await logout;
  }

  protected async saveProfile(): Promise<void> {
    if (!this.profileDraft.displayName.trim()) {
      this.error = 'El nombre no puede quedar vacío.';
      return;
    }
    await this.runAction('profile', async () => {
      await this.auth.updateProfile({
        displayName: this.profileDraft.displayName.trim(),
        phone: this.profileDraft.phone.trim(),
        city: this.profileDraft.city.trim(),
        commune: this.profileDraft.commune.trim(),
        region: this.profileDraft.region.trim(),
        address: this.profileDraft.address.trim()
      });
      this.notice = 'Tus datos de perfil fueron corregidos.';
    });
  }

  protected async updateMarketing(granted: boolean): Promise<void> {
    await this.runAction('marketing', async () => {
      this.overview = await this.privacyData.updateMarketingConsent(granted);
      this.marketingConsent = granted;
      this.notice = granted
        ? 'Consentimiento opcional registrado.'
        : 'Consentimiento opcional retirado. Los tratamientos obligatorios para prestar el servicio no se modificaron.';
    });
  }

  protected async submitRequest(): Promise<void> {
    if (!this.selectedRequestType) {
      this.error = 'Selecciona el derecho que deseas ejercer.';
      return;
    }
    if (this.selectedRequestType !== 'access' && this.requestDetails.trim().length < 10) {
      this.error = 'Describe con más detalle los datos o el tratamiento involucrado.';
      return;
    }
    await this.runAction('request', async () => {
      await this.privacyData.createRequest(this.selectedRequestType as PrivacyRequestType, this.requestDetails.trim());
      this.selectedRequestType = '';
      this.requestDetails = '';
      await this.loadOverview(false);
      this.notice = 'Solicitud recibida. El comprobante y su fecha límite ya aparecen en el historial.';
    });
  }

  protected async downloadData(): Promise<void> {
    await this.runAction('export', async () => {
      const response = await this.privacyData.exportData();
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = `cotizapp-datos-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      await this.loadOverview(false);
      this.notice = response.data['emailLinkedRecordsIncluded'] === false
        ? 'Exportamos los datos de tu cuenta. Verifica tu correo para incluir solicitudes realizadas sin iniciar sesión.'
        : 'Exportación generada y registrada como solicitud completada.';
    });
  }

  protected async verifyEmail(): Promise<void> {
    await this.runAction('verify', async () => {
      await this.auth.sendVerificationEmail();
      this.notice = 'Revisa tu correo y abre el enlace de verificación. Después presiona “Ya verifiqué mi correo”.';
    });
  }

  protected async refreshVerification(): Promise<void> {
    await this.runAction('verify', async () => {
      const verified = await this.auth.refreshEmailVerification();
      this.notice = verified ? 'Correo verificado. Puedes volver a descargar tu exportación completa.' : 'Tu correo todavía no está verificado.';
    });
  }

  protected openCookieSettings(): void {
    this.cookies.openSettings();
  }

  protected rejectOptionalCookies(): void {
    this.cookies.rejectOptional();
    this.notice = 'Se retiraron las cookies opcionales y la ubicación guardada en esta sesión.';
  }

  protected async deleteAccount(): Promise<void> {
    if (!this.deleteReady) return;
    await this.runAction('delete', async () => {
      await this.auth.confirmPassword(this.deletePassword);
      this.deletePassword = '';
      this.deletionReceipt = await this.privacyData.deleteAccount(this.deleteEmail.trim());
      await this.auth.clearAfterAccountDeletion();
      this.deletePanelOpen = false;
    });
  }

  protected async leaveAfterDeletion(): Promise<void> {
    await this.router.navigateByUrl('/');
  }

  protected requestLabel(type: PrivacyRequestType): string {
    return this.requestOptions.find((option) => option.value === type)?.label || type;
  }

  protected consentLabel(type: string): string {
    const labels: Record<string, string> = {
      terms: 'Términos del servicio',
      privacy_notice: 'Autorización de datos y aviso de privacidad',
      age_declaration: 'Declaración de mayoría de edad',
      marketing: 'Comunicaciones opcionales'
    };
    return labels[type] || type;
  }

  private async loadOverview(showLoader = true): Promise<void> {
    if (showLoader) this.loading = true;
    try {
      this.overview = await this.privacyData.overview();
      this.marketingConsent = this.overview.marketingConsent;
      this.syncProfileDraft();
    } catch (error) {
      this.error = this.errorMessage(error, 'No pudimos cargar tu información de privacidad.');
    } finally {
      if (showLoader) this.loading = false;
    }
  }

  private syncProfileDraft(): void {
    const user = this.user;
    if (!user) return;
    this.profileDraft = {
      displayName: user.displayName || '',
      phone: user.phone || '',
      city: user.city || '',
      commune: user.commune || '',
      region: user.region || '',
      address: user.address || ''
    };
  }

  private async runAction(name: string, action: () => Promise<void>): Promise<void> {
    this.error = '';
    this.notice = '';
    this.busyAction = name;
    try {
      await action();
    } catch (error) {
      this.error = this.errorMessage(error, 'No pudimos completar la acción.');
    } finally {
      this.busyAction = '';
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = error.error?.error?.message;
      if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    }
    return error instanceof Error && error.message.trim() ? error.message : fallback;
  }

  private emptyProfileDraft(): ProfileDraft {
    return { displayName: '', phone: '', city: '', commune: '', region: '', address: '' };
  }
}
