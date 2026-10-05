import { dataMode } from '../lib/data-mode.js';
import { Router } from 'express';
import { adminAuth, db } from '../lib/firebase.js';
import { requireAuth } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, coordinateValue, validRole } from '../lib/values.js';
import { rows, createRow } from '../repositories/firestore.repository.js';
import { authUserResponse } from '../services/user.service.js';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../lib/legal.js';
import { hasCurrentLegalAcceptance, recordLegalAcceptance } from '../services/consent.service.js';
export const authRouter = Router();

authRouter.post('/auth/register', requireAuth, async (req, res) => {
  const role = req.body?.rol;
  if (!req.authUserId || !validRole(role) || role === 'admin') {
    return fail(res, 'AUTH_INVALID_PAYLOAD', 'Datos invalidos para crear el perfil.', 400);
  }
  if (req.body?.termsAccepted !== true || req.body?.privacyAcknowledged !== true || req.body?.ageConfirmed !== true) {
    return fail(
      res,
      'LEGAL_ACCEPTANCE_REQUIRED',
      'Debes aceptar los términos, autorizar el tratamiento de datos necesario para la cuenta y declarar que eres mayor de edad.',
      400
    );
  }

  if (req.body?.termsVersion !== CURRENT_TERMS_VERSION || req.body?.privacyVersion !== CURRENT_PRIVACY_VERSION) {
    return fail(res, 'LEGAL_VERSION_OUTDATED', 'Los documentos cambiaron. Recarga y revisa las versiones vigentes antes de aceptar.', 409);
  }
  const firebaseUser = await adminAuth.getUser(req.authUserId);
  const userPayload = {
    rol: role,
    dataMode: dataMode(),
    nombre: normalizeText(req.body?.nombre),
    correo: (firebaseUser.email || normalizeText(req.body?.correo)).toLowerCase(),
    telefono: normalizeText(req.body?.telefono),
    region: normalizeText(req.body?.region),
    ciudad: normalizeText(req.body?.ciudad),
    comuna: normalizeText(req.body?.comuna),
    direccion: normalizeText(req.body?.direccion),
    estadoCuenta: role === 'ferreteria' ? 'pendiente' : 'activo',
    creadoEn: nowIso()
  };

  if (!userPayload.nombre || !userPayload.correo) {
    return fail(res, 'AUTH_INVALID_PAYLOAD', 'Nombre y correo son obligatorios.', 400);
  }

  const storeLatitude = coordinateValue(req.body?.latitud, -90, 90);
  const storeLongitude = coordinateValue(req.body?.longitud, -180, 180);
  if (role === 'ferreteria' && (storeLatitude === null || storeLongitude === null)) {
    return fail(res, 'FERRETERIA_LOCATION_REQUIRED', 'Registra la ubicacion del local para aparecer en busquedas cercanas.', 400);
  }

  const created = await db.runTransaction(async tx => {
    const ref = db.collection(COLLECTIONS.users).doc(req.authUserId!);
    if ((await tx.get(ref)).exists) return false;
    tx.create(ref, userPayload);
    return true;
  });
  if (!created) return fail(res, 'AUTH_PROFILE_ALREADY_EXISTS', 'Tu perfil ya existe. Puedes actualizarlo desde tu cuenta.', 409);

  if (role === 'ferreteria') {
    const existingStores = (await rows(COLLECTIONS.stores)).filter((store) => store.usuarioDuenoId === req.authUserId);
    if (existingStores.length === 0) {
      await createRow(COLLECTIONS.stores, {
        usuarioDuenoId: req.authUserId,
        nombreComercial: normalizeText(req.body?.nombreComercial) || userPayload.nombre,
        rut: normalizeText(req.body?.rut),
        latitud: storeLatitude,
        longitud: storeLongitude,
        estado: 'activo',
        creadoEn: nowIso()
      });
    }
  }

  await recordLegalAcceptance(req.authUserId, {
    termsAccepted: true,
    privacyAcknowledged: true,
    ageConfirmed: true,
    marketingConsent: req.body?.marketingConsent === true
  }, 'registration');

  const profile = await authUserResponse(req.authUserId);
  return ok(res, { usuario: profile }, 201);
});

authRouter.get('/auth/me', requireAuth, async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesion.', 401);
  const profile = await authUserResponse(req.authUserId);
  if (!profile) return fail(res, 'AUTH_USER_NOT_FOUND', 'No se encontro el perfil del usuario.', 404);
  return ok(res, profile);
});

authRouter.get('/auth/session', requireAuth, async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesion.', 401);
  const profile = await authUserResponse(req.authUserId);
  const rawProfile = await db.collection(COLLECTIONS.users).doc(req.authUserId).get();
  return ok(res, {
    usuario: profile,
    requiereCompletarPerfil: !profile,
    requiereAceptacionLegal: profile ? !hasCurrentLegalAcceptance(rawProfile.data()) : false,
    versionesLegales: {
      terminos: CURRENT_TERMS_VERSION,
      privacidad: CURRENT_PRIVACY_VERSION
    }
  });
});

authRouter.patch('/auth/me', requireAuth, async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesion.', 401);
  const allowed = ['nombre', 'telefono', 'region', 'ciudad', 'comuna', 'direccion'];
  const patch: Record<string, unknown> = {};
  allowed.forEach((key) => {
    if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  });
  const profileRef = db.collection(COLLECTIONS.users).doc(req.authUserId);
  if (!(await profileRef.get()).exists) return fail(res, 'AUTH_USER_NOT_FOUND', 'Completa tu perfil antes de editarlo.', 404);
  const batch = db.batch();
  if (Object.keys(patch).length > 0) batch.update(profileRef, patch);

  const stores = (await rows(COLLECTIONS.stores)).filter((store) => store.usuarioDuenoId === req.authUserId);
  if (stores[0]) {
    const storePatch: Record<string, unknown> = {};
    if (req.body?.nombreComercial !== undefined) storePatch['nombreComercial'] = normalizeText(req.body.nombreComercial);
    if (req.body?.rut !== undefined) storePatch['rut'] = normalizeText(req.body.rut);

    if (req.body?.latitud !== undefined || req.body?.longitud !== undefined) {
      const latitude = coordinateValue(req.body?.latitud, -90, 90);
      const longitude = coordinateValue(req.body?.longitud, -180, 180);
      if (latitude === null || longitude === null) {
        return fail(res, 'FERRETERIA_LOCATION_INVALID', 'La ubicacion del local no es valida.', 400);
      }
      storePatch['latitud'] = latitude;
      storePatch['longitud'] = longitude;
    }

    if (Object.keys(storePatch).length > 0) batch.update(db.collection(COLLECTIONS.stores).doc(stores[0].id), storePatch);
  }

  await batch.commit();
  return ok(res, await authUserResponse(req.authUserId));
});

authRouter.post('/auth/logout', requireAuth, async (_req, res) => ok(res, { success: true }));

// Taxonomy.
