import { HYDRATION_ENABLED } from './core/config/rendering.config';
import { DataModeService } from './core/services/data-mode.service';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    provideAppInitializer(() => inject(DataModeService).initialize()),
    providePrimeNG({ translation: { aria: { firstPageLabel: 'Primera página', lastPageLabel: 'Última página', nextPageLabel: 'Página siguiente', prevPageLabel: 'Página anterior', previousPageLabel: 'Página anterior', rowsPerPageLabel: 'Filas por página', pageLabel: 'Página {page}', jumpToPageDropdownLabel: 'Ir a página', jumpToPageInputLabel: 'Ir a página' } }, theme: { preset: Aura, options: { darkModeSelector: false } } }),
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled'
    })),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(), ...(HYDRATION_ENABLED ? [provideClientHydration()] : [])
  ]
};
