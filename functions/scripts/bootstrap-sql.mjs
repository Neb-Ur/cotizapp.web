import {readFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {cloudAuth,cloudRequest,secretValue,cloudPool,projectId,instanceId,database,requireApply,waitSqlOperation} from './lib/sql-cloud.mjs';
const migrations=['001-schema.sql','002-public-views.sql','003-security.sql','005-runtime-compatibility.sql','006-sql-connect-inspection.sql','007-complete-console-inspection.sql','008-location-reference-tables.sql','009-complete-location-inspection.sql','010-maintain-location-links.sql'];
async function ensureSecret(auth,name){
 try{return await secretValue(auth,name);}catch(error){if(![404].includes(error.response?.status))throw error;}
 const value=randomBytes(36).toString('base64url');
 await cloudRequest(auth,`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets?secretId=${name}`,'POST',{replication:{automatic:{}}});
 await cloudRequest(auth,`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${name}:addVersion`,'POST',{payload:{data:Buffer.from(value).toString('base64')}});return value;
}
async function main(){
 requireApply();const auth=await cloudAuth();
 const serviceUrl=`https://serviceusage.googleapis.com/v1/projects/${projectId}/services/secretmanager.googleapis.com`;
 const service=await cloudRequest(auth,serviceUrl);
 if(service.state!=='ENABLED'){await cloudRequest(auth,serviceUrl+':enable','POST',{});await new Promise(resolve=>setTimeout(resolve,3000));}
 const sqlRoot=`https://sqladmin.googleapis.com/v1/projects/${projectId}/instances/${instanceId}`;
 const instance=await cloudRequest(auth,sqlRoot);if(instance.state!=='RUNNABLE'||instance.region!=='us-east4')throw new Error('La instancia no está disponible en la región esperada.');
 const ownerPassword=await ensureSecret(auth,'FINDI_SQL_MIGRATION_PASSWORD');
 const runtimePassword=await ensureSecret(auth,'FINDI_SQL_PASSWORD');
 const users=(await cloudRequest(auth,sqlRoot+'/users')).items||[];
 for(const [name,password]of [['findi_migration',ownerPassword],['findi_runtime',runtimePassword]])if(!users.some(u=>u.name===name))await waitSqlOperation(auth,await cloudRequest(auth,sqlRoot+'/users','POST',{name,password,type:'BUILT_IN'}));
 const {pool,close}=await cloudPool(auth,'findi_migration',ownerPassword,1);
 try{
  const client=await pool.connect();try{
   await client.query('SELECT pg_advisory_lock(583728492)');
   await client.query('CREATE TABLE IF NOT EXISTS public.findi_schema_migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
   await client.query('REVOKE ALL ON public.findi_schema_migrations FROM PUBLIC');
   for(const file of migrations){
    const sql=await readFile(new URL('../../sql/findi/'+file,import.meta.url),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
    const current=await client.query('SELECT sha256 FROM public.findi_schema_migrations WHERE version=$1',[file]);
    if(current.rows.length){if(current.rows[0].sha256!==hash)throw new Error('Una migración aplicada cambió: '+file);continue;}
    if(file==='001-schema.sql'){const exists=await client.query("SELECT 1 FROM pg_namespace WHERE nspname='findi'");if(exists.rows.length)throw new Error('El esquema findi ya existe sin registro de migración; revisarlo antes de continuar.');}
    await client.query(sql);await client.query('INSERT INTO public.findi_schema_migrations(version,sha256) VALUES($1,$2)',[file,hash]);console.log('Applied',file);
   }
   await client.query('GRANT findi_backend TO findi_runtime');
   await client.query('REVOKE cloudsqlsuperuser FROM findi_runtime');
   await client.query('ALTER ROLE findi_runtime NOCREATEROLE NOCREATEDB');
   console.log(JSON.stringify({projectId,instanceId,database,tables:(await client.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='findi'")).rows[0].n}));
  }finally{client.release();}
 }finally{await close();}
}
main().catch(error=>{console.error('SQL_BOOTSTRAP_FAILED',error.response?.data?.error?.message||error.code||error.message);process.exitCode=1;});
