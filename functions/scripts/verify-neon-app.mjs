#!/usr/bin/env node
/**
 * Local HTTP + real PostgreSQL QA on the named disposable Neon branch only.
 * Firebase ID-token verification is stubbed here; Firebase Authentication login,
 * revocation and token issuance are NOT exercised. No Auth users are created.
 * This script does not load dotenv files and never accepts a remote HTTP origin.
 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mock } from 'node:test';

const QA_BRANCH = 'migration-validation-20261031';
const RUN_ID = `qa-neon-http-${randomUUID()}`;
const categoryNames = [`${RUN_ID}-category`, `${RUN_ID}-category-updated`];
const quotationName = `${RUN_ID}-quotation`;
let domain = 'guard';
let pool;
let server;
let request;
let database;
let collections;
let identities;
let storeOffer;
let offerNeedsRestore = false;
let categoryId;
let quotationId;
let cleanupFailed = false;
let allDomainsPassed = false;

function check(condition, code) {
  if (!condition) throw Object.assign(new Error(code), { code });
}
function pass(name) { console.log(`PASS ${name}`); }
function safeCode(error) {
  const code = error?.code;
  return typeof code === 'string' && /^(?:QA_[A-Z_]+|[0-9A-Z]{5})$/.test(code) ? code : 'QA_CHECK_FAILED';
}
function assertQaEnvironment() {
  check(process.env.NEON_BRANCH === QA_BRANCH, 'QA_BRANCH_REQUIRED');
  check(process.env.NODE_ENV !== 'production' && !process.env.K_SERVICE && !process.env.FUNCTION_TARGET, 'QA_PRODUCTION_FORBIDDEN');
  check(process.env.SQL_PROVIDER === 'neon', 'QA_NEON_PROVIDER_REQUIRED');
  check(process.env.SQL_SCHEMA_VARIANT === 'compact', 'QA_COMPACT_SCHEMA_REQUIRED');
  check(process.env.USE_SQL_DATABASE === 'true', 'QA_SQL_REQUIRED');
  check(typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim(), 'QA_DATABASE_URL_REQUIRED');
  check(process.argv.length === 2, 'QA_NO_ARGUMENTS_ALLOWED');
}
function selected(values, variable) {
  const requested = process.env[variable];
  if (!requested) return values[0];
  const found = values.find(value => value.id === requested);
  check(found, 'QA_SELECTED_ID_NOT_ELIGIBLE');
  return found;
}
async function verifyRuntimePrivileges() {
  const result = await pool.query(`SELECT
    r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
    has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
    EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%'
      AND n.nspname <> 'information_schema' AND has_schema_privilege(current_user,n.oid,'CREATE')) AS schema_create,
    EXISTS(SELECT 1 FROM pg_roles elevated WHERE elevated.rolname IN ('neon_superuser','cloudsqlsuperuser')
      AND pg_has_role(r.oid,elevated.oid,'MEMBER')) AS elevated_membership
    FROM pg_roles r WHERE r.rolname=current_user`);
  const privileges = result.rows[0];
  check(privileges && Object.values(privileges).every(value => value === false), 'QA_RUNTIME_ROLE_TOO_PRIVILEGED');
  const state = await pool.query("SELECT status,manifest FROM findi.app_state WHERE id='baseline'");
  check(state.rows[0]?.status === 'ready', 'QA_COMPACT_BASELINE_NOT_READY');
  check(state.rows[0]?.manifest?.targetProject === 'crimson-credit-77789114'
    && state.rows[0]?.manifest?.branch === QA_BRANCH, 'QA_DATABASE_BRANCH_MISMATCH');
  pass('runtime-role-no-create-no-superuser');
}
async function readCollection(name) {
  return (await database.collection(name).get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
}
async function selectExistingQaRecords(hasCurrentLegalAcceptance, activeStoreAgreement, buildSearchRows) {
  const users = (await readCollection(collections.users)).filter(user => user.estadoCuenta === 'activo'
    && user.tratamientoBloqueado !== true && (!user.dataMode || user.dataMode === 'real')
    && hasCurrentLegalAcceptance(user)).sort((a, b) => a.id.localeCompare(b.id));
  const admin = selected(users.filter(user => user.rol === 'admin'), 'NEON_QA_ADMIN_UID');
  const maestro = selected(users.filter(user => user.rol === 'maestro'), 'NEON_QA_MAESTRO_UID');
  check(admin && maestro, 'QA_EXISTING_LEGAL_USERS_REQUIRED');
  const owners = users.filter(user => user.rol === 'ferreteria');
  const requestedOwner = process.env.NEON_QA_STORE_OWNER_UID;
  const ownerIds = new Set(owners.filter(user => !requestedOwner || user.id === requestedOwner).map(user => user.id));
  const stores = (await readCollection(collections.stores)).filter(store => ownerIds.has(store.usuarioDuenoId)
    && (!process.env.NEON_QA_STORE_ID || store.id === process.env.NEON_QA_STORE_ID));
  const byStore = new Map(stores.map(store => [store.id, store]));
  const offers = (await buildSearchRows()).filter(offer => offer.comparisonEligible === true
    && Number.isFinite(offer.price) && offer.price > 0 && Number.isSafeInteger(offer.stock) && offer.stock >= 2
    && byStore.has(offer.storeId) && (!process.env.NEON_QA_OFFER_ID || offer.productoFerreteriaId === process.env.NEON_QA_OFFER_ID))
    .sort((a, b) => a.productoFerreteriaId.localeCompare(b.productoFerreteriaId));
  for (const offer of offers) {
    if (!await activeStoreAgreement(offer.storeId)) continue;
    const original = (await database.collection(collections.storeProducts).doc(offer.productoFerreteriaId).get()).data();
    if (!original || original.incluyeIva === false) continue;
    const store = byStore.get(offer.storeId);
    const owner = owners.find(user => user.id === store.usuarioDuenoId);
    return { admin, maestro, owner, store, offer, original };
  }
  throw Object.assign(new Error('QA_EXISTING_OWNED_OFFER_REQUIRED'), { code: 'QA_EXISTING_OWNED_OFFER_REQUIRED' });
}
async function startLocalApi(api, adminAuth) {
  const tokens = new Map(['admin', 'maestro', 'ferreteria'].map(role => [role, `${RUN_ID}-${role}`]));
  const owners = new Map([
    [tokens.get('admin'), identities.admin.id],
    [tokens.get('maestro'), identities.maestro.id],
    [tokens.get('ferreteria'), identities.owner.id]
  ]);
  mock.method(adminAuth, 'verifyIdToken', async (token, checkRevoked) => {
    check(checkRevoked === true && owners.has(token), 'QA_UNKNOWN_TEST_TOKEN');
    return { uid: owners.get(token), sub: owners.get(token), auth_time: Math.floor(Date.now() / 1000),
      firebase: { sign_in_provider: 'custom', sign_in_second_factor: 'totp' } };
  });
  server = createServer(api);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  check(address && typeof address === 'object' && address.address === '127.0.0.1', 'QA_LOCALHOST_BIND_REQUIRED');
  const origin = `http://127.0.0.1:${address.port}`;
  request = async (method, path, role, body, expected = 200) => {
    check(path.startsWith('/api/') && !path.includes('://'), 'QA_LOCAL_API_PATH_REQUIRED');
    const response = await fetch(origin + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(60_000),
      headers: { ...(role ? { Authorization: `Bearer ${tokens.get(role)}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const payload = await response.json();
    check(response.status === expected, 'QA_HTTP_STATUS_MISMATCH');
    check(payload.ok === (expected < 400), 'QA_HTTP_ENVELOPE_INVALID');
    return expected < 400 ? payload.data : payload.error;
  };
}
async function verifyCatalog() {
  const index = await request('GET', '/api/catalogo-busqueda');
  check(Array.isArray(index.products) && index.products.some(product => product.id === identities.offer.productoMaestroId), 'QA_CATALOG_PRODUCT_MISSING');
  const query = new URLSearchParams({ query: identities.offer.productName, ferreteriaId: identities.store.id });
  const results = await request('GET', `/api/busqueda?${query}`);
  check(Array.isArray(results) && results.some(offer => offer.productoFerreteriaId === identities.offer.productoFerreteriaId), 'QA_SEARCH_OFFER_MISSING');
  const paginated = await request('GET', `/api/busqueda?${new URLSearchParams({ query: identities.offer.productName, vista: 'productos', page: '1', size: '20' })}`);
  check(Array.isArray(paginated.items) && paginated.total > 0, 'QA_SEARCH_PAGE_EMPTY');
  const indexedProduct = index.products.find(product => product.id === identities.offer.productoMaestroId);
  identities.productSlug = indexedProduct.path.split('/').at(-1);
  check(identities.productSlug, 'QA_PRODUCT_SLUG_REQUIRED');
  const detail = await request('GET', `/api/productos/detalle?${new URLSearchParams({ slug: identities.productSlug })}`);
  check(detail.productoMaestro?.id === identities.offer.productoMaestroId, 'QA_PRODUCT_DETAIL_MISMATCH');
  check(detail.stores.some(offer => offer.productoFerreteriaId === identities.offer.productoFerreteriaId), 'QA_PRODUCT_DETAIL_OFFER_MISSING');
  pass('catalog-search-product-detail');
}
async function verifyRoleBoundaries() {
  const users = await request('GET', '/api/admin/usuarios', 'admin');
  check(Array.isArray(users) && users.some(user => user.id === identities.admin.id), 'QA_ADMIN_USERS_MISSING');
  const storePath = `/api/ferreterias/${encodeURIComponent(identities.store.id)}/catalogo`;
  const catalog = await request('GET', storePath, 'ferreteria');
  check(Array.isArray(catalog) && catalog.some(offer => offer.id === identities.offer.productoFerreteriaId), 'QA_OWNED_CATALOG_MISSING');
  await request('GET', '/api/admin/usuarios', undefined, undefined, 401);
  await request('GET', '/api/admin/usuarios', 'maestro', undefined, 403);
  await request('GET', '/api/admin/usuarios', 'ferreteria', undefined, 403);
  await request('GET', storePath, 'maestro', undefined, 403);
  const ownerPath = `/api/maestros/${encodeURIComponent(identities.maestro.id)}/proyectos`;
  await request('GET', ownerPath, 'ferreteria', undefined, 403);
  await request('GET', `/api/maestros/${encodeURIComponent(RUN_ID)}/proyectos`, 'maestro', undefined, 403);
  await request('POST', '/api/categorias', 'maestro', { nombre: categoryNames[0] }, 403);
  await request('POST', ownerPath, undefined, { nombre: quotationName, items: [] }, 401);
  pass('admin-store-owner-and-denied-role-boundaries');
}
async function verifyTaxonomyCrud() {
  const created = await request('POST', '/api/categorias', 'admin', { nombre: categoryNames[0], icono: 'box' }, 201);
  check(typeof created.id === 'string', 'QA_CATEGORY_ID_MISSING');
  categoryId = created.id;
  let categories = await request('GET', '/api/categorias');
  check(categories.some(category => category.id === categoryId && category.nombre === categoryNames[0]), 'QA_CATEGORY_CREATE_NOT_PERSISTED');
  const updated = await request('PATCH', `/api/categorias/${encodeURIComponent(categoryId)}`, 'admin', { nombre: categoryNames[1], icono: 'wrench' });
  check(updated.id === categoryId && updated.nombre === categoryNames[1], 'QA_CATEGORY_UPDATE_NOT_PERSISTED');
  await request('DELETE', `/api/categorias/${encodeURIComponent(categoryId)}`, 'admin');
  categories = await request('GET', '/api/categorias');
  check(!categories.some(category => category.id === categoryId), 'QA_CATEGORY_DELETE_NOT_PERSISTED');
  categoryId = undefined;
  pass('taxonomy-create-read-update-delete');
}
async function verifyQuotationCrud() {
  const path = `/api/maestros/${encodeURIComponent(identities.maestro.id)}/proyectos`;
  const item = { productName: identities.offer.productName, productoMaestroId: identities.offer.productoMaestroId,
    productoFerreteriaId: identities.offer.productoFerreteriaId, storeId: identities.store.id,
    storeName: identities.offer.storeName, quantity: 1 };
  const created = await request('POST', path, 'maestro', { nombre: quotationName, items: [item], descripcion: `${RUN_ID}-create` }, 201);
  check(typeof created.id === 'string', 'QA_QUOTATION_ID_MISSING');
  quotationId = created.id;
  check(created.verificationCode && created.totalOptimal > 0 && created.items?.[0]?.quantity === 1, 'QA_QUOTATION_CREATE_INVALID');
  const detailPath = `${path}/${encodeURIComponent(quotationId)}`;
  const read = await request('GET', detailPath, 'maestro');
  check(read.id === quotationId && read.name === quotationName, 'QA_QUOTATION_READ_MISMATCH');
  const updated = await request('PUT', detailPath, 'maestro', { nombre: quotationName,
    items: [{ ...item, quantity: 2 }], descripcion: `${RUN_ID}-updated` });
  check(updated.items?.[0]?.quantity === 2 && updated.totalOptimal === created.totalOptimal * 2, 'QA_QUOTATION_UPDATE_INVALID');
  const persisted = await request('GET', detailPath, 'maestro');
  check(persisted.items?.[0]?.quantity === 2 && persisted.description === `${RUN_ID}-updated`, 'QA_QUOTATION_UPDATE_NOT_PERSISTED');
  await request('GET', detailPath, 'ferreteria', undefined, 403);
  await request('DELETE', detailPath, 'maestro');
  await request('GET', detailPath, 'maestro', undefined, 404);
  quotationId = undefined;
  pass('maestro-quotation-create-read-update-delete');
}
async function verifyStorePriceStock() {
  storeOffer = { storeId: identities.store.id, offerId: identities.offer.productoFerreteriaId,
    price: Number(identities.original.precio), stock: Number(identities.original.stock) };
  const path = `/api/ferreterias/${encodeURIComponent(storeOffer.storeId)}/catalogo/${encodeURIComponent(storeOffer.offerId)}`;
  const changes = { precio: storeOffer.price + 1, stock: storeOffer.stock - 1 };
  // Register restoration before sending, including the case where HTTP times out after commit.
  offerNeedsRestore = true;
  const updated = await request('PATCH', path, 'ferreteria', changes);
  check(updated.precio === changes.precio && updated.stock === changes.stock, 'QA_OFFER_PATCH_INVALID');
  let stored = (await database.collection(collections.storeProducts).doc(storeOffer.offerId).get()).data();
  check(Number(stored?.precio) === changes.precio && Number(stored?.stock) === changes.stock, 'QA_OFFER_PATCH_NOT_PERSISTED');
  let publicDetail = await request('GET', `/api/productos/detalle?${new URLSearchParams({ slug: identities.productSlug, vista: 'ofertas' })}`);
  let publicOffer = publicDetail.stores.find(offer => offer.productoFerreteriaId === storeOffer.offerId);
  check(publicOffer?.price === changes.precio && publicOffer?.stock === changes.stock, 'QA_PUBLIC_OFFER_PATCH_NOT_VISIBLE');
  await restoreOffer();
  stored = (await database.collection(collections.storeProducts).doc(storeOffer.offerId).get()).data();
  check(Number(stored?.precio) === storeOffer.price && Number(stored?.stock) === storeOffer.stock, 'QA_OFFER_RESTORE_NOT_PERSISTED');
  publicDetail = await request('GET', `/api/productos/detalle?${new URLSearchParams({ slug: identities.productSlug, vista: 'ofertas' })}`);
  publicOffer = publicDetail.stores.find(offer => offer.productoFerreteriaId === storeOffer.offerId);
  check(publicOffer?.price === storeOffer.price && publicOffer?.stock === storeOffer.stock, 'QA_PUBLIC_OFFER_RESTORE_NOT_VISIBLE');
  pass('store-price-stock-patch-and-restore');
}
async function restoreOffer() {
  if (!offerNeedsRestore || !request || !storeOffer) return;
  const path = `/api/ferreterias/${encodeURIComponent(storeOffer.storeId)}/catalogo/${encodeURIComponent(storeOffer.offerId)}`;
  const restored = await request('PATCH', path, 'ferreteria', { precio: storeOffer.price, stock: storeOffer.stock });
  check(Number(restored.precio) === storeOffer.price && Number(restored.stock) === storeOffer.stock, 'QA_OFFER_RESTORE_INVALID');
  offerNeedsRestore = false;
}
async function cleanup() {
  const tasks = [
    ['offer-restore', restoreOffer],
    ['quotation-delete', async () => {
      if (!database || !request || !identities) return;
      const candidates = await database.collection(collections.projects).where('ownerId', '==', identities.maestro.id).where('name', '==', quotationName).get();
      for (const doc of candidates.docs) await request('DELETE', `/api/maestros/${encodeURIComponent(identities.maestro.id)}/proyectos/${encodeURIComponent(doc.id)}`, 'maestro');
      quotationId = undefined;
    }],
    ['category-delete', async () => {
      if (!database || !request) return;
      for (const name of categoryNames) {
        const candidates = await database.collection(collections.categories).where('nombre', '==', name).get();
        for (const doc of candidates.docs) await request('DELETE', `/api/categorias/${encodeURIComponent(doc.id)}`, 'admin');
      }
      categoryId = undefined;
    }]
  ];
  for (const [name, work] of tasks) {
    try { await work(); } catch (error) { cleanupFailed = true; console.error(`FAIL cleanup-${name} ${safeCode(error)}`); }
  }
  if (server?.listening) {
    await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
  }
  mock.restoreAll();
  if (pool) await pool.end();
}

try {
  assertQaEnvironment();
  console.log('LIMITATION Firebase Authentication verification is stubbed locally; real login, issuance and revocation are not tested.');
  const config = await import('../lib/database/config.js');
  const connections = await import('../lib/database/pool.js');
  const { neonPoolOptions } = await import('../lib/database/neon-connection.js');
  const parsed = neonPoolOptions(process.env.DATABASE_URL);
  check(parsed.ssl?.rejectUnauthorized === true && parsed.host?.includes('-pooler'), 'QA_VERIFIED_POOLED_CONNECTION_REQUIRED');
  check(config.sqlProvider() === 'neon' && config.sqlSchemaVariant() === 'compact' && config.useSqlDatabase(), 'QA_RUNTIME_CONFIG_MISMATCH');
  check(connections.databaseSecrets().map(secret => secret.name).join(',') === 'DATABASE_URL', 'QA_DATABASE_SECRET_BINDING_INVALID');
  pool = await connections.sqlPool();
  domain = 'runtime-role';
  await verifyRuntimePrivileges();
  const firebase = await import('../lib/lib/firebase.js');
  check(firebase.db.constructor.name === 'PostgresDatabase', 'QA_REAL_POSTGRES_ADAPTER_REQUIRED');
  database = firebase.db;
  collections = (await import('../lib/lib/collections.js')).COLLECTIONS;
  const { hasCurrentLegalAcceptance } = await import('../lib/services/consent.service.js');
  const { activeStoreAgreement } = await import('../lib/services/store-agreement.service.js');
  const { buildSearchRows } = await import('../lib/services/catalog-search.service.js');
  domain = 'qa-fixture-selection';
  identities = await selectExistingQaRecords(hasCurrentLegalAcceptance, activeStoreAgreement, buildSearchRows);
  const { api } = await import('../lib/index.js');
  await startLocalApi(api, firebase.adminAuth);
  domain = 'config';
  const publicConfig = await request('GET', '/api/config');
  check(publicConfig.database?.provider === 'neon' && publicConfig.database.schemaVariant === 'compact'
    && publicConfig.database.writesManaged === true, 'QA_HTTP_DATABASE_CONFIG_MISMATCH');
  pass('config-neon-compact-real-postgres');
  domain = 'catalog'; await verifyCatalog();
  domain = 'roles'; await verifyRoleBoundaries();
  domain = 'taxonomy'; await verifyTaxonomyCrud();
  domain = 'maestro'; await verifyQuotationCrud();
  domain = 'store'; await verifyStorePriceStock();
  allDomainsPassed = true;
} catch (error) {
  process.exitCode = 1;
  console.error(`FAIL ${domain} ${safeCode(error)}`);
} finally {
  try { await cleanup(); } catch (error) { cleanupFailed = true; console.error(`FAIL cleanup ${safeCode(error)}`); }
  if (cleanupFailed) process.exitCode = 1;
  else if (allDomainsPassed) pass('all-application-domains-local-http-real-postgres-cleaned');
}
