import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { db } from '../services/in-memory-db.service.js';
import { fail, ok } from '../utils/http.js';
const vincularSchema = z.object({
    productoMaestroId: z.string().uuid(),
    skuFerreteria: z.string().min(2),
    codigoBarras: z.string().nullable().optional(),
    precio: z.number().positive(),
    stock: z.number().int().min(0),
    activo: z.boolean().optional(),
    publicado: z.boolean().optional()
});
const updateProductoFerreteriaSchema = z.object({
    skuFerreteria: z.string().min(2).optional(),
    codigoBarras: z.string().nullable().optional(),
    precio: z.number().positive().optional(),
    stock: z.number().int().min(0).optional(),
    activo: z.boolean().optional(),
    publicado: z.boolean().optional()
});
const buildCatalogRow = (productoFerreteriaId) => {
    const pf = db.productosFerreteria.find((item) => item.id === productoFerreteriaId);
    if (!pf) {
        return null;
    }
    const pm = db.productosMaestro.find((item) => item.id === pf.productoMaestroId);
    if (!pm) {
        return null;
    }
    return {
        ...pf,
        productoMaestro: pm
    };
};
export const catalogoFerreteriaRouter = Router();
catalogoFerreteriaRouter.get('/ferreterias/by-owner/:usuarioDuenoId', requireAuth, (req, res) => {
    const row = db.ferreterias.find((item) => item.usuarioDuenoId === req.params.usuarioDuenoId);
    if (!row) {
        return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe ferreteria para el usuario indicado.', 404);
    }
    return ok(res, row);
});
catalogoFerreteriaRouter.get('/ferreterias/:ferreteriaId/catalogo', requireAuth, (req, res) => {
    const { ferreteriaId } = req.params;
    const query = (req.query.query || '').trim().toLowerCase();
    const categoriaId = (req.query.categoriaId || '').trim();
    const subcategoriaId = (req.query.subcategoriaId || '').trim();
    const familiaId = (req.query.familiaId || '').trim();
    const rows = db.productosFerreteria
        .filter((item) => item.ferreteriaId === ferreteriaId)
        .map((item) => buildCatalogRow(item.id))
        .filter((item) => !!item)
        .filter((item) => {
        const pm = item.productoMaestro;
        const textOk = !query || pm.nombre.toLowerCase().includes(query) || pm.marca.toLowerCase().includes(query) || item.skuFerreteria.toLowerCase().includes(query);
        const categoryOk = !categoriaId || pm.categoriaId === categoriaId;
        const subcategoryOk = !subcategoriaId || pm.subcategoriaId === subcategoriaId;
        const familyOk = !familiaId || pm.familiaId === familiaId;
        return textOk && categoryOk && subcategoryOk && familyOk;
    })
        .sort((a, b) => a.productoMaestro.nombre.localeCompare(b.productoMaestro.nombre));
    return ok(res, rows);
});
catalogoFerreteriaRouter.post('/ferreterias/:ferreteriaId/catalogo', requireAuth, requireRole('ferreteria', 'admin'), (req, res) => {
    const { ferreteriaId } = req.params;
    const parsed = vincularSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'CATALOGO_INVALID_PAYLOAD', 'Payload invalido para vincular producto.', 400, parsed.error.flatten());
    }
    const ferreteria = db.ferreterias.find((item) => item.id === ferreteriaId);
    if (!ferreteria) {
        return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferreteria indicada.', 404);
    }
    const productoMaestro = db.productosMaestro.find((item) => item.id === parsed.data.productoMaestroId);
    if (!productoMaestro) {
        return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro indicado.', 404);
    }
    const exists = db.productosFerreteria.find((item) => item.ferreteriaId === ferreteriaId && item.productoMaestroId === productoMaestro.id);
    if (exists) {
        return fail(res, 'CATALOGO_ALREADY_LINKED', 'El producto ya esta vinculado en la ferreteria.', 409);
    }
    const created = {
        id: uuidv4(),
        ferreteriaId,
        productoMaestroId: productoMaestro.id,
        skuFerreteria: parsed.data.skuFerreteria,
        codigoBarras: parsed.data.codigoBarras ?? null,
        precio: parsed.data.precio,
        stock: parsed.data.stock,
        activo: parsed.data.activo ?? true,
        publicado: parsed.data.publicado ?? true,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
    };
    db.productosFerreteria.push(created);
    const row = buildCatalogRow(created.id);
    return ok(res, row, 201);
});
catalogoFerreteriaRouter.patch('/ferreterias/:ferreteriaId/catalogo/:productoFerreteriaId', requireAuth, requireRole('ferreteria', 'admin'), (req, res) => {
    const parsed = updateProductoFerreteriaSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'CATALOGO_INVALID_PAYLOAD', 'Payload invalido para actualizar catalogo de ferreteria.', 400, parsed.error.flatten());
    }
    const target = db.productosFerreteria.find((item) => item.id === req.params.productoFerreteriaId && item.ferreteriaId === req.params.ferreteriaId);
    if (!target) {
        return fail(res, 'CATALOGO_NOT_FOUND', 'No existe el producto en el catalogo de la ferreteria.', 404);
    }
    const payload = parsed.data;
    if (payload.skuFerreteria !== undefined)
        target.skuFerreteria = payload.skuFerreteria;
    if (payload.codigoBarras !== undefined)
        target.codigoBarras = payload.codigoBarras;
    if (payload.precio !== undefined)
        target.precio = payload.precio;
    if (payload.stock !== undefined)
        target.stock = payload.stock;
    if (payload.activo !== undefined)
        target.activo = payload.activo;
    if (payload.publicado !== undefined)
        target.publicado = payload.publicado;
    target.actualizadoEn = new Date().toISOString();
    const row = buildCatalogRow(target.id);
    return ok(res, row);
});
catalogoFerreteriaRouter.delete('/ferreterias/:ferreteriaId/catalogo/:productoFerreteriaId', requireAuth, requireRole('ferreteria', 'admin'), (req, res) => {
    const index = db.productosFerreteria.findIndex((item) => item.id === req.params.productoFerreteriaId && item.ferreteriaId === req.params.ferreteriaId);
    if (index < 0) {
        return fail(res, 'CATALOGO_NOT_FOUND', 'No existe el producto en el catalogo de la ferreteria.', 404);
    }
    db.productosFerreteria.splice(index, 1);
    return ok(res, { deleted: true });
});
