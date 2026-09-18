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
import { LoginPayload, RegisterPayload, SessionUser, SubscriptionPlan, UserRole } from '../models/app.models';
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
  planSuscripcion?: SubscriptionPlan;
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

      const m