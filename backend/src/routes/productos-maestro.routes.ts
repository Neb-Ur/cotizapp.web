import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { db } from '../services/in-memory-db.service.js';
import { fail, ok } from '../utils/http.js';

const productoSchema = z.object({
  categoriaId: z.string().uuid(),
  subcategoriaId: z.string().uuid(),
  familiaId: z.string().uuid(),
  nombre: z.string().min(2),
  marca: z.string().min(1),
  descripcionCorta: z.string().optional(),
  descripcionLarga: z.string().optional(),
  imagenPrincipalUrl: z.string().optional(),
  galeriaJson: z.array(z.string()).optional(),
  estado: z.enum(['activo', 'inactivo']).optional()
});

const atributoValorSchema = z.object({
  definicionAtributoId: z.string().uuid(),
  valorTexto: z.string().nullable().optional(),
  valorNumero: z.number().nullable().optional(),
  valorBooleano: z.boolean().nullable().optional(),
  valorOpcion: z.string().nullable().optional()
});

const attributeBulkSchema = z.array(atributoValorSchema);

const buildDetalle = (productoMaestroId: string) => {
  const producto = db.productosMaestro.find((item) => item.id === productoMaestroId);
  if (!producto) {
    return null;
  }

  const atributos = db.atributosProductoMaestro.filter((item) => item.productoMaestroId === producto.id);
  return {
    ...producto,
    atributos
  };
};

export const productosMaestroRouter = Router();

productosMaestroRouter.get('/productos-maestro', (req, res) => {
  const query = ((req.query.query as string | undefined) || '').trim().toLowerCase();
  const categoriaId = ((req.query.categoriaId as string | undefined) || '').trim();
  const subcategoriaId = ((req.query.subcategoriaId as string | undefined) || '').trim();
  const familiaId = ((req.query.familiaId as string | undefined) || '').trim();

  const data = db.productosMaestro
    .filter((item) => !query || item.nombre.toLowerCase().includes(query) || item.marca.toLowerCase().includes(query))
    .filter((item) => !categoriaId || item.categoriaId === categoriaId)
    .filter((item) => !subcategoriaId || item.subcategoriaId === subcategoriaId)
    .filter((item) => !familiaId || item.familiaId === familiaId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return ok(res, data);
});

productosMaestroRouter.get('/productos-maestro/:productoMaestroId', (req, res) => {
  const detalle = buildDetalle(req.params.productoMaestroId);
  if (!detalle) {
    return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  }
  return ok(res, detalle);
});

productosMaestroRouter.post('/productos-maestro', requireAuth, requireRole('admin'), (req, res) => {
  const parsed = productoSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'PRODUCTO_MAESTRO_INVALID_PAYLOAD', 'Payload invalido para crear producto maestro.', 400, parsed.error.flatten());
  }

  const payload = parsed.data;
  const created = {
    id: uuidv4(),
    categoriaId: payload.categoriaId,
    subcategoriaId: payload.subcategoriaId,
    familiaId: payload.familiaId,
    nombre: payload.nombre,
    marca: payload.marca,
    descripcionCorta: payload.descripcionCorta || '',
    descripcionLarga: payload.descripcionLarga || '',
    imagenPrincipalUrl: payload.imagenPrincipalUrl || '',
    galeriaJson: payload.galeriaJson || [],
    estado: payload.estado || 'activo',
    creadoEn: new Date().toISOString()
  };

  db.productosMaestro.push(created);
  return ok(res, created, 201);
});

productosMaestroRouter.patch('/productos-maestro/:productoMaestroId', requireAuth, requireRole('admin'), (req, res) => {
  const parsed = productoSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'PRODUCTO_MAESTRO_INVALID_PAYLOAD', 'Payload invalido para actualizar producto maestro.', 400, parsed.error.flatten());
  }

  const target = db.productosMaestro.find((item) => item.id === req.params.productoMaestroId);
  if (!target) {
    return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  }

  const payload = parsed.data;
  if (payload.categoriaId !== undefined) target.categoriaId = payload.categoriaId;
  if (payload.subcategoriaId !== undefined) target.subcategoriaId = payload.subcategoriaId;
  if (payload.familiaId !== undefined) target.familiaId = payload.familiaId;
  if (payload.nombre !== undefined) target.nombre = payload.nombre;
  if (payload.marca !== undefined) target.marca = payload.marca;
  if (payload.descripcionCorta !== undefined) target.descripcionCorta = payload.descripcionCorta;
  if (payload.descripcionLarga !== undefined) target.descripcionLarga = payload.descripcionLarga;
  if (payload.imagenPrincipalUrl !== undefined) target.imagenPrincipalUrl = payload.imagenPrincipalUrl;
  if (payload.galeriaJson !== undefined) target.galeriaJson = payload.galeriaJson;
  if (payload.estado !== undefined) target.estado = payload.estado;

  return ok(res, target);
});

productosMaestroRouter.put('/productos-maestro/:productoMaestroId/atributos', requireAuth, requireRole('admin'), (req, res) => {
  const parsed = attributeBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'PRODUCTO_MAESTRO_INVALID_ATTRIBUTES', 'Payload invalido para atributos de producto.', 400, parsed.error.flatten());
  }

  const { productoMaestroId } = req.params;
  const exists = db.productosMaestro.some((item) => item.id === productoMaestroId);
  if (!exists) {
    return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  }

  for (let idx = db.atributosProductoMaestro.length - 1; idx >= 0; idx -= 1) {
    if (db.atributosProductoMaestro[idx].productoMaestroId === productoMaestroId) {
      db.atributosProductoMaestro.splice(idx, 1);
    }
  }

  parsed.data.forEach((item) => {
    db.atributosProductoMaestro.push({
      id: uuidv4(),
      productoMaestroId,
      definicionAtributoId: item.definicionAtributoId,
      valorTexto: item.valorTexto ?? null,
      valorNumero: item.valorNumero ?? null,
      valorBooleano: item.valorBooleano ?? null,
      valorOpcion: item.valorOpcion ?? null
    });
  });

  return ok(res, db.atributosProductoMaestro.filter((item) => item.productoMaestroId === productoMaestroId));
});
