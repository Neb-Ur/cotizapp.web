import {createHash} from 'node:crypto';
import {brandIdentity, normalizeBrand} from '../../lib/domain/brand-identity.js';
import {brandUses} from '../../lib/domain/brand-use.js';
import {automotiveProductName, normalizeProductApplications} from '../../lib/domain/product-vehicle.js';
import {mappingFor, quote, writeDocument} from '../../lib/database/codec.js';
import {planInitialVehicleCatalog} from './initial-vehicle-catalog.mjs';

export const EXPANSION_BATCH = 'trovio-expansion-200-2026-10-14';
const digest = s => createHash('sha256').update(s).digest('hex').slice(0, 24);
export const expansionProductId = entry => 'seed-exp200-product-' + digest(entry.key);
const automotiveCategory = 'cat-repuestos-automotrices';
const automotiveStores = ['seed-kuv-store-norte', 'seed-kuv-store-central', 'seed-kuv-store-sur'];
const hardwareStores = ['pilot-store-1', 'pilot-store-2', 'pilot-store-3', 'pilot-store-4'];
const additionalFamilies = ['motor-y-refrigeracion', 'filtros-automotrices', 'transmision-y-diferencial'].map((key, i) => ({
  id: 'fam-repuestos-' + key,
  nombre: ['Motor y refrigeración', 'Filtros automotrices', 'Transmisión y diferencial'][i],
  subcategoriaId: 'sub-repuestos-motor-y-electricidad', permiteVehiculos: true,
}));
const normalized = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function planCatalogExpansion(seed, state, now) {
  if (seed.batch !== EXPANSION_BATCH || seed.products.length !== 200 || seed.products.filter(p => p.group === 'auto').length !== 100 || seed.products.filter(p => p.group === 'construction').length !== 100) throw Error('EXPANSION_COUNTS_INVALID');
  const brands = state.brands.map(b => ({...b}));
  const byVehicleBrand = new Map();
  for (const p of seed.products.filter(p => p.group === 'auto')) {
    if (!byVehicleBrand.has(p.vehicleBrand)) byVehicleBrand.set(p.vehicleBrand, new Set());
    byVehicleBrand.get(p.vehicleBrand).add(p.vehicleModel);
  }
  const refs = planInitialVehicleCatalog({brands: [...byVehicleBrand].map(([name, models]) => ({name, models: [...models]}))}, brands, state.models, now);
  const prerequisites = [...refs.creates];
  const updates = new Map(refs.updates.map(d => [d.id, d]));
  for (const d of refs.creates.filter(d => d.collection === 'marcas')) brands.push({id: d.id, ...d.data});
  const models = [...state.models, ...refs.creates.filter(d => d.collection === 'modelosVehiculo').map(d => ({id: d.id, ...d.data}))];
  const manufacturerIds = new Map();
  for (const name of new Set(seed.products.map(p => p.brand).filter(name => name !== 'Por especificar'))) {
    const identity = brandIdentity(name);
    if (!identity) throw Error('EXPANSION_MANUFACTURER_INVALID');
    const matches = brands.filter(b => normalizeBrand(b.nombre) === identity.nombreNormalizado);
    if (matches.length > 1) throw Error('EXPANSION_MANUFACTURER_AMBIGUOUS');
    if (matches.length) {
      manufacturerIds.set(name, matches[0].id);
      const uses = [...new Set([...brandUses(matches[0].usos), ...(updates.get(matches[0].id)?.data.usos || []), 'fabricante'])];
      if (uses.length !== brandUses(matches[0].usos).length) updates.set(matches[0].id, {collection: 'marcas', id: matches[0].id, data: {usos: uses, actualizadoEn: now}});
    } else {
      const data = {nombre: identity.nombre, nombreNormalizado: identity.nombreNormalizado, usos: ['fabricante'], creadoEn: now, actualizadoEn: now};
      prerequisites.push({collection: 'marcas', id: identity.id, data});
      brands.push({id: identity.id, ...data});
      manufacturerIds.set(name, identity.id);
    }
  }
  const families = new Map(state.families.map(f => [f.id, f]));
  for (const family of additionalFamilies) {
    if (families.has(family.id)) {
      const old = families.get(family.id);
      if (old.subcategoriaId !== family.subcategoriaId || old.permiteVehiculos !== true) throw Error('EXPANSION_FAMILY_CONFLICT');
    } else {
      prerequisites.push({collection: 'familias', id: family.id, data: {nombre: family.nombre, subcategoriaId: family.subcategoriaId, permiteVehiculos: true}});
      families.set(family.id, family);
    }
  }
  const subcategories = new Map(state.subcategories.map(s => [s.id, s]));
  for (const id of [...automotiveStores, ...hardwareStores]) {
    const store = state.stores.find(s => s.id === id);
    if (!store || store.esPrueba !== true || store.estado === 'inactivo' || (automotiveStores.includes(id) ? store.tipoNegocio !== 'desarmaduria' : (store.tipoNegocio || 'ferreteria') !== 'ferreteria')) throw Error('EXPANSION_TEST_STORE_REQUIRED:' + id);
    if (!state.users.some(u => u.id === store.usuarioDuenoId && u.esPrueba === true && u.estadoCuenta === 'activo')) throw Error('EXPANSION_TEST_OWNER_REQUIRED:' + id);
  }
  const keys = new Set(), sourceKeys = new Set(), names = new Set();
  const products = [], offers = [];
  for (const [index, entry] of seed.products.entries()) {
    if (!entry.key || keys.has(entry.key) || !entry.code || !entry.sourceTitle || !Number.isInteger(entry.seedPrice) || entry.seedPrice <= 0) throw Error('EXPANSION_PRODUCT_INVALID');
    keys.add(entry.key);
    const source = new URL(entry.sourceUrl);
    const allowedHosts = ['www.fitalia.cl', 'allmotor.cl', 'dab.cl'];
    if (source.protocol !== 'https:' || !allowedHosts.includes(source.hostname)) throw Error('EXPANSION_SOURCE_INVALID');
    const sourceKey = source.hostname + ':' + entry.code.toUpperCase();
    if (sourceKeys.has(sourceKey)) throw Error('EXPANSION_SOURCE_DUPLICATE');
    sourceKeys.add(sourceKey);
    const images = [...new Set(entry.images)];
    if (!images.length || images.length > 4 || images.some(u => new URL(u).protocol !== 'https:' || /placeholder|no[_-]?image/i.test(u))) throw Error('EXPANSION_IMAGES_INVALID');
    const family = families.get(entry.familyId), subcategory = subcategories.get(family?.subcategoriaId);
    if (!family || !subcategory) throw Error('EXPANSION_TAXONOMY_REQUIRED:' + entry.familyId);
    const auto = entry.group === 'auto';
    if (auto !== (subcategory.categoriaId === automotiveCategory) || auto && family.permiteVehiculos !== true) throw Error('EXPANSION_TAXONOMY_INVALID');
    let applications;
    if (auto) {
      const brand = brands.find(b => normalizeBrand(b.nombre) === normalizeBrand(entry.vehicleBrand));
      const model = models.find(m => m.marcaId === brand?.id && normalizeBrand(m.nombre) === normalizeBrand(entry.vehicleModel) && m.activo !== false);
      if (!brand || !model || !entry.yearEvidence || !['declared', 'editorial'].includes(entry.rangeMode)) throw Error('EXPANSION_VEHICLE_INVALID');
      applications = normalizeProductApplications([{marcaId: brand.id, modeloId: model.id, marcaNombre: brand.nombre, modeloNombre: model.nombre, anioDesde: entry.years?.[0], anioHasta: entry.years?.[1]}]);
    }
    const id = expansionProductId(entry);
    const name = auto ? automotiveProductName(entry.part, applications, entry.code) : entry.name;
    if (!name?.trim() || names.has(normalized(name))) throw Error('EXPANSION_NAME_DUPLICATE');
    names.add(normalized(name));
    const oldDuplicate = state.products.find(p => p.id !== id && p.lotePrueba !== seed.batch && (
      normalized(p.nombre) === normalized(name) || p.fuenteContenidoUrl === source.href || p.evidenciaCatalogo?.sourceUrl === source.href
      || p.referenciaProveedor === entry.code && new URL(p.fuenteContenidoUrl || 'https://invalid.example').hostname === source.hostname));
    if (oldDuplicate) throw Error('EXPANSION_EXISTING_PRODUCT:' + oldDuplicate.id);
    const data = {
      nombre: name, tipoProducto: auto ? entry.part : family.nombre, marca: entry.brand, marcaId: manufacturerIds.get(entry.brand) || null,
      codigoFabricante: entry.manufacturerCode || null, referenciaProveedor: entry.code,
      categoriaId: subcategory.categoriaId, subcategoriaId: family.subcategoriaId, familiaId: family.id,
      catalogoNivel: 'producto_comercial', estado: 'activo', unidadVenta: 'Unidad', presentacion: entry.packaging || '1 unidad o juego según referencia',
      imagenPrincipalUrl: images[0], imagenExternaUrl: images[0], galeriaJson: images, origenImagen: 'external_url', imagenReferencial: true,
      proveedorImagen: source.hostname, fuenteImagenUrl: source.href,
      descripcionCorta: 'Ficha de referencia de catálogo. Ofertas de prueba con precio y stock simulados.' + (auto ? ' Compatibilidad vehicular pendiente de verificación.' : ''),
      descripcionLarga: 'Identificación de referencia: ' + entry.sourceTitle + '.\nFuente: ' + source.href + '\nReferencia del proveedor: ' + entry.code + '.\n' + (auto ? entry.yearEvidence + '\nConfirmar VIN, motor, versión, lado, medidas y conectores.\n' : '') + 'Las fotografías externas ilustran la referencia del catálogo, no las unidades físicas de los locales ficticios. Los precios, existencias y condiciones de las ofertas son simulados.',
      origenContenido: 'original', fuenteContenidoUrl: source.href,
      referenciaDerechosContenido: 'Trovio: redacción editorial propia; identificación factual de proveedor. Sin declaración de licencia sobre fotografías externas.',
      evidenciaCatalogo: {sourceUrl: source.href, sourceTitle: entry.sourceTitle, sourceReference: entry.code, researchedAt: seed.researchedAt, ...(auto ? {rangeMode: entry.rangeMode, yearEvidence: entry.yearEvidence} : {})},
      esPrueba: true, lotePrueba: seed.batch, claveSemilla: entry.key, creadoEn: now, actualizadoEn: now,
      ...(auto ? {nombrePieza: entry.part, detalleVariante: entry.code, compatibilidadVehiculos: applications, compatibilidadReferencial: true} : {}),
    };
    products.push({collection: 'productosMaestro', id, data});
    const stores = auto ? automotiveStores : hardwareStores;
    for (const [offset, multiplier] of [[0, 1], [1, 1.12]]) {
      const storeId = stores[(index + offset) % stores.length];
      offers.push({collection: 'real_productosFerreteria', id: 'seed-exp200-offer-' + digest(storeId + ':' + id), data: {
        ferreteriaId: storeId, productoMaestroId: id, skuFerreteria: 'EXP200-' + digest(storeId + ':' + id).toUpperCase(),
        precio: Math.max(1000, Math.round(entry.seedPrice * multiplier / 100) * 100), stock: 1 + (index + offset) % 5,
        condicion: auto && !['fam-repuestos-filtros-de-aceite', 'fam-repuestos-filtros-automotrices', 'fam-repuestos-pastillas-de-freno', 'fam-repuestos-distribucion', 'fam-repuestos-embragues'].includes(family.id) ? 'usado' : 'nuevo',
        incluyeIva: true, activo: true, publicado: true, patrocinado: false,
        condicionesOferta: 'SOLO PRUEBA. Local ficticio; precio, stock y condición simulados. Las fotos ilustran la referencia del catálogo y no una unidad disponible para compra o retiro. ' + (auto ? 'Compatibilidad referencial; verificar por VIN y código.' : ''),
        asociacionesVehiculos: [], esPrueba: true, lotePrueba: seed.batch, vigenteDesde: now, vigenteHasta: null, creadoEn: now, actualizadoEn: now,
      }});
    }
  }
  return {prerequisites, updates: [...updates.values()], products, offers};
}

