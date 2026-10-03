import { Injectable } from '@angular/core';
import {
  AdminAuditEntry,
  GovernanceEvidence,
  GovernanceEvidenceOutcome,
  GovernanceEvidenceType,
  GovernanceSummary,
  SecurityIncident,
  SecurityIncidentSeverity,
  SecurityIncidentStatus
} from '../models/app.models';
import { ApiClientService } from './api-client.service';

export interface SecurityIncidentDraft {
  title: string;
  description: string;
  severity: SecurityIncidentSeverity;
  detectedAt: string;
  systems: string[];
  dataCategories: string[];
  affectedPeopleEstimate: number;
  containmentActions: string;
}

export interface GovernanceEvidenceDraft {
  type: GovernanceEvidenceType;
  outcome: GovernanceEvidenceOutcome;
  title: string;
  owner: string;
  performedAt: string;
  nextReviewAt?: string;
  notes: string;
  evidenceUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class GovernanceDataService {
  constructor(private readonly api: ApiClientService) {}

  async dashboard(): Promise<{
    summary: GovernanceSummary;
    incidents: SecurityIncident[];
    evidence: GovernanceEvidence[];
    audit: AdminAuditEntry[];
  }> {
    const [summary, incidents, evidence, audit] = await Promise.all([
      this.api.get<GovernanceSummary>('/admin/governance/summary', true),
      this.api.get<SecurityIncident[]>('/admin/governance/incidents', true),
      this.api.get<GovernanceEvidence[]>('/admin/governance/evidence', true),
      this.api.get<AdminAuditEntry[]>('/admin/governance/audit-logs', true, { limit: 100 })
    ]);
    return { summary, incidents, evidence, audit };
  }

  createIncident(draft: SecurityIncidentDraft): Promise<SecurityIncident> {
    return this.api.post<SecurityIncident>('/admin/governance/incidents', draft, true);
  }

  updateIncident(id: string, status: SecurityIncidentStatus, containmentActions = ''): Promise<SecurityIncident> {
    return this.api.patch<SecurityIncident>(`/admin/governance/incidents/${id}`, {
      status,
      containmentActions
    }, true);
  }

  createEvidence(draft: GovernanceEvidenceDraft): Promise<GovernanceEvidence> {
    return this.api.post<GovernanceEvidence>('/admin/governance/evidence', draft, true);
  }
}
