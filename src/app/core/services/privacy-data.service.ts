import { Injectable } from '@angular/core';
import { PrivacyOverview, PrivacyRequest, PrivacyRequestStatus, PrivacyRequestType } from '../models/app.models';
import { ApiClientService } from './api-client.service';

interface PrivacyExportResponse {
  request: PrivacyRequest;
  data: Record<string, unknown>;
}

export interface AccountDeletionReceipt {
  deleted: boolean;
  deletedAt: string;
  backupErasureExpectedBy: string;
  counts: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class PrivacyDataService {
  constructor(private readonly api: ApiClientService) {}

  overview(): Promise<PrivacyOverview> {
    return this.api.get<PrivacyOverview>('/privacy/overview', true);
  }

  acceptCurrentLegalDocuments(marketingConsent: boolean, versions: { terms: string; privacy: string }): Promise<PrivacyOverview> {
    return this.api.post<PrivacyOverview>('/privacy/consents/current', {
      termsVersion: versions.terms,
      privacyVersion: versions.privacy,
      termsAccepted: true,
      privacyAcknowledged: true,
      ageConfirmed: true,
      marketingConsent
    }, true);
  }

  updateMarketingConsent(granted: boolean): Promise<PrivacyOverview> {
    return this.api.patch<PrivacyOverview>('/privacy/consents/marketing', { granted }, true);
  }

  createRequest(type: PrivacyRequestType, details: string): Promise<PrivacyRequest> {
    return this.api.post<PrivacyRequest>('/privacy/requests', { type, details }, true);
  }

  exportData(): Promise<PrivacyExportResponse> {
    return this.api.post<PrivacyExportResponse>('/privacy/export', {}, true);
  }

  deleteAccount(email: string): Promise<AccountDeletionReceipt> {
    return this.api.delete<AccountDeletionReceipt>('/privacy/account', true, {
      email,
      confirmation: 'ELIMINAR'
    });
  }

  listRequestsForAdmin(): Promise<PrivacyRequest[]> {
    return this.api.get<PrivacyRequest[]>('/admin/privacy-requests', true);
  }

  updateRequestForAdmin(requestId: string, status: PrivacyRequestStatus, resolution: string): Promise<PrivacyRequest> {
    return this.api.patch<PrivacyRequest>(`/admin/privacy-requests/${requestId}`, { status, resolution }, true);
  }
}