// Batched lookups and one cache invalidation per chunk avoid hundreds of extra
// Cloud SQL round trips, while all normalized writes still use the runtime codec.
export async function existingExpansionDocuments(client, documents) {
  const grouped = new Map();
  for (const d of documents) {
    if (!grouped.has(d.collection)) grouped.set(d.collection, []);
    grouped.get(d.collection).push(d.id);
  }
  const existing = new Map();
  for (const [collection, ids] of grouped) {
    const table = mappingFor(collection).tables[0];
    const result = await client.query('SELECT id,api_payload FROM findi.' + quote(table) + ' WHERE id=ANY($1::text[])', [ids]);
    for (const row of result.rows) existing.set(collection + '/' + row.id, row.api_payload || {deleted: true});
  }
  return existing;
}

export function missingExpansionDocuments(documents, existing) {
  return documents.filter(d => {
    const old = existing.get(d.collection + '/' + d.id);
    if (!old) return true;
    const fields = d.collection === 'marcas' ? ['nombreNormalizado'] : d.collection === 'modelosVehiculo' ? ['marcaId', 'nombreNormalizado', 'activo'] : d.collection === 'familias' ? ['subcategoriaId', 'permiteVehiculos'] : ['esPrueba', 'lotePrueba', 'claveSemilla', 'productoMaestroId', 'ferreteriaId'];
    if (old.deleted || fields.some(k => d.data[k] !== undefined && old[k] !== d.data[k])) throw Error('EXPANSION_IDENTITY_CONFLICT:' + d.id);
    return false;
  });
}

