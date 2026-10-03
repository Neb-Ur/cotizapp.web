import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { COLLECTIONS } from '../lib/collections.js';
import { fail, ok } from '../lib/http.js';
import { calendarDeadline } from '../lib/legal.js';
import { normalizeText, nowIso } from '../lib/values.js';
import { deleteRowsByIds, patchRow, row, rows } from '../repositories/firestore.repository.js';

export const intellectualPropertyRouter = Router();

const validRights = ['copyright', 'trademark', 'both'];
const validContentTypes = ['product_image', 'logo', 'technical_sheet', 'commercial_description', 'other'];
const validTargetTypes = ['store_offer', 'master_product', 'store', 'other'];
const validStatuses = ['recibida', 'en_revision', 'retiro_preventivo', 'esperando_respuesta', 'repuesto', 'retiro_definitivo', 'rechazada'];

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function validPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function invalidatePublicCatalog(): Promise<void> {
  const snapshot = await db.collection(COLLECTIONS.publicCache).get();
  await deleteRowsByIds(COLLECTIONS.publicCache, snapshot.docs.map((document) => document.id));
}

intellectualPropertyRouter.post('/ip-reports', async (req, res) => {
  if (normalizeText(req.body?.website)) return ok(res, { received: true }, 201);

  const claimantName = normalizeText(req.body?.claimantName).slice(0, 160);
  const claimantEmail = normalizeText(req.body?.claimantEmail).toLowerCase().slice(0, 180);
  const organization = normalizeText(req.body?.organization).slice(0, 180);
  const capacity = normalizeText(req.body?.capacity).toLowerCase();
  const rightsType = normalizeText(req.body?.rightsType).toLowerCase();
  const contentType = normalizeText(req.body?.contentType).toLowerCase();
  const targetType = normalizeText(req.body?.targetType).toLowerCase();
  const targetId = normalizeText(req.body?.targetId).slice(0, 160);
  const contentUrl = normalizeText(req.body?.contentUrl).slice(0, 1000);
  const originalWorkUrl = normalizeText(req.body?.originalWorkUrl).slice(0, 1000);
  const workDescription = normalizeText(req.body?.workDescription).slice(0, 3000);
  const infringementDescription = normalizeText(req.body?.infringementDescription).slice(0, 4000);

  if (claimantName.length < 3
    || !/^\S+@\S+\.\S+$/.test(claimantEmail)
    || !['owner', 'authorized_agent'].includes(capacity)
    || !validRights.includes(rightsType)
    || !validContentTypes.includes(contentType)
    || !validTargetTypes.includes(targetType)
    || !validPublicUrl(contentUrl)
    || (originalWorkUrl && !validPublicUrl(originalWorkUrl))
    || workDescription.length < 20
    || infringementDescription.length < 20
    || req.body?.goodFaithConfirmed !== true
    || req.body?.accuracyConfirmed !== true
    || req.body?.contactAuthorized !== true) {
    return fail(res, 'IP_REPORT_INVALID', 'Revisa la identificación, las URLs, la descripción y las declaraciones obligatorias.', 400);
  }

  const submittedAt = new Date();
  const receiptToken = randomBytes(24).toString('hex');
  const reference = `PI-${submittedAt.getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  const created = await db.collection(COLLECTIONS.intellectualPropertyReports).add({
    reference,
    receiptTokenHash: tokenHash(receiptToken),
    claimant: { name: claimantName, email: claimantEmail, organization, capacity },
    rightsType,
    contentType,
    targetType,
    targetId: targetId || null,
    contentUrl,
    originalWorkUrl: originalWorkUrl || null,
    workDescription,
    infringementDescription,
    declarations: { goodFaith: true, accuracy: true, contactAuthorized: true },
    status: 'recibida',
    publicStatusMessage: 'Denuncia recibida y pendiente de revisión inicial.',
    submittedAt: submittedAt.toISOString(),
    acknowledgedAt: submittedAt.toISOString(),
    initialReviewDueAt: calendarDeadline(submittedAt, 2),
    targetResolutionAt: calendarDeadline(submittedAt, 10),
    assignedTo: null,
    resolution: null,
    resolvedAt: null,
    history: [{ status: 'recibida', occurredAt: submittedAt.toISOString(), actor: 'claimant' }]
  });

  return ok(res, {
    received: true,
    id: created.id,
    reference,
    receiptToken,
    acknowledgedAt: submittedAt.toISOString(),
    initialReviewDueAt: calendarDeadline(submittedAt, 2)
  }, 201);
});

intellectualPropertyRouter.post('/ip-reports/status', async (req, res) => {
  const reference = normalizeText(req.body?.reference).toUpperCase();
  const receiptToken = normalizeText(req.body?.receiptToken);
  const report = (await rows(COLLECTIONS.intellectualPropertyReports)).find((item) => item.reference === reference);
  if (!report || !receiptToken || report.receiptTokenHash !== tokenHash(receiptToken)) {
    return fail(res, 'IP_REPORT_RECEIPT_INVALID', 'El número de seguimiento o código privado no es válido.', 404);
  }
  return ok(res, {
    reference: report.reference,
    status: report.status,
    publicStatusMessage: report.publicStatusMessage,
    submittedAt: report.submittedAt,
    updatedAt: report.updatedAt || report.submittedAt,
    resolvedAt: report.resolvedAt || null
  });
});

intellectualPropertyRouter.get('/admin/ip-reports', requireAuth, requireRole('admin'), async (_req, res) => {
  const reports = (await rows(COLLECTIONS.intellectualPropertyReports))
    .map(({ receiptTokenHash: _secret, ...report }) => report)
    .sort((left, right) => String(right.submittedAt).localeCompare(String(left.submittedAt)));
  return ok(res, reports);
});

intellectualPropertyRouter.patch('/admin/ip-reports/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const current = await row(COLLECTIONS.intellectualPropertyReports, req.params.id);
  if (!current) return fail(res, 'IP_REPORT_NOT_FOUND', 'No se encontró la denuncia.', 404);
  const status = normalizeText(req.body?.status).toLowerCase();
  const resolution = normalizeText(req.body?.resolution).slice(0, 3000);
  const publicStatusMessage = normalizeText(req.body?.publicStatusMessage).slice(0, 500);
  if (!validStatuses.includes(status) || resolution.length < 10 || publicStatusMessage.length < 10) {
    return fail(res, 'IP_REPORT_RESOLUTION_INVALID', 'Selecciona un estado e informa una decisión interna y un mensaje para el denunciante.', 400);
  }

  const changedAt = nowIso();
  const shouldRemove = status === 'retiro_preventivo' || status === 'retiro_definitivo';
  const shouldRestore = status === 'repuesto';
  if ((shouldRemove || shouldRestore) && current.targetType === 'store_offer' && current.targetId) {
    const target = await row(COLLECTIONS.storeProducts, current.targetId);
    if (target) await patchRow(COLLECTIONS.storeProducts, current.targetId, {
      publicado: shouldRestore,
      activo: shouldRestore ? target.activo !== false : false,
      propiedadIntelectualEstado: status,
      propiedadIntelectualReporteId: req.params.id,
      actualizadoEn: changedAt
    });
  }
  if ((shouldRemove || shouldRestore) && current.targetType === 'master_product' && current.targetId) {
    const target = await row(COLLECTIONS.masterProducts, current.targetId);
    if (target) await patchRow(COLLECTIONS.masterProducts, current.targetId, {
      estado: shouldRestore ? 'activo' : 'inactivo',
      propiedadIntelectualEstado: status,
      propiedadIntelectualReporteId: req.params.id,
      actualizadoEn: changedAt
    });
  }
  if ((shouldRemove || shouldRestore) && current.targetType === 'store' && current.targetId) {
    const target = await row(COLLECTIONS.stores, current.targetId);
    if (target) await patchRow(COLLECTIONS.stores, current.targetId, {
      estado: shouldRestore ? 'activo' : 'inactivo',
      propiedadIntelectualEstado: status,
      propiedadIntelectualReporteId: req.params.id,
      actualizadoEn: changedAt
    });
  }
  if (shouldRemove || shouldRestore) await invalidatePublicCatalog();

  const final = ['repuesto', 'retiro_definitivo', 'rechazada'].includes(status);
  const updated = await patchRow(COLLECTIONS.intellectualPropertyReports, req.params.id, {
    status,
    publicStatusMessage,
    resolution,
    assignedTo: req.authUserId,
    updatedAt: changedAt,
    resolvedAt: final ? changedAt : null,
    history: [
      ...(Array.isArray(current.history) ? current.history : []),
      { status, occurredAt: changedAt, actor: req.authUserId, resolution }
    ]
  });
  return ok(res, updated);
});
