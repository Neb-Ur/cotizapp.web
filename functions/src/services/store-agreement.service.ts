import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { COLLECTIONS } from '../lib/collections.js';
import { fail } from '../lib/http.js';
import {
  CURRENT_STORE_AGREEMENT_VERSION,
  STORE_AGREEMENT_CLAUSES,
  STORE_AGREEMENT_PROVIDER
} from '../lib/legal.js';
import { row, rows } from '../repositories/firestore.repository.js';

export function storeAgreementDocumentHash(): string {
  return createHash('sha256').update(JSON.stringify({
    version: CURRENT_STORE_AGREEMENT_VERSION,
    provider: STORE_AGREEMENT_PROVIDER,
    clauses: STORE_AGREEMENT_CLAUSES
  })).digest('hex');
}

export async function activeStoreAgreement(storeId: string): Promise<Record<string, unknown> | null> {
  const agreements = await rows(COLLECTIONS.storeAgreements);
  return agreements
    .filter((item) => item.ferreteriaId === storeId
      && item.version === CURRENT_STORE_AGREEMENT_VERSION
      && item.estado === 'vigente'
      && item.documentHash === storeAgreementDocumentHash())
    .sort((left, right) => String(right.aceptadoEn).localeCompare(String(left.aceptadoEn)))[0] || null;
}

export async function requireCurrentStoreAgreement(req: Request, res: Response, storeId: string): Promise<boolean> {
  const store = await row(COLLECTIONS.stores, storeId);
  if (!store) {
    fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferretería indicada.', 404);
    return false;
  }
  const agreement = await activeStoreAgreement(storeId);
  if (!agreement) {
    fail(
      res,
      'STORE_AGREEMENT_REQUIRED',
      'Debes aceptar el contrato comercial vigente antes de administrar o publicar el catálogo.',
      428,
      { requiredVersion: CURRENT_STORE_AGREEMENT_VERSION }
    );
    return false;
  }
  return true;
}
