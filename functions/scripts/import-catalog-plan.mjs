import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { Firestore } from '@google-cloud/firestore';
import { buildCatalogDocuments, classifyCatalogDocuments } from './lib/catalog-plan.mjs';

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apply = process.argv.includes('--apply');
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID es obligatorio.');
  if (apply && process.env.CONFIRM_PROJECT_ID !== projectId) throw new Error('CONFIRM_PROJECT_ID debe coincidir con el proyecto.');
  const plan = JSON.parse(await readFile(new URL('../../docs/catalogo/inventario-propuesto.json', import.meta.url), 'utf8'));
  const documents = buildCatalogDocuments(plan, new Date().toISOString());
  let authClient;
  if (process.argv.includes('--firebase-cli-auth')) {
    const config = JSON.parse(await readFile(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'));
    if (!config.tokens?.access_token || config.tokens.expires_at < Date.now() + 60000) throw new Error('La sesión de Firebase CLI necesita renovarse.');
    authClient = new OAuth2Client();
    authClient.setCredentials({ access_token: config.tokens.access_token, expiry_date: config.tokens.expires_at });
  } else authClient = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] }).getClient();
  const db = new Firestore({ projectId, authClient });
  const existing = new Map();
  for (let start = 0; start < documents.length; start += 100) {
    const snapshots = await db.getAll(...documents.slice(start, start + 100).map(doc => db.doc(`${doc.collection}/${doc.id}`)));
    for (const snapshot of snapshots) if (snapshot.exists) existing.set(snapshot.ref.path, snapshot.data());
  }
  const classified = classifyCatalogDocuments(documents, existing);
  const summary = { projectId, mode: apply ? 'apply' : 'dry-run', categories: plan.categories.length, subcategories: plan.subcategories.length,
    families: plan.families.length, baseProducts: plan.productTypes.length, definitions: documents.filter(doc => doc.collection === 'definicionesAtributoFamilia').length,
    create: classified.create.length, skipped: classified.skipped.length, conflicts: classified.conflicts };
  console.log(JSON.stringify(summary, null, 2));
  if (classified.conflicts.length) throw new Error('Conflictos de identidad; no se modificó ningún documento.');
  if (!apply) return;
  const dir = fileURLToPath(new URL('../../tmp/catalog-import/', import.meta.url));
  await mkdir(dir, { recursive: true });
  const receipt = `${dir}/import-${Date.now()}.json`;
  const createdPaths = [];
  await writeFile(receipt, JSON.stringify({ ...summary, createdPaths, plannedPaths: classified.create.map(doc => `${doc.collection}/${doc.id}`) }, null, 2), { mode: 0o600, flag: 'wx' });
  // Atomic create-only batches: never replace existing products, offers or users.
  for (let start = 0; start < classified.create.length; start += 400) {
    const slice = classified.create.slice(start, start + 400);
    const batch = db.batch();
    for (const doc of slice) batch.create(db.doc(`${doc.collection}/${doc.id}`), doc.data);
    await batch.commit();
    createdPaths.push(...slice.map(doc => `${doc.collection}/${doc.id}`));
    await writeFile(receipt, JSON.stringify({ ...summary, createdPaths }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ committed: createdPaths.length, total: classified.create.length }));
  }
  for (let start = 0; start < documents.length; start += 100) {
    const snapshots = await db.getAll(...documents.slice(start, start + 100).map(doc => db.doc(`${doc.collection}/${doc.id}`)));
    if (snapshots.some(snapshot => !snapshot.exists)) throw new Error('La verificación encontró documentos faltantes.');
  }
  console.log(JSON.stringify({ ok: true, verified: true, created: createdPaths.length, receipt }));
}
main().catch(error => { console.error(JSON.stringify({ ok: false, code: error.code, message: error.message })); process.exitCode = 1; });
