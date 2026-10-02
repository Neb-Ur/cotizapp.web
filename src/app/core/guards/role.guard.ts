import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/app.models';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const expectedRole = route.data['role'] as UserRole | undefined;
  return authService.verifiedUser().then((currentUser) => {
    if (!expectedRole || !currentUser) {
      return router.parseUrl('/login');
    }

    if (currentUser.role === expectedRole) {
      return true;
    }

    return router.parseUrl(authService.dashboardRouteForRole(currentUser.role));
  });
};
