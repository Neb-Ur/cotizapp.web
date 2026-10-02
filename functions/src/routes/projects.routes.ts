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
  const projects = (await rows(COLLECTIONS.projects))
    .filter((item) => item.ownerId === req.params.ownerId)
    .sort((a, b) => normalizeText(b.createdAt).localeCompare(normalizeText(a.createdAt)));
  const data = await Promise.all(projects.map(projectView));
  return ok(res, data);
});

projectsRouter.post('/maestros/:ownerId/proyectos', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para crear esta cotizacion.', 403);

  const ownerProjects = (await rows(COLLECTIONS.projects))
    .filter((item) => item.ownerId === req.params.ownerId);
  if (ownerProjects.length >= 2) {
    return fail(
      res,
      'COTIZACION_LIMIT_REACHED',
      'Puedes guardar un maximo de 2 cotizaciones. Elimina una para crear otra.',
      409
    );
  }

  const name = normalizeText(req.body?.nombre);
  if (!name) return fail(res, 'PROYECTO_INVALID_PAYLOAD', 'Nombre de cotizacion requerido.', 400);
  const created = await createRow(COLLECTIONS.projects, {
    ownerId: req.params.ownerId,
    name,
    address: normalizeText(req.body?.direccionObra),
    items: normalizeItems(req.body?.items),
    proximity: normalizeProjectProximity(req.body?.proximidad) || null,
    singleStoreName: normalizeText(req.body?.ferreteriaUnica) || null,
    createdAt: nowIso()
  });
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
    items: normalizeItems(req.body?.items),
    proximity: normalizeProjectProximity(req.body?.proximidad) || null,
    singleStoreName: normalizeText(req.body?.ferreteriaUnica) || null,
    updatedAt: nowIso()
  });
  return ok(res, await projectView(updated));
});

projectsRouter.post('/maestros/:ownerId/proyectos/:projectId/items', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  const nextItems = [...normalizeItems(project.items), ...normalizeItems([req.body])];
  const updated = await patchRow(COLLECTIONS.projects, req.params.projectId, { items: nextItems, updatedAt: nowIso() });
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
      normalizeText(req.body?.ferreteriaUnica)
    )
  );
});




// Product creation requests (kept simple for MVP).
