import { seoProductSlug } from '../domain/catalog-seo.js';
import { Router } from 'express';
import { getProductSheet } from '../lib/product-sheet-cache.js';
import { db } from '../lib/firebase.js';
import { fail, ok } from '../lib/http.js';
import { getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';
import { COLLECTIONS } from '../lib/collections.js';
import { normalizeText, numberValue, normalizeProjectProximity } from '../lib/values.js';
import { paginateProductSearch, type ProductSearchOptions } from '../domain/product-search.js';
import { rows, row } from '../repositories/firestore.repository.js';
import { buildSearchRows } from '../services/catalog-search.service.js';
export const searchRouter = Router();

searchRouter.get('/busqueda', async (req, res) => {
  // Opt-in product pages preserve the legacy array response used by quotation
  // and catalog consumers, while the search screen downloads only one page.
  if (req.query['vista'] === 'productos') {
    const page = Number(req.query['page'] ?? 1);
    const size = Number(req.query['size'] ?? 20);
    const sort = String(req.query['sort'] ?? 'relevance');
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(size) || size < 1 || size > 50
      || !['relevance', 'price-asc', 'price-desc', 'stores'].includes(sort)) {
      return fail(res, 'SEARCH_INVALID_PAGE', 'Página, tamaño u orden de búsqueda inválidos.');
    }
    const hasProximity = ['latitude', 'longitude', 'radiusKm'].some(key => req.query[key] !== undefined);
    const proximity = hasProximity ? normalizeProjectProximity(req.query) : null;
    if (hasProximity && !proximity) {
      return fail(res, 'SEARCH_INVALID_PROXIMITY', 'La ubicación o el radio de búsqueda no son válidos.');
    }
    const result = paginateProductSearch(await getPublicCatalogSnapshot(), {
      query: normalizeText(req.query['query']),
      categoryId: normalizeText(req.query['categoriaId']),
      subcategoryId: normalizeText(req.query['subcategoriaId']),
      familyId: normalizeText(req.query['familiaId']),
      brand: normalizeText(req.query['marca']),
      brandId: normalizeText(req.query['marcaId']),
      proximity: proximity || undefined,
      sort: sort as ProductSearchOptions['sort'], page, size
    });
    res.set('Cache-Control', 'no-store');
    return ok(res, result);
  }
  const q = normalizeText(req.query['query']).toLowerCase();
  const categoryId = normalizeText(req.query['categoriaId']);
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const familyId = normalizeText(req.query['familiaId']);
  const data = (await getPublicCatalogSnapshot()).searchRows
    .filter((item) => !q || item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q))
    .filter((item) => !categoryId || item.categoryId === categoryId)
    .filter((item) => !subcategoryId || item.subcategoryId === subcategoryId)
    .filter((item) => !familyId || item.familyId === familyId)
    .sort((a, b) => a.price - b.price);
  return ok(res, data);
});

searchRouter.get('/productos/opciones', async (req, res) => {
  const familyId = normalizeText(req.query['familiaId']);
  const names = ((await getPublicCatalogSnapshot()).searchRows)
    .filter((item) => !familyId || item.familyId === familyId)
    .map((item) => item.productName);
  return ok(res, Array.from(new Set(names)).sort());
});

searchRouter.get('/familias/:familyId/productos', async (req, res) => {
  const q = normalizeText(req.query['search']).toLowerCase();
  const searchRows = ((await getPublicCatalogSnapshot()).searchRows)
    .filter((item) => item.familyId === req.params.familyId)
    .filter((item) => !q || item.productName.toLowerCase().includes(q));
  const grouped = new Map<string, any>();
  searchRows.forEach((item) => {
    const current = grouped.get(item.productName) || {
      productName: item.productName,
      imageUrl: '',
      minPrice: item.price,
      maxPrice: item.price,
      storeCount: 0,
      brand: '',
      productType: '',
      sellers: new Set<string>()
    };
    current.minPrice = Math.min(current.minPrice, item.price);
    current.maxPrice = Math.max(current.maxPrice, item.price);
    current.sellers.add(item.storeName);
    grouped.set(item.productName, current);
  });
  return ok(res, Array.from(grouped.values()).map((item) => ({ ...item, storeCount: item.sellers.size, sellers: Array.from(item.sellers) })));
});

searchRouter.get('/productos/populares', async (req, res) => {
  const limit = Math.max(1, Math.floor(numberValue(req.query['limit'], 12)));
  const searchRows = (await getPublicCatalogSnapshot()).searchRows;
  const grouped = new Map<string, any>();
  searchRows.forEach((item) => {
    const current = grouped.get(item.productName) || { productName: item.productName, score: 0, minPrice: item.price, maxPrice: item.price, sellers: new Set<string>() };
    current.score += item.stock;
    current.minPrice = Math.min(current.minPrice, item.price);
    current.maxPrice = Math.max(current.maxPrice, item.price);
    current.sellers.add(item.storeName);
    grouped.set(item.productName, current);
  });
  return ok(res, Array.from(grouped.values()).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => ({
    productName: item.productName,
    minPrice: item.minPrice,
    maxPrice: item.maxPrice,
    storeCount: item.sellers.size,
    sellers: Array.from(item.sellers)
  })));
});

