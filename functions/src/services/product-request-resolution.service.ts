import { db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { normalizeText, numberValue, nowIso } from '../lib/values.js';

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
      if (offers.empty) {
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
        offerId = offers.docs[0].id;
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
