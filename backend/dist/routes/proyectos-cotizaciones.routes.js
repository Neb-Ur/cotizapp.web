import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.middleware.js';
import { db } from '../services/in-memory-db.service.js';
import { fail, ok } from '../utils/http.js';
const proyectoItemsByProyectoId = new Map();
const itemProyectoSchema = z.object({
    productName: z.string().min(1),
    quantity: z.number().int().positive()
});
const proyectoSchema = z.object({
    nombre: z.string().min(1),
    direccionObra: z.string().optional(),
    items: z.array(itemProyectoSchema).optional()
});
const cotizacionBuildSchema = z.object({
    items: z.array(itemProyectoSchema).min(1)
});
const crearCotizacionSchema = z.object({
    proyectoId: z.string().uuid(),
    items: z.array(z.object({
        productoFerreteriaId: z.string().uuid(),
        cantidad: z.number().int().positive()
    })).min(1)
});
const estadoCotizacionSchema = z.object({
    estado: z.enum(['pendiente', 'aceptada', 'rechazada'])
});
const toSearchRows = () => {
    return db.productosFerreteria
        .filter((pf) => pf.activo && pf.publicado)
        .map((pf) => {
        const pm = db.productosMaestro.find((item) => item.id === pf.productoMaestroId);
        const fer = db.ferreterias.find((item) => item.id === pf.ferreteriaId);
        if (!pm || !fer)
            return null;
        return {
            productName: pm.nombre,
            storeName: fer.nombreComercial,
            price: pf.precio,
            productoFerreteriaId: pf.id
        };
    })
        .filter((item) => !!item);
};
const buildQuotationFromItems = (items) => {
    const rows = toSearchRows();
    const lines = items.map((item) => {
        const candidates = rows
            .filter((row) => row.productName.toLowerCase() === item.productName.toLowerCase())
            .sort((a, b) => a.price - b.price);
        const best = candidates[0];
        return {
            productName: item.productName,
            quantity: item.quantity,
            bestStoreName: best?.storeName || 'Sin datos',
            unitPrice: best?.price || 0,
            subtotal: (best?.price || 0) * item.quantity,
            productoFerreteriaId: best?.productoFerreteriaId || null
        };
    });
    const optimalTotal = lines.reduce((acc, line) => acc + line.subtotal, 0);
    const totalsByStoreMap = new Map();
    lines.forEach((line) => {
        const name = line.bestStoreName;
        totalsByStoreMap.set(name, (totalsByStoreMap.get(name) || 0) + line.subtotal);
    });
    const totalsByStore = Array.from(totalsByStoreMap.entries()).map(([storeName, total]) => ({ storeName, total }));
    const bestStore = totalsByStore.sort((a, b) => a.total - b.total)[0] || { storeName: 'Sin datos', total: optimalTotal };
    return {
        lines,
        totalsByStore,
        bestStore,
        optimalTotal,
        mixedSaving: 0
    };
};
export const proyectosCotizacionesRouter = Router();
proyectosCotizacionesRouter.get('/maestros/:maestroId/proyectos', requireAuth, (req, res) => {
    const data = db.proyectos
        .filter((item) => item.usuarioMaestroId === req.params.maestroId)
        .map((proyecto) => ({
        ...proyecto,
        items: proyectoItemsByProyectoId.get(proyecto.id) || [],
        cotizaciones: db.cotizaciones.filter((cot) => cot.proyectoId === proyecto.id)
    }))
        .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
    return ok(res, data);
});
proyectosCotizacionesRouter.post('/maestros/:maestroId/proyectos', requireAuth, (req, res) => {
    const parsed = proyectoSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'PROYECTO_INVALID_PAYLOAD', 'Payload invalido para crear proyecto.', 400, parsed.error.flatten());
    }
    const created = {
        id: uuidv4(),
        usuarioMaestroId: req.params.maestroId,
        nombre: parsed.data.nombre,
        direccionObra: parsed.data.direccionObra || '',
        creadoEn: new Date().toISOString()
    };
    db.proyectos.push(created);
    proyectoItemsByProyectoId.set(created.id, (parsed.data.items || []).map((item) => ({
        id: uuidv4(),
        productName: item.productName,
        quantity: item.quantity
    })));
    return ok(res, created, 201);
});
proyectosCotizacionesRouter.get('/maestros/:maestroId/proyectos/:proyectoId', requireAuth, (req, res) => {
    const proyecto = db.proyectos.find((item) => item.id === req.params.proyectoId && item.usuarioMaestroId === req.params.maestroId);
    if (!proyecto) {
        return fail(res, 'PROYECTO_NOT_FOUND', 'No existe el proyecto indicado.', 404);
    }
    return ok(res, {
        ...proyecto,
        items: proyectoItemsByProyectoId.get(proyecto.id) || [],
        cotizaciones: db.cotizaciones.filter((cot) => cot.proyectoId === proyecto.id)
    });
});
proyectosCotizacionesRouter.put('/maestros/:maestroId/proyectos/:proyectoId', requireAuth, (req, res) => {
    const parsed = proyectoSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'PROYECTO_INVALID_PAYLOAD', 'Payload invalido para actualizar proyecto.', 400, parsed.error.flatten());
    }
    const proyecto = db.proyectos.find((item) => item.id === req.params.proyectoId && item.usuarioMaestroId === req.params.maestroId);
    if (!proyecto) {
        return fail(res, 'PROYECTO_NOT_FOUND', 'No existe el proyecto indicado.', 404);
    }
    proyecto.nombre = parsed.data.nombre;
    proyecto.direccionObra = parsed.data.direccionObra || '';
    if (parsed.data.items) {
        proyectoItemsByProyectoId.set(proyecto.id, parsed.data.items.map((item) => ({
            id: uuidv4(),
            productName: item.productName,
            quantity: item.quantity
        })));
    }
    return ok(res, proyecto);
});
proyectosCotizacionesRouter.patch('/maestros/:maestroId/proyectos/:proyectoId/estado', requireAuth, (req, res) => {
    const parsed = estadoCotizacionSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'COTIZACION_INVALID_STATUS', 'Payload invalido para estado de cotizacion.', 400, parsed.error.flatten());
    }
    const cotizacionesProyecto = db.cotizaciones
        .filter((item) => item.proyectoId === req.params.proyectoId && item.usuarioMaestroId === req.params.maestroId)
        .sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn));
    const target = cotizacionesProyecto[0];
    if (!target) {
        const created = {
            id: uuidv4(),
            proyectoId: req.params.proyectoId,
            usuarioMaestroId: req.params.maestroId,
            estado: parsed.data.estado,
            total: 0,
            ahorroEstimado: 0,
            creadaEn: new Date().toISOString(),
            actualizadaEn: new Date().toISOString()
        };
        db.cotizaciones.push(created);
        return ok(res, created);
    }
    target.estado = parsed.data.estado;
    target.actualizadaEn = new Date().toISOString();
    return ok(res, target);
});
proyectosCotizacionesRouter.delete('/maestros/:maestroId/proyectos/:proyectoId', requireAuth, (req, res) => {
    const index = db.proyectos.findIndex((item) => item.id === req.params.proyectoId && item.usuarioMaestroId === req.params.maestroId);
    if (index < 0) {
        return fail(res, 'PROYECTO_NOT_FOUND', 'No existe el proyecto indicado.', 404);
    }
    const proyectoId = db.proyectos[index].id;
    db.proyectos.splice(index, 1);
    proyectoItemsByProyectoId.delete(proyectoId);
    for (let i = db.cotizaciones.length - 1; i >= 0; i -= 1) {
        if (db.cotizaciones[i].proyectoId === proyectoId) {
            const cotizacionId = db.cotizaciones[i].id;
            db.cotizaciones.splice(i, 1);
            for (let j = db.itemsCotizacion.length - 1; j >= 0; j -= 1) {
                if (db.itemsCotizacion[j].cotizacionId === cotizacionId) {
                    db.itemsCotizacion.splice(j, 1);
                }
            }
        }
    }
    return ok(res, { deleted: true });
});
proyectosCotizacionesRouter.post('/maestros/:maestroId/proyectos/:proyectoId/items', requireAuth, (req, res) => {
    const parsed = itemProyectoSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'PROYECTO_ITEM_INVALID_PAYLOAD', 'Payload invalido para agregar item a proyecto.', 400, parsed.error.flatten());
    }
    const proyecto = db.proyectos.find((item) => item.id === req.params.proyectoId && item.usuarioMaestroId === req.params.maestroId);
    if (!proyecto) {
        return fail(res, 'PROYECTO_NOT_FOUND', 'No existe el proyecto indicado.', 404);
    }
    const current = proyectoItemsByProyectoId.get(proyecto.id) || [];
    current.push({
        id: uuidv4(),
        productName: parsed.data.productName,
        quantity: parsed.data.quantity
    });
    proyectoItemsByProyectoId.set(proyecto.id, current);
    return ok(res, current, 201);
});
proyectosCotizacionesRouter.post('/cotizaciones/build', requireAuth, (req, res) => {
    const parsed = cotizacionBuildSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'COTIZACION_BUILD_INVALID_PAYLOAD', 'Payload invalido para construir cotizacion.', 400, parsed.error.flatten());
    }
    return ok(res, buildQuotationFromItems(parsed.data.items));
});
proyectosCotizacionesRouter.post('/cotizaciones/estrategias', requireAuth, (req, res) => {
    const parsed = cotizacionBuildSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'COTIZACION_BUILD_INVALID_PAYLOAD', 'Payload invalido para estrategias de cotizacion.', 400, parsed.error.flatten());
    }
    const quotation = buildQuotationFromItems(parsed.data.items);
    const strategies = [
        {
            id: 'cheapest',
            title: 'Tienda mas barata',
            subtitle: quotation.bestStore.storeName,
            total: quotation.bestStore.total,
            saving: 0
        },
        {
            id: 'same-store',
            title: 'Todo en la misma tienda',
            subtitle: quotation.bestStore.storeName,
            total: quotation.bestStore.total
        }
    ];
    return ok(res, strategies);
});
proyectosCotizacionesRouter.get('/maestros/:maestroId/cotizaciones-items', requireAuth, (req, res) => {
    const cotizaciones = db.cotizaciones.filter((item) => item.usuarioMaestroId === req.params.maestroId);
    const cotizacionIds = new Set(cotizaciones.map((item) => item.id));
    const items = db.itemsCotizacion.filter((item) => cotizacionIds.has(item.cotizacionId));
    return ok(res, items);
});
proyectosCotizacionesRouter.post('/maestros/:maestroId/cotizaciones-items', requireAuth, (req, res) => {
    const parsed = crearCotizacionSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'COTIZACION_INVALID_PAYLOAD', 'Payload invalido para crear cotizacion.', 400, parsed.error.flatten());
    }
    const proyecto = db.proyectos.find((item) => item.id === parsed.data.proyectoId && item.usuarioMaestroId === req.params.maestroId);
    if (!proyecto) {
        return fail(res, 'PROYECTO_NOT_FOUND', 'No existe el proyecto indicado.', 404);
    }
    const cotizacion = {
        id: uuidv4(),
        proyectoId: proyecto.id,
        usuarioMaestroId: req.params.maestroId,
        estado: 'pendiente',
        total: 0,
        ahorroEstimado: 0,
        creadaEn: new Date().toISOString(),
        actualizadaEn: new Date().toISOString()
    };
    let total = 0;
    parsed.data.items.forEach((item) => {
        const product = db.productosFerreteria.find((v) => v.id === item.productoFerreteriaId);
        if (!product || !product.activo) {
            return;
        }
        const subtotal = product.precio * item.cantidad;
        total += subtotal;
        db.itemsCotizacion.push({
            id: uuidv4(),
            cotizacionId: cotizacion.id,
            productoFerreteriaId: product.id,
            cantidad: item.cantidad,
            precioUnitarioSnapshot: product.precio,
            subtotal
        });
    });
    cotizacion.total = total;
    db.cotizaciones.push(cotizacion);
    return ok(res, {
        cotizacion,
        items: db.itemsCotizacion.filter((item) => item.cotizacionId === cotizacion.id)
    }, 201);
});
