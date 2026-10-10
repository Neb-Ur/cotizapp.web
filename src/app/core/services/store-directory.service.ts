import { Injectable } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { StoreDirectoryPage, StoreReview, StoreReviewPage } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class StoreDirectoryService {
  constructor(private readonly api: ApiClientService) {}
  list(page = 1, region = '', commune = '', query = '', size = 12): Promise<StoreDirectoryPage> {
    return this.api.get('/directorio-ferreterias', false, { page, size, region, comuna: commune, q: query });
  }
  detail(id: string, page = 1): Promise<StoreReviewPage> {
    return this.api.get(`/directorio-ferreterias/${encodeURIComponent(id)}`, false, { page });
  }
  myReview(id: string): Promise<StoreReview | null> {
    return this.api.get(`/directorio-ferreterias/${encodeURIComponent(id)}/mi-resena`, true);
  }
  saveReview(id: string, rating: number, comment: string): Promise<StoreReview> {
    return this.api.put(`/directorio-ferreterias/${encodeURIComponent(id)}/mi-resena`, { rating, comment }, true);
  }
  deleteReview(id: string): Promise<{ deleted: boolean }> {
    return this.api.delete(`/directorio-ferreterias/${encodeURIComponent(id)}/mi-resena`, true);
  }
}
