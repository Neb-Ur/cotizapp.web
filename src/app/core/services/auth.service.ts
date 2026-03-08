import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LoginPayload, RegisterPayload, SessionUser, SubscriptionPlan, UserRole } from '../models/app.models';
import { API_BASE_URL } from '../config/api.config';

export const LOGIN_SUPPORT_ERROR_MESSAGE = 'Usuario con error, favor contactarse con soporte.';

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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiBaseUrl = API_BASE_URL;
  private readonly sessionStorageKey = 'construcomparador-session';

  private readonly currentUserState = signal<SessionUser | null>(null);
  private readonly tokenState = signal<string | null>(null);

  readonly currentUser = computed(() => this.currentUserState());
  readonly isLoggedIn = computed(() => this.currentUserState() !== null);

  constructor(private readonly http: HttpClient) {
    this.restoreSession();
    this.syncSessionWithBackend();
  }

  async login(payload: LoginPayload): Promise<SessionUser> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiEnvelope<{ token: string; usuario: ApiAuthUser }>>(`${this.apiBaseUrl}/auth/login`, {
          correo: payload.email.trim().toLowerCase(),
          password: payload.password,
          remember: payload.remember
        })
      );

      const loginUser = this.mapLoginUser(response.data?.usuario);
      const resolvedUser = await this.fetchCurrentUser(response.data.token).catch(() => loginUser);
      this.setSession(resolvedUser, response.data.token, payload.remember);
      return resolvedUser;
    } catch (error) {
      throw new Error(this.resolveLoginErrorMessage(error));
    }
  }

  async register(payload: RegisterPayload): Promise<SessionUser> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiEnvelope<{ token: string; usuario: ApiAuthUser }>>(`${this.apiBaseUrl}/auth/register`, {
          rol: payload.role,
          nombre: payload.name.trim(),
          correo: payload.email.trim().toLowerCase(),
          password: payload.password,
          telefono: payload.phone.trim(),
          ciudad: payload.city.trim(),
          comuna: payload.commune.trim(),
          region: payload.region.trim(),
          direccion: payload.address.trim(),
          nombreComercial: payload.businessName?.trim() || undefined,
          rut: payload.rut?.trim() || undefined,
          especialidad: payload.specialty?.trim() || undefined,
          anosExperiencia: payload.experienceYears
        })
      );

      const user = this.mapApiUser(response.data.usuario);
      this.setSession(user, response.data.token, true);
      return user;
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'No se pudo crear la cuenta.'));
    }
  }

  async updateProfile(partial: Partial<SessionUser>): Promise<SessionUser> {
    const current = this.currentUserState();
    const token = this.tokenState();
    if (!current || !token) {
      throw new Error('No hay sesion activa.');
    }

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
        ...this.pickLocalOnlyFields(partial),
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

  logout(): void {
    const token = this.tokenState();
    if (token) {
      void firstValueFrom(
        this.http.post<ApiEnvelope<{ success: boolean }>>(`${this.apiBaseUrl}/auth/logout`, {}, {
          headers: this.authHeaders(token)
        })
      ).catch(() => undefined);
    }

    this.currentUserState.set(null);
    this.tokenState.set(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.sessionStorageKey);
    }
  }

  hasRole(role: UserRole): boolean {
    return this.currentUserState()?.role === role;
  }

  getSubscriptionPlan(): SubscriptionPlan {
    return this.currentUserState()?.subscriptionPlan || 'basico';
  }

  getToken(): string | null {
    return this.tokenState();
  }

  dashboardRouteForUser(user: SessionUser | null): string {
    if (!user) {
      return '/login';
    }
    return this.dashboardRouteForRole(user.role);
  }

  dashboardRouteForRole(role: UserRole): string {
    if (role === 'admin') {
      return '/dashboard/admin/validaciones';
    }
    if (role === 'ferreteria') {
      return '/dashboard/ferreteria';
    }
    return '/dashboard/maestro';
  }

  async listUsersForAdmin(): Promise<SessionUser[]> {
    const token = this.tokenState();
    if (!token) {
      throw new Error('No hay sesion activa.');
    }

    try {
      const response = await firstValueFrom(
        this.http.get<ApiEnvelope<ApiAuthUser[]>>(`${this.apiBaseUrl}/admin/usuarios`, {
          headers: this.authHeaders(token)
        })
      );

      return response.data
        .map((user) => this.mapApiUser(user))
        .sort((left, right) => left.displayName.localeCompare(right.displayName));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'No fue posible cargar usuarios.'));
    }
  }

  async adminUpdateUser(
    userId: string,
    partial: Partial<Pick<SessionUser, 'role' | 'subscriptionPlan' | 'accountStatus' | 'displayName' | 'phone' | 'city' | 'commune' | 'address'>>
  ): Promise<SessionUser | null> {
    const token = this.tokenState();
    if (!token) {
      throw new Error('No hay sesion activa.');
    }

    const payload: Record<string, unknown> = {};
    if (partial.role !== undefined) payload['rol'] = partial.role;
    if (partial.subscriptionPlan !== undefined) payload['planSuscripcion'] = partial.subscriptionPlan;
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

      const updated = this.mapApiUser(response.data);
      const current = this.currentUserState();
      if (current?.id === updated.id) {
        const merged = { ...current, ...updated };
        this.currentUserState.set(merged);
        this.persistSession(merged, token);
      }

      return updated;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }
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
    subscriptionPlan?: SubscriptionPlan;
    accountStatus?: 'activo' | 'bloqueado' | 'pendiente';
    businessName?: string;
    rut?: string;
  }): Promise<SessionUser> {
    const token = this.tokenState();
    if (!token) {
      throw new Error('No hay sesion activa.');
    }

    try {
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
          planSuscripcion: payload.subscriptionPlan,
          estadoCuenta: payload.accountStatus,
          nombreComercial: payload.businessName?.trim() || undefined,
          rut: payload.rut?.trim() || undefined
        }, {
          headers: this.authHeaders(token)
        })
      );

      return this.mapApiUser(response.data);
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'No fue posible crear el usuario.'));
    }
  }

  async adminDeleteUser(userId: string): Promise<boolean> {
    const token = this.tokenState();
    if (!token) {
      throw new Error('No hay sesion activa.');
    }

    try {
      await firstValueFrom(
        this.http.delete<ApiEnvelope<{ deleted: boolean }>>(`${this.apiBaseUrl}/admin/usuarios/${userId}`, {
          headers: this.authHeaders(token)
        })
      );

      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return false;
      }
      throw new Error(this.extractErrorMessage(error, 'No fue posible eliminar el usuario.'));
    }
  }

  private syncSessionWithBackend(): void {
    const token = this.tokenState();
    if (!token) {
      return;
    }

    void firstValueFrom(
      this.http.get<ApiEnvelope<ApiAuthUser>>(`${this.apiBaseUrl}/auth/me`, {
        headers: this.authHeaders(token)
      })
    )
      .then((response) => {
        const current = this.currentUserState();
        const mapped = this.mapApiUser(response.data);
        const merged = {
          ...current,
          ...mapped
        };
        this.currentUserState.set(merged);
        this.persistSession(merged, token);
      })
      .catch(() => {
        this.currentUserState.set(null);
        this.tokenState.set(null);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(this.sessionStorageKey);
        }
      });
  }

  private restoreSession(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = window.localStorage.getItem(this.sessionStorageKey);
    if (!raw) {
      return;
    }

    try {
      const session = JSON.parse(raw) as { user: SessionUser; token: string };
      if (!session?.user?.email || !session?.token) {
        return;
      }

      this.currentUserState.set(session.user);
      this.tokenState.set(session.token);
    } catch {
      window.localStorage.removeItem(this.sessionStorageKey);
    }
  }

  private setSession(user: SessionUser, token: string, remember: boolean): void {
    this.currentUserState.set(user);
    this.tokenState.set(token);
    this.persistSession(user, token);
  }

  private persistSession(user: SessionUser, token: string | null): void {
    if (typeof window === 'undefined' || !token) {
      return;
    }

    window.localStorage.setItem(this.sessionStorageKey, JSON.stringify({ user, token }));
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
      subscriptionPlan: user.planSuscripcion || 'basico',
      accountStatus: user.estadoCuenta || 'pendiente',
      adminValidated: user.estadoCuenta === 'activo',
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
    if (!this.hasValidApiUser(user)) {
      throw new Error(LOGIN_SUPPORT_ERROR_MESSAGE);
    }

    return this.mapApiUser(user);
  }

  private hasValidApiUser(user: ApiAuthUser | null | undefined): user is ApiAuthUser {
    if (!user) {
      return false;
    }

    return Boolean(
      user.id?.trim()
      && user.correo?.trim()
      && user.nombre?.trim()
      && this.isValidRole(user.rol)
    );
  }

  private isValidRole(role: string | null | undefined): role is UserRole {
    return role === 'admin' || role === 'maestro' || role === 'ferreteria';
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
      planSuscripcion: user.subscriptionPlan,
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
    if (partial.displayName !== undefined || partial.legalFullName !== undefined) {
      payload['nombre'] = (partial.legalFullName || partial.displayName || '').toString().trim();
    }
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
    if (partial.subscriptionPlan !== undefined) payload['planSuscripcion'] = partial.subscriptionPlan;
    return payload;
  }

  private pickLocalOnlyFields(partial: Partial<SessionUser>): Partial<SessionUser> {
    const localOnly: Partial<SessionUser> = {};
    if (partial.secondaryPhone !== undefined) localOnly.secondaryPhone = partial.secondaryPhone;
    if (partial.specialty !== undefined) localOnly.specialty = partial.specialty;
    if (partial.experienceYears !== undefined) localOnly.experienceYears = partial.experienceYears;
    if (partial.preferredContactMethod !== undefined) localOnly.preferredContactMethod = partial.preferredContactMethod;
    if (partial.emergencyContactName !== undefined) localOnly.emergencyContactName = partial.emergencyContactName;
    if (partial.emergencyContactPhone !== undefined) localOnly.emergencyContactPhone = partial.emergencyContactPhone;
    if (partial.region !== undefined) localOnly.region = partial.region;
    return localOnly;
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = error.error?.error?.message;
      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        return apiMessage;
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  private resolveLoginErrorMessage(error: unknown): string {
    const apiCode = this.extractApiErrorCode(error);
    if (apiCode === 'AUTH_USER_NOT_FOUND') {
      return LOGIN_SUPPORT_ERROR_MESSAGE;
    }

    if (error instanceof Error && error.message === LOGIN_SUPPORT_ERROR_MESSAGE) {
      return error.message;
    }

    return this.extractErrorMessage(error, 'No fue posible iniciar sesion.');
  }

  private extractApiErrorCode(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    const apiCode = error.error?.error?.code;
    return typeof apiCode === 'string' && apiCode.trim() ? apiCode : null;
  }
}
