import { Router } from 'express';
import { db } from '../services/in-memory-db.service.js';
import { fail, ok } from '../utils/http.js';
const toSearchRows = () => {
    return db.productosFerreteria
        .filter((pf) => pf.activo && pf.publicado)
        .map((pf) => {
        const ferreteria = db.ferreterias.find((item) => item.id === pf.ferreteriaId);
        const pm = db.productosMaestro.find((item) => item.id === pf.productoMaestroId);
        if (!ferreteria || !pm) {
            return null;
        }
        const categoria = db.categorias.find((item) => item.id === pm.categoriaId);
        const subcategoria = db.subcategorias.find((item) => item.id === pm.subcategoriaId);
        const familia = db.familias.find((item) => item.id === pm.familiaId);
        const hash = Number.parseInt(pf.id.slice(0, 4).replace(/-/g, ''), 16) || 100;
        const distanceKm = 1 + (hash % 15);
        const balanceScore = pf.precio + Math.round(distanceKm * 70);
        return {
            productoMaestroId: pm.id,
            productoFerreteriaId: pf.id,
            productName: pm.nombre,
            storeName: ferreteria.nombreComercial,
            price: pf.precio,
            distanceKm,
            balanceScore,
            categoryId: pm.categoriaId,
            categoryName: categoria?.nombre || 'Sin categoria',
            subcategoryId: pm.subcategoriaId,
            subcategoryName: subcategoria?.nombre || 'Sin subcategoria',
            familyId: pm.familiaId,
            familyName: familia?.nombre || 'Sin familia',
            stock: pf.stock,
            sku: pf.skuFerreteria
        };
    })
        .filter((item) => !!item);
};
export const busquedaRouter = Router();
busquedaRouter.get('/busqueda', (req, res) => {
    const query = (req.query.query || '').trim().toLowerCase();
    const categoriaId = (req.query.categoriaId || '').trim();
    const subcategoriaId = (req.query.subcategoriaId || '').trim();
    const familiaId = (req.query.familiaId || '').trim();
    const sort = (req.query.sort || 'precio').trim();
    const rows = toSearchRows()
        .filter((item) => !query || item.productName.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query))
        .filter((item) => !categoriaId || item.categoryId === categoriaId)
        .filter((item) => !subcategoriaId || item.subcategoryId === subcategoriaId)
        .filter((item) => !familiaId || item.familyId === familiaId);
    rows.sort((a, b) => {
        if (sort === 'cercania')
            return a.distanceKm - b.distanceKm;
        if (sort === 'balance')
            return a.balanceScore - b.balanceScore;
        return a.price - b.price;
    });
    return ok(res, rows);
});
busquedaRouter.get('/productos/opciones', (req, res) => {
    const categoriaId = (req.query.categoriaId || '').trim();
    const subcategoriaId = (req.query.subcategoriaId || '').trim();
    const familiaId = (req.query.familiaId || '').trim();
    const values = toSearchRows()
        .filter((item) => !categoriaId || item.categoryId === categoriaId)
        .filter((item) => !subcategoriaId || item.subcategoryId === subcategoriaId)
        .filter((item) => !familiaId || item.familyId === familiaId)
        .map((item) => item.productName);
    const unique = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
    return ok(res, unique);
});
busquedaRouter.get('/familias/:familiaId/productos', (req, res) => {
    const { familiaId } = req.params;
    const search = (req.query.search || '').trim().toLowerCase();
    const rows = toSearchRows()
        .filter((item) => item.familyId === familiaId)
        .filter((item) => !search || item.productName.toLowerCase().includes(search));
    const grouped = new Map();
    rows.forEach((row) => {
        const current = grouped.get(row.productName) || {
            productName: row.productName,
            minPrice: row.price,
            maxPrice: row.price,
            sellers: new Set()
        };
        current.minPrice = Math.min(current.minPrice, row.price);
        current.maxPrice = Math.max(current.maxPrice, row.price);
        current.sellers.add(row.storeName);
        grouped.set(row.productName, current);
    });
    const response = Array.from(grouped.values()).map((item) => ({
        productName: item.productName,
        minPrice: item.minPrice,
        maxPrice: item.maxPrice,
        storeCount: item.sellers.size,
        sellers: Array.from(item.sellers)
    }));
    return ok(res, response);
});
busquedaRouter.get('/productos/populares', (req, res) => {
    const search = (req.query.search || '').trim().toLowerCase();
    const limit = Number.parseInt(req.query.limit || '12', 10) || 12;
    const grouped = new Map();
    toSearchRows()
        .filter((row) => !search || row.productName.toLowerCase().includes(search))
        .forEach((row) => {
        const current = grouped.get(row.productName) || {
            productName: row.productName,
            score: 0,
            minPrice: row.price,
            maxPrice: row.price,
            sellers: new Set()
        };
        current.score += row.stock;
        current.minPrice = Math.min(current.minPrice, row.price);
        current.maxPrice = Math.max(current.maxPrice, row.price);
        current.sellers.add(row.storeName);
        grouped.set(row.productName, current);
    });
    const response = Array.from(grouped.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, limit))
        .map((row) => ({
        productName: row.productName,
        minPrice: row.minPrice,
        maxPrice: row.maxPrice,
        storeCount: row.sellers.size,
        sellers: Array.from(row.sellers)
    }));
    return ok(res, response);
});
busquedaRouter.get('/productos/detalle', (req, res) => {
    const product = (req.query.producto || '').trim().toLowerCase();
    const rows = toSearchRows().filter((item) => item.productName.toLowerCase() === product);
    if (rows.length === 0) {
        return fail(res, 'PRODUCTO_NOT_FOUND', 'No se encontro el producto solicitado.', 404);
    }
    const pm = db.productosMaestro.find((item) => item.id === rows[0].productoMaestroId);
    if (!pm) {
        return fail(res, 'PRODUCTO_NOT_FOUND', 'No se encontro el producto solicitado.', 404);
    }
    const stores = rows
        .map((row) => ({
        storeName: row.storeName,
        price: row.price,
        distanceKm: row.distanceKm,
        stock: row.stock,
        sku: row.sku,
        productoFerreteriaId: row.productoFerreteriaId
    }))
        .sort((a, b) => a.price - b.price);
    return ok(res, {
        productoMaestro: pm,
        atributosProducto: db.atributosProductoMaestro.filter((item) => item.productoMaestroId === pm.id),
        stores,
        minPrice: stores[0]?.price || 0,
        maxPrice: stores[stores.length - 1]?.price || 0
    });
});
busquedaRouter.get('/ofertas/mejor', (req, res) => {
    const product = (req.query.producto || '').trim().toLowerCase();
    const rows = toSearchRows().filter((item) => item.productName.toLowerCase() === product);
    if (rows.length === 0) {
        return ok(res, null);
    }
    rows.sort((a, b) => a.price - b.price || a.distanceKm - b.distanceKm);
    const best = rows[0];
    return ok(res, {
        storeName: best.storeName,
        price: best.price,
        sku: best.sku,
        productoFerreteriaId: best.productoFerreteriaId
    });
});
