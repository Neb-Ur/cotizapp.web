import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchemaMigrations } from '../scripts/lib/schema-migrations.mjs';
import { snapshotSelectedData, applySelectedData, verifySelectedData, hashDtoDocuments } from '../scripts/lib/neon-data-transfer.mjs';

async function database(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  const client = { query: (sql, params) => params ? pg.query(sql, params) : pg.exec(sql).then(results => results.at(-1)) };
  await applySchemaMigrations(client);
  return { pg, client };
}

async function seed(pg) {
  await pg.exec(`
    INSERT INTO findi.database_migration_state(id,status,source_project,manifest) VALUES('firestore-to-sql','active','local-fixture','{"writesPaused":true}');
    INSERT INTO findi.users(id,role,name,email,quotation_limit,api_payload) VALUES('owner','ferreteria','Local','owner@example.test',37,'{"rol":"ferreteria","quotationLimit":2}'),('admin','admin','Admin','admin@example.test',50,'{"rol":"admin"}');
    INSERT INTO findi.categories(id,name,api_payload) VALUES('category','Materiales','{"nombre":"Materiales"}');
    INSERT INTO findi.subcategories(id,category_id,name) VALUES('sub','category','Tableros');
    INSERT INTO findi.families(id,subcategory_id,name) VALUES('family','sub','Madera');
    INSERT INTO findi.products(id,family_id,name,api_payload,created_at) VALUES('product','family','Tablero','{"nombre":"Tablero","valorExacto":9007199254740993.12345}','2026-01-02T03:04:05.123456Z');
    INSERT INTO findi.product_features(product_id,position,text) VALUES('product',0,'Resistente');
    INSERT INTO findi.stores(id,owner_id,business_name,api_payload) VALUES('store','owner','Local','{"nombreComercial":"Local"}');
    INSERT INTO findi.offers(id,store_id,product_id,price,stock,api_payload) VALUES('offer','store','product',9007199254740993.12345,9007199254740993,'{"precio":9007199254740993.12345,"stock":9007199254740993}');
    INSERT INTO findi.ip_reports(id,reference,rights_type,content_type,target_type,target_reference,product_id,offer_id,store_id,content_url,declarations,privacy_consent,status,submitted_at,api_payload)
      VALUES('linked-report','R1','copyright','product_image','store_offer','offer','product','offer','store','https://example.test/asset','{}','{}','repuesto',now(),'{"status":"repuesto"}'),
      ('closed-unrelated','R2','copyright','other','other','other',NULL,NULL,NULL,'https://example.test/other','{}','{}','rechazada',now(),'{"status":"rechazada"}');
    INSERT INTO findi.ip_report_events(id,report_id,position,status,occurred_at,actor_user_id) VALUES('event','linked-report',0,'repuesto',now(),'admin');
    UPDATE findi.products SET ip_report_id='linked-report'; UPDATE findi.stores SET ip_report_id='linked-report'; UPDATE findi.offers SET ip_report_id='linked-report';
    INSERT INTO findi.content_rights(id,source_type,authorization_reference,reviewed_by) VALUES('rights','original','Local authorization','admin');
    INSERT INTO findi.product_content_rights(product_id,rights_id) VALUES('product','rights');
    INSERT INTO findi.media_assets(id,url,origin,rights_id) VALUES('asset','https://example.test/image','original','rights');
    INSERT INTO findi.product_media(product_id,asset_id,position,is_primary) VALUES('product','asset',0,true);
    INSERT INTO findi.legal_documents(kind,version,document_hash,content,is_current) VALUES('store_agreement','v1','hash','{}',true);
    INSERT INTO findi.store_agreements(id,store_id,store_reference,signer_user_id,version,document_hash,status,provider_snapshot,store_snapshot,signer_snapshot,declarations,evidence,accepted_at)
      VALUES('agreement','store','store','owner','v1','hash','vigente','{}','{}','{}','{}','{}',now());
    INSERT INTO findi.consent_events(id,user_id,type,version,granted,source,occurred_at) VALUES('consent','owner','terms','v1',true,'local',now());
    INSERT INTO findi.marketing_suppressions(email_hash,suppressed_at,source,api_payload) VALUES('hash',now(),'local','{"source":"local"}');
    INSERT INTO findi.store_reviews(id,store_id,user_id,author_name,rating,comment,api_payload) VALUES('review','store','admin','Admin',5,'Comentario local','{"rating":5}');
    INSERT INTO findi.product_requests(id,store_id,product_name,request_type,status,api_payload) VALUES('pending','store','Nuevo','nuevo_producto','pendiente','{"estado":"pendiente"}'),('closed','store','Anterior','nuevo_producto','aprobada','{"estado":"aprobada"}');
    INSERT INTO findi.privacy_requests(id,user_id,type,status,submitted_at) VALUES('privacy-open','owner','access','recibida',now()),('privacy-closed','owner','access','completada',now());
    INSERT INTO findi.quotations(id,owner_id,name) VALUES('old-quote','owner','No copiar');
    INSERT INTO findi.quotation_items(id,quotation_id,position,product_id,product_name_snapshot,quantity) VALUES('old-item','old-quote',0,'product','Tablero',1);
    INSERT INTO findi.offer_history(id,offer_reference,store_reference,product_reference,action,source,includes_vat,occurred_at) VALUES('history','offer','store','product','price_change','local',true,now());
  `);
}

