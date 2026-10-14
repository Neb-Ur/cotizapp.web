import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';import {createHash} from 'node:crypto';
import {cloudAuth,cloudPool,secretValue,projectId,requireApply} from './lib/sql-cloud.mjs';
requireApply();const file='019-product-vehicle-applications.sql';const sql=await readFile(new URL('../../sql/findi/'+file,import.meta.url),'utf8');const hash=createHash('sha256').update(sql).digest('hex');
const auth=await cloudAuth();const connection=await cloudPool(auth,'findi_migration',await secretValue(auth,'FINDI_SQL_MIGRATION_PASSWORD'),1);
const client=await connection.pool.connect();
try{
 await client.query('SELECT pg_advisory_lock(583728492)');
 const existing=(await client.query('SELECT sha256 FROM public.findi_schema_migrations WHERE version=$1',[file])).rows[0];
 if(existing){if(existing.sha256!==hash)throw Error('MIGRATION_HASH_CHANGED');console.log(JSON.stringify({alreadyApplied:true,file}));}
 else{
  const before={};for(const table of ['products','offers','offer_vehicle_applications','brands','brand_uses','vehicle_models','families'])before[table]=(await client.query('SELECT * FROM findi.'+table)).rows;
  const dir=homedir()+'/.local/share/cotizapp/backups';await mkdir(dir,{recursive:true,mode:0o700});await writeFile(dir+'/product-vehicles-schema-'+Date.now()+'.json',JSON.stringify({projectId,file,hash,before}),{mode:0o600,flag:'wx'});
  // Record the migration in the same transaction as the schema change.
  await client.query('BEGIN');await client.query(sql.replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,''));await client.query('INSERT INTO public.findi_schema_migrations(version,sha256) VALUES($1,$2)',[file,hash]);await client.query('COMMIT');
  for(const table of Object.keys(before)){
   const after=(await client.query('SELECT * FROM findi.'+table)).rows;
   const strip=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['part_name','variant_label','automotive_identity'].includes(key)));
   if(JSON.stringify(after.map(strip).sort((a,b)=>String(a.id||JSON.stringify(a)).localeCompare(String(b.id||JSON.stringify(b)))))!==JSON.stringify(before[table].map(strip).sort((a,b)=>String(a.id||JSON.stringify(a)).localeCompare(String(b.id||JSON.stringify(b))))))throw Error('BUSINESS_DATA_CHANGED:'+table);
  }
  console.log(JSON.stringify({applied:file,previousBusinessDataPreserved:true,productApplications:0}));
 }
} catch(error){await client.query('ROLLBACK');throw error;}finally{await client.query('SELECT pg_advisory_unlock(583728492)');client.release();await connection.close();}
