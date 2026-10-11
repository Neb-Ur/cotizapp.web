import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { GuestQuotationService } from '../services/guest-quotation.service';

export const publicQuotationGuard: CanActivateFn = async route => {
  const auth = inject(AuthService); const router = inject(Router); const guest = inject(GuestQuotationService);
  const user = await auth.verifiedUser();
  const localDetail = route.routeConfig?.path === 'cotizaciones/local/:projectId';
  const creating = route.routeConfig?.path === 'cotizaciones/nueva' || (localDetail && route.params['projectId'] === 'nuevo');
  if (user && (!localDetail || creating)) {
    if (user.role !== 'maestro') return router.parseUrl(auth.dashboardRouteForUser(user));
    return creating ? router.createUrlTree(['/dashboard/maestro/cotizaciones/nuevo'], { queryParams: route.queryParams })
      : router.createUrlTree(['/dashboard/maestro'], { queryParams: { section: 'cotizaciones' } });
  }
  if (creating && !guest.canCreate()) return router.createUrlTree(['/cotizaciones'], { queryParams: { limite: '1' } });
  if (localDetail && creating) return router.parseUrl('/cotizaciones/nueva');
  return true;
};
