import test from 'node:test';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, CURRENT_STORE_AGREEMENT_VERSION } from '../lib/lib/legal.js';
import assert from 'node:assert/strict';
import { storeOnboardingRouter } from '../lib/routes/store-onboarding.routes.js';
import { requireAuth } from '../lib/lib/auth.js';
import { adminAuth } from '../lib/lib/firebase.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const handle = method => storeOnboardingRouter.stack.find(layer => layer.route?.path === `/store-onboarding/${method === 'get' ? 'current' : 'accept'}`).route.stack.at(-1).handle;
const declarations = ['termsAccepted', 'privacyAcknowledged', 'ageConfirmed', 'agreementAccepted', 'authorityConfirmed', 'catalogCommitmentConfirmed'];
const payload = { ...Object.fromEntries(declarations.map(key => [key, true])), termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, agreementVersion: CURRENT_STORE_AGREEMENT_VERSION };
const seed = { usuarios: { owner: { rol: 'ferreteria', nombre: 'Representante', correo: 'store@example.test' } }, ferreterias: { store: { usuarioDuenoId: 'owner', nombreComercial: 'Tienda', rut: '76000000-0' } } };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = body => ({ authUserId: 'owner', body, header: () => 'test-browser' });

test('every mandatory declaration is explicit and old document versions cannot be accepted', async t => {
  const fixture = firestoreFixture(t, seed);
  for (const key of declarations) for (const value of [false, undefined, 'true']) {
    const res = response(); await handle('post')(request({ ...payload, [key]: value }), res);
    assert.equal(res.statusCode, 400);
  }
  for (const key of ['termsVersion', 'privacyVersion', 'agreementVersion']) {
    const res = response(); await handle('post')(request({ ...payload, [key]: 'old' }), res);
    assert.equal(res.statusCode, 409);
  }
  assert.equal(fixture.rows('registrosConsentimiento').length, 0);
  assert.equal(fixture.rows('contratosFerreteria').length, 0);
  assert.equal(fixture.get('usuarios', 'owner').terminosVersion, undefined);
});

test('compact acceptance records legal and commercial evidence together using the authenticated account identity', async t => {
  const fixture = firestoreFixture(t, seed); const res = response();
  await handle('post')(request({ ...payload, signerName: 'forged', marketingConsent: true }), res);
  assert.equal(res.statusCode, 201);
  const user = fixture.get('usuarios', 'owner');
  assert.equal(user.terminosVersion, CURRENT_TERMS_VERSION); assert.equal(user.privacidadVersion, CURRENT_PRIVACY_VERSION);
  assert.equal(user.marketingConsent, undefined);
  const agreement = fixture.rows('contratosFerreteria')[0];
  assert.equal(agreement.firmante.nombre, 'Representante'); assert.equal(agreement.firmante.correo, 'store@example.test');
  assert.equal(agreement.firmante.rut, undefined); assert.equal(agreement.firmante.cargo, undefined);
  assert.equal(agreement.usuarioFirmanteId, 'owner'); assert.equal(agreement.estado, 'vigente');
  assert.equal(agreement.aceptadoEn, user.terminosAceptadosEn);
  assert.equal(fixture.get('ferreterias', 'store').contratoEstado, 'vigente');
  const overview = response(); await handle('get')(request({}), overview);
  assert.equal(overview.body.data.acceptanceRequired, false);
  await handle('post')(request(payload), response());
  assert.equal(fixture.rows('contratosFerreteria').length, 1);
});

test('suspended stores cannot reactivate their agreement through onboarding', async t => {
  const fixture = firestoreFixture(t, { ...seed, ferreterias: { store: { ...seed.ferreterias.store, contratoEstado: 'suspendido' } } });
  const res = response(); await handle('post')(request(payload), res);
  assert.equal(res.statusCode, 403); assert.equal(fixture.get('usuarios', 'owner').terminosVersion, undefined);
});

test('auth permits only the onboarding operations before legal acceptance, while catalog and blocked processing remain protected', async t => {
  firestoreFixture(t, seed);
  t.mock.method(adminAuth, 'verifyIdToken', async () => ({ uid: 'owner' }));
  for (const path of ['/api/store-onboarding/current', '/api/store-onboarding/accept', '/api/store-agreement/current', '/api/ferreteria/catalogo']) {
    const res = response(); let allowed = false;
    await requireAuth({ method: path.endsWith('accept') ? 'POST' : 'GET', originalUrl: path, header: name => name.toLowerCase() === 'authorization' ? 'Bearer token' : '' }, res, () => { allowed = true; });
    assert.equal(allowed, !path.includes('catalogo'));
    if (!allowed) assert.equal(res.statusCode, 428);
  }
});

test('the onboarding exception does not bypass a privacy processing block', async t => {
  firestoreFixture(t, { ...seed, usuarios: { owner: { ...seed.usuarios.owner, tratamientoBloqueado: true } } });
  t.mock.method(adminAuth, 'verifyIdToken', async () => ({ uid: 'owner' }));
  const res = response(); let allowed = false;
  await requireAuth({ method: 'POST', originalUrl: '/api/store-onboarding/accept', header: () => 'Bearer token' }, res, () => allowed = true);
  assert.equal(allowed, false); assert.equal(res.statusCode, 423);
});
