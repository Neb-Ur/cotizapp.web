import test from 'node:test';
import assert from 'node:assert/strict';
import { contactRouter } from '../lib/routes/contact.routes.js';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../lib/lib/legal.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';

const handler = contactRouter.stack.find(layer => layer.route?.path === '/solicitudes-contacto' && layer.route.methods.post).route.stack.at(-1).handle;
const required = ['termsAccepted', 'privacyAcknowledged', 'ageConfirmed', 'authorityConfirmed', 'accuracyConfirmed'];
const payload = {
  type: 'Ferreteria', name: 'Persona encargada', email: 'STORE@example.test', businessName: 'Ferretería local',
  message: 'Solicito acceso para mi ferretería.',
  ...Object.fromEntries(required.map(field => [field, true])),
  termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION
};
function response() { return { statusCode: 200, status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;} }; }

test('every store declaration must be explicitly true before any data is stored', async t => {
  const fixture = firestoreFixture(t);
  for (const field of required) {
    for (const value of [undefined, false, 'true']) {
      const res = response();
      await handler({body:{...payload,[field]:value}},res);
      assert.equal(res.statusCode,400);
      assert.equal(res.body.error.code,'CONTACT_LEGAL_ACCEPTANCE_REQUIRED');
      assert.equal(fixture.rows('solicitudesContacto').length,0);
    }
  }
});
test('store submissions with missing or outdated legal versions cannot be recorded', async t => {
  const fixture = firestoreFixture(t);
  for (const field of ['termsVersion','privacyVersion']) {
    for (const value of [undefined,'obsolete']) {
      const res=response();await handler({body:{...payload,[field]:value}},res);
      assert.equal(res.statusCode,409);assert.equal(res.body.error.code,'CONTACT_LEGAL_VERSION_OUTDATED');
      assert.equal(fixture.rows('solicitudesContacto').length,0);
    }
  }
});
test('valid store request saves current versions and server timestamp together without advertising consent or account creation', async t => {
  const fixture=firestoreFixture(t);const res=response();
  await handler({body:{...payload,acceptedAt:'forged',marketingConsent:true}},res);
  assert.equal(res.statusCode,201);
  const request=fixture.rows('solicitudesContacto')[0];
  assert.equal(request.email,'store@example.test');
  for(const field of required)assert.equal(request.legalAcceptance[field],true);
  assert.equal(request.legalAcceptance.termsVersion,CURRENT_TERMS_VERSION);
  assert.equal(request.legalAcceptance.privacyVersion,CURRENT_PRIVACY_VERSION);
  assert.equal(request.legalAcceptance.acceptedAt,request.createdAt);
  assert.ok(!Number.isNaN(Date.parse(request.legalAcceptance.acceptedAt)));
  assert.equal(request.legalAcceptance.source,'store_contact_form');
  assert.equal(request.marketingConsent,undefined);
  assert.equal(fixture.rows('usuarios').length,0);
});
test('ordinary contact inquiries remain available without store declarations', async t => {
  const fixture=firestoreFixture(t);const res=response();
  await handler({body:{type:'Maestro',name:'Persona',email:'person@example.test',message:'Una consulta sobre mis cotizaciones.',privacyAcknowledged:true,privacyVersion:CURRENT_PRIVACY_VERSION}},res);
  assert.equal(res.statusCode,201);assert.equal(fixture.rows('solicitudesContacto')[0].legalAcceptance,undefined);
});
test('honeypot submissions never store contact data or fabricated acceptance', async t => {
  const fixture=firestoreFixture(t);const res=response();
  await handler({body:{type:'Ferreteria',website:'bot.example.test'}},res);
  assert.equal(res.statusCode,201);assert.equal(fixture.rows('solicitudesContacto').length,0);
});

for (const type of ['Maestro', 'Otro', 'Privacidad']) {
  test(`public ${type} inquiry requires current express consent and stores purpose and server time`, async t => {
    const fixture = firestoreFixture(t);
    const body = {type, name:'Persona', email:'person@example.test', message:'Consulta sobre mis datos personales.'};
    for (const value of [undefined, false, 'true']) {
      const res=response(); await handler({body:{...body,privacyAcknowledged:value,privacyVersion:CURRENT_PRIVACY_VERSION}},res);
      assert.equal(res.statusCode,400); assert.equal(fixture.rows('solicitudesContacto').length,0);
    }
    const old=response(); await handler({body:{...body,privacyAcknowledged:true,privacyVersion:'old'}},old);
    assert.equal(old.statusCode,409); assert.equal(fixture.rows('solicitudesContacto').length,0);
    const res=response(); await handler({body:{...body,privacyAcknowledged:true,privacyVersion:CURRENT_PRIVACY_VERSION,acceptedAt:'forged'}},res);
    assert.equal(res.statusCode,201);
    const request=fixture.rows('solicitudesContacto')[0];
    assert.deepEqual(request.privacyConsent,{granted:true,purpose:'contact_request',version:CURRENT_PRIVACY_VERSION,acceptedAt:request.createdAt});
    assert.equal(request.legalAcceptance,undefined);
  });
}
