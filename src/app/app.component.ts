import { PilotBannerComponent } from './shared/components/pilot-banner/pilot-banner.component';
import { WriteFeedbackService } from './core/services/write-feedback.service';
import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { SeoService } from './core/services/seo.service';
import { CookieConsentComponent } from './shared/components/cookie-consent/cookie-consent.component';
import { HelpWidgetComponent } from './shared/components/help-widget/help-widget.component';
import { SiteFooterComponent } from './shared/components/site-footer/site-footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [PilotBannerComponent, RouterOutlet, SiteFooterComponent, HelpWidgetComponent, CookieConsentComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  protected readonly api = inject(WriteFeedbackService);
  private readonly seoService = inject(SeoService);

  constructor() {
    this.seoService.initialize();
    const auth = inject(AuthService);
    const router = inject(Router);
    effect(() => {
      if (auth.sessionExpired()) {
        void router.navigate(['/login'], { queryParams: { reason: 'inactivity' } });
      }
    });
  }
}
