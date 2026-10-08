import { CommonModule } from '@angular/common';
import { Component, afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CookieConsentService } from '../../../core/services/cookie-consent.service';
import { UiModalComponent } from '../ui-modal/ui-modal.component';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, FormsModule, UiModalComponent],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.scss'
})
export class CookieConsentComponent {
  protected preferences = false;

  constructor(protected readonly cookieConsent: CookieConsentService) {
    afterNextRender(() => {
      this.cookieConsent.initializeBrowserState();
      this.syncDraft();
    });
  }

  protected acceptPreferences(): void {
    this.cookieConsent.acceptPreferences();
    this.preferences = true;
  }

  protected rejectOptional(): void {
    this.cookieConsent.rejectOptional();
    this.preferences = false;
  }

  protected openSettings(): void {
    this.syncDraft();
    this.cookieConsent.openSettings();
  }

  protected closeSettings(): void {
    this.cookieConsent.closeSettings();
  }

  protected saveSelection(): void {
    this.cookieConsent.saveSelection({
      preferences: this.preferences
    });
  }

  private syncDraft(): void {
    const consent = this.cookieConsent.consent();
    this.preferences = consent?.preferences ?? false;
  }
}
