import { Injectable } from '@angular/core';
import { IpReport, IpReportStatus } from '../models/app.models';
import { ApiClientService } from './api-client.service';

export interface IpReportReceipt {
  received: true;
  id: string;
  reference: string;
  receiptToken: string;
  acknowledgedAt: string;
  initialReviewDueAt: string;
}

@Injectable({ providedIn: 'root' })
export class IntellectualPropertyService {
  constructor(private readonly api: ApiClientService) {}

  create(payload: Record<string, unknown>): Promise<IpReportReceipt> {
    return this.api.post<IpReportReceipt>('/ip-reports', payload);
  }

  status(reference: string, receiptToken: string): Promise<Pick<IpReport, 'reference' | 'status' | 'publicStatusMessage' | 'submittedAt' | 'resolvedAt'> & { updatedAt: string }> {
    return this.api.post('/ip-reports/status', { reference, receiptToken });
  }

  listForAdmin(): Promise<IpReport[]> {
    return this.api.get<IpReport[]>('/admin/ip-reports', true);
  }

  updateForAdmin(id: string, status: IpReportStatus, resolution: string, publicStatusMessage: string): Promise<IpReport> {
    return this.api.patch<IpReport>(`/admin/ip-reports/${id}`, { status, resolution, publicStatusMessage }, true);
  }
}
