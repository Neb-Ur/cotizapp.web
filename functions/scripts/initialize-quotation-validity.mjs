import {mkdir,writeFile} from 'node:fs/promises';
import {cloudAuth,cloudPool,secretValue,requireApply} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {buildSearchRows} from '../lib/services/catalog-search.service.js';
import {captureQuotationPricing} from '../lib/domain/quotation-validity.js';
async function main(){
 requireApply();const auth=await cloudAuth(),{pool,close}=await cloudPool(auth,'findi_runtime',await secretValue(auth,'FINDI_SQL_PASSWORD'),2);
 try{
  const quotes=(await pool.query('SELECT id,api_payload FROM findi.quotations')).rows.filter(q=>!Array.isArray(q.api_payload.pricingOffers));
  if(!quotes.length){console.log(JSON.stringify({initialized:0,preserved:true}));return;}
  const tables=['offers','products','stores','users','categories','subcategories','families'];
  const sources=await Promise.all(tables.map(async table=>(await pool.query(`SELECT id,api_payload FROM findi.${table}${table==='products'?' WHERE deleted_at IS NULL':''}`)).rows.map(r=>({id:r.id,...r.api_payload}))));
  const offers=await buildSearchRows(sources);
  await mkdir('tmp/sql-migration',{recursive:true});await writeFile(`tmp/sql-migration/quotation-validity-${Date.now()}.json`,JSON.stringify(quotes),{mode:0o600,flag:'wx'});
  const db=new PostgresDatabase(pool,true),capturedAt=Date.now();let initialized=0;
  for(const q of quotes){const ref=db.collection('real_proyectos').doc(q.id);
   await db.runTransaction(async tx=>{const snapshot=await tx.get(ref);const latest=snapshot.data();if(!snapshot.exists||Array.isArray(latest.pricingOffers))return;tx.update(ref,captureQuotationPricing(latest,undefined,offers,capturedAt));initialized++;});
  }
  console.log(JSON.stringify({initialized,validityDays:10,existingSnapshotsPreserved:true}));
 }finally{await close();}
}
main().catch(e=>{console.error('QUOTATION_VALIDITY_MIGRATION_FAILED',e.code||'ERROR');process.exitCode=1;});
