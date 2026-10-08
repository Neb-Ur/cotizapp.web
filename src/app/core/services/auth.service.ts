import { DataModeService } from './data-mode.service';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, NgZone, OnDestroy, computed, signal } from '@angular/core';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  getIdToken,
  onIdTokenChanged,
  sendPasswordResetEmail,
  updatePassword,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Auth
} from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { LoginPayload, RegisterPayload, SessionUser, UserRole } from '../models/app.models';
import { API_BASE_URL } from '../config/api.config';
import { getFirebaseAuthInstance } from '../config/firebase.config';
import { STRONG_PASSWORD_PATTERN } from '../utils/password-policy.util';

export const LOGIN_SUPPORT_ERROR_MESSAGE = 'Usuario con error, favor contactarse con soporte.';
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export class ProfileCompletionRequiredError extends Error {
  constructor(readonly email: string) {
    super('Debes completar tu perfil para continuar.');
    this.name = 'ProfileCompletionRequiredError';
  }
}

type StorageMode = 'local' | 'session';

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface ApiAuthUser {
  id: string;
  ferreteriaId?: string;
  rol: UserRole;
  nombre: string;
  correo: string;
  telefono?: string;
  ciudad?: string;
  comuna?: string;
  region?: string;
  direccion?: string;
  estadoCuenta?: 'activo' | 'bloqueado' | 'pendiente';
  creadoEn?: string;
  nombreComercial?: string;
  rut?: string;
  latitud?: number | null;
  longitud?: number | null;
  tratamientoBloqueado?: boolean;
  contratoFerreteriaEstado?: 'pendiente' | 'vigente' | 'suspendido' | 'terminado';
  contratoFerreteriaVersion?: string;
  contratoFerreteriaAceptadoEn?: string;
}

interface ApiAuthSession {
  usuario: ApiAuthUser | null;
  requiereCompletarPerfil: boolean;
  requiereAceptacionLegal?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly apiBaseUrl = API_BASE_URL;
  private readonly sessionStorageKey = 'cotizapp-session';

  private readonly currentUserState = signal<SessionUser | null>(null);
  private readonly tokenState = signal<string | null>(null);
  private readonly emailVerifiedState = signal(false);
  readonly emailVerified = this.emailVerifiedState.asReadonly();
  private readonly sessionVerifiedState = signal(false);
  private readonly sessionReadyPromise: Promise<void>;
  private sessionVerifiedAt = 0;
  private sessionVerificationPromise: Promise<SessionUser | null> | null = null;
  private firebaseAuth: Auth | null = null;
  private storageMode: StorageMode = 'local';
  private readonly activityStorageKey = 'cotizapp-session-activity';
  private lastActivityAt = 0;
  private sessionGeneration = 0;
  private sessionClosed = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeAuth: (() => void) | null = null;
  private readonly activityEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
  readonly sessionExpired = signal(false);

  private readonly onActivity = () => {
    if (!this.sessionVerifiedState() || !this.currentUserState()) return;
    this.readSharedActivity();
    if (this.isIdleExpired()) { void this.expireIdleSession(); return; }
    if (Date.now() - this.lastActivityAt < 1_000) return;
    this.lastActivityAt = Date.now();
    this.writeActivity();
    this.scheduleIdleCheck();
  };
  private readonly onResume = () => {
    if (!this.currentUserState()) return;
    this.readSharedActivity();
    if (this.isIdleExpired()) void this.expireIdleSession();
    else this.scheduleIdleCheck();
  };
  private readonly onStorage = (event: StorageEvent) => {
    if (event.key === this.activityStorageKey) this.onResume();
  };

  readonly currentUser = computed(() => this.currentUserState());
  readonly isLoggedIn = computed(
    () => this.sessionVerifiedState() && this.currentUserState() !== null,
  );

