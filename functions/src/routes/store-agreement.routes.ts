import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { COLLECTIONS } from '../lib/collections.js';
import { fail, ok } from '../lib/http.js';
import {
  CURRENT_STORE_AGREEMENT_EFFECTIVE_DATE,
  CURRENT_STORE_AGREEMENT_VERSION,
  STORE_AGREEMENT_CLAUSES,
  STORE_AGREEMENT_PROVIDER
} from '../lib/legal.js';
import { normalizeText, nowIso, validChileanTaxId } from '../lib/values.js';
import { deleteRowsByIds, row, rows } from '../repositories/firestore.repository.js';
import { activeStoreAgreement, storeAgreementDocumentHash } from '../services/store-agreement.service.js';

export const storeAgreementRouter = Router();

function normalizedTaxId(value: unknown): string {
  return normalizeText(value).replace(/[^0-9kK]/g, '').toUpperCase();
}

function clientEvidenceHash(value: string): string {
  const salt = process.env['AGREEMENT_EVIDENCE_SALT'] || 'replace-in-production';
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

async function ownedStore(userId: string): Promise<Record<string, any> | null> {
  return (await rows(COLLECTIONS.stores)).find((item) => item.usuarioDuenoId === userId) || null;
}

storeAgreementRouter.get('/store-agreement/current', requireAuth, requireRole('ferreteria'), async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesión.', 401);
  const store = await ownedStore(req.authUserId);
  if (!store) return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe una ferretería asociada a tu cuenta.', 404);
  const user = await row(COLLECTIONS.users, req.authUserId);
  const agreement = await activeStoreAgreement(store.id);
  return ok(res, {
    version: CURRENT_STORE_AGREEMENT_VERSION,
    effectiveDate: CURRENT_STORE_AGREEMENT_EFFECTIVE_DATE,
    documentHash: storeAgreementDocumentHash(),
    provider: STORE_AGREEMENT_PROVIDER,
    store: {
      id: store.id,
      legalName: store.razonSocial || store.nombreComercial || user?.nombre || '',
      businessName: store.nombreComercial || '',
      taxId: store.rut || '',
      address: store.direccion || user?.direccion || '',
      commune: store.comuna || user?.comuna || '',
      city: store.ciudad || user?.ciudad || '',
      branchName: store.nombreSucursal || 'Sucursal principal'
    },
    clauses: STORE_AGREEMENT_CLAUSES,
    status: agreement ? 'vigente' : 'pendiente',
    agreement
  });
});

