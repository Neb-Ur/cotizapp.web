import { vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { reload, sendEmailVerification, sendPasswordResetEmail, type Auth } from 'firebase/auth';
import { AuthService } from './auth.service';
import { PrivacyCenterComponent } from '../../pages/privacy-center/privacy-center.component';

describe('account email language and recipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(AuthService.prototype as any, 'initializeFirebaseSession').mockResolvedValue(undefined);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);
    vi.mocked(sendEmailVerification).mockResolvedValue(undefined);
    vi.mocked(reload).mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  function fixture(verified = false) {
    const user = { email: 'owner@example.test', emailVerified: verified };
    const auth = { currentUser: user, languageCode: null } as unknown as Auth;
    const zone = { run: (work: () => unknown) => work(), runOutsideAngular: (work: () => unknown) => work() } as NgZone;
    const service = new AuthService({} as HttpClient, zone);
    (service as any).firebaseAuth = auth;
    return { auth, user, service };
  }

  it('sends password recovery in Spanish to the normalized requested address', async () => {
    const { auth, service } = fixture();
    await service.sendPasswordReset('  Owner@Example.Test  ');
    expect(auth.languageCode).toBe('es');
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, 'owner@example.test');
  });
  it('sends verification in Spanish to the signed-in user after checking their state', async () => {
    const { auth, user, service } = fixture();
    await service.sendVerificationEmail();
    expect(auth.languageCode).toBe('es');
    expect(reload).toHaveBeenCalledWith(user);
    expect(sendEmailVerification).toHaveBeenCalledWith(user);
  });
  it('does not resend verification after the address has already been verified', async () => {
    const { service } = fixture(true);
    await service.sendVerificationEmail();
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });
});


describe('mandatory legal acceptance', () => {
  function fixture() {
    const user = { id: 'user', role: 'maestro', email: 'user@example.test' };
    const auth = { currentUser: vi.fn().mockReturnValue(user), refreshCurrentUser: vi.fn().mockResolvedValue(user), dashboardRouteForUser: vi.fn().mockReturnValue('/dashboard/maestro'), logout: vi.fn().mockResolvedValue(undefined) };
    const privacy = { acceptCurrentLegalDocuments: vi.fn().mockResolvedValue({ legalAcceptanceRequired: false }) };
    const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    const component = new PrivacyCenterComponent(auth as any, {} as any, privacy as any, router as any, document) as any;
    component.overview = { legalAcceptanceRequired: true };
    return { component, auth, privacy, router };
  }
  it('keeps the acceptance blocking until all three declarations are checked, then returns to the dashboard', async () => {
    const { component, privacy, router } = fixture();
    await component.acceptLegalDocuments();
    expect(privacy.acceptCurrentLegalDocuments).not.toHaveBeenCalled();
    component.legalTermsAccepted = component.legalPrivacyAcknowledged = component.legalAgeConfirmed = true;
    await component.acceptLegalDocuments();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard/maestro');
    expect(component.overview.legalAcceptanceRequired).toBe(false);
  });
  it('keeps the modal pending if saving fails', async () => {
    const { component, privacy, router } = fixture();
    component.legalTermsAccepted = component.legalPrivacyAcknowledged = component.legalAgeConfirmed = true;
    privacy.acceptCurrentLegalDocuments.mockRejectedValue(new Error('offline'));
    await component.acceptLegalDocuments();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(component.overview.legalAcceptanceRequired).toBe(true);
    expect(component.error).toBeTruthy();
  });
  it('closes the session on rejection', async () => {
    const { component, auth, router } = fixture();
    await component.rejectLegalDocuments();
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
