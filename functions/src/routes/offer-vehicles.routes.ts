import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { requireStoreWriteAccess } from '../lib/ownership.js';
import { requireCurrentStoreAgreement } from '../services/store-agreement.service.js';
import { db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { fail, ok } from '../lib/http.js';
import { row } from '../repositories/firestore.repository.js';
import { normalizeVehicleApplications, vehicleApplicationsEnabled } from '../domain/vehicle-application.js';
import { brandUses } from '../domain/brand-use.js';

export const offerVehiclesRouter = Router();
const path = '/ferreterias/:storeId/catalogo/:offerId/vehiculos';
offerVehiclesRouter.get(path, requireAuth, requireRole('ferreteria','admin'), async (req,res) => {
  if (!(await requireStoreWriteAccess(req,res,req.params.storeId))) return;
  const offer = await row(COLLECTIONS.storeProducts,req.params.offerId);
  if (!offer || offer.ferreteriaId !== req.params.storeId) return fail(res,'CATALOGO_NOT_FOUND','Publicación no encontrada.',404);
  const product = await row(COLLECTIONS.masterProducts,offer.productoMaestroId);
  const family = product ? await row(COLLECTIONS.families,product.familiaId) : null;
  return ok(res,{applications: product?.compatibilidadVehiculos?.length ? product.compatibilidadVehiculos : offer.asociacionesVehiculos || [], canEdit: !product?.compatibilidadVehiculos?.length && family?.permiteVehiculos === true && vehicleApplicationsEnabled(req.params.storeId)});
});
offerVehiclesRouter.put(path, requireAuth, requireRole('ferreteria','admin'), async (req,res) => {
  if (!(await requireStoreWriteAccess(req,res,req.params.storeId))) return;
  const targetOffer=await row(COLLECTIONS.storeProducts,req.params.offerId);
  const targetProduct=targetOffer ? await row(COLLECTIONS.masterProducts,targetOffer.productoMaestroId) : null;
  if(targetProduct?.compatibilidadVehiculos?.length)return fail(res,'PRODUCT_COMPATIBILITY_OWNED','La compatibilidad de esta variante se administra en el producto maestro.',403);
  if (!vehicleApplicationsEnabled(req.params.storeId)) return fail(res,'VEHICLE_APPLICATIONS_DISABLED','Las asociaciones de vehículos todavía no están habilitadas para este local.',403);
  if (!(await requireCurrentStoreAgreement(req,res,req.params.storeId))) return;
  let applications;
  try { applications = normalizeVehicleApplications(req.body?.asociacionesVehiculos); }
  catch (error) { return fail(res,(error as Error).message,'Revisa marca, modelo y años. Usa rangos completos y sin solapamientos (máximo 20 asociaciones).',400); }
  const result = await db.runTransaction(async tx => {
    const offerRef = db.collection(COLLECTIONS.storeProducts).doc(req.params.offerId);
    const storeRef = db.collection(COLLECTIONS.stores).doc(req.params.storeId);
    const [offerDoc,storeDoc] = await Promise.all([tx.get(offerRef),tx.get(storeRef)]);
    const offer = offerDoc.data(), store = storeDoc.data();
    if (!offer || offer['ferreteriaId'] !== req.params.storeId) return {error:'CATALOGO_NOT_FOUND',status:404};
    if (!store || req.authRole !== 'admin' && store['usuarioDuenoId'] !== req.authUserId) return {error:'AUTH_FORBIDDEN',status:403};
    const product = (await tx.get(db.collection(COLLECTIONS.masterProducts).doc(String(offer['productoMaestroId'])))).data();
    const family = product ? (await tx.get(db.collection(COLLECTIONS.families).doc(String(product['familiaId'])))).data() : null;
    // Removing declarations remains possible after a family is disabled.
    if (applications.length && family?.['permiteVehiculos'] !== true) return {error:'FAMILY_VEHICLES_DISABLED',status:400};
    const resolved = [];
    for (const application of applications) {
      const model = (await tx.get(db.collection(COLLECTIONS.vehicleModels).doc(application.modeloId))).data();
      const brand = (await tx.get(db.collection(COLLECTIONS.brands).doc(application.marcaId))).data();
      if (!model || model['marcaId'] !== application.marcaId || !brand || !brandUses(brand['usos']).includes('vehiculo')) return {error:'VEHICLE_APPLICATION_MODEL_INVALID',status:400};
      const previouslyDeclared = (offer['asociacionesVehiculos'] || []).some((old:any) => old.modeloId === application.modeloId && old.marcaId === application.marcaId && old.anioDesde === application.anioDesde && old.anioHasta === application.anioHasta);
      if (model['activo'] === false && !previouslyDeclared) return {error:'VEHICLE_APPLICATION_MODEL_INACTIVE',status:400};
      resolved.push({...application,marcaNombre:String(brand['nombre']),modeloNombre:String(model['nombre'])});
    }
    const now = new Date().toISOString();
    tx.update(offerRef,{asociacionesVehiculos:resolved,actualizadoEn:now});
    tx.update(storeRef,{catalogoActualizadoEn:now});
    const history = db.collection(COLLECTIONS.priceHistory).doc();
    tx.create(history,{ferreteriaId:req.params.storeId,productoFerreteriaId:req.params.offerId,productoMaestroId:offer['productoMaestroId'],actorId:req.authUserId,action:'vehicle_applications_updated',precioAnterior:offer['precio'],precioNuevo:offer['precio'],incluyeIva:offer['incluyeIva'] !== false,ocurridoEn:now,source:req.authRole,snapshotAnterior:{asociacionesVehiculos:offer['asociacionesVehiculos'] || []},snapshotNuevo:{asociacionesVehiculos:resolved}});
    return {applications:resolved};
  });
  if (result.error) return fail(res,result.error,'No se pueden guardar estas asociaciones. Comprueba la publicación, su familia y los modelos seleccionados.',result.status);
  return ok(res,{applications:result.applications,canEdit:true});
});
