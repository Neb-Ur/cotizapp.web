import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
export type DataMode = 'demo' | 'real';

@Injectable({ providedIn: 'root' })
export class DataModeService {
  readonly mode = signal<DataMode>('real');
  readonly defaultMode = signal<DataMode>('real');
  private adminId = '';
  constructor(private readonly http: HttpClient) {}

  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;
    const response = await firstValueFrom(this.http.get<{data:{demo:boolean}}>(`${API_BASE_URL}/config`));
    if (typeof response.data?.demo !== 'boolean') throw new Error('No se pudo determinar el entorno de datos.');
    const mode = response.data.demo ? 'demo' : 'real';
    this.defaultMode.set(mode);
    this.mode.set(mode);
  }

  setAccount(id: string, role: string): void {
    this.adminId = role === 'admin' ? id : '';
    let selected: string | null = null;
    if (this.adminId && typeof localStorage !== 'undefined') {
      try { selected = localStorage.getItem(this.storageKey); } catch { /* Storage is optional. */ }
    }
    this.mode.set(selected === 'demo' || selected === 'real' ? selected : this.defaultMode());
  }

  toggleDemo(): void {
    if (!this.adminId) throw new Error('Solo el administrador puede cambiar de entorno.');
    const selected = this.mode() === 'demo' ? 'real' : 'demo';
    // A reload drops all in-memory requests, lists and drafts from the previous realm.
    localStorage.setItem(this.storageKey, selected);
    this.mode.set(selected);
    window.location.reload();
  }

  requestHeaders(token?: string | null, authenticated = true): HttpHeaders {
    if (!authenticated && !this.adminId) token = null;
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    if (token && this.adminId) headers = headers.set('X-Data-Mode', this.mode());
    return headers;
  }
  private get storageKey(): string { return `cotizapp-admin-data-mode:${this.adminId}`; }
}
