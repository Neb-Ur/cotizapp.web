import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { db } from '../services/in-memory-db.service.js';
import { fail, ok } from '../utils/http.js';

const toFerreteriaMvpMetrics = (ferreteriaId: string) => {
  const productosFerreteria = db.productosFerreteria.filter((item) => item.ferreteriaId === ferreteriaId && item.activo);

  const publishedProducts = productosFerreteria.filter((item) => item.publicado).length;
  const lowStockProducts = productosFerreteria.filter((item) => item.stock > 0 && item.stock < 15).length;
  const outOfStockProducts = productosFerreteria.filter((item) => item.stock === 0).length;
  const avgPricePublished = productosFerreteria.length > 0
    ? Math.round(productosFerreteria.reduce((acc, item) => acc + item.precio, 0) / productosFerreteria.length)
    : 0;

  const quotationReach = 0;

  return {
    totalProducts: productosFerreteria.length,
    publishedProducts,
    lowStockProducts,
    outOfStockProducts,
    avgPricePublished,
    quotationReach
  };
};

export const metricasRouter = Router();

metricasRouter.get('/maestros/:maestroId/resumen', requireAuth, (req, res) => {
  return ok(res, {
    activeProjects: 0,
    estimatedSaving: 0,
    topSearches: ['Cemento', 'Tornillo', 'Cortina Blackout']
  });
});

metricasRouter.get('/ferreterias/:ferreteriaId/resumen', requireAuth, (req, res) => {
  const metrics = toFerreteriaMvpMetrics(req.params.ferreteriaId);
  return ok(res, {
    totalProducts: metrics.publishedProducts,
    lowStock: metrics.lowStockProducts,
    avgPrice: metrics.avgPricePublished
  });
});

metricasRouter.get('/ferreterias/:ferreteriaId/metricas-mvp', requireAuth, (req, res) => {
  const ferreteria = db.ferreterias.find((item) => item.id === req.params.ferreteriaId);
  if (!ferreteria) {
    return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferreteria indicada.', 404);
  }

  return ok(res, toFerreteriaMvpMetrics(ferreteria.id));
});

metricasRouter.get('/ferreterias/:ferreteriaId/metricas', requireAuth, (req, res) => {
  const ferreteria = db.ferreterias.find((item) => item.id === req.params.ferreteriaId);
  if (!ferreteria) {
    return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferreteria indicada.', 404);
  }

  const productosFerreteria = db.productosFerreteria.filter((item) => item.ferreteriaId === ferreteria.id && item.activo);

  const inventoryValue = productosFerreteria.reduce((acc, item) => acc + (item.precio * item.stock), 0);
  const avgStockPerProduct = productosFerreteria.length > 0
    ? Number((productosFerreteria.reduce((acc, item) => acc + item.stock, 0) / productosFerreteria.length).toFixed(1))
    : 0;

  return ok(res, {
    ...toFerreteriaMvpMetrics(ferreteria.id),
    views: productosFerreteria.length * 55,
    clicks: productosFerreteria.length * 11,
    ctrPercent: productosFerreteria.length > 0 ? 20 : 0,
    inventoryValue,
    avgStockPerProduct,
    quoteRequestsEstimate: Math.max(1, Math.round(productosFerreteria.length * 0.8)),
    topProducts: productosFerreteria.slice(0, 5).map((pf) => {
      const pm = db.productosMaestro.find((item) => item.id === pf.productoMaestroId);
      return {
        name: pm?.nombre || 'Producto',
        views: 120,
        clicks: 18,
        ctrPercent: 15,
        stock: pf.stock,
        price: pf.precio,
        potentialRevenue: pf.stock * pf.precio
      };
    })
  });
});
