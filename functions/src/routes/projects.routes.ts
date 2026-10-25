import {isQuotationStatus,quotationStatus} from '../domain/quotation-workflow.js';
import {paintingTemplatePending} from '../domain/work-budget.js';
import {normalizeWorkBudget, normalizePaintingPlan, WorkBudgetError} from '../domain/work-budget.js';
import { verificationSnapshot, newVerificationCode } from '../services/quotation-verification.service.js';
import { buildSearchRows } from '../services/catalog-search.service.js';
import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, normalizeProjectProximity } from '../lib/values.js';
import { rows, row, createRow, patchRow } from '../repositories/firestore.repository.js';
import { canAccessOwner } from '../lib/ownership.js';
import { normalizeItems, optimizeItems, projectView, captureProjectPricing } from '../services/quotation.service.js';
import { captureQuotationPricing } from '../domain/quotation-validity.js';
export const projectsRouter = Router();
projectsRouter.use((req,res,next)=>{
 try {
  if(req.body?.workBudget!==undefined)req.body.workBudget=normalizeWorkBudget(req.body.workBudget);
  if(req.body?.paintingPlan!==undefined)req.body.paintingPlan=normalizePaintingPlan(req.body.paintingPlan) ?? null;
  next();
 }catch(error){if(error instanceof WorkBudgetError)return fail(res,'WORK_BUDGET_INVALID',error.message,400);next(error);}
});

// Backfill legacy quotations once, using the latest stored content and preserving saved prices.
async function ensureProjectVerification(project: any, offers?: Awaited<ReturnType<typeof buildSearchRows>>): Promise<any | null> {
  if (project.verificationCode) return project;
  const searchRows = offers ?? await buildSearchRows();
  return db.runTransaction(async tx => {
    const ref = db.collection(COLLECTIONS.projects).doc(project.id);
    const snapshot = await tx.get(ref);
    const latest = snapshot.data();
    if (!snapshot.exists || latest?.ownerId !== project.ownerId) return null;
    if (latest.verificationCode) return { ...latest, id: ref.id };
    const pricing = captureQuotationPricing(latest, latest, searchRows);
    const code = newVerificationCode();
    const patch = { ...pricing, verificationCode: code };
    const updated = { ...latest, ...patch, id: ref.id };
    tx.update(ref, patch);
    tx.create(db.collection(COLLECTIONS.quotationVerifications).doc(code), verificationSnapshot(updated, code));
    return updated;
  });
}

projectsRouter.get('/maestros/:ownerId/proyectos', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para estas cotizaciones.', 403);
  const snapshot = await db.collection(COLLECTIONS.projects).where('ownerId', '==', req.params.ownerId).get();
  const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    .sort((a, b) => normalizeText(b.createdAt).localeCompare(normalizeText(a.createdAt)));
  const offers = await buildSearchRows();
  const verifiedProjects = await Promise.all(projects.map(project => ensureProjectVerification(project, offers)));
  const data = await Promise.all(verifiedProjects.filter(Boolean).map(project => projectView(project, offers)));
  return ok(res, data);
});

projectsRouter.post('/maestros/:ownerId/proyectos', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para crear esta cotizacion.', 403);

  const name = normalizeText(req.body?.nombre);
  if (!name) return fail(res, 'PROYECTO_INVALID_PAYLOAD', 'Nombre de cotizacion requerido.', 400);
  const payload = {
    ownerId: req.params.ownerId,
    workflowStatus: 'draft',
    workflowUpdatedAt: nowIso(),
    workBudget: req.body?.workBudget ?? normalizeWorkBudget(undefined),
    paintingPlan: req.body?.paintingPlan ?? null,
    name,
    address: normalizeText(req.body?.direccionObra),
    description: normalizeText(req.body?.descripcion).slice(0, 2000),
    items: normalizeItems(req.body?.items),
    proximity: normalizeProjectProximity(req.body?.proximidad) || null,
    singleStoreName: normalizeText(req.body?.ferreteriaUnica) || null,
    singleStoreId: normalizeText(req.body?.ferreteriaUnicaId) || null,
    createdAt: nowIso()
  };
  if(payload.paintingPlan && !payload.items.some(item=>item.productoMaestroId===payload.paintingPlan.productId))payload.paintingPlan=null;
  Object.assign(payload, await captureProjectPricing(payload));
  const ref = db.collection(COLLECTIONS.projects).doc();
  const code = newVerificationCode();
  Object.assign(payload, {verificationCode:code});
  const verification = verificationSnapshot({...payload,id:ref.id},code);
  const created = await db.runTransaction(async tx => {
    const lock = db.collection(COLLECTIONS.projectOwnerLocks).doc(req.params.ownerId);
    await tx.get(lock);
    const existing = await tx.get(db.collection(COLLECTIONS.projects).where('ownerId', '==', req.params.ownerId));
    if (existing.size >= 2) return null;
    tx.set(lock, { updatedAt: nowIso() });
    tx.create(ref, payload);
    tx.create(db.collection(COLLECTIONS.quotationVerifications).doc(code), verification);
    return { id: ref.id, ...payload };
  });
  if (!created) return fail(res, 'COTIZACION_LIMIT_REACHED', 'Puedes guardar un maximo de 2 cotizaciones. Elimina una para crear otra.', 409);
  return ok(res, await projectView(created), 201);
});

