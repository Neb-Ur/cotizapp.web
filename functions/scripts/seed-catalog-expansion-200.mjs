import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {cloudAuth, cloudPool, secretValue, projectId, requireApply} from './lib/sql-cloud.mjs';
import {planCatalogExpansion, existingExpansionDocuments, missingExpansionDocuments, applyExpansionChunk} from './lib/catalog-expansion-200.mjs';

const seed = JSON.parse(await readFile(new URL('../../docs/catalogo/semilla-expansion-200.json', import.meta.url), 'utf8'));
const apply = process.argv.includes('--apply');
if (apply) requireApply();
const auth = await cloudAuth();
const connection = await cloudPool(auth, apply ? 'findi_runtime' : 'findi_migration', await secretValue(auth, apply ? 'FINDI_SQL_PASSWORD' : 'FINDI_SQL_MIGRATION_PASSWORD'), 1);
try {
  const db = new PostgresDatabase(connection.pool);
  const now = new Date().toISOString();
  const snapshot = await db.withClient(async client => {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      const state = {};
      for (const [key, collection] of [['brands', 'marcas'], ['models', 'modelosVehiculo'], ['families', 'familias'], ['subcategories', 'subcategorias'], ['stores', 'real_ferreterias'], ['users', 'usuarios'], ['products', 'productosMaestro']]) {
        state[key] = (await db.read(client, collection)).docs.map(d => ({id: d.id, ...d.data()}));
      }
      const plan = planCatalogExpansion(seed, state, now);
      const documents = [...plan.prerequisites, ...plan.products, ...plan.offers];
      const existing = await existingExpansionDocuments(client, [...documents, ...plan.updates]);
      const create = missingExpansionDocuments(documents, existing);
      await client.query('COMMIT');
      return {plan, existing, create};
    } catch (error) {await client.query('ROLLBACK'); throw error;}
  });
  const {plan, existing, create} = snapshot;
  console.log(JSON.stringify({projectId, apply, batch: seed.batch, products: plan.products.length, auto: 100, toolsAndConstruction: 100, offers: plan.offers.length, create: create.length, brandUsesToExtend: plan.updates.length, images: seed.products.reduce((n, p) => n + p.images.length, 0)}));
  if (apply) {
    const dir = homedir() + '/.local/share/cotizapp/backups';
    await mkdir(dir, {recursive: true, mode: 0o700});
    const receiptPath = dir + '/catalog-expansion-200-' + Date.now() + '.json';
    const receipt = {projectId, batch: seed.batch, previous: [...existing], planned: plan, completed: []};
    await writeFile(receiptPath, JSON.stringify(receipt), {mode: 0o600, flag: 'wx'});
    const references = await applyExpansionChunk(db, plan.prerequisites, plan.updates);
    receipt.completed.push({references});
    await writeFile(receiptPath, JSON.stringify(receipt), {mode: 0o600});
    console.log(JSON.stringify({referencesApplied: true, ...references}));
    for (let offset = 0; offset < plan.products.length; offset += 20) {
      const products = plan.products.slice(offset, offset + 20);
      const ids = new Set(products.map(p => p.id));
      const offers = plan.offers.filter(o => ids.has(o.data.productoMaestroId));
      const result = await applyExpansionChunk(db, [...products, ...offers]);
      const completed = {productsThrough: offset + products.length, ...result};
      receipt.completed.push(completed);
      await writeFile(receiptPath, JSON.stringify(receipt), {mode: 0o600});
      console.log(JSON.stringify(completed));
    }
    console.log(JSON.stringify({seedApplied: true, products: 200, offers: 400, existingProductsAndOffersOverwritten: false}));
  }
} finally {await connection.close();}
