import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { COLLECTIONS } from '../lib/collections.js';
import { fail, ok } from '../lib/http.js';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, CURRENT_STORE_AGREEMENT_VERSION, STORE_AGREEMENT_PROVIDER } from '../lib/legal.js';
import { nowIso } from '../lib/values.js';
import { row, rows } from '../repositories/firestore.repository.js';
import { hasCurrentLegalAcceptance, stageLegalAcceptance } from '../services/consent.service.js';
import { activeStoreAgreement, storeAgreementDocumentHash } from '../services/store-agreement.service.js';

export const storeOnboardingRouter = Router();
const versions = () => ({ termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, agreementVersion: CURRENT_STORE_AGREEMENT_VERSION });
async function context(userId: string) {
  const store = (await rows(COLLECTIONS.stores)).find(item => item.usuarioDuenoId === userId);
  const user = await row(COLLECTIONS.users, userId);
  const agreement = store ? await activeStoreAgreement(store.id) : null;
  return { store, user, agreement };
}

storeOnboardingRouter.get('/store-onboarding/current', requireAuth, requireRole('ferreteria'), async (req, res) => {
  const { store, user, agreement } = await context(req.authUserId!);
  if (!store || !user) return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe una ferretería asociada a tu cuenta.', 404);
  return ok(res, {
    ...versions(),
    acceptanceRequired: !hasCurrentLegalAcceptance(user) || !agreement,
    canAccept: !['suspendido', 'terminado'].includes(store.contratoEstado),
    storeName: store.nombreComercial || user.nombre
  });
});

storeOnboardingRouter.post('/store-onboarding/accept', requireAuth, requireRole('ferreteria'), async (req, res) => {
  const required = ['termsAccepted', 'privacyAcknowledged', 'ageConfirmed', 'agreementAccepted', 'authorityConfirmed', 'catalogCommitmentConfirmed'];
  if (required.some(field => req.body?.[field] !== true)) {
    return fail(res, 'STORE_ONBOARDING_CONFIRMATION_REQUIRED', 'Marca todas las casillas obligatorias para continuar.', 400);
  }
  if (Object.entries(versions()).some(([field, version]) => req.body?.[field] !== version)) {
    return fail(res, 'STORE_ONBOARDING_VERSION_OUTDATED', 'Los documentos cambiaron. Recarga las condiciones y revísalas nuevamente.', 409);
  }
  const { store, user, agreement } = await context(req.authUserId!);
  if (!store || !user) return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe una ferretería asociada a tu cuenta.', 404);
  if (['suspendido', 'terminado'].includes(store.contratoEstado)) {
    return fail(res, 'STORE_AGREEMENT_RESTRICTED', 'El acceso comercial está suspendido o terminado. Contacta a Findi.', 403);
  }
  if (hasCurrentLegalAcceptance(user) && agreement) return ok(res, { accepted: true, ...versions() });

  const acceptedAt = nowIso();
  const batch = db.batch();
  // The authenticated account identifies the person accepting; do not invent signer RUT or title.
  if (!hasCurrentLegalAcceptance(user)) stageLegalAcceptance(batch, req.authUserId!, req.body, 'store_onboarding', acceptedAt, false);
  if (!agreement) {
    batch.set(db.collection(COLLECTIONS.storeAgreements).doc(randomUUID()), {
      ferreteriaId: store.id, usuarioFirmanteId: req.authUserId,
      version: CURRENT_STORE_AGREEMENT_VERSION, documentHash: storeAgreementDocumentHash(), estado: 'vigente',
      proveedor: STORE_AGREEMENT_PROVIDER,
      ferreteria: { razonSocial: store.razonSocial || store.nombreComercial || user.nombre, nombreComercial: store.nombreComercial || '', rut: store.rut || '', sucursal: store.nombreSucursal || 'Sucursal principal', direccion: store.direccion || user.direccion || '', comuna: store.comuna || user.comuna || '', ciudad: store.ciudad || user.ciudad || '' },
      firmante: { nombre: user.nombre, correo: user.correo, usuarioId: req.authUserId },
      declaraciones: { aceptacionIntegra: true, facultadesRepresentacion: true, compromisoCatalogo: true },
      evidencia: { source: 'store_onboarding', identityMethod: 'authenticated_account', userAgent: (req.header('user-agent') || '').slice(0, 300) },
      aceptadoEn: acceptedAt, actualizadoEn: acceptedAt, terminadoEn: null, motivoTermino: null
    });
    batch.set(db.collection(COLLECTIONS.stores).doc(store.id), { contratoVersion: CURRENT_STORE_AGREEMENT_VERSION, contratoDocumentHash: storeAgreementDocumentHash(), contratoEstado: 'vigente', contratoAceptadoEn: acceptedAt }, { merge: true });
  }
  // Legal declarations and the commercial agreement become effective together.
  await batch.commit();
  return ok(res, { accepted: true, acceptedAt, ...versions() }, 201);
});