projectsRouter.get('/maestros/:ownerId/proyectos/:projectId', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  let project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  project = await ensureProjectVerification(project);
  if (!project) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  return ok(res, await projectView(project));
});

projectsRouter.put('/maestros/:ownerId/proyectos/:projectId', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  const renew = req.body?.renovarPrecios === true;
  const patch = {
    name: normalizeText(req.body?.nombre) || project.name,
    address: normalizeText(req.body?.direccionObra),
    description: req.body?.descripcion === undefined ? (project.description || '') : normalizeText(req.body.descripcion).slice(0, 2000),
    items: normalizeItems(req.body?.items),
    proximity: normalizeProjectProximity(req.body?.proximidad) || null,
    singleStoreName: normalizeText(req.body?.ferreteriaUnica) || null,
    singleStoreId: normalizeText(req.body?.ferreteriaUnicaId) || null,
    workBudget: req.body?.workBudget ?? project.workBudget ?? normalizeWorkBudget(undefined),
    paintingPlan: req.body?.paintingPlan === undefined ? (project.paintingPlan ?? null) : req.body.paintingPlan,
    workflowStatus: 'draft',
    workflowUpdatedAt: nowIso(),
    updatedAt: nowIso()
  };
  if(patch.paintingPlan && !patch.items.some(item=>item.productoMaestroId===patch.paintingPlan.productId))patch.paintingPlan=null;
  const pricedPatch={...patch,...await captureProjectPricing({...project,...patch},project,renew)};
  const code=newVerificationCode();
  const updated=await db.runTransaction(async tx=>{
    const ref=db.collection(COLLECTIONS.projects).doc(project.id),snapshot=await tx.get(ref);
    const latest=snapshot.data();if(!snapshot.exists||latest?.ownerId!==req.params.ownerId)return null;
    // Do not overwrite a simultaneous edit with a snapshot computed from older items/prices.
    const content=(value:Record<string,unknown>)=>JSON.stringify(Object.fromEntries(Object.entries(value).filter(([k])=>k!=='id')));
    if(content(latest)!==content(project))return null;
    const data={...latest,...pricedPatch,verificationCode:code};
    tx.update(ref,{...pricedPatch,verificationCode:code});
    tx.create(db.collection(COLLECTIONS.quotationVerifications).doc(code),verificationSnapshot({...data,id:project.id},code));
    return {id:project.id,...data};
  });
  if(!updated)return fail(res,'QUOTATION_CHANGED','La cotización cambió. Vuelve a cargarla antes de guardar.',409);
  return ok(res, await projectView(updated));
});

projectsRouter.post('/maestros/:ownerId/proyectos/:projectId/items', requireAuth, requireRole('maestro', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  const offers = await buildSearchRows();
  const updated = await db.runTransaction(async tx => {
    const ref = db.collection(COLLECTIONS.projects).doc(req.params.projectId);
    const latest = await tx.get(ref);
    if (!latest.exists || latest.data()?.['ownerId'] !== req.params.ownerId) return null;
    const data = latest.data()!;
    const patch = { items: [...normalizeItems(data['items']), ...normalizeItems([req.body])], workflowStatus:'draft', workflowUpdatedAt:nowIso(), updatedAt: nowIso() };
    Object.assign(patch, captureQuotationPricing({...data, ...patch}, data, offers));
    const code=newVerificationCode();
    Object.assign(patch,{verificationCode:code});
    tx.update(ref, patch);
    tx.create(db.collection(COLLECTIONS.quotationVerifications).doc(code),verificationSnapshot({...data,...patch,id:ref.id},code));
    return { id: ref.id, ...data, ...patch };
  });
  if (!updated) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  return ok(res, await projectView(updated), 201);
});


