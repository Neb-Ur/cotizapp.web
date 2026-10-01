import { Router } from 'express';
import { adminAuth, db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, validRole } from '../lib/values.js';
import { rows, row, createRow, deleteRowsByIds } from '../repositories/firestore.repository.js';
import { authUserResponse } from '../services/user.service.js';
export const adminUsersRouter = Router();

adminUsersRouter.get('/admin/usuarios', requireAuth, requireRole('admin'), async (_req, res) => {
  return ok(res, await Promise.all((await rows(COLLECTIONS.users)).map((item) => authUserResponse(item.id))));
});

adminUsersRouter.post('/admin/usuarios', requireAuth, requireRole('admin'), async (req, res) => {
  const role = req.body?.rol;
  if (!validRole(role)) return fail(res, 'ADMIN_INVALID_ROLE', 'Rol invalido.', 400);
  const firebaseUser = await adminAuth.createUser({
    email: normalizeText(req.body?.correo).toLowerCase(),
    password: normalizeText(req.body?.password),
    displayName: normalizeText(req.body?.nombre)
  });
  await db.collection(COLLECTIONS.users).doc(firebaseUser.uid).set({
    rol: role,
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
  const stores = (await rows(COLLECTIONS.stores)).filter((item) => item.usuarioDuenoId === req.params.id);
  for (const store of stores) {
    const offers = (await rows(COLLECTIONS.storeProducts)).filter((item) => item.ferreteriaId === store.id);
    await deleteRowsByIds(COLLECTIONS.storeProducts, offers.map((item) => item.id));
    await db.collection(COLLECTIONS.stores).doc(store.id).delete();
  }
  await db.collection(COLLECTIONS.users).doc(req.params.id).delete();
  try { await adminAuth.deleteUser(req.params.id); } catch { /* profile may predate Firebase Auth */ }
  return ok(res, { deleted: true });
});
