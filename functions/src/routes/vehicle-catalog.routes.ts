import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { fail, ok } from '../lib/http.js';
import { rows } from '../repositories/firestore.repository.js';
import { resolveBrand } from '../lib/brands.js';
import { brandIdentity, normalizeBrand } from '../domain/brand-identity.js';
import { brandUses } from '../domain/brand-use.js';
import { invalidateStaticCatalog } from '../lib/product-sheet-cache.js';
import { markPublicCatalogDirty } from '../lib/public-catalog-cache.js';

export const vehicleCatalogRouter = Router();
const invalidate = () => Promise.all([invalidateStaticCatalog(),markPublicCatalogDirty()]);
const nameOf = (value: unknown) => typeof value === 'string' && value.trim().length <= 120 ? value.trim().replace(/\s+/g,' ') : '';
const modelView = (model: any) => ({id:model.id,marcaId:model.marcaId,nombre:model.nombre,activo:model.activo!==false});
async function catalog(includeAll: boolean) {
  const [brands,models] = await Promise.all([rows(COLLECTIONS.brands),rows(COLLECTIONS.vehicleModels)]);
  const selected = brands.filter(brand=>includeAll || brandUses(brand.usos).includes('vehiculo'));
  const ids = new Set(selected.map(brand=>brand.id));
  return { brands:selected.map(brand=>({id:brand.id,nombre:brand.nombre,usos:brandUses(brand.usos)})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')),
    models:models.filter(model=>ids.has(model.marcaId) && (includeAll || model.activo!==false)).map(modelView).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')||a.id.localeCompare(b.id)) };
}
vehicleCatalogRouter.get('/vehiculos/catalogo',async (_req,res)=>{res.set('Cache-Control','no-store');return ok(res,await catalog(false));});
vehicleCatalogRouter.get('/admin/vehiculos/catalogo',requireAuth,requireRole('admin'),async (_req,res)=>ok(res,await catalog(true)));
vehicleCatalogRouter.post('/admin/vehiculos/marcas',requireAuth,requireRole('admin'),async (req,res)=>{
  if(req.body?.marcaId!==undefined){
    if(typeof req.body.marcaId!=='string'||!req.body.marcaId)return fail(res,'VEHICLE_BRAND_INVALID','Selecciona una marca existente.',400);
    const brand=await db.runTransaction(async tx=>{
      const ref=db.collection(COLLECTIONS.brands).doc(req.body.marcaId),existing=await tx.get(ref);
      if(!existing.exists)return null;
      const data=existing.data()!,uses=brandUses(data['usos']);
      if(!uses.includes('vehiculo'))tx.update(ref,{usos:[...uses,'vehiculo'],actualizadoEn:new Date().toISOString()});
      return {id:ref.id,nombre:data['nombre']};
    });
    if(!brand)return fail(res,'VEHICLE_BRAND_NOT_FOUND','Marca no encontrada.',404);
    await invalidate();return ok(res,brand);
  }
  const name=nameOf(req.body?.nombre);
  if(!name||!brandIdentity(name))return fail(res,'VEHICLE_BRAND_INVALID','Escribe una marca de vehículo válida (máximo 120 caracteres).',400);
  const brand=await resolveBrand(name,'vehiculo');await invalidate();return ok(res,{id:brand.marcaId,nombre:brand.marca},201);
});
vehicleCatalogRouter.post('/admin/vehiculos/modelos',requireAuth,requireRole('admin'),async (req,res)=>{
  const name=nameOf(req.body?.nombre),brandId=typeof req.body?.marcaId==='string'?req.body.marcaId:'';
  const normalized=normalizeBrand(name);
  if(!normalized||!brandId)return fail(res,'VEHICLE_MODEL_INVALID','Selecciona una marca de vehículo e indica el modelo.',400);
  const model=await db.runTransaction(async tx=>{
    const brandRef=db.collection(COLLECTIONS.brands).doc(brandId),brand=await tx.get(brandRef);
    if(!brand.exists||!brandUses(brand.data()?.['usos']).includes('vehiculo'))return null;
    const existing=await tx.get(db.collection(COLLECTIONS.vehicleModels).where('marcaId','==',brandId).where('nombreNormalizado','==',normalized));
    if(!existing.empty)return {id:existing.docs[0].id,...existing.docs[0].data()};
    const ref=db.collection(COLLECTIONS.vehicleModels).doc(),now=new Date().toISOString();
    const data={marcaId:brandId,nombre:name,nombreNormalizado:normalized,activo:true,creadoEn:now,actualizadoEn:now};
    // Serialize writes through the brand before creating a name-unique model.
    // The model ID stays independent of its name, including after renames.
    tx.update(brandRef,{actualizadoEn:now});tx.create(ref,data);return {id:ref.id,...data};
  });
  if(!model)return fail(res,'VEHICLE_BRAND_REQUIRED','La marca seleccionada no está habilitada para vehículos.',400);
  await invalidate();return ok(res,modelView(model),201);
});
vehicleCatalogRouter.patch('/admin/vehiculos/modelos/:id',requireAuth,requireRole('admin'),async (req,res)=>{
  if(req.body?.marcaId!==undefined)return fail(res,'VEHICLE_MODEL_BRAND_IMMUTABLE','El modelo conserva su marca. Crea otro modelo si corresponde a otra marca.',400);
  if(req.body?.activo!==undefined&&typeof req.body.activo!=='boolean')return fail(res,'VEHICLE_MODEL_INVALID','El estado del modelo debe ser activo o inactivo.',400);
  const name=req.body?.nombre===undefined?undefined:nameOf(req.body.nombre);
  if(name!==undefined&&!normalizeBrand(name))return fail(res,'VEHICLE_MODEL_INVALID','Escribe un nombre válido para el modelo.',400);
  const outcome=await db.runTransaction(async tx=>{
    const ref=db.collection(COLLECTIONS.vehicleModels).doc(req.params.id),existing=await tx.get(ref);
    if(!existing.exists)return {missing:true};
    const data=existing.data()!,patch:Record<string,unknown>={actualizadoEn:new Date().toISOString()};
    if(name!==undefined){
      const duplicates=await tx.get(db.collection(COLLECTIONS.vehicleModels).where('marcaId','==',data['marcaId']).where('nombreNormalizado','==',normalizeBrand(name)));
      if(duplicates.docs.some(doc=>doc.id!==ref.id))return {duplicate:true};
      patch['nombre']=name;patch['nombreNormalizado']=normalizeBrand(name);
    }
    if(req.body?.activo!==undefined)patch['activo']=req.body.activo;
    tx.update(db.collection(COLLECTIONS.brands).doc(String(data['marcaId'])),{actualizadoEn:patch['actualizadoEn']});tx.update(ref,patch);
    return {model:{id:ref.id,...data,...patch}};
  });
  if(outcome.missing)return fail(res,'VEHICLE_MODEL_NOT_FOUND','Modelo de vehículo no encontrado.',404);
  if(outcome.duplicate)return fail(res,'VEHICLE_MODEL_DUPLICATE','Ya existe ese modelo para la marca.',409);
  await invalidate();return ok(res,modelView(outcome.model));
});
