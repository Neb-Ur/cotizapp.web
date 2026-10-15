import {buildAutoPartsSeed, missingAutoPartsSeedDocuments} from './auto-parts-seed.mjs';
export const JUNKYARD_BATCH = 'trovio-junkyards-whatsapp-2026-10-14';
export function buildJunkyardDocuments(seed, products, now) {
  if (seed.batch !== JUNKYARD_BATCH || seed.stores.length !== 4 || seed.offers.length !== 80 || !/^\+56\d{9}$/.test(seed.whatsappPhone)) throw Error('JUNKYARD_SEED_INVALID');
  for (const offer of seed.offers) {
    const product = products.find(p => p.id === offer.productId);
    if (!product || product.estado !== 'activo' || product.esPrueba !== true || product.categoriaId !== 'cat-repuestos-automotrices' || !product.compatibilidadVehiculos?.length || offer.vehicles.length) throw Error('JUNKYARD_SOURCE_INVALID:' + offer.productId);
  }
  const documents = buildAutoPartsSeed(seed, [], [], now);
  for (const d of documents) {
    if (d.collection === 'real_ferreterias') Object.assign(d.data, {telefonoContactoPublico: seed.whatsappPhone, contactoWhatsappPrueba: true});
    if (d.collection === 'real_productosFerreteria') d.data.condicionesOferta = 'SOLO PRUEBA. Desarmaduría ficticia, precio, stock y condición simulados. Las imágenes ilustran una referencia de catálogo, no una unidad física disponible. Compatibilidad heredada del maestro y pendiente de verificación. El WhatsApp corresponde a un contacto de prueba autorizado.';
  }
  return documents;
}
export function planJunkyardWrites(seed, documents, existing, now) {
  const create = missingAutoPartsSeedDocuments(documents, existing);
  const contacts = [];
  for (const id of [...seed.existingContactStoreIds, ...seed.stores.map(s => s.id)]) {
    const old = existing.get('real_ferreterias/' + id);
    if (!old) {
      if (seed.existingContactStoreIds.includes(id)) throw Error('JUNKYARD_CONTACT_MISSING');
      continue;
    }
    if (old.esPrueba !== true || old.tipoNegocio !== 'desarmaduria' || old.estado !== 'activo') throw Error('JUNKYARD_CONTACT_NOT_PILOT');
    const current = String(old.telefonoContactoPublico || '').replace(/\D/g, '');
    if (current && current !== seed.whatsappPhone.replace(/\D/g, '')) throw Error('JUNKYARD_CONTACT_CONFLICT');
    if (old.telefonoContactoPublico !== seed.whatsappPhone || old.contactoWhatsappPrueba !== true) contacts.push({id, data: {...old, telefonoContactoPublico: seed.whatsappPhone, contactoWhatsappPrueba: true, actualizadoEn: now}});
  }
  return {create, contacts};
}