// Commercial tracking is separate from material price validity and verification snapshots.
projectsRouter.patch('/maestros/:ownerId/proyectos/:projectId/estado', requireAuth, requireRole('maestro','admin'), async(req,res)=>{
 if(!canAccessOwner(req,req.params.ownerId))return fail(res,'AUTH_FORBIDDEN','No tienes permisos para esta cotización.',403);
 if(!isQuotationStatus(req.body?.estado)||!isQuotationStatus(req.body?.estadoAnterior))return fail(res,'QUOTATION_STATUS_INVALID','Selecciona un estado válido.',400);
 const result=await db.runTransaction(async tx=>{
  const ref=db.collection(COLLECTIONS.projects).doc(req.params.projectId),snapshot=await tx.get(ref),project=snapshot.data();
  if(!snapshot.exists||project?.ownerId!==req.params.ownerId)return {error:'missing'};
  if(quotationStatus(project.workflowStatus)!==req.body.estadoAnterior || (project.verificationCode && project.verificationCode!==req.body.codigoVerificacion))return {error:'changed'};
  if(req.body.estado==='sent'||req.body.estado==='accepted'){
   const view=await projectView({...project,id:ref.id});
   if(view.availabilityStatus!=='ready'||paintingTemplatePending(view.workBudget))return {error:'incomplete'};
  }
  const patch={workflowStatus:req.body.estado,workflowUpdatedAt:nowIso(),updatedAt:nowIso()};
  tx.update(ref,patch);
  return {data:{...project,...patch,id:ref.id}};
 });
 if(result.error==='missing')return fail(res,'PROYECTO_NOT_FOUND','No existe la cotización indicada.',404);
 if(result.error==='changed')return fail(res,'QUOTATION_CHANGED','El estado cambió. Vuelve a cargar la cotización.',409);
 if(result.error==='incomplete')return fail(res,'QUOTATION_INCOMPLETE','Completa los materiales y los costos de la plantilla antes de marcarla enviada o aceptada.',400);
 return ok(res,await projectView(result.data));
});

projectsRouter.post('/maestros/:ownerId/proyectos/:projectId/duplicar', requireAuth, requireRole('maestro','admin'), async(req,res)=>{
 if(!canAccessOwner(req,req.params.ownerId))return fail(res,'AUTH_FORBIDDEN','No tienes permisos para esta cotización.',403);
 const project=await row(COLLECTIONS.projects,req.params.projectId);
 if(!project||project.ownerId!==req.params.ownerId)return fail(res,'PROYECTO_NOT_FOUND','No existe la cotización indicada.',404);
 const budget={...normalizeWorkBudget(project.workBudget),clientName:''};
 const payload={ownerId:req.params.ownerId,name:`Copia de ${project.name || 'Cotización'}`.slice(0,200),address:'',description:project.description || '',
  items:normalizeItems(project.items),workBudget:budget,paintingPlan:normalizePaintingPlan(project.paintingPlan) ?? null,
  proximity:null,singleStoreName:project.singleStoreName || null,singleStoreId:project.singleStoreId || null,
  workflowStatus:'draft',workflowUpdatedAt:nowIso(),createdAt:nowIso()};
 Object.assign(payload,await captureProjectPricing(payload));
 const ref=db.collection(COLLECTIONS.projects).doc(),code=newVerificationCode();
 Object.assign(payload,{verificationCode:code});
 const created=await db.runTransaction(async tx=>{
  const lock=db.collection(COLLECTIONS.projectOwnerLocks).doc(req.params.ownerId);await tx.get(lock);
  const source=await tx.get(db.collection(COLLECTIONS.projects).doc(req.params.projectId));
  if(!source.exists||source.data()?.ownerId!==req.params.ownerId)return {error:'missing'};
  const existing=await tx.get(db.collection(COLLECTIONS.projects).where('ownerId','==',req.params.ownerId));
  if(existing.size>=2)return {error:'limit'};
  tx.set(lock,{updatedAt:nowIso()});tx.create(ref,payload);
  tx.create(db.collection(COLLECTIONS.quotationVerifications).doc(code),verificationSnapshot({...payload,id:ref.id},code));
  return {data:{...payload,id:ref.id}};
 });
 if(created.error==='missing')return fail(res,'PROYECTO_NOT_FOUND','No existe la cotización indicada.',404);
 if(created.error==='limit')return fail(res,'COTIZACION_LIMIT_REACHED','Puedes guardar un máximo de 2 cotizaciones. Elimina una para duplicar otra.',409);
 return ok(res,await projectView(created.data),201);
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
