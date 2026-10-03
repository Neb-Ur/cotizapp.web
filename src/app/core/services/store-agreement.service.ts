import { Injectable } from '@angular/core';
import { StoreAgreementOverview } from '../models/app.models';
import { ApiClientService } from './api-client.service';

export interface StoreAgreementAcceptance {
  version: string;
  legalName: string;
  storeTaxId: string;
  signerName: string;
  signerTaxId: string;
  signerTitle: string;
  accepted: boolean;
  authorityConfirmed: boolean;
  catalogCommitmentConfirmed: boolean;
}

@Injectable({ providedIn: 'root' })
export class StoreAgreementService {
  constructor(private readonly api: ApiClientService) {}

  current(): Promise<StoreAgreementOverview> {
    return this.api.get<StoreAgreementOverview>('/store-agreement/current', true);
  }

  accept(payload: StoreAgreementAcceptance): Promise<{ id: string; status: 'vigente'; acceptedAt: string; version: string }> {
    return this.api.post('/store-agreement/accept', payload, true);
  }
}
