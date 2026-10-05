import { vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { reload, sendEmailVerification, sendPasswordResetEmail, type Auth } from 'firebase/auth';
import { AuthService } from './auth.service';

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
