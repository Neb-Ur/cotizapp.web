import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { COLLECTIONS } from '../lib/collections.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { normalizeText, nowIso, numberValue } from '../lib/values.js';
import { createRow, patchRow, row, rows } from '../repositories/firestore.repository.js';

export const priceReportsRouter = Router();

priceReportsRouter.post('/price-reports', async (req, res) => {
  if (normalizeText(req.body?.website)) return ok(res, { received: true }, 201);
  const email = normalizeText(req.body?.email).toLowerCase().slice(0, 180);
  const productName = normalizeText(req.body?.productName).slice(0, 220);
  const storeName = normalizeText(req.body?.storeName).slice(0, 180);
  const offerId = normalizeText(req.body?.offerId).slice(0, 160);
  const storeId = normalizeText(req.body?.storeId).slice(0, 160);
  const contentUrl = normalizeText(req.body?.contentUrl).slice(0, 1000);
  const details = normalizeText(req.body?.details).slice(0, 2000);
  const displayedPrice = numberValue(req.body?.displayedPrice, -1);
  const observedPrice = numberValue(req.body?.observedPrice, -1);
  if (!/^\S+@\S+\.\S+$/.test(email) || !productName || !storeName || !offerId || !storeId
    || !/^https?:\/\//i.test(contentUrl) || displayedPrice < 0 || observedPrice < 0 || details.length < 10) {
    return fail(res, 'PRICE_REPORT_INVALID', 'Revisa la oferta, los precios, el correo y la descripción.', 400);
  }

  const reference = `PRECIO-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  const created = await createRow(COLLECTIONS.priceReports, {
    reference,
    email,
    productName,
    storeName,
    storeId,
    offerId,
    contentUrl,
    displayedPrice,
    observedPrice,
    details,
    status: 'recibido',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    resolution: null,
    resolvedAt: null
  });
  return ok(res, { received: true, reference, id: created.id }, 201);
});

priceReportsRouter.get('/admin/price-reports', requireAuth, requireRole('admin'), async (_req, res) => {
  const reports = (await rows(COLLECTIONS.priceReports))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  return ok(res, reports);
});

priceReportsRouter.patch('/admin/price-reports/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const report = await row(COLLECTIONS.priceReports, req.params.id);
  if (!report) return fail(res, 'PRICE_REPORT_NOT_FOUND', 'No se encontró el reclamo.', 404);
  const status = normalizeText(req.body?.status);
  const resolution = normalizeText(req.body?.resolution).slice(0, 2000);
  if (!['en_revision', 'corregido', 'no_acreditado'].includes(status) || resolution.length < 10) {
    return fail(res, 'PRICE_REPORT_RESOLUTION_INVALID', 'Indica un estado y fundamento suficiente.', 400);
  }

  const changedAt = nowIso();
  if (status === 'corregido') {
    const offer = await row(COLLECTIONS.storeProducts, report.offerId);
    const correctedPrice = numberValue(req.body?.correctedPrice, -1);
    if (!offer || offer.ferreteriaId !== report.storeId || correctedPrice < 0) {
      return fail(res, 'PRICE_REPORT_CORRECTION_INVALID', 'La oferta ya no existe o falta el precio corregido.', 400);
    }
    await patchRow(COLLECTIONS.storeProducts, report.offerId, { precio: correctedPrice, actualizadoEn: changedAt });
    await createRow(COLLECTIONS.priceHistory, {
      ferreteriaId: report.storeId,
      productoFerreteriaId: report.offerId,
      productoMaestroId: offer.productoMaestroId,
      actorId: req.authUserId,
      action: 'price_report_correction',
      precioAnterior: numberValue(offer.precio),
      precioNuevo: correctedPrice,
      incluyeIva: offer.incluyeIva !== false,
      ocurridoEn: changedAt,
      source: 'admin',
      priceReportId: req.params.id
    });
  }

  const updated = await patchRow(COLLECTIONS.priceReports, req.params.id, {
    status,
    resolution,
    resolvedAt: status === 'en_revision' ? null : changedAt,
    updatedAt: changedAt,
    resolvedBy: req.authUserId
  });
  return ok(res, updated);
});
