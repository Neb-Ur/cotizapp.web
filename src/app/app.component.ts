import { DataModeService } from './core/services/data-mode.service';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './core/services/seo.service';
import { CookieConsentComponent } from './shared/components/cookie-consent/cookie-consent.component';
import { HelpWidgetComponent } from './shared/components/help-widget/help-widget.component';
import { SiteFooterComponent } from './shared/components/site-footer/site-footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SiteFooterComponent, HelpWidgetComponent, CookieConsentComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  protected readonly dataMode = inject(DataModeService);
  private readonly seoService = inject(SeoService);

  constructor() {
    this.seoService.initialize();
  }
}