searchRouter.get('/productos/detalle', async (req, res) => {
  const name = normalizeText(req.query['producto']).toLowerCase();
  const requestedSlug = normalizeText(req.query['slug']);
  if (req.query['vista'] === 'ficha') {
    const sheet = await getProductSheet(name, requestedSlug);
    if (!sheet) return fail(res, 'PRODUCTO_NOT_FOUND', 'No se encontro el producto solicitado.', 404);
    return ok(res, sheet);
  }
  const snapshot = await getPublicCatalogSnapshot();
  const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  const product = snapshot.products.find(item => requestedSlug
    ? seoProductSlug(item,snapshot.products) === requestedSlug
    : normalizeText(item.nombre).toLowerCase() === name);
  if (!product) return fail(res, 'PRODUCTO_NOT_FOUND', 'No se encontro el producto solicitado.', 404);
  const searchRows = snapshot.searchRows.filter(item => item.productoMaestroId === product.id);
  const offersOnly = req.query['vista'] === 'ofertas';
  const [attributeSnapshot, definitionSnapshot] = offersOnly ? [{ docs: [] }, { docs: [] }] : await Promise.all([
    db.collection(COLLECTIONS.masterAttributes).where('productoMaestroId', '==', product.id).get(),
    db.collection(COLLECTIONS.familyDefinitions).where('familiaId', '==', product.familiaId).get()
  ]);
  const definitions = new Map(definitionSnapshot.docs.map(doc => [doc.id, doc.data()]));
  const attributes = attributeSnapshot.docs.map(doc => {
    const item = doc.data();
    return { id: doc.id, ...item, etiqueta: definitions.get(item['definicionAtributoId'])?.['etiqueta'] || item['definicionAtributoId'] };
  });
  const stores = searchRows.map((item) => ({
    storeName: item.storeName,
    storeId: item.storeId,
    latitude: item.storeLatitude,
    longitude: item.storeLongitude,
    address: item.storeAddress,
    commune: item.storeCommune,
    rut: item.storeRut,
    email: item.storeEmail,
    phone: item.storePhone,
    price: item.price,
    priceUpdatedAt: item.priceUpdatedAt,
    includesVat: item.includesVat,
    comparisonEligible: item.comparisonEligible,
    includesShipping: item.includesShipping,
    validFrom: item.validFrom,
    validUntil: item.validUntil,
    offerConditions: item.offerConditions,
    sponsored: item.sponsored,
    measurementUnit: item.measurementUnit,
    measurementQuantity: item.measurementQuantity,
    pricePerMeasurement: item.pricePerMeasurement,
    measurementSource: item.measurementSource,
    source: 'Informado por la ferretería',
    stock: item.stock,
    sku: item.sku,
    productoFerreteriaId: item.productoFerreteriaId
  })).sort((a, b) => Number(b.comparisonEligible) - Number(a.comparisonEligible) || a.price - b.price);
  if (offersOnly) return ok(res, {
    stores, minPrice: stores.length ? Math.min(...stores.map(item => item.price)) : 0,
    maxPrice: stores.length ? Math.max(...stores.map(item => item.price)) : 0
  });
  return ok(res, {
    productoMaestro: {...product,seoPath:`/productos/${seoProductSlug(product,snapshot.products)}`},
    categoryName: snapshot.taxonomy.categories.find(item => item.id === product.categoriaId)?.nombre || 'Sin categoria',
    subcategoryName: snapshot.taxonomy.subcategories.find(item => item.id === product.subcategoriaId)?.nombre || 'Sin subcategoria',
    familyName: snapshot.taxonomy.families.find(item => item.id === product.familiaId)?.nombre || 'Sin familia',
    atributosProducto: attributes,
    stores,
    minPrice: stores.length ? Math.min(...stores.map((item) => item.price)) : 0,
    maxPrice: stores.length ? Math.max(...stores.map((item) => item.price)) : 0,
    comparisonCriteria: 'Menor precio final unitario con IVA incluido, informado para la misma ficha de producto, con oferta activa y vigente. El patrocinio no altera el orden. El despacho no está incluido.'
  });
});

searchRouter.get('/ofertas/mejor', async (req, res) => {
  const name = normalizeText(req.query['producto']).toLowerCase();
  const offers = ((await getPublicCatalogSnapshot()).searchRows)
    .filter((item) => item.productName.toLowerCase() === name)
    .filter((item) => item.comparisonEligible)
    .sort((a, b) => a.price - b.price);
  const best = offers[0];
  return ok(res, best ? {
    storeName: best.storeName,
    price: best.price,
    sku: best.sku,
    productoFerreteriaId: best.productoFerreteriaId
  } : null);
});

// Ferreteria catalog.
