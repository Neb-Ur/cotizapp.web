import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { ok } from '../lib/http.js';
import { normalizeText, nowIso } from '../lib/values.js';
import { rows } from '../repositories/firestore.repository.js';

export const marketingRouter = Router();

marketingRouter.post('/marketing/unsubscribe', async (req, res) => {
  if (normalizeText(req.body?.website)) return ok(res, { received: true });
  const email = normalizeText(req.body?.email).toLowerCase().slice(0, 180);
  if (/^\S+@\S+\.\S+$/.test(email)) {
    const occurredAt = nowIso();
    const emailHash = createHash('sha256').update(email).digest('hex');
    const users = (await rows(COLLECTIONS.users)).filter((user) => normalizeText(user.correo).toLowerCase() === email);
    const batch = db.batch();
    batch.set(db.collection(COLLECTIONS.marketingSuppressions).doc(emailHash), {
      emailHash,
      suppressedAt: occurredAt,
      source: 'public_unsubscribe'
    }, { merge: true });
    users.forEach((user) => {
      batch.set(db.collection(COLLECTIONS.users).doc(user.id), {
        marketingConsent: false,
        marketingConsentUpdatedAt: occurredAt
      }, { merge: true });
      batch.set(db.collection(COLLECTIONS.consentRecords).doc(randomUUID()), {
        usuarioId: user.id,
        type: 'marketing',
        version: '1.0',
        granted: false,
        occurredAt,
        source: 'public_unsubscribe'
      });
    });
    await batch.commit();
  }
  // Identical response prevents account enumeration.
  return ok(res, { received: true, message: 'La dirección quedó excluida de futuras comunicaciones publicitarias, si estaba registrada.' });
});
