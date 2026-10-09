import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../config/api.config';

@Injectable({providedIn:'root'})
export class PilotService {
  readonly enabled = signal(false);
  private readonly http = inject(HttpClient);
  private started = false;
  initialize(): void {
    if (this.started) return;
    this.started = true;
    this.http.get<{data:{pilotStoresEnabled?:boolean}}>(`${API_BASE_URL}/config`).subscribe({
      next: result => this.enabled.set(result.data.pilotStoresEnabled === true),
      error: () => { this.started = false; }
    });
  }
}
