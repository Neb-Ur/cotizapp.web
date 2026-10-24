import { isHardwareStore } from '../domain/market-scope.js';
import { CURRENT_STORE_AGREEMENT_VERSION } from '../lib/legal.js';
import { storeAgreementDocumentHash } from './store-agreement.service.js';

export function pilotStoresEnabled(): boolean { return process.env.PILOT_STORES_ENABLED === 'true'; }
export function publicRecordVisible(record: Record<string, any>): boolean {
  return record.esPrueba !== true || pilotStoresEnabled();
}
export function storeCanPublish(store: Record<string, any>): boolean {
  if (!isHardwareStore(store) || store.estado === 'inactivo') return false;
  // Synthetic pilot stores have no signed commercial agreement. Never fabricate one.
  if (store.esPrueba === true) return pilotStoresEnabled();
  return store.contratoEstado === 'vigente'
    && store.contratoVersion === CURRENT_STORE_AGREEMENT_VERSION
    && store.contratoDocumentHash === storeAgreementDocumentHash();
}
