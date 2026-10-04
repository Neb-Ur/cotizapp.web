import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { canAccessOwner } from '../lib/ownership.js';
import { ok, fail } from '../lib/http.js';
import { getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';
export const storeMetricsRouter = Router();
// Aggregate counters only: no cookies, visitor identifiers, or geolocation storage.
storeMetricsRouter.post('/metricas/oferta', async (req, res) => {
 const { offerId, event } = req.body || {};
 if (typeof offerId !== 'string' || offerId.length > 150 || !['view','select'].includes(event)) return fail(res,'INVALID_EVENT','Evento inválido.',400);
 const offer = (await getPublicCatalogSnapshot()).searchRows.find(row=>row.productoFerreteriaId === offerId);
 if (!offer) return fail(res,'OFFER_NOT_FOUND','Oferta no disponible.',404);
 await db.collection('storeMetrics').doc(offer.storeId).set({ [event === 'view' ? 'views' : 'selections']: FieldValue.increment(1), updatedAt: new Date().toISOString() }, { merge:true });
 return ok(res,{ recorded:true });
});
storeMetricsRouter.get('/ferreterias/propietario/:ownerId/metricas', requireAuth, requireRole('ferreteria','admin'), async(req,res)=>{
 if (!canAccessOwner(req,req.params.ownerId)) return fail(res,'AUTH_FORBIDDEN','No tienes acceso.',403);
 const stores = await db.collection('ferreterias').where('usuarioDuenoId','==',req.params.ownerId).get();
 const metrics = await Promise.all(stores.docs.map(doc=>db.collection('storeMetrics').doc(doc.id).get()));
 return ok(res,metrics.reduce((total,doc)=>({ views:total.views + Number(doc.data()?.['views'] || 0), selections:total.selections + Number(doc.data()?.['selections'] || 0) }),{ views:0,selections:0 }));
});
