import { Injectable, signal } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class DataModeService {
  readonly mode = signal('real').asReadonly();
  private adminId = '';

  async initialize(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('cotizapp-admin-data-mode:')) localStorage.removeItem(key);
      }
    } catch { /* Storage is optional. */ }
  }

  setAccount(id: string, role: string): void {
    this.adminId = role === 'admin' ? id : '';
  }

  requestHeaders(token?: string | null, authenticated = true): HttpHeaders {
    if (!authenticated && !this.adminId) token = null;
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }
}
