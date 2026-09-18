import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  getIdToken,
  onIdTokenChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Auth
} from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { LoginPayload, RegisterPayload, SessionUser, UserRole } from '../models/app.models';
import { API_BASE_URL } from '../config/api.config';
import { getFirebaseAuthInstance } from '../config/firebase.config';

export const LOGIN_SUPPORT_ERROR_MESSAGE = 'Usuario con error, favor contactarse con soporte.';

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
  telefonoSecundario?: string;
  ciudad?: string;
  comuna?: string;
  region?: string;
  direccion?: string;
  estadoCuenta?: 'activo' | 'bloqueado' | 'pendiente';
  creadoEn?: string;
  nombreComercial?: string;
  rut?: string;
  contactoEmergenciaNombre?: string;
  contactoEmergenciaTelefono?: string;
  especialidad?: string;
  anosExperiencia?: number;
  metodoContactoPreferido?: 'whatsapp' | 'llamada' | 'email';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBaseUrl = API_BASE_URL;
  private readonly sessionStorageKey = 'cotizapp-session';

  private readonly currentUserState = signal<SessionUser | null>(null);
  private readonly tokenState = signal<string | null>(null);
  private firebaseAuth: Auth | null = null;
  private storageMode: StorageMode = 'local';

  readonly currentUser = computed(() => this.currentUserState());
  readonly isLoggedIn = computed(() => this.currentUserState() !== null);

  constructor(private readonly http: HttpClient) {
    this.restoreCachedSession();
    void this.initializeFirebaseSession();
  }

  async login(payload: LoginPayload): Promise<SessionUser> {
    try {
      const auth = await this.getAuth();
      this.storageMode = payload.remember ? 'local' : 'session';
      await setPersistence(auth, payload.remember ? browserLocalPersistence : browserSessionPersistence);
      const credential = await signInWithEmailAndPassword(auth, payload.email.trim().toLowerCase(), payload.password);
      const token = await getIdToken(credential.user, true);
      const user = await this.fetchCurrentUser(token);
      this.setSession(user, token, this.storageMode);
      return user;
    } catch (error) {
      throw new Error(this.resolveLoginErrorMessage(error));
    }
  }

  async register(payload: RegisterPayload): Promise<SessionUser> {
    const auth = await this.getAuth();
    await setPersistence(auth, browserLocalPersistence);
    this.storageMode = 'local';

    let credential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
    try {
      credential = await createUserWithEmailAndPassword(auth, payload.email.trim().toLowerCase(), payload.password);
      const token = await getIdToken(credential.user, true);
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
          especialidad: payload.specialty?.trim() || undefined,
          anosExperiencia: payload.experienceYears
        }, {
          headers: this.authHeaders(token)
        })
      );

      const user = this.mapApiUser(response.data.usuario);
      this.setSession(user, token, 'local');
      return user;
    } catch (error) {
      if (credential) {
        await deleteUser(credential.user).catch(() => undefined);
      }
      throw new Error(this.extractErrorMessage(error, this.firebaseErrorMessage(error, 'No se pudo crear la cuenta.')));
    }
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

  async logout(): Promise<void> {
    try {
      const auth = await this.getAuth();
      await signOut(auth);
    } catch {
      // Clear the local session even if Firebase is temporarily unavailable.
    }
    this.clearSession();
  }

  hasRole(role: UserRole): boolean {
    return this.currentUserState()?.role === role;
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
    return '/dashboard/maestro';
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
        rut: payload.rut?.trim() || undefined
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
    return this.firebaseAuth;
  }

  private async initializeFirebaseSession(): Promise<void> {
    try {
      const auth = await this.getAuth();
      onIdTokenChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          this.clearSession();
          return;
        }

        try {
          const token = await getIdToken(firebaseUser);
          const user = await this.fetchCurrentUser(token);
          this.tokenState.set(token);
          this.currentUserState.set(user);
          this.persistSession(user, token);
        } catch {
          this.clearSession();
        }
      });
    } catch {
      // The cached session lets the UI render. Requests will fail clearly until Firebase is available.
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
      const cached = JSON.parse(raw) as { user: SessionUser; token: string };
      if (cached?.user?.email && cached?.token) {
        this.currentUserState.set(cached.user);
        this.tokenState.set(cached.token);
      }
    } catch {
      this.clearCachedSession();
    }
  }

  private setSession(user: SessionUser, token: string, mode: StorageMode): void {
    this.storageMode = mode;
    this.currentUserState.set(user);
    this.tokenState.set(token);
    this.persistSession(user, token);
  }

  private persistSession(user: SessionUser, token: string): void {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ user, token });
    if (this.storageMode === 'session') {
      window.sessionStorage.setItem(this.sessionStorageKey, payload);
      window.localStorage.removeItem(this.sessionStorageKey);
    } else {
      window.localStorage.setItem(this.sessionStorageKey, payload);
      window.sessionStorage.removeItem(this.sessionStorageKey);
    }
  }

  private clearSession(): void {
    this.currentUserState.set(null);
    this.tokenState.set(null);
    this.clearCachedSession();
  }

  private clearCachedSession(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(this.sessionStorageKey);
    window.sessionStorage.removeItem(this.sessionStorageKey);
  }

  private requireToken(): string {
    const token = this.tokenState();
    if (!token) throw new Error('No hay sesion activa.');
    return token;
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private async fetchCurrentUser(token: string): Promise<SessionUser> {
    const response = await firstValueFrom(
      this.http.get<ApiEnvelope<ApiAuthUser>>(`${this.apiBaseUrl}/auth/me`, {
        headers: this.authHeaders(token)
      })
    );
    return this.mapLoginUser(response.data);
  }

  private mapApiUser(user: ApiAuthUser): SessionUser {
    return {
      id: user.id,
      ferreteriaId: user.ferreteriaId,
      email: user.correo,
      displayName: user.nombreComercial?.trim() ? user.nombreComercial : user.nombre,
      legalFullName: user.nombre,
      role: user.rol,
      accountStatus: user.estadoCuenta || 'activo',
      adminValidated: user.estadoCuenta !== 'bloqueado',
      createdAt: user.creadoEn,
      phone: user.telefono,
      secondaryPhone: user.telefonoSecundario,
      city: user.ciudad,
      commune: user.comuna,
      region: user.region,
      address: user.direccion,
      businessName: user.nombreComercial,
      rut: user.rut,
      emergencyContactName: user.contactoEmergenciaNombre,
      emergencyContactPhone: user.contactoEmergenciaTelefono,
      specialty: user.especialidad,
      experienceYears: user.anosExperiencia,
      preferredContactMethod: user.metodoContactoPreferido
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
      nombre: user.legalFullName || user.displayName,
      correo: user.email,
      telefono: user.phone,
      telefonoSecundario: user.secondaryPhone,
      ciudad: user.city,
      comuna: user.commune,
      region: user.region,
      direccion: user.address,
      estadoCuenta: user.accountStatus,
      creadoEn: user.createdAt,
      nombreComercial: user.businessName,
      rut: user.rut,
      contactoEmergenciaNombre: user.emergencyContactName,
      contactoEmergenciaTelefono: user.emergencyContactPhone,
      especialidad: user.specialty,
      anosExperiencia: user.experienceYears,
      metodoContactoPreferido: user.preferredContactMethod
    };
  }

  private mapProfilePatchToApiPayload(partial: Partial<SessionUser>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (partial.displayName !== undefined || partial.legalFullName !== undefined) payload['nombre'] = partial.legalFullName || partial.displayName || '';
    if (partial.phone !== undefined) payload['telefono'] = partial.phone;
    if (partial.secondaryPhone !== undefined) payload['telefonoSecundario'] = partial.secondaryPhone;
    if (partial.city !== undefined) payload['ciudad'] = partial.city;
    if (partial.commune !== undefined) payload['comuna'] = partial.commune;
    if (partial.region !== undefined) payload['region'] = partial.region;
    if (partial.address !== undefined) payload['direccion'] = partial.address;
    if (partial.businessName !== undefined) payload['nombreComercial'] = partial.businessName;
    if (partial.rut !== undefined) payload['rut'] = partial.rut;
    if (partial.specialty !== undefined) payload['especialidad'] = partial.specialty;
    if (partial.experienceYears !== undefined) payload['anosExperiencia'] = partial.experienceYears;
    if (partial.preferredContactMethod !== undefined) payload['metodoContactoPreferido'] = partial.preferredContactMethod;
    if (partial.emergencyContactName !== undefined) payload['contactoEmergenciaNombre'] = partial.emergencyContactName;
    if (partial.emergencyContactPhone !== undefined) payload['contactoEmergenciaTelefono'] = partial.emergencyContactPhone;
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
