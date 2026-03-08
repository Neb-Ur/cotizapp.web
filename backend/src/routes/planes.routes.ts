import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { db } from '../services/in-memory-db.service.js';
import { fail, ok } from '../utils/http.js';

const maestroPlanCapabilities = {
  basico: { plan: 'basico', label: 'Plan Basico', maxPendingQuotations: 1, hasHistory: false },
  pro: { plan: 'pro', label: 'Plan Pro', maxPendingQuotations: 5, hasHistory: true },
  premium: { plan: 'premium', label: 'Plan Premium', maxPendingQuotations: null, hasHistory: true }
} as const;

const ferreteriaPlanCapabilities = {
  basico: { plan: 'basico', label: 'Plan Basico', maxCatalogProducts: 30, allowCsvImport: false, allowAdvancedMetrics: false },
  pro: { plan: 'pro', label: 'Plan Pro', maxCatalogProducts: 200, allowCsvImport: true, allowAdvancedMetrics: true },
  premium: { plan: 'premium', label: 'Plan Premium', maxCatalogProducts: null, allowCsvImport: true, allowAdvancedMetrics: true }
} as const;

export const planesRouter = Router();

planesRouter.get('/planes/maestro/:codigo/capacidades', requireAuth, (req, res) => {
  const codigo = req.params.codigo as keyof typeof maestroPlanCapabilities;
  const data = maestroPlanCapabilities[codigo];
  if (!data) {
    return fail(res, 'PLAN_NOT_FOUND', 'No existe el plan indicado.', 404);
  }
  return ok(res, data);
});

planesRouter.get('/planes/ferreteria/:codigo/capacidades', requireAuth, (req, res) => {
  const codigo = req.params.codigo as keyof typeof ferreteriaPlanCapabilities;
  const data = ferreteriaPlanCapabilities[codigo];
  if (!data) {
    return fail(res, 'PLAN_NOT_FOUND', 'No existe el plan indicado.', 404);
  }
  return ok(res, data);
});

planesRouter.get('/maestros/:maestroId/capacidad-cotizaciones', requireAuth, (req, res) => {
  const user = db.usuarios.find((item) => item.id === req.params.maestroId && item.rol === 'maestro');
  if (!user) {
    return fail(res, 'MAESTRO_NOT_FOUND', 'No existe el maestro indicado.', 404);
  }

  const plan = ((req.query.plan as string | undefined) || user.planSuscripcion) as keyof typeof maestroPlanCapabilities;
  const capabilities = maestroPlanCapabilities[plan] || maestroPlanCapabilities.basico;

  const pendingCount = 0;

  const limit = capabilities.maxPendingQuotations;
  if (limit !== null && pendingCount >= limit) {
    return ok(res, {
      allowed: false,
      pendingCount,
      limit,
      remaining: 0,
      message: `Tu ${capabilities.label} permite ${limit} cotizacion(es) pendiente(s).`
    });
  }

  return ok(res, {
    allowed: true,
    pendingCount,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - pendingCount),
    message: ''
  });
});

planesRouter.get('/ferreterias/:ferreteriaId/capacidad-catalogo', requireAuth, (req, res) => {
  const ferreteria = db.ferreterias.find((item) => item.id === req.params.ferreteriaId);
  if (!ferreteria) {
    return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferreteria indicada.', 404);
  }

  const owner = db.usuarios.find((item) => item.id === ferreteria.usuarioDuenoId);
  const plan = ((req.query.plan as string | undefined) || owner?.planSuscripcion || 'basico') as keyof typeof ferreteriaPlanCapabilities;
  const capabilities = ferreteriaPlanCapabilities[plan] || ferreteriaPlanCapabilities.basico;

  const currentCount = db.productosFerreteria.filter((item) => item.ferreteriaId === ferreteria.id).length;
  const limit = capabilities.maxCatalogProducts;

  if (limit !== null && currentCount >= limit) {
    return ok(res, {
      allowed: false,
      currentCount,
      limit,
      message: `Tu ${capabilities.label} permite hasta ${limit} productos en catalogo.`
    });
  }

  return ok(res, {
    allowed: true,
    currentCount,
    limit,
    message: ''
  });
});
