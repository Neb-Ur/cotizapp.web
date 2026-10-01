import { Router } from 'express';
import { fail, ok } from '../lib/http.js';
import { getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';
import { COLLECTIONS } from '../lib/collections.js';
import { normalizeText, numberValue } from '../lib/values.js';
import { rows, row } from '../repositories/firestore.repository.js';
import { buildSearchRows } from '../services/catalog-search.service.js';
export const searchRouter = Router();

searchRouter.get('/busqueda', async (req, res) => {
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
  const names = (await buildSearchRows())
    .filter((item) => !familyId || item.familyId === familyId)
    .map((item) => item.productName);
  return ok(res, Array.from(new Set(names)).sort());
});

searchRouter.get('/familias/:familyId/productos', async (req, res) => {
  const q = normalizeText(req.query['search']).toLowerCase();
  const searchRows = (await buildSearchRows())
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
  const searchRows = await buildSearchRows();
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
  const searchRows = (await buildSearchRows()).filter((item) => item.productName.toLowerCase() === name);
  if (searchRows.length === 0) return fail(res, 'PRODUCTO_NOT_FOUND', 'No se encontro el producto solicitado.', 404);
  const product = await row(COLLECTIONS.masterProducts, searchRows[0].productoMaestroId);
  if (!product) return fail(res, 'PRODUCTO_NOT_FOUND', 'No se encontro el producto solicitado.', 404);
  const attributes = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === product.id);
  const stores = searchRows.map((item) => ({
    storeName: item.storeName,
    storeId: item.storeId,
    latitude: item.storeLatitude,
    longitude: item.storeLongitude,
    address: item.storeAddress,
    commune: item.storeCommune,
    price: item.price,
    stock: item.stock,
    sku: item.sku,
    productoFerreteriaId: item.productoFerreteriaId
  })).sort((a, b) => a.price - b.price);
  return ok(res, {
    productoMaestro: product,
    atributosProducto: attributes,
    stores,
    minPrice: stores[0]?.price || 0,
    maxPrice: stores[stores.length - 1]?.price || 0
  });
});

searchRouter.get('/ofertas/mejor', async (req, res) => {
  const name = normalizeText(req.query['producto']).toLowerCase();
  const offers = (await buildSearchRows())
    .filter((item) => item.productName.toLowerCase() === name)
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
