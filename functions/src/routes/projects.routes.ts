import { buildSearchRows } from '../services/catalog-search.service.js';
import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, normalizeProjectProximity } from '../lib/values.js';
import { rows, row, createRow, patchRow } from '../repositories/firestore.repository.js';
import { canAccessOwner } from '../lib/ownership.js';
import { normalizeItems, optimizeItems, projectView } from '../services/quotation.service.js';
export const projectsRouter = Router();

projectsRouter.get('/maestros/:ownerId/proyectos', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para estas cotizaciones.', 403);
  const snapshot = await db.collection(COLLECTIONS.projects).where('ownerId', '==', req.params.ownerId).get();
  const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    .sort((a, b) => normalizeText(b.createdAt).localeCompare(normalizeText(a.createdAt)));
  const offers = await buildSearchRows();
  const data = await Promise.all(projects.map(project => projectView(project, offers)));
  return ok(res, data);
});

projectsRouter.post('/maestros/:ownerId/proyectos', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para crear esta cotizacion.', 403);

  const name = normalizeText(req.body?.nombre);
  if (!name) return fail(res, 'PROYECTO_INVALID_PAYLOAD', 'Nombre de cotizacion requerido.', 400);
  const payload = {
    ownerId: req.params.ownerId,
    name,
    address: normalizeText(req.body?.direccionObra),
    description: normalizeText(req.body?.descripcion).slice(0, 2000),
    items: normalizeItems(req.body?.items),
    proximity: normalizeProjectProximity(req.body?.proximidad) || null,
    singleStoreName: normalizeText(req.body?.ferreteriaUnica) || null,
    singleStoreId: normalizeText(req.body?.ferreteriaUnicaId) || null,
    createdAt: nowIso()
  };
  const ref = db.collection(COLLECTIONS.projects).doc();
  const created = await db.runTransaction(async tx => {
    const lock = db.collection(COLLECTIONS.projectOwnerLocks).doc(req.params.ownerId);
    await tx.get(lock);
    const existing = await tx.get(db.collection(COLLECTIONS.projects).where('ownerId', '==', req.params.ownerId));
    if (existing.size >= 2) return null;
    tx.set(lock, { updatedAt: nowIso() });
    tx.create(ref, payload);
    return { id: ref.id, ...payload };
  });
  if (!created) return fail(res, 'COTIZACION_LIMIT_REACHED', 'Puedes guardar un maximo de 2 cotizaciones. Elimina una para crear otra.', 409);
  return ok(res, await projectView(created), 201);
});

projectsRouter.get('/maestros/:ownerId/proyectos/:projectId', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  return ok(res, await projectView(project));
});

projectsRouter.put('/maestros/:ownerId/proyectos/:projectId', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  const updated = await patchRow(COLLECTIONS.projects, req.params.projectId, {
    name: normalizeText(req.body?.nombre) || project.name,
    address: normalizeText(req.body?.direccionObra),
    description: req.body?.descripcion === undefined ? (project.description || '') : normalizeText(req.body.descripcion).slice(0, 2000),
    items: normalizeItems(req.body?.items),
    proximity: normalizeProjectProximity(req.body?.proximidad) || null,
    singleStoreName: normalizeText(req.body?.ferreteriaUnica) || null,
    singleStoreId: normalizeText(req.body?.ferreteriaUnicaId) || null,
    updatedAt: nowIso()
  });
  return ok(res, await projectView(updated));
});

projectsRouter.post('/maestros/:ownerId/proyectos/:projectId/items', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  const updated = await db.runTransaction(async tx => {
    const ref = db.collection(COLLECTIONS.projects).doc(req.params.projectId);
    const latest = await tx.get(ref);
    if (!latest.exists || latest.data()?.['ownerId'] !== req.params.ownerId) return null;
    const data = latest.data()!;
    const patch = { items: [...normalizeItems(data['items']), ...normalizeItems([req.body])], updatedAt: nowIso() };
    tx.update(ref, patch);
    return { id: ref.id, ...data, ...patch };
  });
  if (!updated) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  return ok(res, await projectView(updated), 201);
});


projectsRouter.delete('/maestros/:ownerId/proyectos/:projectId', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  await db.collection(COLLECTIONS.projects).doc(req.params.projectId).delete();
  return ok(res, { deleted: true });
});

projectsRouter.post('/cotizaciones/optimizar', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  return ok(
    res,
    await optimizeItems(
      normalizeItems(req.body?.items),
      normalizeProjectProximity(req.body?.proximidad),
      normalizeText(req.body?.ferreteriaUnica),
      undefined,
      normalizeText(req.body?.ferreteriaUnicaId)
    )
  );
});




// Product creation requests (kept simple for MVP).