export async function applyExpansionChunk(db, documents, updates = []) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.withClient(async client => {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        try {
          const existing = await existingExpansionDocuments(client, [...documents, ...updates]);
          const create = missingExpansionDocuments(documents, existing);
          const storeIds = [...new Set(create.filter(d => d.collection === 'real_productosFerreteria').map(d => d.data.ferreteriaId))];
          if (storeIds.length) {
            const stores = await client.query('SELECT s.id,s.api_payload store,u.api_payload owner FROM findi.stores s JOIN findi.users u ON u.id=s.owner_id WHERE s.id=ANY($1::text[])', [storeIds]);
            if (stores.rows.length !== storeIds.length || stores.rows.some(r => r.store?.esPrueba !== true || r.store?.estado === 'inactivo' || r.owner?.esPrueba !== true || r.owner?.estadoCuenta !== 'activo')) throw Error('EXPANSION_TEST_STORE_CHANGED');
          }
          let updated = 0;
          for (const update of updates) {
            const old = existing.get(update.collection + '/' + update.id);
            if (update.collection !== 'marcas' || !old || old.deleted) throw Error('EXPANSION_BRAND_UPDATE_INVALID');
            const usos = [...new Set([...brandUses(old.usos), ...update.data.usos])];
            if (usos.length === brandUses(old.usos).length) continue;
            await writeDocument(client, update.collection, update.id, {...old, usos, actualizadoEn: update.data.actualizadoEn});
            updated++;
          }
          for (const d of create) await writeDocument(client, d.collection, d.id, d.data);
          if (create.length || updated) {
            await client.query("UPDATE findi.catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope=ANY($1::text[])", [['static', 'offers']]);
            await client.query("INSERT INTO findi.public_cache_artifacts(key,scope,version,payload,schema_version,updated_at) VALUES('meta','offers','',jsonb_build_object('dirty',true,'generation',1),1,now()) ON CONFLICT(key) DO UPDATE SET payload=findi.public_cache_artifacts.payload || jsonb_build_object('dirty',true,'generation',COALESCE((findi.public_cache_artifacts.payload->>'generation')::bigint,0)+1),updated_at=now()");
            await client.query("INSERT INTO findi.public_cache_artifacts(key,scope,version,payload,schema_version,updated_at) SELECT 'catalog-revision','static','',jsonb_build_object('revision',revision),1,now() FROM findi.catalog_revisions WHERE scope='static' ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()");
          }
          await client.query('COMMIT');
          return {created: create.length, updated};
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      });
    } catch (error) {
      if (!['40001', '40P01'].includes(error.code) || attempt === 4) throw error;
    }
  }
}
