import { Router } from 'express';
import { adminAuth, db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { COLLECTIONS } from '../lib/collections.js';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  calendarDeadline,
  conservativeBlockingDeadline,
  isPrivacyRequestType
} from '../lib/legal.js';
import { fail, ok } from '../lib/http.js';
import { createRow, patchRow, row, rows } from '../repositories/firestore.repository.js';
import { authUserResponse } from '../services/user.service.js';
import { exportAccountData, deleteAccountData } from '../services/account-data.service.js';
import { hasCurrentLegalAcceptance, recordLegalAcceptance, recordMarketingConsent } from '../services/consent.service.js';
import { normalizeText } from '../lib/values.js';

export const privacyRouter = Router();

async function privacyOverview(userId: string): Promise<Record<string, unknown>> {
  const profile = await row(COLLECTIONS.users, userId);
  const [consents, requests] = await Promise.all([
    rows(COLLECTIONS.consentRecords),
    rows(COLLECTIONS.privacyRequests)
  ]);
  return {
    profile: await authUserResponse(userId),
    currentVersions: {
      terms: CURRENT_TERMS_VERSION,
      privacy: CURRENT_PRIVACY_VERSION
    },
    legalAcceptanceRequired: !hasCurrentLegalAcceptance(profile),
    processingBlocked: profile?.tratamientoBloqueado === true,
    marketingConsent: profile?.marketingConsent === true,
    consents: consents
      .filter((item) => item.usuarioId === userId)
      .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))),
    requests: requests
      .filter((item) => item.usuarioId === userId)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
  };
}

privacyRouter.get('/privacy/overview', requireAuth, async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesión.', 401);
  return ok(res, await privacyOverview(req.authUserId));
});

privacyRouter.post('/privacy/consents/current', requireAuth, async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesión.', 401);
  if (req.body?.termsAccepted !== true || req.body?.privacyAcknowledged !== true || req.body?.ageConfirmed !== true) {
    return fail(res, 'LEGAL_ACCEPTANCE_REQUIRED', 'Debes aceptar los términos, confirmar la lectura del aviso de privacidad y declarar que eres mayor de edad.', 400);
  }
  await recordLegalAcceptance(req.authUserId, {
    termsAccepted: true,
    privacyAcknowledged: true,
    ageConfirmed: true,
    marketingConsent: req.body?.marketingConsent === true
  }, 'privacy_center');
  return ok(res, await privacyOverview(req.authUserId));
});

privacyRouter.patch('/privacy/consents/marketing', requireAuth, async (req, res) => {
  if (!req.authUserId || typeof req.body?.granted !== 'boolean') {
    return fail(res, 'CONSENT_INVALID_PAYLOAD', 'Indica si autorizas o retiras las comunicaciones opcionales.', 400);
  }
  await recordMarketingConsent(req.authUserId, req.body.granted);
  return ok(res, await privacyOverview(req.authUserId));
});

privacyRouter.post('/privacy/requests', requireAuth, async (req, res) => {
  if (!req.authUserId || !isPrivacyRequestType(req.body?.type)) {
    return fail(res, 'PRIVACY_REQUEST_INVALID', 'Selecciona un derecho válido.', 400);
  }
  const details = normalizeText(req.body?.details).slice(0, 2000);
  if (req.body.type !== 'access' && details.length < 10) {
    return fail(res, 'PRIVACY_REQUEST_DETAILS_REQUIRED', 'Describe los datos o el tratamiento al que se refiere tu solicitud.', 400);
  }

  const submitted = new Date();
  const profile = await row(COLLECTIONS.users, req.authUserId);
  const created = await createRow(COLLECTIONS.privacyRequests, {
    usuarioId: req.authUserId,
    email: normalizeText(profile?.correo).toLowerCase(),
    type: req.body.type,
    details,
    status: 'recibida',
    submittedAt: submitted.toISOString(),
    acknowledgedAt: submitted.toISOString(),
    responseDueAt: calendarDeadline(submitted, 30),
    blockingDueAt: req.body.type === 'blocking' ? conservativeBlockingDeadline(submitted) : null,
    resolution: null,
    resolvedAt: null
  });

  if (req.body.type === 'blocking') {
    await db.collection(COLLECTIONS.users).doc(req.authUserId).set({
      tratamientoBloqueado: true,
      tratamientoBloqueadoEn: submitted.toISOString()
    }, { merge: true });
  }
  return ok(res, created, 201);
});

