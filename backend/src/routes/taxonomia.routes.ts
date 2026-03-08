import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { db } from '../services/in-memory-db.service.js';
import { fail, ok } from '../utils/http.js';

const definicionSchema = z.object({
  codigo: z.string().min(1),
  etiqueta: z.string().min(1),
  tipoDato: z.enum(['texto', 'numero', 'seleccion', 'booleano']),
  esFiltrable: z.boolean(),
  esObligatorio: z.boolean(),
  opcionesJson: z.array(z.string()).optional(),
  orden: z.number().int().optional()
});

export const taxonomiaRouter = Router();

taxonomiaRouter.get('/categorias', (_req, res) => {
  return ok(res, db.categorias);
});

taxonomiaRouter.get('/subcategorias', (req, res) => {
  const categoriaId = (req.query.categoriaId as string | undefined)?.trim();
  const data = categoriaId
    ? db.subcategorias.filter((item) => item.categoriaId === categoriaId)
    : db.subcategorias;
  return ok(res, data);
});

taxonomiaRouter.get('/familias', (req, res) => {
  const subcategoriaId = (req.query.subcategoriaId as string | undefined)?.trim();
  const data = subcategoriaId
    ? db.familias.filter((item) => item.subcategoriaId === subcategoriaId)
    : db.familias;
  return ok(res, data);
});

taxonomiaRouter.get('/familias/:familiaId/atributos-definicion', (req, res) => {
  const { familiaId } = req.params;
  const data = db.definicionesAtributoFamilia
    .filter((item) => item.familiaId === familiaId)
    .sort((a, b) => a.orden - b.orden || a.etiqueta.localeCompare(b.etiqueta));
  return ok(res, data);
});

taxonomiaRouter.post('/familias/:familiaId/atributos-definicion', requireAuth, requireRole('admin'), (req, res) => {
  const { familiaId } = req.params;
  const familiaExists = db.familias.some((item) => item.id === familiaId);
  if (!familiaExists) {
    return fail(res, 'TAXONOMIA_FAMILIA_NOT_FOUND', 'No existe la familia indicada.', 404);
  }

  const parsed = definicionSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'TAXONOMIA_INVALID_PAYLOAD', 'Payload invalido para definicion de atributo.', 400, parsed.error.flatten());
  }

  const payload = parsed.data;
  const duplicated = db.definicionesAtributoFamilia.some(
    (item) => item.familiaId === familiaId && item.codigo.toLowerCase() === payload.codigo.toLowerCase()
  );

  if (duplicated) {
    return fail(res, 'TAXONOMIA_DUPLICATED_CODE', 'Ya existe una definicion con ese codigo.', 409);
  }

  const created = {
    id: uuidv4(),
    familiaId,
    codigo: payload.codigo,
    etiqueta: payload.etiqueta,
    tipoDato: payload.tipoDato,
    esFiltrable: payload.esFiltrable,
    esObligatorio: payload.esObligatorio,
    opcionesJson: payload.opcionesJson || [],
    orden: payload.orden ?? (db.definicionesAtributoFamilia.length + 1)
  };

  db.definicionesAtributoFamilia.push(created);
  return ok(res, created, 201);
});

taxonomiaRouter.patch('/familias/:familiaId/atributos-definicion/:definicionId', requireAuth, requireRole('admin'), (req, res) => {
  const { familiaId, definicionId } = req.params;
  const parsed = definicionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'TAXONOMIA_INVALID_PAYLOAD', 'Payload invalido para actualizar definicion.', 400, parsed.error.flatten());
  }

  const target = db.definicionesAtributoFamilia.find((item) => item.id === definicionId && item.familiaId === familiaId);
  if (!target) {
    return fail(res, 'TAXONOMIA_DEFINITION_NOT_FOUND', 'No existe la definicion indicada.', 404);
  }

  const payload = parsed.data;
  if (payload.codigo !== undefined) target.codigo = payload.codigo;
  if (payload.etiqueta !== undefined) target.etiqueta = payload.etiqueta;
  if (payload.tipoDato !== undefined) target.tipoDato = payload.tipoDato;
  if (payload.esFiltrable !== undefined) target.esFiltrable = payload.esFiltrable;
  if (payload.esObligatorio !== undefined) target.esObligatorio = payload.esObligatorio;
  if (payload.opcionesJson !== undefined) target.opcionesJson = payload.opcionesJson;
  if (payload.orden !== undefined) target.orden = payload.orden;

  return ok(res, target);
});
