import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.verifiedUser().then((user) => user
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
};
