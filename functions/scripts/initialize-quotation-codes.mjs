import {mkdir,writeFile} from 'node:fs/promises';
import {cloudAuth,cloudPool,secretValue,requireApply} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {verificationSnapshot,newVerificationCode} from '../lib/services/quotation-verification.service.js';
async function main(){
 requireApply();const auth=await cloudAuth(),{pool,close}=await cloudPool(auth,'findi_runtime',await secretValue(auth,'FINDI_SQL_PASSWORD'),2);
 try{
  const quotes=(await pool.query('SELECT id,api_payload FROM findi.quotations')).rows.filter(q=>!q.api_payload.verificationCode);
  if(!quotes.length){console.log(JSON.stringify({initialized:0,preserved:true}));return;}
  if(quotes.some(q=>!Array.isArray(q.api_payload.pricingOffers)))throw Error('INITIALIZE_QUOTATION_PRICING_FIRST');
  await mkdir('tmp/sql-migration',{recursive:true});await writeFile(`tmp/sql-migration/quotation-codes-${Date.now()}.json`,JSON.stringify(quotes),{mode:0o600,flag:'wx'});
  const db=new PostgresDatabase(pool,true);let initialized=0;
  for(const q of quotes){const ref=db.collection('real_proyectos').doc(q.id),code=newVerificationCode();
   await db.runTransaction(async tx=>{const snapshot=await tx.get(ref);const latest=snapshot.data();if(!snapshot.exists||latest.verificationCode)return;
    tx.update(ref,{verificationCode:code});tx.create(db.collection('real_cotizacionesVerificables').doc(code),verificationSnapshot({...latest,id:q.id},code));initialized++;
   });
  }
  const counts=(await pool.query('SELECT count(*)::int AS total FROM findi.quotation_verifications')).rows[0];
  console.log(JSON.stringify({initialized,verificationRecords:counts.total,existingPricesPreserved:true}));
 }finally{await close();}
}
main().catch(e=>{console.error('QUOTATION_CODES_MIGRATION_FAILED',e.code||(/^[A-Z_]+$/.test(e.message)?e.message:'ERROR'));process.exitCode=1;});
