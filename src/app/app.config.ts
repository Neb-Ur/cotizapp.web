import { writeFeedbackInterceptor } from './core/services/write-feedback.service';
import { HYDRATION_ENABLED } from './core/config/rendering.config';
import { DataModeService } from './core/services/data-mode.service';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

const TrovioTheme = definePreset(Aura, {
  semantic: { primary: {
    50: '#f3f5f8', 100: '#e0e8f0', 200: '#c0d1e0', 300: '#94b2cc',
    400: '#527c9f', 500: '#0f2d4a', 600: '#0d2842', 700: '#0b233a',
    800: '#091e32', 900: '#07192a', 950: '#111827'
  } }
});
import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    provideAppInitializer(() => inject(DataModeService).initialize()),
    providePrimeNG({ translation: { aria: { firstPageLabel: 'Primera página', lastPageLabel: 'Última página', nextPageLabel: 'Página siguiente', prevPageLabel: 'Página anterior', previousPageLabel: 'Página anterior', rowsPerPageLabel: 'Filas por página', pageLabel: 'Página {page}', jumpToPageDropdownLabel: 'Ir a página', jumpToPageInputLabel: 'Ir a página' } }, theme: { preset: TrovioTheme, options: { darkModeSelector: false } } }),
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled'
    })),
    provideHttpClient(withFetch(), withInterceptors([writeFeedbackInterceptor])),
    provideAnimationsAsync(), ...(HYDRATION_ENABLED ? [provideClientHydration(withEventReplay())] : [])
  ]
};
