import { dataMode } from '../lib/data-mode.js';
import { Router } from 'express';
import { adminAuth, db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { coordinateValue, nowIso, normalizeText, validRole, validStrongPassword } from '../lib/values.js';
import { rows, row, createRow } from '../repositories/firestore.repository.js';
import { authUserResponse } from '../services/user.service.js';
import { deleteAccountData } from '../services/account-data.service.js';
export const adminUsersRouter = Router();

adminUsersRouter.get('/admin/usuarios', requireAuth, requireRole('admin'), async (_req, res) => {
  return ok(res, await Promise.all((await rows(COLLECTIONS.users)).map((item) => authUserResponse(item.id))));
});

adminUsersRouter.post('/admin/usuarios', requireAuth, requireRole('admin'), async (req, res) => {
  const role = req.body?.rol;
  if (!validRole(role)) return fail(res, 'ADMIN_INVALID_ROLE', 'Rol invalido.', 400);
  if (!validStrongPassword(req.body?.password)) {
    return fail(
      res,
      'AUTH_WEAK_PASSWORD',
      'La contraseña debe tener entre 6 y 128 caracteres e incluir mayúscula, minúscula, número y símbolo.',
      400
    );
  }
  const storeLatitude = coordinateValue(req.body?.latitud, -90, 90);
  const storeLongitude = coordinateValue(req.body?.longitud, -180, 180);
  if (role === 'ferreteria') {
    if (!normalizeText(req.body?.ciudad) || !normalizeText(req.body?.comuna) || !normalizeText(req.body?.direccion)) {
      return fail(res, 'FERRETERIA_ADDRESS_REQUIRED', 'Ciudad, comuna y dirección son obligatorias.', 400);
    }
    if (storeLatitude === null || storeLongitude === null) {
      return fail(res, 'FERRETERIA_LOCATION_REQUIRED', 'La ubicación del local es obligatoria para las búsquedas por proximidad.', 400);
    }
  }
  const firebaseUser = await adminAuth.createUser({
    email: normalizeText(req.body?.correo).toLowerCase(),
    password: normalizeText(req.body?.password),
    displayName: normalizeText(req.body?.nombre)
  });
  await db.collection(COLLECTIONS.users).doc(firebaseUser.uid).set({
    rol: role,
    dataMode: dataMode(),
    nombre: normalizeText(req.body?.nombre),
    correo: normalizeText(req.body?.correo).toLowerCase(),
    telefono: normalizeText(req.body?.telefono),
    ciudad: normalizeText(req.body?.ciudad),
    comuna: normalizeText(req.body?.comuna),
    direccion: normalizeText(req.body?.direccion),
    estadoCuenta: req.body?.estadoCuenta || (role === 'ferreteria' ? 'pendiente' : 'activo'),
    creadoEn: nowIso()
  });
  if (role === 'ferreteria') {
    await createRow(COLLECTIONS.stores, {
      usuarioDuenoId: firebaseUser.uid,
      nombreComercial: normalizeText(req.body?.nombreComercial) || normalizeText(req.body?.nombre),
      rut: normalizeText(req.body?.rut),
      latitud: storeLatitude,
      longitud: storeLongitude,
      estado: 'activo',
      creadoEn: nowIso()
    });
  }
  return ok(res, await authUserResponse(firebaseUser.uid), 201);
});

adminUsersRouter.patch('/admin/usuarios/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const current = await row(COLLECTIONS.users, req.params.id);
  if (!current) return fail(res, 'AUTH_USER_NOT_FOUND', 'Usuario no encontrado.', 404);
  const allowed = ['rol', 'nombre', 'telefono', 'ciudad', 'comuna', 'direccion', 'estadoCuenta'];
  const patch: Record<string, unknown> = {};
  allowed.forEach((key) => { if (req.body?.[key] !== undefined) patch[key] = req.body[key]; });
  await db.collection(COLLECTIONS.users).doc(req.params.id).set(patch, { merge: true });
  return ok(res, await authUserResponse(req.params.id));
});

adminUsersRouter.delete('/admin/usuarios/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const current = await row(COLLECTIONS.users, req.params.id);
  if (!current) return fail(res, 'AUTH_USER_NOT_FOUND', 'Usuario no encontrado.', 404);
  const counts = await deleteAccountData(req.params.id, normalizeText(current.correo).toLowerCase(), true);
  return ok(res, { deleted: true, counts });
});
