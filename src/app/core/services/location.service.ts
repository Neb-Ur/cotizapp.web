import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { LocationOption } from '../models/app.models';

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly apiBaseUrl = API_BASE_URL;

  constructor(private readonly http: HttpClient) {}

  async listRegions(query?: string): Promise<LocationOption[]> {
    const params: Record<string, string> = {};
    if (query?.trim()) {
      params['q'] = query.trim();
    }
    const response = await firstValueFrom(
      this.http.get<ApiEnvelope<LocationOption[]>>(`${this.apiBaseUrl}/ubicaciones/regiones`, { params })
    );
    return response.data || [];
  }

  async listCities(regionId: string, query?: string): Promise<LocationOption[]> {
    const params: Record<string, string> = { regionId };
    if (query?.trim()) {
      params['q'] = query.trim();
    }
    const response = await firstValueFrom(
      this.http.get<ApiEnvelope<LocationOption[]>>(`${this.apiBaseUrl}/ubicaciones/ciudades`, { params })
    );
    return response.data || [];
  }

  async listCommunes(cityId: string, query?: string): Promise<LocationOption[]> {
    const params: Record<string, string> = { cityId };
    if (query?.trim()) {
      params['q'] = query.trim();
    }
    const response = await firstValueFrom(
      this.http.get<ApiEnvelope<LocationOption[]>>(`${this.apiBaseUrl}/ubicaciones/comunas`, { params })
    );
    return response.data || [];
  }
}
