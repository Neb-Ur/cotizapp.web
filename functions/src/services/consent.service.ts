import { randomUUID } from 'node:crypto';
import type { WriteBatch } from 'firebase-admin/firestore';
import { db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../lib/legal.js';

export interface LegalAcceptanceInput {
  termsAccepted: boolean;
  privacyAcknowledged: boolean;
  ageConfirmed: boolean;
  marketingConsent?: boolean;
}

export function hasCurrentLegalAcceptance(user: Record<string, unknown> | null | undefined): boolean {
  return user?.['terminosVersion'] === CURRENT_TERMS_VERSION
    && user?.['privacidadVersion'] === CURRENT_PRIVACY_VERSION
    && user?.['mayoriaEdadDeclarada'] === true;
}

export async function recordLegalAcceptance(
  userId: string,
  input: LegalAcceptanceInput,
  source: 'registration' | 'profile_completion' | 'privacy_center'
): Promise<void> {
  const occurredAt = new Date().toISOString();
  const batch = db.batch();
  stageLegalAcceptance(batch, userId, input, source, occurredAt);
  await batch.commit();
}

export function stageLegalAcceptance(
  batch: WriteBatch,
  userId: string,
  input: LegalAcceptanceInput,
  source: 'registration' | 'profile_completion' | 'privacy_center' | 'store_onboarding',
  occurredAt: string,
  includeMarketing = true
): void {
  const events = [
    { type: 'terms', version: CURRENT_TERMS_VERSION, granted: input.termsAccepted },
    { type: 'privacy_notice', version: CURRENT_PRIVACY_VERSION, granted: input.privacyAcknowledged, purpose: 'account_and_requested_features', expressConsent: true },
    { type: 'age_declaration', version: '18+', granted: input.ageConfirmed },
    { type: 'marketing', version: '1.0', granted: input.marketingConsent === true }
  ];

  events.filter(event => includeMarketing || event.type !== 'marketing').forEach((event) => {
    batch.set(db.collection(COLLECTIONS.consentRecords).doc(randomUUID()), {
      usuarioId: userId,
      ...event,
      occurredAt,
      source
    });
  });
  batch.set(db.collection(COLLECTIONS.users).doc(userId), {
    terminosVersion: CURRENT_TERMS_VERSION,
    terminosAceptadosEn: occurredAt,
    privacidadVersion: CURRENT_PRIVACY_VERSION,
    privacidadInformadaEn: occurredAt,
    mayoriaEdadDeclarada: true,
    ...(includeMarketing ? {
      marketingConsent: input.marketingConsent === true,
      marketingConsentUpdatedAt: occurredAt
    } : {})
  }, { merge: true });
}

export async function recordMarketingConsent(userId: string, granted: boolean): Promise<void> {
  const occurredAt = new Date().toISOString();
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.consentRecords).doc(randomUUID()), {
    usuarioId: userId,
    type: 'marketing',
    version: '1.0',
    granted,
    occurredAt,
    source: 'privacy_center'
  });
  batch.set(db.collection(COLLECTIONS.users).doc(userId), {
    marketingConsent: granted,
    marketingConsentUpdatedAt: occurredAt
  }, { merge: true });
  await batch.commit();
}
