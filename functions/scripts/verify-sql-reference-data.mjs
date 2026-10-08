import assert from 'node:assert/strict';
import {cloudAuth,cloudPool,secretValue} from './lib/sql-cloud.mjs';
const auth=await cloudAuth();const {pool,close}=await cloudPool(auth,'findi_runtime',await secretValue(auth,'FINDI_SQL_PASSWORD'),1);
try {
 for(const [table,n]of Object.entries({countries:1,regions:16,provinces:56,communes:346,cities:17,city_communes:122}))assert.equal((await pool.query(`SELECT count(*)::int n FROM findi.${table}`)).rows[0].n,n,table);
 assert.equal((await pool.query('SELECT count(*)::int n FROM findi.communes c JOIN findi.provinces p ON p.code=c.province_code JOIN findi.regions r ON r.code=p.region_code WHERE left(c.code,3)<>p.code OR left(p.code,2)<>r.code')).rows[0].n,0);
 const missing=(await pool.query("SELECT count(*)::int n FROM findi.products p LEFT JOIN findi.catalog_search_documents d ON d.product_id=p.id WHERE p.status='activo' AND p.deleted_at IS NULL AND (d.product_id IS NULL OR d.normalized_text='')")).rows[0].n;assert.equal(missing,0);
 const missingSeo=(await pool.query("SELECT count(*)::int n FROM findi.products p LEFT JOIN findi.seo_routes s ON s.product_id=p.id AND s.is_canonical AND s.active WHERE p.status='activo' AND p.deleted_at IS NULL AND s.path IS NULL")).rows[0].n;assert.equal(missingSeo,0);
 assert.equal((await pool.query("SELECT count(*)::int n FROM findi.legal_documents WHERE is_current AND kind IN ('terms','privacy_notice','store_agreement')")).rows[0].n,3);
 const client=await pool.connect();try {
  await client.query('BEGIN');const uid=(await client.query('SELECT id FROM findi.users ORDER BY id LIMIT 1')).rows[0].id;
  await client.query("UPDATE findi.users SET city='Santiago',commune='Ñuñoa',region='' WHERE id=$1",[uid]);
  const match=(await client.query('SELECT c.name,a.region_code FROM findi.account_locations a JOIN findi.communes c ON c.code=a.commune_code WHERE a.user_id=$1',[uid])).rows[0];assert.equal(match.name,'Ñuñoa');assert.equal(match.region_code,'13');
  await client.query("UPDATE findi.users SET city='',commune='',region='' WHERE id=$1",[uid]);assert.equal((await client.query('SELECT count(*)::int n FROM findi.account_locations WHERE user_id=$1',[uid])).rows[0].n,0);
  await client.query('ROLLBACK');
 }finally{await client.query('ROLLBACK');client.release();}
 console.log(JSON.stringify({verified:true,regions:16,provinces:56,communes:346,cityGroups:17,searchCoverage:'complete',seoCoverage:'complete',locationChanges:'synchronized, tests rolled back'}));
}finally{await close();}