privacyRouter.post('/privacy/export', requireAuth, async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesión.', 401);
  const firebaseUser = await adminAuth.getUser(req.authUserId);
  const submitted = new Date();
  const request = await createRow(COLLECTIONS.privacyRequests, {
    usuarioId: req.authUserId,
    email: firebaseUser.email || '',
    type: 'portability',
    details: 'Exportación autoservicio solicitada desde Privacidad y datos.',
    status: 'completada',
    submittedAt: submitted.toISOString(),
    acknowledgedAt: submitted.toISOString(),
    responseDueAt: calendarDeadline(submitted, 30),
    resolvedAt: new Date().toISOString(),
    resolution: 'Datos entregados en formato JSON estructurado.'
  });
  const data = await exportAccountData(req.authUserId, firebaseUser.email || '');
  return ok(res, { request, data });
});

privacyRouter.delete('/privacy/account', requireAuth, async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesión.', 401);
  if (req.authRole === 'admin') {
    return fail(res, 'ADMIN_SELF_DELETE_DISABLED', 'La cuenta administradora debe eliminarse mediante un procedimiento administrativo para evitar perder el control del sistema.', 409);
  }
  const firebaseUser = await adminAuth.getUser(req.authUserId);
  const email = (firebaseUser.email || '').toLowerCase();
  if (normalizeText(req.body?.email).toLowerCase() !== email || req.body?.confirmation !== 'ELIMINAR') {
    return fail(res, 'ACCOUNT_DELETE_CONFIRMATION_INVALID', 'Confirma tu correo y escribe ELIMINAR para continuar.', 400);
  }

  const deletedAt = new Date();
  const counts = await deleteAccountData(req.authUserId, email, true);
  return ok(res, {
    deleted: true,
    deletedAt: deletedAt.toISOString(),
    counts,
    backupErasureExpectedBy: calendarDeadline(deletedAt, 180)
  });
});

privacyRouter.get('/admin/privacy-requests', requireAuth, requireRole('admin'), async (_req, res) => {
  const requests = (await rows(COLLECTIONS.privacyRequests))
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return ok(res, requests);
});

privacyRouter.patch('/admin/privacy-requests/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const status = normalizeText(req.body?.status).toLowerCase();
  if (!['recibida', 'en_revision', 'completada', 'rechazada'].includes(status)) {
    return fail(res, 'PRIVACY_STATUS_INVALID', 'El estado de la solicitud no es válido.', 400);
  }
  const current = await row(COLLECTIONS.privacyRequests, req.params.id);
  if (!current) return fail(res, 'PRIVACY_REQUEST_NOT_FOUND', 'No se encontró la solicitud.', 404);
  const finalStatus = status === 'completada' || status === 'rechazada';
  const resolutionInput = normalizeText(req.body?.resolution).slice(0, 1800);
  if (finalStatus && resolutionInput.length < 10) {
    return fail(res, 'PRIVACY_RESOLUTION_REQUIRED', 'Registra una respuesta fundada antes de cerrar la solicitud.', 400);
  }
  const resolution = status === 'rechazada'
    ? `${resolutionInput} Puedes reclamar ante la Agencia de Protección de Datos Personales dentro de 30 días hábiles, conforme a la Ley N.º 21.719.`
    : resolutionInput;
  const updated = await patchRow(COLLECTIONS.privacyRequests, req.params.id, {
    status,
    resolution,
    resolvedAt: finalStatus ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
    resolvedBy: req.authUserId
  });

  if (current.type === 'blocking' && finalStatus) {
    const stillOpen = (await rows(COLLECTIONS.privacyRequests)).some((item) => (
      item.id !== current.id
      && item.usuarioId === current.usuarioId
      && item.type === 'blocking'
      && !['completada', 'rechazada'].includes(item.status)
    ));
    if (!stillOpen) {
      await db.collection(COLLECTIONS.users).doc(current.usuarioId).set({
        tratamientoBloqueado: false,
        tratamientoDesbloqueadoEn: new Date().toISOString()
      }, { merge: true });
    }
  }
  return ok(res, updated);
});
