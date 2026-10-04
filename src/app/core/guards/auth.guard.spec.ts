import { vi, type Mock, type Mocked } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { SessionUser } from '../models/app.models';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authService: Mocked<AuthService>;
  let router: Mocked<Router>;
  const loginTree = {} as UrlTree;
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/dashboard/maestro' } as RouterStateSnapshot;

  beforeEach(() => {
    authService = { verifiedUser: vi.fn() } as unknown as Mocked<AuthService>;
    router = { createUrlTree: vi.fn() } as unknown as Mocked<Router>;
    router.createUrlTree.mockReturnValue(loginTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('allows a Firebase-verified session', async () => {
    authService.verifiedUser.mockResolvedValue({ role: 'maestro' } as SessionUser);

    const result = await TestBed.runInInjectionContext(
      () => authGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBe(true);
  });

  it('redirects an unverified visitor to login and preserves the requested URL', async () => {
    authService.verifiedUser.mockResolvedValue(null);

    const result = await TestBed.runInInjectionContext(
      () => authGuard(route, state) as Promise<boolean | UrlTree>
    );

    expect(result).toBe(loginTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/dashboard/maestro' }
    });
  });
});