test('selected transfer preserves exact typed data and FK closure while omitting quotations and history', async t => {
  const source = await database(t), target = await database(t);
  await seed(source.pg);
  const snapshot = await snapshotSelectedData(source.client);
  assert.equal(snapshot.excludedSource.quotations, 1);
  assert.equal(snapshot.excludedSource.offer_history, 1);
  assert.equal(snapshot.tables.ip_reports.sourceCount, 2);
  assert.equal(snapshot.tables.ip_reports.count, 1);
  assert.equal(snapshot.tables.ip_report_events.count, 1);
  assert.equal(snapshot.tables.product_requests.count, 1);
  assert.equal(snapshot.tables.privacy_requests.count, 1);
  assert.equal(snapshot.dtoManifest.usuarios.sha256, hashDtoDocuments([{ id: 'owner', data: { rol: 'ferreteria', quotationLimit: 37 } }, { id: 'admin', data: { rol: 'admin', quotationLimit: 50 } }]));
  assert.match(snapshot.tables.offers.rows[0].json, /9007199254740993\.12345/);
  assert.match(snapshot.tables.products.rows[0].json, /03:04:05\.123456/);
  const report = await applySelectedData(target.client, snapshot);
  assert.equal(report.verified, true);
  assert.equal(report.excluded.quotations, 0);
  assert.equal(report.excluded.offer_history, 0);
  assert.equal((await verifySelectedData(target.client, snapshot)).verified, true);
  assert.deepEqual((await target.pg.query('SELECT price::text,stock::text,ip_report_id FROM findi.offers')).rows[0], { price: '9007199254740993.12345', stock: '9007199254740993', ip_report_id: 'linked-report' });
  assert.equal((await source.pg.query('SELECT count(*)::int AS count FROM findi.quotations')).rows[0].count, 1);
  assert.equal((await target.pg.query('SELECT count(*)::int AS count FROM findi.database_migration_state')).rows[0].count, 0);
  await assert.rejects(applySelectedData(target.client, snapshot), /TARGET_NOT_EMPTY/);
  await target.pg.exec('UPDATE findi.offers SET price=1');
  await assert.rejects(verifySelectedData(target.client, snapshot), /TARGET_MISMATCH/);
});

test('partial insert errors roll back all data and source hash mismatches prevent snapshot creation', async t => {
  const source = await database(t), target = await database(t);
  await seed(source.pg);
  const snapshot = await snapshotSelectedData(source.client);
  await target.pg.exec('ALTER TABLE findi.offers ADD CONSTRAINT fixture_rejection CHECK(stock=0)');
  await assert.rejects(applySelectedData(target.client, snapshot), /fixture_rejection/);
  assert.equal((await target.pg.query('SELECT count(*)::int AS count FROM findi.users')).rows[0].count, 0);
  assert.equal((await target.pg.query('SELECT count(*)::int AS count FROM findi.products')).rows[0].count, 0);
  const damaged = structuredClone(snapshot);
  damaged.tables.users.rows[0].json += ' ';
  await assert.rejects(applySelectedData(target.client, damaged), /SNAPSHOT_HASH_MISMATCH/);
  await source.pg.exec("UPDATE public.findi_schema_migrations SET sha256='changed' WHERE version='001-schema.sql'");
  await assert.rejects(snapshotSelectedData(source.client), /SOURCE_HASH_MISMATCH/);
  assert.equal((await source.pg.query('SELECT count(*)::int AS count FROM findi.users')).rows[0].count, 2);
});

test('an unexpected selected-data reference into an excluded quotation table blocks the snapshot', async t => {
  const source = await database(t);
  await seed(source.pg);
  await source.pg.exec("ALTER TABLE findi.users ADD COLUMN local_quote_reference text REFERENCES findi.quotations(id); UPDATE findi.users SET local_quote_reference='old-quote' WHERE id='owner'");
  await assert.rejects(snapshotSelectedData(source.client), /TRANSFER_EXCLUDED_PARENT/);
  assert.equal((await source.pg.query('SELECT count(*)::int AS count FROM findi.quotations')).rows[0].count, 1);
});
