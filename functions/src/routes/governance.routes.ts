import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { COLLECTIONS } from '../lib/collections.js';
import { fail, ok } from '../lib/http.js';
import { nowIso, normalizeText, numberValue } from '../lib/values.js';
import { createRow, patchRow, rows } from '../repositories/firestore.repository.js';

const incidentSeverities = ['baja', 'media', 'alta', 'critica'] as const;
const incidentStatuses = ['abierto', 'contenido', 'recuperado', 'cerrado'] as const;
const evidenceTypes = [
  'revision_controles',
  'prueba_recuperacion',
  'evaluacion_impacto',
  'revision_encargados',
  'revision_accesos',
  'confidencialidad_personal'
] as const;
const evidenceOutcomes = ['conforme', 'con_observaciones', 'no_conforme', 'no_aplica'] as const;

function oneOf<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  const normalized = normalizeText(value).toLowerCase();
  return allowed.includes(normalized as T[number]) ? normalized as T[number] : null;
}

function stringList(value: unknown, maxItems = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item).slice(0, 160))
    .filter(Boolean)
    .slice(0, maxItems);
}

function optionalDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const governanceRouter = Router();

governanceRouter.get('/admin/governance/summary', requireAuth, requireRole('admin'), async (_req, res) => {
  const [incidents, evidence, audit] = await Promise.all([
    rows(COLLECTIONS.securityIncidents),
    rows(COLLECTIONS.governanceEvidence),
    rows(COLLECTIONS.adminAuditLogs)
  ]);
  const latestEvidenceByType = Object.fromEntries(evidenceTypes.map((type) => {
    const latest = evidence
      .filter((item) => item.type === type)
      .sort((left, right) => String(right.performedAt).localeCompare(String(left.performedAt)))[0] || null;
    return [type, latest];
  }));

  return ok(res, {
    openIncidents: incidents.filter((item) => item.status !== 'cerrado').length,
    criticalOpenIncidents: incidents.filter((item) => item.status !== 'cerrado' && item.severity === 'critica').length,
    evidenceCount: evidence.length,
    auditEventCount: audit.length,
    latestEvidenceByType
  });
});

governanceRouter.get('/admin/governance/audit-logs', requireAuth, requireRole('admin'), async (req, res) => {
  const requestedLimit = Math.floor(numberValue(req.query['limit'], 100));
  const limit = Math.min(Math.max(requestedLimit, 1), 250);
  const entries = (await rows(COLLECTIONS.adminAuditLogs))
    .sort((left, right) => String(right.occurredAt).localeCompare(String(left.occurredAt)))
    .slice(0, limit);
  return ok(res, entries);
});

governanceRouter.get('/admin/governance/incidents', requireAuth, requireRole('admin'), async (_req, res) => {
  const incidents = (await rows(COLLECTIONS.securityIncidents))
    .sort((left, right) => String(right.detectedAt).localeCompare(String(left.detectedAt)));
  return ok(res, incidents);
});

governanceRouter.post('/admin/governance/incidents', requireAuth, requireRole('admin'), async (req, res) => {
  const title = normalizeText(req.body?.title).slice(0, 160);
  const description = normalizeText(req.body?.description).slice(0, 5000);
  const severity = oneOf(req.body?.severity, incidentSeverities);
  const detectedAt = optionalDate(req.body?.detectedAt);
  if (!title || description.length < 10 || !severity || !detectedAt) {
    return fail(res, 'GOVERNANCE_INCIDENT_INVALID', 'Completa titulo, severidad, deteccion y descripcion del incidente.', 400);
  }

  const createdAt = nowIso();
  const incident = await createRow(COLLECTIONS.securityIncidents, {
    title,
    description,
    severity,
    status: 'abierto',
    detectedAt,
    systems: stringList(req.body?.systems),
    dataCategories: stringList(req.body?.dataCategories),
    affectedPeopleEstimate: Math.max(0, Math.floor(numberValue(req.body?.affectedPeopleEstimate, 0))),
    reasonableRisk: typeof req.body?.reasonableRisk === 'boolean' ? req.body.reasonableRisk : null,
    agencyNotificationRequired: typeof req.body?.agencyNotificationRequired === 'boolean'
      ? req.body.agencyNotificationRequired
      : null,
    containmentActions: normalizeText(req.body?.containmentActions).slice(0, 5000),
    createdAt,
    updatedAt: createdAt,
    createdBy: req.authUserId,
    updatedBy: req.authUserId
  });
  return ok(res, incident, 201);
});

governanceRouter.patch('/admin/governance/incidents/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const status = oneOf(req.body?.status, incidentStatuses);
  if (!status) return fail(res, 'GOVERNANCE_INCIDENT_STATUS_INVALID', 'El estado del incidente no es valido.', 400);

  const patch: Record<string, unknown> = {
    status,
    updatedAt: nowIso(),
    updatedBy: req.authUserId,
    containmentActions: normalizeText(req.body?.containmentActions).slice(0, 5000),
    rootCause: normalizeText(req.body?.rootCause).slice(0, 5000),
    lessonsLearned: normalizeText(req.body?.lessonsLearned).slice(0, 5000),
    agencyNotifiedAt: optionalDate(req.body?.agencyNotifiedAt),
    subjectsNotifiedAt: optionalDate(req.body?.subjectsNotifiedAt)
  };
  if (status === 'cerrado') patch['closedAt'] = nowIso();

  const incident = await patchRow(COLLECTIONS.securityIncidents, req.params.id, patch);
  if (!incident) return fail(res, 'GOVERNANCE_INCIDENT_NOT_FOUND', 'No se encontro el incidente.', 404);
  return ok(res, incident);
});

governanceRouter.get('/admin/governance/evidence', requireAuth, requireRole('admin'), async (_req, res) => {
  const evidence = (await rows(COLLECTIONS.governanceEvidence))
    .sort((left, right) => String(right.performedAt).localeCompare(String(left.performedAt)));
  return ok(res, evidence);
});

governanceRouter.post('/admin/governance/evidence', requireAuth, requireRole('admin'), async (req, res) => {
  const type = oneOf(req.body?.type, evidenceTypes);
  const outcome = oneOf(req.body?.outcome, evidenceOutcomes);
  const title = normalizeText(req.body?.title).slice(0, 180);
  const owner = normalizeText(req.body?.owner).slice(0, 160);
  const performedAt = optionalDate(req.body?.performedAt);
  if (!type || !outcome || !title || !owner || !performedAt) {
    return fail(res, 'GOVERNANCE_EVIDENCE_INVALID', 'Completa tipo, resultado, titulo, responsable y fecha.', 400);
  }

  const createdAt = nowIso();
  const evidence = await createRow(COLLECTIONS.governanceEvidence, {
    type,
    outcome,
    title,
    owner,
    performedAt,
    nextReviewAt: optionalDate(req.body?.nextReviewAt),
    notes: normalizeText(req.body?.notes).slice(0, 5000),
    evidenceUrl: normalizeText(req.body?.evidenceUrl).slice(0, 1000),
    createdAt,
    createdBy: req.authUserId
  });
  return ok(res, evidence, 201);
});
