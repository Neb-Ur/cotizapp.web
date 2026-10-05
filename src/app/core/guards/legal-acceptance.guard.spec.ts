import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { legalAcceptanceGuard } from './legal-acceptance.guard';

describe('legal acceptance routing', () => {
  function fixture(user: unknown) {
    const router = { parseUrl: vi.fn().mockReturnValue('login'), createUrlTree: vi.fn().mockReturnValue('privacy') };
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { verifiedUser: vi.fn().mockResolvedValue(user) } }, { provide: Router, useValue: router }] });
    return { router, run: () => TestBed.runInInjectionContext(() => (legalAcceptanceGuard as any)()) };
  }
  it('lets pending stores reach the home where the mandatory acceptance modal is shown', async () => {
    const { run, router } = fixture({ role: 'ferreteria', legalAcceptanceRequired: true });
    expect(await run()).toBe(true); expect(router.createUrlTree).not.toHaveBeenCalled();
  });
  it('keeps accounts with blocked processing in the privacy center', async () => {
    const { run, router } = fixture({ role: 'ferreteria', privacyProcessingBlocked: true });
    expect(await run()).toBe('privacy');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/cuenta/privacidad-datos'], { queryParams: { reason: 'blocked' } });
  });
  it('keeps the existing acceptance flow for maestros', async () => {
    const { run } = fixture({ role: 'maestro', legalAcceptanceRequired: true });
    expect(await run()).toBe('privacy');
  });
});