  constructor(
    private readonly http: HttpClient,
    private readonly ngZone: NgZone,
    private readonly dataMode: DataModeService | null = null
  ) {
    this.restoreCachedSession();
    if (typeof window !== 'undefined') this.ngZone.runOutsideAngular(() => {
      this.activityEvents.forEach(event => window.addEventListener(event, this.onActivity, { passive: true }));
      window.addEventListener('focus', this.onResume);
      window.addEventListener('storage', this.onStorage);
      document.addEventListener('visibilitychange', this.onResume);
    });
    this.sessionReadyPromise = this.ngZone.runOutsideAngular(() => this.initializeFirebaseSession());
  }

  async login(payload: LoginPayload): Promise<SessionUser> {
    try {
      await this.sessionReadyPromise;
      const auth = await this.getAuth();
      this.storageMode = payload.remember ? 'local' : 'session';
      await setPersistence(auth, payload.remember ? browserLocalPersistence : browserSessionPersistence);
      this.sessionClosed = false;
      const credential = await signInWithEmailAndPassword(auth, payload.email.trim().toLowerCase(), payload.password);
      const token = await getIdToken(credential.user, true);
      const user = await this.fetchCurrentUser(token);
      this.lastActivityAt = Date.now();
      this.sessionExpired.set(false);
      this.setSession(user, token, this.storageMode);
      return user;
    } catch (error) {
      if (error instanceof ProfileCompletionRequiredError) throw error;
      throw new Error(this.resolveLoginErrorMessage(error));
    }
  }

  async register(payload: RegisterPayload): Promise<SessionUser> {
    await this.sessionReadyPromise;
    const auth = await this.getAuth();
    await setPersistence(auth, browserLocalPersistence);
    this.storageMode = 'local';

    let credential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
    try {
      this.sessionClosed = false;
      credential = await createUserWithEmailAndPassword(auth, payload.email.trim().toLowerCase(), payload.password);
      const token = await getIdToken(credential.user, true);
      const user = await this.createProfile(payload, token);
      this.setSession(user, token, 'local');
      return user;
    } catch (error) {
      if (credential) {
        await deleteUser(credential.user).catch(() => undefined);
      }
      throw new Error(this.extractErrorMessage(error, this.firebaseErrorMessage(error, 'No se pudo crear la cuenta.')));
    }
  }

  async completeProfile(payload: RegisterPayload): Promise<SessionUser> {
    const auth = await this.getAuth();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.email) throw new Error('La sesión para completar el perfil expiró. Inicia sesión nuevamente.');
    if (firebaseUser.email.toLowerCase() !== payload.email.trim().toLowerCase()) {
      throw new Error('El correo no coincide con la sesión iniciada.');
    }

