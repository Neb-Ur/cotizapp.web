import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {cloudAuth, cloudPool, secretValue, projectId, requireApply} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {buildKuv100CatalogSeed, missingKuv100SeedDocuments} from './lib/kuv100-catalog-seed.mjs';

const seed = JSON.parse(await readFile(new URL('../../docs/catalogo/semilla-kuv100-ampliada.json', import.meta.url), 'utf8'));
const apply = process.argv.includes('--apply');
if (apply) requireApply();
const auth = await cloudAuth();
const connection = await cloudPool(auth, apply ? 'findi_runtime' : 'findi_migration', await secretValue(auth, apply ? 'FINDI_SQL_PASSWORD' : 'FINDI_SQL_MIGRATION_PASSWORD'), 1);
try {
  const db = new PostgresDatabase(connection.pool);
  const now = new Date().toISOString();
  async function plan(get) {
    const read = async c => (await get(db.collection(c))).docs.map(d => ({id: d.id, ...d.data()}));
    const brands = await read('marcas');
    const models = await read('modelosVehiculo');
    for (const [collection, id] of [['categorias', 'cat-repuestos-automotrices'], ['subcategorias', 'sub-repuestos-motor-y-electricidad'], ['subcategorias', 'sub-repuestos-frenos-y-suspension']]) {
      if (!(await get(db.collection(collection).doc(id))).exists) throw Error('KUV_TAXONOMY_REQUIRED:' + id);
    }
    const documents = buildKuv100CatalogSeed(seed, brands, models, now);
    const existing = new Map();
    for (const d of documents) {
      const old = (await get(db.collection(d.collection).doc(d.id))).data();
      if (old) existing.set(d.collection + '/' + d.id, old);
    }
    return {documents, existing, create: missingKuv100SeedDocuments(documents, existing)};
  }
  const preview = await plan(ref => ref.get());
  console.log(JSON.stringify({projectId, apply, batch: seed.batch, create: preview.create.length, existing: preview.existing.size, products: seed.products.length, images: seed.products.reduce((n, p) => n + p.images.length, 0), stores: seed.stores.length, offers: preview.documents.filter(d => d.collection === 'real_productosFerreteria').length}));
  if (apply) {
    const dir = homedir() + '/.local/share/cotizapp/backups';
    await mkdir(dir, {recursive: true, mode: 0o700});
    await writeFile(dir + '/kuv100-catalog-' + Date.now() + '.json', JSON.stringify({projectId, batch: seed.batch, previous: [...preview.existing], planned: preview.documents}, null, 2), {mode: 0o600, flag: 'wx'});
    await db.runTransaction(async tx => {
      const current = await plan(ref => tx.get(ref));
      for (const d of current.create) tx.create(db.collection(d.collection).doc(d.id), d.data);
    });
    console.log(JSON.stringify({seedApplied: true, created: preview.create.length, noExistingRecordsOverwritten: true}));
  }
} finally {
  await connection.close();
}