storeAgreementRouter.post('/store-agreement/accept', requireAuth, requireRole('ferreteria'), async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesión.', 401);
  const store = await ownedStore(req.authUserId);
  if (!store) return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe una ferretería asociada a tu cuenta.', 404);
  if (req.body?.version !== CURRENT_STORE_AGREEMENT_VERSION
    || req.body?.accepted !== true
    || req.body?.authorityConfirmed !== true
    || req.body?.catalogCommitmentConfirmed !== true) {
    return fail(res, 'STORE_AGREEMENT_CONFIRMATION_REQUIRED', 'Debes revisar el contrato y completar todas las declaraciones obligatorias.', 400);
  }

  const signerName = normalizeText(req.body?.signerName).slice(0, 160);
  const signerTaxId = normalizeText(req.body?.signerTaxId).slice(0, 20);
  const signerTitle = normalizeText(req.body?.signerTitle).slice(0, 100);
  const legalName = normalizeText(req.body?.legalName).slice(0, 180);
  if (signerName.length < 3 || !validChileanTaxId(signerTaxId) || signerTitle.length < 2 || legalName.length < 2) {
    return fail(res, 'STORE_AGREEMENT_SIGNER_INVALID', 'Completa la identidad y cargo del representante autorizado.', 400);
  }
  if (!validChileanTaxId(store.rut) || normalizedTaxId(store.rut) !== normalizedTaxId(req.body?.storeTaxId)) {
    return fail(res, 'STORE_AGREEMENT_TAX_ID_MISMATCH', 'El RUT confirmado no coincide con el registrado para la ferretería.', 409);
  }

  const user = await row(COLLECTIONS.users, req.authUserId);
  const acceptedAt = nowIso();
  const agreementId = randomUUID();
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.storeAgreements).doc(agreementId), {
    ferreteriaId: store.id,
    usuarioFirmanteId: req.authUserId,
    version: CURRENT_STORE_AGREEMENT_VERSION,
    documentHash: storeAgreementDocumentHash(),
    estado: 'vigente',
    proveedor: STORE_AGREEMENT_PROVIDER,
    ferreteria: {
      razonSocial: legalName,
      nombreComercial: store.nombreComercial || '',
      rut: store.rut,
      sucursal: store.nombreSucursal || 'Sucursal principal',
      direccion: store.direccion || user?.direccion || '',
      comuna: store.comuna || user?.comuna || '',
      ciudad: store.ciudad || user?.ciudad || ''
    },
    firmante: {
      nombre: signerName,
      rut: signerTaxId,
      cargo: signerTitle,
      correo: user?.correo || ''
    },
    declaraciones: {
      aceptacionIntegra: true,
      facultadesRepresentacion: true,
      compromisoCatalogo: true
    },
    evidencia: {
      ipHash: clientEvidenceHash(req.ip || req.socket.remoteAddress || 'unknown'),
      userAgent: normalizeText(req.header('user-agent')).slice(0, 300),
      source: 'store_portal'
    },
    aceptadoEn: acceptedAt,
    actualizadoEn: acceptedAt,
    terminadoEn: null,
    motivoTermino: null
  });
  batch.set(db.collection(COLLECTIONS.stores).doc(store.id), {
    razonSocial: legalName,
    contratoVersion: CURRENT_STORE_AGREEMENT_VERSION,
    contratoDocumentHash: storeAgreementDocumentHash(),
    contratoEstado: 'vigente',
    contratoAceptadoEn: acceptedAt
  }, { merge: true });
  await batch.commit();
  const publicCache = await db.collection(COLLECTIONS.publicCache).get();
  await deleteRowsByIds(COLLECTIONS.publicCache, publicCache.docs.map((document) => document.id));
  return ok(res, { id: agreementId, status: 'vigente', acceptedAt, version: CURRENT_STORE_AGREEMENT_VERSION }, 201);
});

storeAgreementRouter.get('/admin/store-agreements', requireAuth, requireRole('admin'), async (_req, res) => {
  const agreements = (await rows(COLLECTIONS.storeAgreements))
    .sort((left, right) => String(right.aceptadoEn).localeCompare(String(left.aceptadoEn)));
  return ok(res, agreements);
});

storeAgreementRouter.patch('/admin/store-agreements/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const agreement = await row(COLLECTIONS.storeAgreements, req.params.id);
  if (!agreement) return fail(res, 'STORE_AGREEMENT_NOT_FOUND', 'No se encontró el contrato.', 404);
  const status = normalizeText(req.body?.status).toLowerCase();
  const reason = normalizeText(req.body?.reason).slice(0, 1000);
  if (!['suspendido', 'terminado'].includes(status) || reason.length < 10) {
    return fail(res, 'STORE_AGREEMENT_STATUS_INVALID', 'Indica suspensión o término y una causa suficiente.', 400);
  }
  const changedAt = nowIso();
  const offers = (await rows(COLLECTIONS.storeProducts)).filter((item) => item.ferreteriaId === agreement.ferreteriaId);
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.storeAgreements).doc(req.params.id), {
    estado: status,
    actualizadoEn: changedAt,
    terminadoEn: status === 'terminado' ? changedAt : null,
    motivoTermino: reason,
    modificadoPor: req.authUserId
  }, { merge: true });
  batch.set(db.collection(COLLECTIONS.stores).doc(agreement.ferreteriaId), {
    contratoEstado: status,
    contratoActualizadoEn: changedAt
  }, { merge: true });
  await batch.commit();
  for (let offset = 0; offset < offers.length; offset += 400) {
    const offerBatch = db.batch();
    offers.slice(offset, offset + 400).forEach((offer) => offerBatch.set(db.collection(COLLECTIONS.storeProducts).doc(offer.id), {
      publicado: false,
      actualizadoEn: changedAt,
      retiroMotivo: `Contrato ${status}: ${reason}`
    }, { merge: true }));
    await offerBatch.commit();
  }
  const publicCache = await db.collection(COLLECTIONS.publicCache).get();
  await deleteRowsByIds(COLLECTIONS.publicCache, publicCache.docs.map((document) => document.id));
  return ok(res, { ...agreement, estado: status, actualizadoEn: changedAt, motivoTermino: reason });
});
