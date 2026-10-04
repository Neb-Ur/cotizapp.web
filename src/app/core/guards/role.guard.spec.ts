import { vi, type Mock, type Mocked } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { SessionUser } from '../models/app.models';
import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  let authService: Mocked<AuthService>;
  let router: Mocked<Router>;
  const loginTree = {} as UrlTree;
  const ownDashboardTree = {} as UrlTree;
  const state = { url: '/dashboard/admin/validaciones' } as RouterStateSnapshot;

  beforeEach(() => {
    authService = { verifiedUser: vi.fn(), dashboardRouteForRole: vi.fn() } as unknown as Mocked<AuthService>;
    router = { parseUrl: vi.fn() } as unknown as Mocked<Router>;
    router.parseUrl.mockImplementation((url: string) => url === '/login' ? loginTree : ownDashboardTree);
    authService.dashboardRouteForRole.mockReturnValue('/dashboard/maestro');

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('allows the role declared by the route', async () => {
    authService.verifiedUser.mockResolvedValue({ role: 'admin' } as SessionUser);
    const route = { data: { role: 'admin' } } as unknown as ActivatedRouteSnapshot;

    const result = await TestBed.runInInjectionContext(
      () => roleGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBe(true);
  });

  it('redirects a different role to its own dashboard', async () => {
    authService.verifiedUser.mockResolvedValue({ role: 'maestro' } as SessionUser);
    const route = { data: { role: 'admin' } } as unknown as ActivatedRouteSnapshot;

    const result = await TestBed.runInInjectionContext(
      () => roleGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBe(ownDashboardTree);
    expect(authService.dashboardRouteForRole).toHaveBeenCalledWith('maestro');
    expect(router.parseUrl).toHaveBeenCalledWith('/dashboard/maestro');
  });

  it('redirects a visitor without a verified session to login', async () => {
    authService.verifiedUser.mockResolvedValue(null);
    const route = { data: { role: 'admin' } } as unknown as ActivatedRouteSnapshot;

    const result = await TestBed.runInInjectionContext(
      () => roleGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBe(loginTree);
    expect(router.parseUrl).toHaveBeenCalledWith('/login');
  });
});
