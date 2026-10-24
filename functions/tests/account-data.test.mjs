import test from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth } from '../lib/lib/firebase.js';
import { exportAccountData, deleteAccountData } from '../lib/services/account-data.service.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const seed = {
 usuarios: { owner: { email: 'victim@example.test' } },
 proyectos: { own: { ownerId: 'owner' }, other: { ownerId: 'other' } },
 solicitudesContacto: { guest: { email: 'victim@example.test' }, own: { usuarioId: 'owner', email: 'other@example.test' } },
 denunciasPropiedadIntelectual: { guest: { claimant: { email: 'victim@example.test' } } },
 reclamosPrecios: { guest: { email: 'victim@example.test' }, blank: { email: null } }
};
test('unverified email cannot export or delete another person’s guest records', async t => {
 const fixture = firestoreFixture(t, seed);
 t.mock.method(adminAuth, 'getUser', async () => ({ email: 'victim@example.test', emailVerified: false }));
 const result = await exportAccountData('owner', 'victim@example.test');
 assert.equal(result.emailLinkedRecordsIncluded, false);
 assert.deepEqual(result.projects.map(row => row.id), ['own']);
 assert.deepEqual(result.contactRequests.map(row => row.id), ['own']);
 assert.equal(result.intellectualPropertyReports.length, 0);
 assert.equal(result.priceReports.length, 0);
 await deleteAccountData('owner', 'victim@example.test', false);
 assert.ok(fixture.get('solicitudesContacto', 'guest'));
 assert.equal(fixture.get('denunciasPropiedadIntelectual', 'guest').claimant.email, 'victim@example.test');
 assert.equal(fixture.get('reclamosPrecios', 'guest').email, 'victim@example.test');
 assert.ok(fixture.get('proyectos', 'other'));
 assert.equal(fixture.get('proyectos', 'own'), undefined);
});
test('verified email includes guest records only for the verified address', async t => {
 firestoreFixture(t, seed);
 t.mock.method(adminAuth, 'getUser', async () => ({ email: 'victim@example.test', emailVerified: true }));
 const result = await exportAccountData('owner', 'VICTIM@example.test');
 assert.equal(result.emailLinkedRecordsIncluded, true);
 assert.equal(result.intellectualPropertyReports.length, 1);
 assert.equal(result.priceReports.length, 1);
 const mismatched = await exportAccountData('owner', 'different@example.test');
 assert.equal(mismatched.emailLinkedRecordsIncluded, false);
 assert.equal(mismatched.priceReports.length, 0);
});
test('authentication service outages fail closed instead of declaring deletion complete', async t => {
 const fixture = firestoreFixture(t, seed);
 t.mock.method(adminAuth, 'getUser', async () => { throw new Error('Auth unavailable'); });
 await assert.rejects(deleteAccountData('owner', 'victim@example.test'), /Auth unavailable/);
 assert.ok(fixture.get('usuarios', 'owner'));
 assert.equal(fixture.rows('comprobantesEliminacion').length, 0);
});
test('failed authentication deletion never records successful completion', async t => {
 const fixture = firestoreFixture(t, seed);
 t.mock.method(adminAuth, 'getUser', async () => ({ emailVerified: false }));
 t.mock.method(adminAuth, 'deleteUser', async () => { throw new Error('Delete unavailable'); });
 await assert.rejects(deleteAccountData('owner', 'victim@example.test'), /Delete unavailable/);
 assert.equal(fixture.rows('comprobantesEliminacion').length, 0);
});


test('exports only authored reviews and deletes them without deleting other maestros opinions', async t=>{
 const fixture=firestoreFixture(t,{...seed,resenasFerreteria:{own:{userId:'owner',storeId:'s',rating:5},other:{userId:'other',storeId:'s',rating:4}}});
 t.mock.method(adminAuth,'getUser',async()=>({emailVerified:false}));
 const exported=await exportAccountData('owner','');
 assert.deepEqual(exported.storeReviews.map(review=>review.id),['own']);
 const counts=await deleteAccountData('owner','',false);
 assert.equal(counts.storeReviews,1);assert.equal(fixture.get('resenasFerreteria','own'),undefined);
 assert.ok(fixture.get('resenasFerreteria','other'));
});
