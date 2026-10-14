import {createHash} from 'node:crypto';
import {automotiveProductName, normalizeProductApplications} from '../../lib/domain/product-vehicle.js';
import {buildAutoPartsSeed} from './auto-parts-seed.mjs';

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const categoryId = 'cat-repuestos-automotrices';
const motor = 'sub-repuestos-motor-y-electricidad';
const brakes = 'sub-repuestos-frenos-y-suspension';
const lighting = 'sub-repuestos-iluminacion';
const body = 'sub-repuestos-carroceria-e-interior';
const families = {
  alternadores: ['Alternadores', motor],
  amortiguadores: ['Amortiguadores', brakes],
  'filtros-de-aceite': ['Filtros de aceite', motor],
  'pastillas-de-freno': ['Pastillas de freno', brakes],
  focos: ['Focos delanteros y traseros', lighting],
  neblineros: ['Neblineros', lighting],
  biseles: ['Biseles de neblinero', body],
  carroceria: ['Carrocería y molduras', body],
  cristales: ['Cristales y lunetas', body],
  interior: ['Interior e instrumentos', body],
  distribucion: ['Distribución y cadenas', motor],
  sensores: ['Sensores automotrices', motor],
  embragues: ['Embragues y rodamientos', motor],
  frenos: ['Cilindros y patines de freno', brakes],
  direccion: ['Dirección y muñones', brakes],
};

export function buildKuv100CatalogSeed(seed, brands, models, now) {
  if (seed.batch !== 'trovio-kuv100-expansion-2026-10-14' || !seed.products.length || seed.stores.length !== 3) throw Error('KUV_SEED_INVALID');
  const brand = brands.filter(b => b.nombre === seed.brand);
  const model = models.filter(m => m.nombre === seed.model && m.marcaId === brand[0]?.id && m.activo !== false);
  if (brand.length !== 1 || model.length !== 1) throw Error('KUV_VEHICLE_REQUIRED');
  const documents = [
    {collection: 'subcategorias', id: lighting, data: {nombre: 'Iluminación automotriz', categoriaId: categoryId}},
    {collection: 'subcategorias', id: body, data: {nombre: 'Carrocería e interior', categoriaId: categoryId}},
    ...Object.entries(families).map(([key, [nombre, subcategoriaId]]) => ({collection: 'familias', id: 'fam-repuestos-' + key, data: {nombre, subcategoriaId, permiteVehiculos: true}})),
  ];
  const offers = [];
  const keys = new Set();
  for (const [index, entry] of seed.products.entries()) {
    if (!entry.key || keys.has(entry.key) || !families[entry.family] || !entry.code || !entry.yearEvidence || !Number.isInteger(entry.seedPrice) || entry.seedPrice <= 0) throw Error('KUV_PRODUCT_INVALID');
    keys.add(entry.key);
    const urls = [...new Set(entry.images)];
    if (!urls.length || urls.length > 12 || [...urls, entry.sourceUrl].some(url => new URL(url).protocol !== 'https:' || /no[_-]?image|placeholder/i.test(url))) throw Error('KUV_IMAGE_INVALID');
    const applications = normalizeProductApplications([{marcaId: brand[0].id, modeloId: model[0].id, marcaNombre: brand[0].nombre, modeloNombre: model[0].nombre, anioDesde: entry.years[0], anioHasta: entry.years[1]}]);
    const id = 'seed-kuv-product-' + hash(entry.key);
    const variant = entry.variant;
    documents.push({collection: 'productosMaestro', id, data: {
      nombrePieza: entry.part, detalleVariante: variant,
      nombre: automotiveProductName(entry.part, applications, variant),
      categoriaId: categoryId, subcategoriaId: families[entry.family][1], familiaId: 'fam-repuestos-' + entry.family,
      marca: entry.manufacturer, marcaId: null,
      codigoFabricante: entry.sourceUrl.includes('fitalia.cl') ? null : entry.code,
      referenciaProveedor: entry.code,
      tipoProducto: entry.part, catalogoNivel: 'producto_comercial', unidadVenta: 'Unidad', presentacion: '1 unidad o juego según ficha', estado: 'activo',
      compatibilidadVehiculos: applications, compatibilidadReferencial: true,
      imagenPrincipalUrl: urls[0], imagenExternaUrl: urls[0], galeriaJson: urls,
      origenImagen: 'external_url', imagenReferencial: true, proveedorImagen: new URL(entry.sourceUrl).hostname,
      // These are external references, never an assertion of ownership or permission.
      fuenteImagenUrl: entry.sourceUrl,
      descripcionCorta: 'Ficha de referencia para ' + entry.part.toLowerCase() + '. Compatibilidad pendiente de validación. Ofertas de locales ficticios.',
      descripcionLarga: 'Semilla de prueba. Referencia de proveedor: ' + entry.sourceUrl + '\nCódigo publicado: ' + entry.code + '.\n' + entry.yearEvidence + '\nLas imágenes externas ilustran la referencia de catálogo; no corresponden a la unidad física de las ofertas simuladas. Confirmar VIN, versión, motor, lado, medidas y conectores antes de utilizar esta ficha como compatibilidad real.',
      caracteristicasDestacadas: ['Código de referencia: ' + entry.code, 'Compatibilidad referencial; verificar por VIN', 'Fotografías externas de referencia; ofertas simuladas'],
      origenContenido: 'original', fuenteContenidoUrl: entry.sourceUrl,
      referenciaDerechosContenido: 'Trovio: redacción editorial propia de semilla; datos de identificación del proveedor enlazado.',
      evidenciaCatalogo: {sourceUrl: entry.sourceUrl, yearEvidence: entry.yearEvidence, researchedAt: seed.researchedAt},
      esPrueba: true, lotePrueba: seed.batch, claveSemilla: entry.key, creadoEn: now, actualizadoEn: now,
    }});
    // Two stores always share a master; a third has every other piece.
    for (const [storeIndex, store] of seed.stores.entries()) {
      if (storeIndex === 2 && index % 2) continue;
      offers.push({id: 'seed-kuv-offer-' + hash(store.id + ':' + id), storeId: store.id, productId: id,
        price: Math.max(1000, Math.round(entry.seedPrice * [1, 1.12, .9][storeIndex] / 500) * 500),
        stock: 1 + (index + storeIndex) % 4,
        condition: entry.family === 'filtros-de-aceite' || entry.family === 'pastillas-de-freno' || entry.family === 'distribucion' ? 'nuevo' : storeIndex === 1 && entry.family === 'alternadores' ? 'reacondicionado' : 'usado', vehicles: []});
    }
  }
  documents.push(...buildAutoPartsSeed({...seed, offers}, brands, models, now));
  return documents;
}

export function missingKuv100SeedDocuments(documents, existing) {
  return documents.filter(d => {
    const old = existing.get(d.collection + '/' + d.id);
    if (!old) return true;
    const taxonomy = ['familias', 'subcategorias'].includes(d.collection);
    const fields = taxonomy ? ['subcategoriaId', 'categoriaId', 'permiteVehiculos'] : ['lotePrueba', 'esPrueba', 'claveSemilla', 'usuarioDuenoId', 'ferreteriaId', 'productoMaestroId', 'rol'];
    if (fields.some(k => d.data[k] !== undefined && old[k] !== d.data[k])) throw Error('KUV_SEED_IDENTITY_CONFLICT:' + d.id);
    return false;
  });
}
