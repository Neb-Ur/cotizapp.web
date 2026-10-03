import { randomUUID } from 'node:crypto';
import { adminAuth, db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { deleteRowsByIds, rows } from '../repositories/firestore.repository.js';

interface AccountDataSnapshot {
  exportedAt: string;
  profile: Record<string, unknown> | null;
  stores: Record<string, unknown>[];
  storeProducts: Record<string, unknown>[];
  priceHistory: Record<string, unknown>[];
  storeAgreements: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  productRequests: Record<string, unknown>[];
  contactRequests: Record<string, unknown>[];
  consentRecords: Record<string, unknown>[];
  privacyRequests: Record<string, unknown>[];
  intellectualPropertyReports: Record<string, unknown>[];
}

async function accountRows(userId: string, email: string): Promise<AccountDataSnapshot> {
  const [userDoc, stores, storeProducts, priceHistory, storeAgreements, projects, productRequests, contacts, consents, privacyRequests, ipReports] = await Promise.all([
    db.collection(COLLECTIONS.users).doc(userId).get(),
    rows(COLLECTIONS.stores),
    rows(COLLECTIONS.storeProducts),
    rows(COLLECTIONS.priceHistory),
    rows(COLLECTIONS.storeAgreements),
    rows(COLLECTIONS.projects),
    rows(COLLECTIONS.productRequests),
    rows(COLLECTIONS.contactRequests),
    rows(COLLECTIONS.consentRecords),
    rows(COLLECTIONS.privacyRequests),
    rows(COLLECTIONS.intellectualPropertyReports)
  ]);
  const ownedStores = stores.filter((item) => item.usuarioDuenoId === userId);
  const storeIds = new Set(ownedStores.map((item) => item.id));

  return {
    exportedAt: new Date().toISOString(),
    profile: userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null,
    stores: ownedStores,
    storeProducts: storeProducts.filter((item) => storeIds.has(item.ferreteriaId)),
    priceHistory: priceHistory.filter((item) => item.actorId === userId || storeIds.has(item.ferreteriaId)),
    storeAgreements: storeAgreements.filter((item) => item.usuarioFirmanteId === userId || storeIds.has(item.ferreteriaId)),
    projects: projects.filter((item) => item.ownerId === userId),
    productRequests: productRequests.filter((item) => item.usuarioSolicitanteId === userId || storeIds.has(item.ferreteriaId)),
    contactRequests: contacts.filter((item) => String(item.email || '').toLowerCase() === email.toLowerCase()),
    consentRecords: consents.filter((item) => item.usuarioId === userId),
    privacyRequests: privacyRequests.filter((item) => item.usuarioId === userId),
    intellectualPropertyReports: ipReports.filter((item) => String(item.claimant?.email || '').toLowerCase() === email.toLowerCase())
  };
}

export async function exportAccountData(userId: string, email: string): Promise<AccountDataSnapshot> {
  return accountRows(userId, email);
}

export async function deleteAccountData(userId: string, email: string, deleteAuthUser = true): Promise<Record<string, number>> {
  const snapshot = await accountRows(userId, email);
  const storeIds = new Set(snapshot.stores.map((item) => String(item['id'])));
  const storeOffers = snapshot.storeProducts;

  // El contrato mercantil y su huella se conservan de forma minimizada para
  // acreditar la relación jurídica y resolver controversias. Se retiran los
  // identificadores de la cuenta y la evidencia técnica del firmante.
  await Promise.all(snapshot.storeAgreements.map((agreement) => db.collection(COLLECTIONS.storeAgreements).doc(String(agreement['id'])).set({
    usuarioFirmanteId: null,
    firmante: { nombre: 'Dato suprimido', rut: null, cargo: null, correo: null },
    evidencia: { ipHash: null, userAgent: null, source: 'retained_legal_record' },
    estado: 'terminado',
    terminadoEn: new Date().toISOString(),
    motivoTermino: 'Cuenta eliminada por solicitud del titular',
    eliminarDespuesDe: new Date(Date.now() + (5 * 365 * 24 * 60 * 60 * 1000)).toISOString()
  }, { merge: true })));
  await Promise.all(snapshot.intellectualPropertyReports.map((report) => db.collection(COLLECTIONS.intellectualPropertyReports).doc(String(report['id'])).set({
    claimant: {
      name: 'Dato suprimido',
      email: null,
      organization: null,
      capacity: (report['claimant'] as Record<string, unknown> | undefined)?.['capacity'] || null
    },
    receiptTokenHash: null,
    accountDataMinimizedAt: new Date().toISOString()
  }, { merge: true })));

  await Promise.all([
    deleteRowsByIds(COLLECTIONS.storeProducts, storeOffers.map((item) => String(item['id']))),
    deleteRowsByIds(COLLECTIONS.priceHistory, snapshot.priceHistory.map((item) => String(item['id']))),
    deleteRowsByIds(COLLECTIONS.projects, snapshot.projects.map((item) => String(item['id']))),
    deleteRowsByIds(COLLECTIONS.productRequests, snapshot.productRequests.map((item) => String(item['id']))),
    deleteRowsByIds(COLLECTIONS.contactRequests, snapshot.contactRequests.map((item) => String(item['id']))),
    deleteRowsByIds(COLLECTIONS.consentRecords, snapshot.consentRecords.map((item) => String(item['id']))),
    deleteRowsByIds(COLLECTIONS.privacyRequests, snapshot.privacyRequests.map((item) => String(item['id']))),
    deleteRowsByIds(COLLECTIONS.stores, snapshot.stores.map((item) => String(item['id'])))
  ]);

  await db.collection(COLLECTIONS.users).doc(userId).delete();

  // El catálogo público es derivado. Invalidarlo evita servir datos de una
  // ferretería eliminada hasta la siguiente reconstrucción programada.
  const publicCache = await db.collection(COLLECTIONS.publicCache).get();
  await deleteRowsByIds(COLLECTIONS.publicCache, publicCache.docs.map((doc) => doc.id));

  if (deleteAuthUser) {
    try { await adminAuth.deleteUser(userId); } catch { /* La cuenta de Auth puede no existir en datos heredados. */ }
  }

  const counts = {
    profiles: snapshot.profile ? 1 : 0,
    stores: snapshot.stores.length,
    offers: storeOffers.length,
    priceHistory: snapshot.priceHistory.length,
    storeAgreementsMinimized: snapshot.storeAgreements.length,
    projects: snapshot.projects.length,
    productRequests: snapshot.productRequests.length,
    contactRequests: snapshot.contactRequests.length,
    consentRecords: snapshot.consentRecords.length,
    privacyRequests: snapshot.privacyRequests.length,
    intellectualPropertyReportsMinimized: snapshot.intellectualPropertyReports.length
  };

  // Comprobante sin UID, correo ni contenido del usuario. Permite acreditar
  // que hubo una operación de eliminación sin reconstruir su identidad.
  await db.collection(COLLECTIONS.deletionReceipts).doc(randomUUID()).set({
    completedAt: new Date().toISOString(),
    counts,
    source: 'self_service_or_admin'
  });

  return counts;
}
