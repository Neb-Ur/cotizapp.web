import { randomUUID } from 'node:crypto';
import { adminAuth, db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { deleteRowsByIds, rows } from '../repositories/firestore.repository.js';

interface AccountDataSnapshot {
  exportedAt: string;
  emailLinkedRecordsIncluded: boolean;
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
  priceReports: Record<string, unknown>[];
  storeReviews: Record<string, unknown>[];
}

async function accountRows(userId: string, email: string): Promise<AccountDataSnapshot> {
  // An authenticated UID is not proof of ownership of an unverified email.
  // Keep self-service UID data available; anonymous email-linked records need
  // verified ownership, including when deletion is initiated by an admin.
  const authUser = await adminAuth.getUser(userId).catch((error: { code?: string }) => {
    if (error.code === 'auth/user-not-found') return null;
    throw error;
  });
  const verifiedEmail = authUser?.emailVerified && authUser.email
    && authUser.email.toLowerCase() === email.trim().toLowerCase()
    ? authUser.email.toLowerCase() : null;
  const belongsToAccount = (item: any, recordEmail: unknown) => item.usuarioId === userId
    || (!!verifiedEmail && String(recordEmail || '').toLowerCase() === verifiedEmail);
  const [userDoc, stores, storeProducts, priceHistory, storeAgreements, projects, productRequests, contacts, consents, privacyRequests, ipReports, priceReports, storeReviews] = await Promise.all([
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
    rows(COLLECTIONS.intellectualPropertyReports),
    rows(COLLECTIONS.priceReports),
    rows(COLLECTIONS.storeReviews)
  ]);
  const ownedStores = stores.filter((item) => item.usuarioDuenoId === userId);
  const storeIds = new Set(ownedStores.map((item) => item.id));

  return {
    exportedAt: new Date().toISOString(),
    emailLinkedRecordsIncluded: !!verifiedEmail,
    profile: userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null,
    stores: ownedStores,
    storeProducts: storeProducts.filter((item) => storeIds.has(item.ferreteriaId)),
    priceHistory: priceHistory.filter((item) => item.actorId === userId || storeIds.has(item.ferreteriaId)),
    storeAgreements: storeAgreements.filter((item) => item.usuarioFirmanteId === userId || storeIds.has(item.ferreteriaId)),
    projects: projects.filter((item) => item.ownerId === userId),
    productRequests: productRequests.filter((item) => item.usuarioSolicitanteId === userId || storeIds.has(item.ferreteriaId)),
    contactRequests: contacts.filter((item) => belongsToAccount(item, item.email)),
    consentRecords: consents.filter((item) => item.usuarioId === userId),
    privacyRequests: privacyRequests.filter((item) => item.usuarioId === userId),
    intellectualPropertyReports: ipReports.filter((item) => belongsToAccount(item, item.claimant?.email)),
    storeReviews: storeReviews.filter(item => item.userId === userId),
    priceReports: priceReports.filter((item) => belongsToAccount(item, item.email))
  };
}

export async function exportAccountData(userId: string, email: string): Promise<AccountDataSnapshot> {
  return accountRows(userId, email);
}

export async function deleteAccountData(userId: string, email: string, deleteAuthUser = true): Promise<Record<string, number>> {
  const snapshot = await accountRows(userId, email);
  const storeOffers = snapshot.storeProducts;
  const storeIds = new Set(snapshot.stores.map(store => store['id']));
  const reviewsToDelete = (await rows(COLLECTIONS.storeReviews)).filter(review => review.userId === userId || storeIds.has(review.storeId));
  await deleteRowsByIds(COLLECTIONS.storeReviews, reviewsToDelete.map(review => review.id));

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
  // Price evidence is retained independently from the deleted account so the
  // platform can demonstrate how a comparison was calculated at a given time.
  await Promise.all(snapshot.priceHistory.map((entry) => db.collection(COLLECTIONS.priceHistory).doc(String(entry['id'])).set({
    actorId: null,
    actorAccountDeletedAt: new Date().toISOString(),
    source: entry['source'] || 'retained_comparison_evidence'
  }, { merge: true })));
  await Promise.all(snapshot.priceReports.map((report) => db.collection(COLLECTIONS.priceReports).doc(String(report['id'])).set({
    email: null,
    accountDataMinimizedAt: new Date().toISOString()
  }, { merge: true })));

  await Promise.all([
    deleteRowsByIds(COLLECTIONS.storeProducts, storeOffers.map((item) => String(item['id']))),
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
    try { await adminAuth.deleteUser(userId); } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    }
  }

  const counts = {
    profiles: snapshot.profile ? 1 : 0,
    stores: snapshot.stores.length,
    offers: storeOffers.length,
    priceHistoryMinimized: snapshot.priceHistory.length,
    storeAgreementsMinimized: snapshot.storeAgreements.length,
    storeReviews: reviewsToDelete.length,
    projects: snapshot.projects.length,
    productRequests: snapshot.productRequests.length,
    contactRequests: snapshot.contactRequests.length,
    consentRecords: snapshot.consentRecords.length,
    privacyRequests: snapshot.privacyRequests.length,
    intellectualPropertyReportsMinimized: snapshot.intellectualPropertyReports.length,
    priceReportsMinimized: snapshot.priceReports.length
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
