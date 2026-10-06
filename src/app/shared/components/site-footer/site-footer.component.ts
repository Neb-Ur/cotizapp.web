import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookieConsentService } from '../../../core/services/cookie-consent.service';
import { LEGAL_IDENTITY } from '../../../core/config/legal-identity.config';
import { BrandMarkComponent } from '../brand-mark/brand-mark.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink, BrandMarkComponent],
  templateUrl: './site-footer.component.html',
  styleUrl: './site-footer.component.scss'
})
export class SiteFooterComponent {
  protected readonly legalIdentity = LEGAL_IDENTITY;

  constructor(private readonly cookieConsent: CookieConsentService, protected readonly auth: AuthService) {}

  protected openCookieSettings(): void {
    this.cookieConsent.openSettings();
  }
}
