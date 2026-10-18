import { isPlatformServer } from '@angular/common';
import {VisitAnalyticsService} from './core/services/visit-analytics.service';
import { PilotBannerComponent } from './shared/components/pilot-banner/pilot-banner.component';
import { WriteFeedbackService } from './core/services/write-feedback.service';
import { Component, effect, inject, signal, PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { SeoService } from './core/services/seo.service';
import { CookieConsentComponent } from './shared/components/cookie-consent/cookie-consent.component';
import { HelpWidgetComponent } from './shared/components/help-widget/help-widget.component';
import { SiteFooterComponent } from './shared/components/site-footer/site-footer.component';

export const APP_SSR_READY = makeStateKey<boolean>('trovio-app-ssr-ready');

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [PilotBannerComponent, RouterOutlet, SiteFooterComponent, HelpWidgetComponent, CookieConsentComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  protected readonly api = inject(WriteFeedbackService);
  private readonly visitAnalytics = inject(VisitAnalyticsService);
  private readonly seoService = inject(SeoService);
  protected readonly pageLoading = signal(true);
  protected readonly pageLoadFailed = signal(false);

  constructor() {
    this.seoService.initialize();
    const auth = inject(AuthService);
    const router = inject(Router);
    const transfer = inject(TransferState);
    // The server already delivered the public page. Keep its DOM in place while
    // the first client navigation hydrates it; CSR-only guarded routes still load.
    this.pageLoading.set(!router.navigated && !transfer.get(APP_SSR_READY, false));
    if (isPlatformServer(inject(PLATFORM_ID))) transfer.set(APP_SSR_READY, true);
    router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationEnd) this.pageLoading.set(false);
      if (event instanceof NavigationError && this.pageLoading()) this.pageLoadFailed.set(true);
    });
    effect(() => {
      if (auth.sessionExpired()) {
        void router.navigate(['/login'], { queryParams: { reason: 'inactivity' } });
      }
    });
  }

  protected retryPageLoad(): void {
    if (typeof window !== 'undefined') window.location.reload();
  }
}
