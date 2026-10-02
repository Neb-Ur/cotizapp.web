import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { SessionUser } from '../models/app.models';
import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  const loginTree = {} as UrlTree;
  const ownDashboardTree = {} as UrlTree;
  const state = { url: '/dashboard/admin/validaciones' } as RouterStateSnapshot;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['verifiedUser', 'dashboardRouteForRole']);
    router = jasmine.createSpyObj<Router>('Router', ['parseUrl']);
    router.parseUrl.and.callFake((url) => url === '/login' ? loginTree : ownDashboardTree);
    authService.dashboardRouteForRole.and.returnValue('/dashboard/maestro');

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('allows the role declared by the route', async () => {
    authService.verifiedUser.and.resolveTo({ role: 'admin' } as SessionUser);
    const route = { data: { role: 'admin' } } as unknown as ActivatedRouteSnapshot;

    const result = await TestBed.runInInjectionContext(
      () => roleGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBeTrue();
  });

  it('redirects a different role to its own dashboard', async () => {
    authService.verifiedUser.and.resolveTo({ role: 'maestro' } as SessionUser);
    const route = { data: { role: 'admin' } } as unknown as ActivatedRouteSnapshot;

    const result = await TestBed.runInInjectionContext(
      () => roleGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBe(ownDashboardTree);
    expect(authService.dashboardRouteForRole).toHaveBeenCalledWith('maestro');
    expect(router.parseUrl).toHaveBeenCalledWith('/dashboard/maestro');
  });

  it('redirects a visitor without a verified session to login', async () => {
    authService.verifiedUser.and.resolveTo(null);
    const route = { data: { role: 'admin' } } as unknown as ActivatedRouteSnapshot;

    const result = await TestBed.runInInjectionContext(
      () => roleGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBe(loginTree);
    expect(router.parseUrl).toHaveBeenCalledWith('/login');
  });
});
