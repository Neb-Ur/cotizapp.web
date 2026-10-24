import { db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { normalizeText, numberValue, nowIso } from '../lib/values.js';
import { productMatchesBusinessType } from '../domain/business-type.js';

export class ProductRequestError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); }
}

export async function resolveProductRequest(id: string, action: 'aprobar' | 'rechazar', masterId: string, adminId: string, note: string) {
  const requestRef = db.collection(COLLECTIONS.productRequests).doc(id);
  return db.runTransaction(async tx => {
    const request = await tx.get(requestRef);
    if (!request.exists) throw new ProductRequestError('SOLICITUD_NOT_FOUND', 'No existe la solicitud indicada.', 404);
    const current = request.data()!;
    if (current['estado'] !== 'pendiente'
      && !(action === 'aprobar' && current['estado'] === 'aprobada' && current['productoMaestroSugeridoId'] === masterId)) {
      throw new ProductRequestError('SOLICITUD_ALREADY_RESOLVED', 'La solicitud ya fue resuelta.', 409);
    }
    if(current['publicacionProvisional'] === true) {
      const target = masterId || String(current['productoMaestroSugeridoId'] || '');
      const offerRef = db.collection(COLLECTIONS.storeProducts).doc(String(current['productoFerreteriaId']));
      const [offer, master, store] = await Promise.all([tx.get(offerRef),tx.get(db.collection(COLLECTIONS.masterProducts).doc(target)),tx.get(db.collection(COLLECTIONS.stores).doc(String(current['ferreteriaId'])))]);
      if(!offer.exists || offer.data()?.['ferreteriaId'] !== current['ferreteriaId']) throw new ProductRequestError('OFFER_NOT_FOUND','La publicación ya no existe.',409);
      if(action==='aprobar' && (!master.exists || master.data()?.['estado']==='inactivo' || !productMatchesBusinessType(master.data()||{},store.data()?.['tipoNegocio']))) throw new ProductRequestError('PRODUCTO_MAESTRO_INVALID','Selecciona un producto permitido y activo.',400);
      const offers=await tx.get(db.collection(COLLECTIONS.storeProducts).where('ferreteriaId','==',current['ferreteriaId']).where('productoMaestroId','==',target));
      const stamp=nowIso();
      const patch={estado:action==='aprobar'?'aprobada':'rechazada',usuarioAdminId:adminId,productoMaestroSugeridoId:target,notasAdmin:note,fechaResolucion:stamp};
      if(action==='aprobar') {
        tx.update(offerRef,{productoMaestroId:target,actualizadoEn:stamp});
        tx.update(master.ref,{validacionPendiente:false});
      } else tx.update(offerRef,{publicado:false,actualizadoEn:stamp});
      tx.update(requestRef,patch);
      return {id,...current,...patch};
    }
    const timestamp = nowIso();
    let offerId: string | null = null;
    if (action === 'aprobar') {
      if (!masterId) throw new ProductRequestError('PRODUCTO_MAESTRO_REQUIRED', 'Selecciona un producto maestro para aprobar la solicitud.', 400);
      const storeRef = db.collection(COLLECTIONS.stores).doc(String(current['ferreteriaId']));
      const [master, store, offers] = await Promise.all([
        tx.get(db.collection(COLLECTIONS.masterProducts).doc(masterId)),
        tx.get(storeRef),
        tx.get(db.collection(COLLECTIONS.storeProducts).where('ferreteriaId', '==', current['ferreteriaId']).where('productoMaestroId', '==', masterId))
      ]);
      if (!master.exists || master.data()?.['estado'] === 'inactivo') throw new ProductRequestError('PRODUCTO_MAESTRO_NOT_FOUND', 'El producto maestro no está disponible.', 400);
      if (!store.exists) throw new ProductRequestError('FERRETERIA_NOT_FOUND', 'La ferretería ya no existe.', 404);
      if (!productMatchesBusinessType(master.data() || {}, store.data()?.['tipoNegocio'])) throw new ProductRequestError('STORE_PRODUCT_BUSINESS_TYPE_MISMATCH', 'El producto no corresponde al tipo de negocio del local.', 400);
      const regularOffers=offers.docs;
      if (!regularOffers.length) {
        const offerRef = db.collection(COLLECTIONS.storeProducts).doc();
        const offer = {
          ferreteriaId: current['ferreteriaId'], productoMaestroId: masterId,
          skuFerreteria: normalizeText(current['skuFerreteria']) || `SKU-${masterId.slice(0, 8).toUpperCase()}`,
          codigoBarras: normalizeText(current['codigoBarras']) || null,
          precio: Math.max(0, numberValue(current['precioReferencia'])),
          stock: Math.max(0, Math.floor(numberValue(current['cantidadReferencia']))),
          incluyeIva: true, activo: true, publicado: current['publicado'] !== false,
          creadoEn: timestamp, actualizadoEn: timestamp, vigenteDesde: timestamp
        };
        tx.create(offerRef, offer);
        // The store is also locked by normal catalog creation, so approvals
        // and manual linking cannot concurrently create the same relation.
        tx.update(storeRef, { catalogoActualizadoEn: timestamp });
        tx.create(db.collection(COLLECTIONS.priceHistory).doc(), {
          ferreteriaId: current['ferreteriaId'], productoFerreteriaId: offerRef.id,
          productoMaestroId: masterId, actorId: adminId, action: 'request_approved',
          precioAnterior: null, precioNuevo: offer.precio, incluyeIva: true,
          ocurridoEn: timestamp, source: 'admin', solicitudId: id,
          snapshotAnterior: null, snapshotNuevo: offer
        });
        offerId = offerRef.id;
      } else {
        // Approving a request must never overwrite an already maintained offer.
        offerId = regularOffers[0].id;
      }
    }
    const patch = {
      estado: action === 'aprobar' ? 'aprobada' : 'rechazada', usuarioAdminId: adminId,
      productoMaestroSugeridoId: action === 'aprobar' ? masterId : null,
      productoFerreteriaId: offerId, notasAdmin: note, fechaResolucion: timestamp
    };
    tx.update(requestRef, patch);
    return { id, ...current, ...patch };
  });
}
