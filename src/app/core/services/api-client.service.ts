import { DataModeService } from './data-mode.service';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../config/api.config';

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly apiBaseUrl = API_BASE_URL;

  constructor(private readonly http: HttpClient, private readonly authService: AuthService, private readonly dataMode: DataModeService | null = null) {}

  private headers(requireAuth: boolean): HttpHeaders {
    if (!requireAuth) {
      return this.dataMode?.requestHeaders(this.authService.getToken(), false) || new HttpHeaders();
    }

    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No hay sesion activa para llamar al backend.');
    }

    return this.dataMode?.requestHeaders(token) || new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  async get<T>(path: string, requireAuth = false, query?: Record<string, string | number | undefined>): Promise<T> {
    const params = this.toHttpParams(query);
    const response = await firstValueFrom(
      this.http.get<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, {
        headers: this.headers(requireAuth),
        params
      })
    );
    return response.data;
  }

  async post<T>(path: string, body: unknown, requireAuth = false): Promise<T> {
    const response = await firstValueFrom(
      this.http.post<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, body, {
        headers: this.headers(requireAuth)
      })
    );
    return response.data;
  }

  async uploadImage<T>(path: string, file: File): Promise<T> {
    const response = await firstValueFrom(this.http.post<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, file, {
      headers: this.headers(true).set('Content-Type', file.type)
    }));
    return response.data;
  }

  async patch<T>(path: string, body: unknown, requireAuth = false): Promise<T> {
    const response = await firstValueFrom(
      this.http.patch<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, body, {
        headers: this.headers(requireAuth)
      })
    );
    return response.data;
  }

  async put<T>(path: string, body: unknown, requireAuth = false): Promise<T> {
    const response = await firstValueFrom(
      this.http.put<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, body, {
        headers: this.headers(requireAuth)
      })
    );
    return response.data;
  }

  async delete<T>(path: string, requireAuth = false, body?: unknown): Promise<T> {
    const response = await firstValueFrom(
      this.http.delete<ApiEnvelope<T>>(`${this.apiBaseUrl}${path}`, {
        headers: this.headers(requireAuth),
        body
      })
    );
    return response.data;
  }

  private toHttpParams(query?: Record<string, string | number | undefined>): HttpParams {
    let params = new HttpParams();
    if (!query) {
      return params;
    }

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });
    return params;
  }

}
