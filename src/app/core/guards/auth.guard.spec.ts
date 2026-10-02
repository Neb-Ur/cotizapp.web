import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { SessionUser } from '../models/app.models';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  const loginTree = {} as UrlTree;
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/dashboard/maestro' } as RouterStateSnapshot;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['verifiedUser']);
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(loginTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('allows a Firebase-verified session', async () => {
    authService.verifiedUser.and.resolveTo({ role: 'maestro' } as SessionUser);

    const result = await TestBed.runInInjectionContext(
      () => authGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBeTrue();
  });

  it('redirects an unverified visitor to login and preserves the requested URL', async () => {
    authService.verifiedUser.and.resolveTo(null);

    const result = await TestBed.runInInjectionContext(
      () => authGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBe(loginTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/dashboard/maestro' }
    });
  });
});
