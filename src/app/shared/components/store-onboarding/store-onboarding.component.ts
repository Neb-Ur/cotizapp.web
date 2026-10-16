import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiClientService } from '../../../core/services/api-client.service';
import { AuthService } from '../../../core/services/auth.service';
import { UiModalComponent } from '../ui-modal/ui-modal.component';

interface OnboardingOverview {
  termsVersion: string;
  privacyVersion: string;
  agreementVersion: string;
  acceptanceRequired: boolean;
  canAccept: boolean;
  storeName: string;
}

@Component({
  selector: 'app-store-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, UiModalComponent],
  templateUrl: './store-onboarding.component.html',
  styleUrl: './store-onboarding.component.scss'
})
export class StoreOnboardingComponent implements OnInit, OnDestroy {
  @Output() ready = new EventEmitter<void>();
  protected overview: OnboardingOverview | null = null;
  protected acceptanceOpen = true;
  protected loading = true;
  protected saving = false;
  protected acceptanceSaved = false;
  protected error = '';
  protected verificationOpen = false;
  protected sentOpen = false;
  protected sending = false;
  protected verificationError = '';
  protected readonly checks = {
    termsAccepted: false, privacyAcknowledged: false, ageConfirmed: false,
    agreementAccepted: false, authorityConfirmed: false, catalogCommitmentConfirmed: false
  };
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private checkingEmail = false;
  private acceptanceUserId: string | null = null;
  private destroyed = false;
  private readonly onFocus = () => { void this.checkVerification(); };

  constructor(
    protected readonly auth: AuthService,
    private readonly api: ApiClientService,
    private readonly router: Router,
    private readonly zone: NgZone
  ) {}

  ngOnInit(): void { void this.load(); }
  protected get acceptanceReady(): boolean {
    return !!this.overview?.canAccept && Object.values(this.checks).every(Boolean);
  }
  protected get needsVerification(): boolean {
    return !this.acceptanceOpen && !!this.auth.currentUser() && !this.auth.emailVerified();
  }

  protected async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.overview = await this.api.get<OnboardingOverview>('/store-onboarding/current', true);
      if (this.destroyed) return;
      if (!this.overview.acceptanceRequired) this.finishAcceptance();
      else if (!this.overview.canAccept) this.error = 'Tu acceso comercial está suspendido o terminado. Contacta a Trovio.';
    } catch {
      this.error = 'No pudimos cargar las condiciones. Reintenta para continuar o cierra la sesión.';
    } finally { this.loading = false; }
  }

  protected async accept(): Promise<void> {
    if (this.saving || !this.overview || (!this.acceptanceSaved && !this.acceptanceReady)) return;
    const userId = this.auth.currentUser()?.id;
    if (!userId) { this.error = 'Tu sesión terminó. Vuelve a iniciar sesión para continuar.'; return; }
    if (this.acceptanceUserId && this.acceptanceUserId !== userId) {
      this.error = 'La cuenta de la sesión cambió. Recarga la página para revisar las condiciones de esa cuenta.';
      return;
    }
    this.acceptanceUserId = userId;
    this.saving = true;
    this.error = '';
    try {
      if (!this.acceptanceSaved) {
        try {
          await this.api.post('/store-onboarding/accept', {
            ...this.checks,
            termsVersion: this.overview.termsVersion,
            privacyVersion: this.overview.privacyVersion,
            agreementVersion: this.overview.agreementVersion
          }, true);
          this.acceptanceSaved = true;
        } catch (error) {
          if (this.destroyed) return;
          if (error instanceof HttpErrorResponse && error.status === 409) {
            Object.keys(this.checks).forEach(key => this.checks[key as keyof typeof this.checks] = false);
            await this.load();
            if (this.acceptanceOpen) this.error = 'Los documentos cambiaron. Revisa las versiones actuales y vuelve a marcar las casillas.';
            return;
          }
          // A lost response does not prove the transaction failed. Consult the
          // server before asking the owner to submit the same declarations again.
          try {
            const current = await this.api.get<OnboardingOverview>('/store-onboarding/current', true);
            if (this.destroyed) return;
            if (current.acceptanceRequired) throw error;
            this.overview = current;
            this.acceptanceSaved = true;
          } catch {
            this.error = this.acceptanceError(error);
            return;
          }
        }
      }
      if (this.destroyed) return;
      try {
        const user = await this.auth.refreshCurrentUser();
        if (this.destroyed) return;
        if (!user) {
          this.error = 'Tus aceptaciones están guardadas. La sesión terminó; vuelve a iniciar sesión para continuar.';
          return;
        }
        if (user.id !== this.acceptanceUserId) {
          this.error = 'La cuenta de la sesión cambió. Recarga la página para continuar.';
          return;
        }
        this.finishAcceptance();
      } catch {
        this.error = 'Tus aceptaciones están guardadas, pero no pudimos actualizar tu sesión. Pulsa «Continuar» para reintentar.';
      }
    } finally { this.saving = false; }
  }

  private acceptanceError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión y continúa con la aceptación.';
      if ([400, 403, 423].includes(error.status)) return error.error?.error?.message || 'No fue posible confirmar las condiciones. Revisa tu cuenta o contacta a Trovio.';
    }
    if (!this.auth.currentUser()) return 'Tu sesión terminó. Vuelve a iniciar sesión para continuar.';
    return 'No pudimos comprobar si la aceptación se guardó. Revisa tu conexión y reintenta; tus casillas se conservaron.';
  }

  protected async reject(): Promise<void> {
    if (this.saving) return;
    // AuthService clears the local session synchronously before contacting Firebase.
    const logout = this.auth.logout();
    await this.router.navigate(['/login']);
    await logout;
  }

  private finishAcceptance(): void {
    this.acceptanceOpen = false;
    this.ready.emit();
    if (!this.auth.emailVerified()) {
      this.verificationOpen = true;
      this.zone.runOutsideAngular(() => {
        this.pollTimer = setInterval(() => {
          if (document.visibilityState !== 'hidden') void this.checkVerification();
        }, 15_000);
        window.addEventListener('focus', this.onFocus);
      });
      void this.checkVerification();
    }
  }

  protected async sendVerification(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    this.verificationError = '';
    try {
      await this.auth.sendVerificationEmail();
      if (this.destroyed) return;
      this.verificationOpen = false;
      if (this.auth.emailVerified()) this.stopPolling();
      else this.sentOpen = true;
    } catch {
      this.verificationError = 'No pudimos enviar el correo. Espera un momento y vuelve a intentarlo.';
    } finally { this.sending = false; }
  }

  protected async checkVerification(): Promise<void> {
    if (this.checkingEmail || this.destroyed || !this.auth.currentUser()) return;
    this.checkingEmail = true;
    try {
      const verified = await this.auth.refreshEmailVerification();
      if (verified && !this.destroyed) this.zone.run(() => {
        this.verificationOpen = false;
        this.sentOpen = false;
        this.verificationError = '';
        this.stopPolling();
      });
    } catch {
      // Keep the reminder while offline; a failed check is not an unverified verdict.
    } finally { this.checkingEmail = false; }
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    window.removeEventListener('focus', this.onFocus);
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopPolling();
    // Reading documents or leaving a view is not an explicit rejection.
    // The server continues to block catalog operations until acceptance.
  }
}
