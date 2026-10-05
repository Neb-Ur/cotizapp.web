import { vi } from 'vitest';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { getIdToken, onIdTokenChanged, signOut, type Auth } from 'firebase/auth';
import { AuthService, SESSION_IDLE_TIMEOUT_MS } from './auth.service';

const profile = { id: 'user-1', correo: 'user@example.test', nombre: 'Usuario', rol: 'maestro' };
const user = { id: profile.id, email: profile.correo, displayName: profile.nombre, role: 'maestro' };
const response = { ok: true, data: { usuario: profile, requiereCompletarPerfil: false } };
const zone = { run: (work: () => unknown) => work(), runOutsideAngular: (work: () => unknown) => work() } as NgZone;

describe('session restoration and inactivity', () => {
  const services: AuthService[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T03:00:00Z'));
    localStorage.clear(); sessionStorage.clear();
    vi.mocked(getIdToken).mockResolvedValue('fresh-firebase-token');
    vi.mocked(signOut).mockResolvedValue(undefined);
  });
  afterEach(() => {
    services.splice(0).forEach(service => service.ngOnDestroy());
    vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers();
  });

  function fixture(age = 0, mode: 'local' | 'session' = 'local', get = vi.fn().mockReturnValue(of(response))) {
    const firebaseUser = { uid: user.id, email: user.email };
    const auth = { currentUser: firebaseUser, authStateReady: vi.fn().mockResolvedValue(undefined) } as unknown as Auth;
    const at = Date.now() - age;
    const storage = mode === 'local' ? localStorage : sessionStorage;
    storage.setItem('cotizapp-session', JSON.stringify({ user, token: 'old-cached-token', lastActivityAt: at }));
    localStorage.setItem('cotizapp-session-activity', JSON.stringify({ userId: user.id, at }));
    vi.spyOn(AuthService.prototype as any, 'getAuth').mockResolvedValue(auth);
    let notify: (value: any) => Promise<void>;
    vi.mocked(onIdTokenChanged).mockImplementation((_auth, observer: any) => {
      notify = observer;
      void observer(firebaseUser);
      return vi.fn();
    });
    const service = new AuthService({ get } as unknown as HttpClient, zone);
    services.push(service);
    return { service, auth, get, notify: (value: any) => notify(value) };
  }

  for (const mode of ['local', 'session'] as const) {
    it(`restores the Firebase user on reload with ${mode} persistence and uses a fresh token`, async () => {
      const { service, get, auth } = fixture(10 * 60_000, mode);
      expect((await service.verifiedUser())?.id).toBe(user.id);
      expect(auth.authStateReady).toHaveBeenCalled();
      expect(service.isLoggedIn()).toBe(true);
      expect(get.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer fresh-firebase-token');
      expect((mode === 'local' ? localStorage : sessionStorage).getItem('cotizapp-session')).not.toBeNull();
    });
  }

  it('waits for Firebase restoration before deciding whether the route has a logged-in user', async () => {
    const { service, auth, get } = fixture();
    let ready!: () => void;
    vi.mocked(auth.authStateReady).mockReturnValue(new Promise<void>(resolve => { ready = resolve; }));
    const verification = service.verifiedUser();
    await Promise.resolve();
    expect(service.isLoggedIn()).toBe(false);
    expect(get).not.toHaveBeenCalled();
    ready();
    expect((await verification)?.id).toBe(user.id);
  });

  it('clears the session when the server rejects its credentials, rather than treating this as an outage', async () => {
    const get = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const { service } = fixture(60_000, 'local', get);
    expect(await service.verifiedUser()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('cotizapp-session')).toBeNull();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(get).toHaveBeenCalledOnce();
  });

  it('renews the idle deadline on user interaction, then logs out after 30 idle minutes', async () => {
    const { service } = fixture();
    await service.verifiedUser();
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_TIMEOUT_MS - 60_000);
    window.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_TIMEOUT_MS - 1);
    expect(service.isLoggedIn()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(service.currentUser()).toBeNull();
    expect(service.sessionExpired()).toBe(true);
    expect(signOut).toHaveBeenCalledOnce();
    expect(localStorage.getItem('cotizapp-session')).toBeNull();
  });

  it('does not reset the inactivity deadline when reloading or refreshing a token', async () => {
    const { service, notify, auth } = fixture(25 * 60_000);
    await service.verifiedUser();
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    await notify(auth.currentUser);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(service.sessionExpired()).toBe(true);
  });

  it('rejects an already expired persisted session before loading the profile', async () => {
    const { service, get } = fixture(SESSION_IDLE_TIMEOUT_MS);
    expect(await service.verifiedUser()).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });

  it('preserves the persisted session during an API outage and restores it when the API recovers', async () => {
    const get = vi.fn().mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })))
      .mockReturnValue(of(response));
    const { service } = fixture(60_000, 'local', get);
    await (service as any).sessionReadyPromise;
    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('cotizapp-session')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(service.isLoggedIn()).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('does not let an in-flight token validation restore a session after explicit logout', async () => {
    const { service, get, notify, auth } = fixture();
    await service.verifiedUser();
    const pending = new Subject<any>();
    get.mockReturnValueOnce(pending);
    const validation = notify(auth.currentUser);
    await Promise.resolve();
    await service.logout();
    pending.next(response); pending.complete();
    await validation;
    expect(service.isLoggedIn()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(localStorage.getItem('cotizapp-session')).toBeNull();
  });

  it('shares recent activity across tabs without treating focus alone as activity', async () => {
    const { service } = fixture(29 * 60_000);
    await service.verifiedUser();
    localStorage.setItem('cotizapp-session-activity', JSON.stringify({ userId: user.id, at: Date.now() }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'cotizapp-session-activity' }));
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_TIMEOUT_MS - 1);
    window.dispatchEvent(new Event('focus'));
    expect(service.isLoggedIn()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(service.sessionExpired()).toBe(true);
  });
});