    const token = await getIdToken(firebaseUser, true);
    const user = await this.createProfile(payload, token);
    this.setSession(user, token, 'local');
    return user;
  }

  async sendPasswordReset(email: string): Promise<void> {
    const auth = await this.getAuth();
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    } catch (error) {
      throw new Error(this.firebaseErrorMessage(error, 'No fue posible enviar el correo de recuperacion.'));
    }
  }

  async updateProfile(partial: Partial<SessionUser>): Promise<SessionUser> {
    const current = this.currentUserState();
    const token = this.tokenState();
    if (!current || !token) throw new Error('No hay sesion activa.');

    const payload = this.mapProfilePatchToApiPayload(partial);
    try {
      const remote = Object.keys(payload).length > 0
        ? await firstValueFrom(
          this.http.patch<ApiEnvelope<ApiAuthUser>>(`${this.apiBaseUrl}/auth/me`, payload, {
            headers: this.authHeaders(token)
          })
        )
        : { ok: true, data: this.mapSessionUserToApiUser(current) };

      const merged: SessionUser = {
        ...current,
        ...this.mapApiUser(remote.data),
        id: current.id,
        email: current.email,
        role: current.role
      };

      this.currentUserState.set(merged);
      this.persistSession(merged, token);
      return merged;
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'No fue posible actualizar el perfil.'));
    }
  }

  async sendVerificationEmail(): Promise<void> {
    const auth = await this.getAuth();
    if (!auth.currentUser) throw new Error('Inicia sesión para verificar tu correo.');
    const user = auth.currentUser;
    const generation = this.sessionGeneration;
    await reload(user);
    if (generation !== this.sessionGeneration || auth.currentUser !== user) throw new Error('Inicia sesión nuevamente.');
    this.emailVerifiedState.set(user.emailVerified);
    if (!user.emailVerified) await sendEmailVerification(user);
  }

  async refreshEmailVerification(): Promise<boolean> {
    const auth = await this.getAuth();
    if (!auth.currentUser) return false;
    const user = auth.currentUser;
    const generation = this.sessionGeneration;
    await reload(user);
    if (generation !== this.sessionGeneration || auth.currentUser !== user) return false;
    const changed = this.emailVerifiedState() !== user.emailVerified;
    this.emailVerifiedState.set(user.emailVerified);
    if (changed && user.emailVerified) await this.refreshCurrentUser();
    return user.emailVerified === true;
  }

  async confirmPassword(password: string): Promise<void> {
    const auth = await this.getAuth();
    if (!auth.currentUser?.email) throw new Error('Inicia sesión nuevamente.');
    await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password));
    const token = await getIdToken(auth.currentUser, true);
    this.tokenState.set(token);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    if (!STRONG_PASSWORD_PATTERN.test(newPassword)) {
      throw new Error('Usa entre 6 y 128 caracteres, con mayúscula, minúscula, número y símbolo.');
    }
    if (currentPassword === newPassword) throw new Error('La nueva contraseña debe ser diferente de la actual.');
    try {
      await this.confirmPassword(currentPassword);
      const auth = await this.getAuth();
      if (!auth.currentUser) throw new Error('Inicia sesión nuevamente.');
      await updatePassword(auth.currentUser, newPassword);
      // Credential changes invalidate older tokens. Keep the current session
      // only when Firebase supplies a fresh token; the password is already
      // changed if this refresh fails, so never report the operation as failed.
      try {
        const token = await getIdToken(auth.currentUser, true);
        this.tokenState.set(token);
        const current = this.currentUserState();
        if (current) this.persistSession(current, token);
        return true;
      } catch {
        this.clearSession();
        return false;
      }
    } catch (error) {
      throw new Error(this.firebaseErrorMessage(error, 'No fue posible cambiar la contraseña. Intenta nuevamente.'));
    }
  }

  private clearQuotationDrafts(): void {
    if (typeof window === 'undefined') return;
    Object.keys(window.localStorage).filter(key => key.startsWith('cotizapp-project-draft:') || key === 'construcomparador-project-draft')
      .forEach(key => window.localStorage.removeItem(key));
  }

  async logout(): Promise<void> {
    this.clearQuotationDrafts();
    this.clearSession();
    try {
      const auth = await this.getAuth();
      await signOut(auth);
    } catch {
      // Clear the local session even if Firebase is temporarily unavailable.
    }
  }

  async refreshCurrentUser(): Promise<SessionUser | null> {
    if (this.sessionClosed) return null;
    const generation = this.sessionGeneration;
    const auth = await this.getAuth();
    if (!auth.currentUser) return null;
    const token = await getIdToken(auth.currentUser, true);
    const user = await this.fetchCurrentUser(token);
    if (generation !== this.sessionGeneration || this.sessionClosed) return null;
    this.setSession(user, token, this.storageMode);
    return user;
  }

  async clearAfterAccountDeletion(): Promise<void> {
    this.clearQuotationDrafts();
    try {
      const auth = await this.getAuth();
      await signOut(auth);
    } catch {
      // La cuenta puede haber desaparecido antes de cerrar la sesión local.
    }
    this.clearSession();
    if (typeof window !== 'undefined') {
      [window.localStorage, window.sessionStorage].forEach((storage) => {
        Object.keys(storage)
          .filter((key) => key.startsWith('cotizapp'))
          .forEach((key) => storage.removeItem(key));
      });
    }
  }

  hasRole(role: UserRole): boolean {
    return this.currentUserState()?.role === role;
  }

  async verifiedUser(): Promise<SessionUser | null> {
    await this.sessionReadyPromise;
    if (this.sessionClosed) return null;
    this.readSharedActivity();
    if (this.isIdleExpired()) { await this.expireIdleSession(); return null; }
    const current = this.currentUserState();
    if (this.sessionVerifiedState() && Date.now() - this.sessionVerifiedAt < 5_000) return current;
    if (this.sessionVerificationPromise) return this.sessionVerificationPromise;
    const generation = this.sessionGeneration;
    this.sessionVerificationPromise = (async () => {
        const auth = await this.getAuth();
        await auth.authStateReady();
        if (!auth.currentUser) return null;
        const token = await getIdToken(auth.currentUser);
        const user = await this.fetchCurrentUser(token);
        if (generation !== this.sessionGeneration) return null;
        if (this.isIdleExpired()) { await this.expireIdleSession(); return null; }
        this.setSession(user, token, this.storageMode);
        return user;
      })()
      .catch((error) => {
        if (generation === this.sessionGeneration) this.handleSessionError(error);
        return null;
      })
      .finally(() => {
        this.sessionVerificationPromise = null;
      });

    return this.sessionVerificationPromise;
  }


  getToken(): string | null {
    return this.tokenState();
  }

  dashboardRouteForUser(user: SessionUser | null): string {
    if (!user) return '/login';
    return this.dashboardRouteForRole(user.role);
  }

  dashboardRouteForRole(role: UserRole): string {
    if (role === 'admin') return '/dashboard/admin/validaciones';
    if (role === 'ferreteria') return '/dashboard/ferreteria';
    return '/';
  }

  async listUsersForAdmin(): Promise<SessionUser[]> {
    const token = this.requireToken();
    const response = await firstValueFrom(
      this.http.get<ApiEnvelope<ApiAuthUser[]>>(`${this.apiBaseUrl}/admin/usuarios`, {
        headers: this.authHeaders(token)
      })
    );
    return (response.data || []).filter(Boolean).map((user) => this.mapApiUser(user));
  }

  async adminUpdateUser(
    userId: string,
    partial: Partial<Pick<SessionUser, 'role' | 'accountStatus' | 'displayName' | 'phone' | 'city' | 'commune' | 'address'>>
  ): Promise<SessionUser | null> {
    const token = this.requireToken();
    const payload: Record<string, unknown> = {};
    if (partial.role !== undefined) payload['rol'] = partial.role;
    if (partial.accountStatus !== undefined) payload['estadoCuenta'] = partial.accountStatus;
    if (partial.displayName !== undefined) payload['nombre'] = partial.displayName;
    if (partial.phone !== undefined) payload['telefono'] = partial.phone;
    if (partial.city !== undefined) payload['ciudad'] = partial.city;
    if (partial.commune !== undefined) payload['comuna'] = partial.commune;
    if (partial.address !== undefined) payload['direccion'] = partial.address;

    try {
      const response = await firstValueFrom(
        this.http.patch<ApiEnvelope<ApiAuthUser>>(`${this.apiBaseUrl}/admin/usuarios/${userId}`, payload, {
          headers: this.authHeaders(token)
        })
      );
      return this.mapApiUser(response.data);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw new Error(this.extractErrorMessage(error, 'No fue posible actualizar el usuario.'));
    }
  }

  async adminCreateUser(payload: {
    role: UserRole;
    name: string;
    email: string;
    password: string;
    phone: string;
    city: string;
    commune: string;
    address: string;
    accountStatus?: 'activo' | 'bloqueado' | 'pendiente';
    businessName?: string;
    rut?: string;
    storeLatitude?: number | null;
    storeLongitude?: number | null;
  }): Promise<SessionUser> {
    const token = this.requireToken();
    const response = await firstValueFrom(
      this.http.post<ApiEnvelope<ApiAuthUser>>(`${this.apiBaseUrl}/admin/usuarios`, {
        rol: payload.role,
        nombre: payload.name.trim(),
        correo: payload.email.trim().toLowerCase(),
        password: payload.password,
        telefono: payload.phone.trim(),
        ciudad: payload.city.trim(),
        comuna: payload.commune.trim(),
        direccion: payload.address.trim(),
        estadoCuenta: payload.accountStatus,
        nombreComercial: payload.businessName?.trim() || undefined,
        rut: payload.rut?.trim() || undefined,
        latitud: payload.storeLatitude,
        longitud: payload.storeLongitude
      }, { headers: this.authHeaders(token) })
    );
    return this.mapApiUser(response.data);
  }

  async adminDeleteUser(userId: string): Promise<boolean> {
    const token = this.requireToken();
    try {
      await firstValueFrom(
        this.http.delete<ApiEnvelope<{ deleted: boolean }>>(`${this.apiBaseUrl}/admin/usuarios/${userId}`, {
          headers: this.authHeaders(token)
        })
      );
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return false;
      throw new Error(this.extractErrorMessage(error, 'No fue posible eliminar el usuario.'));
    }
  }

  private async getAuth(): Promise<Auth> {
    if (!this.firebaseAuth) this.firebaseAuth = await getFirebaseAuthInstance();
    this.firebaseAuth.languageCode = 'es';
    return this.firebaseAuth;
  }

  private async initializeFirebaseSession(): Promise<void> {
    // Firebase browser persistence cannot be restored during server rendering.
    if (typeof window === 'undefined') return;
    try {
      const auth = await this.getAuth();
      await auth.authStateReady();
      await new Promise<void>((resolve) => {
        let initialSessionResolved = false;
        this.unsubscribeAuth = onIdTokenChanged(auth, async (firebaseUser) => {
          const generation = this.sessionGeneration;
          try {
            if (!firebaseUser) {
              this.ngZone.run(() => this.clearSession());
              return;
            }
            if (this.sessionClosed) return;
            this.ngZone.run(() => this.emailVerifiedState.set(firebaseUser.emailVerified));
            this.readSharedActivity();
            if (this.isIdleExpired()) { await this.expireIdleSession(); return; }
            const token = await getIdToken(firebaseUser);
            const user = await this.fetchCurrentUser(token);
            if (generation !== this.sessionGeneration || auth.currentUser?.uid !== firebaseUser.uid) return;
            if (this.isIdleExpired()) { await this.expireIdleSession(); return; }
            this.ngZone.run(() => this.setSession(user, token, this.storageMode));
          } catch (error) {
            if (generation === this.sessionGeneration) this.ngZone.run(() => this.handleSessionError(error));
          } finally {
            if (!initialSessionResolved) {
              initialSessionResolved = true;
              resolve();
            }
          }
        });
      });
    } catch (error) {
      this.ngZone.run(() => this.handleSessionError(error));
    }
  }

  private restoreCachedSession(): void {
    if (typeof window === 'undefined') return;
    const sessionRaw = window.sessionStorage.getItem(this.sessionStorageKey);
    const localRaw = window.localStorage.getItem(this.sessionStorageKey);
    const raw = sessionRaw || localRaw;
    this.storageMode = sessionRaw ? 'session' : 'local';
    if (!raw) return;

    try {
      const cached = JSON.parse(raw) as { user: SessionUser; token: string; lastActivityAt?: number };
      if (cached?.user?.email && cached?.token) {
        this.dataMode?.setAccount(cached.user.id, cached.user.role);
        this.currentUserState.set(cached.user);
        this.tokenState.set(cached.token);
        this.lastActivityAt = cached.lastActivityAt || Date.now();
        this.readSharedActivity();
      }
    } catch {
      this.clearCachedSession();
    }
  }

  private setSession(user: SessionUser, token: string, mode: StorageMode): void {
    this.readSharedActivity();
    if (this.currentUserState()?.id !== user.id || !this.lastActivityAt) this.lastActivityAt = Date.now();
    this.sessionClosed = false;
    this.sessionExpired.set(false);
    this.dataMode?.setAccount(user.id, user.role);
    this.storageMode = mode;
    this.currentUserState.set(user);
    this.tokenState.set(token);
    this.sessionVerifiedState.set(true);
    this.sessionVerifiedAt = Date.now();
    this.persistSession(user, token);
    this.writeActivity();
    this.scheduleIdleCheck();
  }

  private persistSession(user: SessionUser, token: string): void {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ user, token, lastActivityAt: this.lastActivityAt });
    if (this.storageMode === 'session') {
      window.sessionStorage.setItem(this.sessionStorageKey, payload);
      window.localStorage.removeItem(this.sessionStorageKey);
    } else {
      window.localStorage.setItem(this.sessionStorageKey, payload);
      window.sessionStorage.removeItem(this.sessionStorageKey);
    }
  }

  private clearSession(): void {
    this.sessionGeneration++;
    this.sessionClosed = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.idleTimer = this.retryTimer = null;
    this.lastActivityAt = 0;
    this.dataMode?.setAccount('', '');
    this.currentUserState.set(null);
    this.emailVerifiedState.set(false);
    this.tokenState.set(null);
    this.sessionVerifiedState.set(false);
    this.sessionVerifiedAt = 0;
    this.sessionVerificationPromise = null;
    this.clearCachedSession();
  }

  private clearCachedSession(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(this.sessionStorageKey);
    window.sessionStorage.removeItem(this.sessionStorageKey);
  }

  private readSharedActivity(): void {
    if (typeof window === 'undefined') return;
    try {
      const activity = JSON.parse(window.localStorage.getItem(this.activityStorageKey) || 'null');
      if (activity?.userId === this.currentUserState()?.id && Number.isFinite(activity?.at) && activity.at <= Date.now()) {
        this.lastActivityAt = Math.max(this.lastActivityAt, activity.at);
      }
    } catch { /* The current tab still tracks inactivity when storage is unavailable. */ }
  }

  private writeActivity(): void {
    if (typeof window === 'undefined' || !this.currentUserState()) return;
    try {
      window.localStorage.setItem(this.activityStorageKey, JSON.stringify({ userId: this.currentUserState()!.id, at: this.lastActivityAt }));
    } catch { /* Storage is optional for tracking activity in this tab. */ }
  }

  private isIdleExpired(): boolean {
    return this.lastActivityAt > 0 && Date.now() - this.lastActivityAt >= SESSION_IDLE_TIMEOUT_MS;
  }

  private scheduleIdleCheck(): void {
    if (typeof window === 'undefined' || !this.currentUserState()) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.ngZone.runOutsideAngular(() => {
      this.idleTimer = setTimeout(this.onResume, Math.max(1, SESSION_IDLE_TIMEOUT_MS - (Date.now() - this.lastActivityAt)));
    });
  }

  private async expireIdleSession(): Promise<void> {
    this.ngZone.run(() => this.sessionExpired.set(true));
    await this.logout();
  }

  private handleSessionError(error: unknown): void {
    const code = (error as { code?: string })?.code || '';
    if (error instanceof ProfileCompletionRequiredError ||
        (error instanceof Error && error.message === LOGIN_SUPPORT_ERROR_MESSAGE) ||
        (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) ||
        ['auth/user-disabled', 'auth/user-token-expired', 'auth/invalid-user-token'].includes(code)) {
      this.clearSession();
      return;
    }
    // A temporary network/API failure must not delete Firebase's persisted login.
    if (typeof window !== 'undefined' && !this.retryTimer) this.ngZone.runOutsideAngular(() => {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.ngZone.run(() => this.verifiedUser());
      }, 5_000);
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeAuth?.();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (typeof window === 'undefined') return;
    this.activityEvents.forEach(event => window.removeEventListener(event, this.onActivity));
    window.removeEventListener('focus', this.onResume);
    window.removeEventListener('storage', this.onStorage);
    document.removeEventListener('visibilitychange', this.onResume);
  }

  private requireToken(): string {
    const token = this.tokenState();
    if (!token) throw new Error('No hay sesion activa.');
    return token;
  }

  private authHeaders(token: string): HttpHeaders {
    return this.dataMode?.requestHeaders(token) || new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private async fetchCurrentUser(token: string): Promise<SessionUser> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiEnvelope<ApiAuthSession>>(`${this.apiBaseUrl}/auth/session`, {
          headers: this.authHeaders(token)
        })
      );
      if (response.data.requiereCompletarPerfil || !response.data.usuario) {
        throw await this.profileCompletionError();
      }
      const user = this.mapLoginUser(response.data.usuario);
      return {
        ...user,
        legalAcceptanceRequired: response.data.requiereAceptacionLegal === true,
        privacyProcessingBlocked: response.data.usuario?.tratamientoBloqueado === true
      };
    } catch (error) {
      if (error instanceof ProfileCompletionRequiredError) throw error;
      if (!(error instanceof HttpErrorResponse) || error.status !== 404) throw error;
    }

    // Compatibilidad durante el despliegue: el backend anterior solo expone /auth/me.
    try {
      const response = await firstValueFrom(
        this.http.get<ApiEnvelope<ApiAuthUser>>(`${this.apiBaseUrl}/auth/me`, {
          headers: this.authHeaders(token)
        })
      );
      return this.mapLoginUser(response.data);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        throw await this.profileCompletionError();
      }
      throw error;
    }
  }

  private async profileCompletionError(): Promise<ProfileCompletionRequiredError> {
    const auth = await this.getAuth();
    return new ProfileCompletionRequiredError(auth.currentUser?.email || '');
  }

  private async createProfile(payload: RegisterPayload, token: string): Promise<SessionUser> {
    const response = await firstValueFrom(
      this.http.post<ApiEnvelope<{ usuario: ApiAuthUser }>>(`${this.apiBaseUrl}/auth/register`, {
        rol: payload.role,
        nombre: payload.name.trim(),
        correo: payload.email.trim().toLowerCase(),
        telefono: payload.phone.trim(),
        ciudad: payload.city.trim(),
        comuna: payload.commune.trim(),
        region: payload.region.trim(),
        direccion: payload.address.trim(),
        nombreComercial: payload.businessName?.trim() || undefined,
        rut: payload.rut?.trim() || undefined,
        latitud: payload.storeLatitude,
        longitud: payload.storeLongitude,
        termsVersion: payload.termsVersion,
        privacyVersion: payload.privacyVersion,
        termsAccepted: payload.termsAccepted,
        privacyAcknowledged: payload.privacyAcknowledged,
        ageConfirmed: payload.ageConfirmed,
        marketingConsent: payload.marketingConsent
      }, {
        headers: this.authHeaders(token)
      })
    );
    return this.mapApiUser(response.data.usuario);
  }

  private mapApiUser(user: ApiAuthUser): SessionUser {
    return {
      id: user.id,
      ferreteriaId: user.ferreteriaId,
      storeAgreementStatus: user.contratoFerreteriaEstado,
      storeAgreementVersion: user.contratoFerreteriaVersion,
      storeAgreementAcceptedAt: user.contratoFerreteriaAceptadoEn,
      email: user.correo,
      displayName: user.nombreComercial?.trim() ? user.nombreComercial : user.nombre,
      role: user.rol,
      accountStatus: user.estadoCuenta || 'activo',
      adminValidated: user.estadoCuenta !== 'bloqueado',
      createdAt: user.creadoEn,
      phone: user.telefono,
      city: user.ciudad,
      commune: user.comuna,
      region: user.region,
      address: user.direccion,
      businessName: user.nombreComercial,
      rut: user.rut,
      storeLatitude: typeof user.latitud === 'number' ? user.latitud : undefined,
      storeLongitude: typeof user.longitud === 'number' ? user.longitud : undefined,
      privacyProcessingBlocked: user.tratamientoBloqueado === true
    };
  }

  private mapLoginUser(user: ApiAuthUser | null | undefined): SessionUser {
    if (!user || !user.id?.trim() || !user.correo?.trim() || !user.nombre?.trim() || !validRole(user.rol)) {
      throw new Error(LOGIN_SUPPORT_ERROR_MESSAGE);
    }
    return this.mapApiUser(user);
  }

  private mapSessionUserToApiUser(user: SessionUser): ApiAuthUser {
    return {
      id: user.id,
      ferreteriaId: user.ferreteriaId,
      rol: user.role,
      nombre: user.displayName,
      correo: user.email,
      telefono: user.phone,
      ciudad: user.city,
      comuna: user.commune,
      region: user.region,
      direccion: user.address,
      estadoCuenta: user.accountStatus,
      creadoEn: user.createdAt,
      nombreComercial: user.businessName,
      rut: user.rut,
      latitud: user.storeLatitude,
      longitud: user.storeLongitude,
      contratoFerreteriaEstado: user.storeAgreementStatus,
      contratoFerreteriaVersion: user.storeAgreementVersion,
      contratoFerreteriaAceptadoEn: user.storeAgreementAcceptedAt,
    };
  }

  private mapProfilePatchToApiPayload(partial: Partial<SessionUser>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (partial.displayName !== undefined) payload['nombre'] = partial.displayName;
    if (partial.phone !== undefined) payload['telefono'] = partial.phone;
    if (partial.city !== undefined) payload['ciudad'] = partial.city;
    if (partial.commune !== undefined) payload['comuna'] = partial.commune;
    if (partial.region !== undefined) payload['region'] = partial.region;
    if (partial.address !== undefined) payload['direccion'] = partial.address;
    if (partial.businessName !== undefined) payload['nombreComercial'] = partial.businessName;
    if (partial.rut !== undefined) payload['rut'] = partial.rut;
    if (partial.storeLatitude !== undefined) payload['latitud'] = partial.storeLatitude;
    if (partial.storeLongitude !== undefined) payload['longitud'] = partial.storeLongitude;
    return payload;
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = error.error?.error?.message;
      if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    }
    if (error instanceof Error && error.message.trim()) return error.message;
    return fallback;
  }

  private resolveLoginErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) return LOGIN_SUPPORT_ERROR_MESSAGE;
    if (error instanceof Error && error.message === LOGIN_SUPPORT_ERROR_MESSAGE) return error.message;
    return this.firebaseErrorMessage(error, this.extractErrorMessage(error, 'No fue posible iniciar sesion.'));
  }

  private firebaseErrorMessage(error: unknown, fallback: string): string {
    const code = (error as { code?: string } | null)?.code || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Correo o contrasena incorrectos.';
    if (code.includes('email-already-in-use')) return 'Ya existe una cuenta con este correo.';
    if (code.includes('weak-password')) return 'La contrasena debe tener al menos 6 caracteres.';
    if (code.includes('invalid-email')) return 'El correo ingresado no es valido.';
    if (code.includes('too-many-requests')) return 'Demasiados intentos. Intenta nuevamente mas tarde.';
    return fallback;
  }
}

function validRole(role: string | null | undefined): role is UserRole {
  return role === 'admin' || role === 'maestro' || role === 'ferreteria';
}
