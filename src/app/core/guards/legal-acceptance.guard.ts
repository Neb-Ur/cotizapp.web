import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const legalAcceptanceGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.verifiedUser().then((user) => {
    if (!user) return router.parseUrl('/login');
    if (user.role === 'ferreteria' && !user.privacyProcessingBlocked) return true;
    if (user.legalAcceptanceRequired || user.privacyProcessingBlocked) {
      return router.createUrlTree(['/cuenta/privacidad-datos'], {
        queryParams: {
          reason: user.privacyProcessingBlocked ? 'blocked' : 'legal-update',
          returnUrl: state.url
        }
      });
    }
    return true;
  });
};
