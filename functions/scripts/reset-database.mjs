import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { OAuth2Client } from 'google-auth-library';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

process.on('uncaughtException', error => {
  console.error(JSON.stringify({ ok: false, code: error.code, message: error.message }));
  process.exit(1);
});

const projectId = process.env.FIREBASE_PROJECT_ID;
const apply = process.argv.includes('--apply');
const keep = process.env.KEEP_ADMIN || 'rubenbenavidessilva';
if (!projectId) throw new Error('FIREBASE_PROJECT_ID es obligatorio.');
if (apply && process.env.CONFIRM_PROJECT_ID !== projectId) throw new Error('CONFIRM_PROJECT_ID debe coincidir con el proyecto.');
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('No usar emuladores para esta limpieza.');
let credential = applicationDefault();
let authClient;
if (process.argv.includes('--firebase-cli-auth')) {
  const config = JSON.parse(await readFile(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'));
  const tokens = config.tokens;
  if (!tokens?.access_token || tokens.expires_at < Date.now() + 300000) throw new Error('La sesión de Firebase CLI debe estar vigente durante al menos cinco minutos.');
  authClient = new OAuth2Client();
  authClient.setCredentials({ access_token: tokens.access_token, expiry_date: tokens.expires_at });
  credential = { getAccessToken: async () => ({ access_token: tokens.access_token, expires_in: Math.floor((tokens.expires_at - Date.now()) / 1000) }) };
}
const app = initializeApp({ credential, projectId });
const auth = getAuth(app);
const db = authClient ? new Firestore({ projectId, authClient }) : getFirestore(app);
async function users() {
  const result = [];
  let token;
  do {
    const page = await auth.listUsers(1000, token);
    result.push(...page.users);
    token = page.pageToken;
  } while (token);
  return result;
}
const accounts = await users();
const matches = accounts.filter(user => user.uid === keep || user.email?.toLowerCase() === keep.toLowerCase()
  || user.email?.split('@')[0].toLowerCase() === keep.toLowerCase());
if (matches.length !== 1) throw new Error(`Se esperaba un único administrador ${keep}; encontrados: ${matches.length}. No se borró nada.`);
const admin = matches[0];
const adminRef = db.collection('usuarios').doc(admin.uid);
const profile = (await adminRef.get()).data();
if (profile?.rol !== 'admin' || profile.estadoCuenta === 'bloqueado' || admin.disabled) throw new Error('La cuenta a conservar no es un administrador activo. No se borró nada.');
const collections = await db.listCollections();
// Remove derived caches after the source data, including invalidations queued by triggers.
collections.sort((a, b) => Number(a.id.includes('cachePublico')) - Number(b.id.includes('cachePublico')));
const inventory = [];
for (const collection of collections) {
  const documents = await collection.listDocuments();
  inventory.push({ collection: collection.id, roots: documents.length, deleteRoots: documents.filter(ref => ref.path !== adminRef.path).length });
}
const storage = authClient ? new Storage({ projectId, authClient }) : getStorage(app);
const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || `${projectId}-catalog-assets`);
const [files] = await bucket.getFiles();
console.log(JSON.stringify({ projectId, mode: apply ? 'apply' : 'dry-run', keep: { uid: admin.uid, email: admin.email, role: profile.rol }, deleteAccounts: accounts.length - 1, collections: inventory, bucket: bucket.name, deleteFiles: files.length }, null, 2));
if (!apply) process.exit(0);

// Block other accounts and revoke their sessions before removing their data.
for (const user of accounts.filter(user => user.uid !== admin.uid)) {
  await auth.updateUser(user.uid, { disabled: true });
  await auth.revokeRefreshTokens(user.uid);
}
for (const collection of collections) {
  if (collection.id !== 'usuarios') {
    await db.recursiveDelete(collection);
  } else {
    for (const ref of await collection.listDocuments()) {
      if (ref.path !== adminRef.path) await db.recursiveDelete(ref);
    }
  }
  console.log(`Limpieza completada: ${collection.id}`);
}
for (const subcollection of await adminRef.listCollections()) await db.recursiveDelete(subcollection);
for (const file of files) {
  if (authClient) {
    await authClient.request({
      url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(file.name)}`,
      method: 'DELETE'
    });
  } else await file.delete({ ignoreNotFound: true });
}
for (let start = 0; start < accounts.length; start += 1000) {
  const ids = accounts.slice(start, start + 1000).filter(user => user.uid !== admin.uid).map(user => user.uid);
  if (!ids.length) continue;
  const result = await auth.deleteUsers(ids);
  if (result.failureCount) throw new Error(`No se pudieron borrar ${result.failureCount} cuentas.`);
}
const remainingUsers = await users();
if (remainingUsers.length !== 1 || remainingUsers[0].uid !== admin.uid) throw new Error('La verificación de Authentication falló.');
for (const collection of await db.listCollections()) {
  const refs = await collection.listDocuments();
  if (refs.some(ref => ref.path !== adminRef.path)) throw new Error(`Quedan datos en ${collection.id}.`);
}
if (!(await adminRef.get()).exists || (await adminRef.listCollections()).length) throw new Error('La verificación del perfil administrador falló.');
if ((await bucket.getFiles())[0].length) throw new Error('Quedan archivos en Storage.');
console.log(JSON.stringify({ ok: true, verified: true, remainingAuthUsers: 1, remainingFirestoreDocuments: 1, remainingStorageFiles: 0, adminEmail: admin.email }));
