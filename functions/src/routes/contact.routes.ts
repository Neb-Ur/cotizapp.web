import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText } from '../lib/values.js';
import { rows, createRow, patchRow } from '../repositories/firestore.repository.js';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../lib/legal.js';
export const contactRouter = Router();

contactRouter.get('/health', (_req, res) => ok(res, { status: 'ok', service: 'cotizapp-functions' }));

contactRouter.post('/solicitudes-contacto', async (req, res) => {
  if (normalizeText(req.body?.website)) return ok(res, { received: true }, 201);

  const type = normalizeText(req.body?.type).toLowerCase();
  const name = normalizeText(req.body?.name);
  const email = normalizeText(req.body?.email).toLowerCase();
  const message = normalizeText(req.body?.message);
  const businessName = normalizeText(req.body?.businessName);
  const phone = normalizeText(req.body?.phone);
  const commune = normalizeText(req.body?.commune);
  const validTypes = ['maestro', 'ferreteria', 'otro'];

  if (!validTypes.includes(type) || name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || message.length < 8) {
    return fail(res, 'CONTACT_INVALID_PAYLOAD', 'Revisa los datos de la solicitud.', 400);
  }
  if (type === 'ferreteria' && !businessName) {
    return fail(res, 'CONTACT_STORE_DATA_REQUIRED', 'Completa el nombre de la ferretería.', 400);
  }

  if (type === 'ferreteria') {
    const required = ['termsAccepted', 'privacyAcknowledged', 'ageConfirmed', 'authorityConfirmed', 'accuracyConfirmed'];
    if (required.some(field => req.body?.[field] !== true)) {
      return fail(res, 'CONTACT_LEGAL_ACCEPTANCE_REQUIRED', 'Debes aceptar los términos, confirmar la lectura de privacidad y completar las declaraciones obligatorias de la ferretería.', 400);
    }
    if (req.body?.termsVersion !== CURRENT_TERMS_VERSION || req.body?.privacyVersion !== CURRENT_PRIVACY_VERSION) {
      return fail(res, 'CONTACT_LEGAL_VERSION_OUTDATED', 'Las condiciones cambiaron. Recarga el formulario y revisa las versiones vigentes antes de enviar.', 409);
    }
  }

  const createdAt = nowIso();

  await createRow(COLLECTIONS.contactRequests, {
    type,
    name: name.slice(0, 120),
    email: email.slice(0, 160),
    message: message.slice(0, 2000),
    businessName: businessName.slice(0, 160),
    phone: phone.slice(0, 40),
    commune: commune.slice(0, 120),
    status: 'pendiente',
    createdAt,
    ...(type === 'ferreteria' ? {
      legalAcceptance: {
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyAcknowledged: true,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        ageConfirmed: true,
        authorityConfirmed: true,
        accuracyConfirmed: true,
        source: 'store_contact_form',
        acceptedAt: createdAt
      }
    } : {})
  });

  return ok(res, { received: true }, 201);
});

contactRouter.get('/admin/solicitudes-contacto', requireAuth, requireRole('admin'), async (_req, res) => {
  const requests = (await rows(COLLECTIONS.contactRequests))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  return ok(res, requests);
});

contactRouter.patch('/admin/solicitudes-contacto/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const status = normalizeText(req.body?.status).toLowerCase();
  if (!['pendiente', 'contactado', 'cerrado'].includes(status)) {
    return fail(res, 'CONTACT_STATUS_INVALID', 'El estado de la solicitud no es valido.', 400);
  }

  const updated = await patchRow(COLLECTIONS.contactRequests, req.params.id, {
    status,
    updatedAt: nowIso()
  });
  if (!updated) return fail(res, 'CONTACT_REQUEST_NOT_FOUND', 'No se encontro la solicitud.', 404);
  return ok(res, updated);
});

// Authentication/profile. Firebase Authentication owns credentials; Firestore stores the app profile.
