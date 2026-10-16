import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {cloudAuth,cloudPool,secretValue,requireApply,projectId} from './lib/sql-cloud.mjs';
const sharedFamilies=['fam-llaves-alicates-y-destornilladores','fam-organizacion-y-transporte-de-herramientas'];
const apply=process.argv.includes('--apply');if(apply)requireApply();
try{
 const auth=await cloudAuth();const c=await cloudPool(auth,'findi_runtime',await secretValue(auth,'FINDI_SQL_PASSWORD'),1);
 try{
  const before=(await c.pool.query("SELECT id,family_id,api_payload FROM findi.products WHERE NOT(api_payload ? 'ambitoComercial') ORDER BY id")).rows;
  const plan=before.map(p=>({id:p.id,familyId:p.family_id,categoryId:p.api_payload.categoriaId||null,scope:p.api_payload.categoriaId==='cat-repuestos-automotrices'?'desarmaduria':sharedFamilies.includes(p.family_id)?'ambos':'ferreteria'}));
  const counts=Object.fromEntries(['ferreteria','desarmaduria','ambos'].map(scope=>[scope,plan.filter(p=>p.scope===scope).length]));
  if(!apply){console.log(JSON.stringify({projectId,apply,products:plan.length,counts,sharedFamilies}));}
  else{
   const dir=homedir()+'/.local/share/cotizapp/backups';await mkdir(dir,{recursive:true,mode:0o700});const backup=dir+'/product-business-scope-'+Date.now()+'.json';await writeFile(backup,JSON.stringify({projectId,before,plan}),{mode:0o600,flag:'wx'});
   const client=await c.pool.connect();try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(574628194)');
    const result=await client.query(`UPDATE findi.products p SET api_payload=p.api_payload||jsonb_build_object('ambitoComercial',v.scope,'actualizadoEn',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),updated_at=now()
      FROM jsonb_to_recordset($1::jsonb) AS v(id text,"familyId" text,"categoryId" text,scope text)
      WHERE p.id=v.id AND NOT(p.api_payload ? 'ambitoComercial') AND p.family_id IS NOT DISTINCT FROM v."familyId" AND p.api_payload->>'categoriaId' IS NOT DISTINCT FROM v."categoryId" RETURNING p.id,p.api_payload->>'ambitoComercial' AS scope`,[JSON.stringify(plan)]);
    if(result.rowCount){
     await client.query("UPDATE findi.catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope IN ('static','offers')");
     await client.query("INSERT INTO findi.public_cache_artifacts(key,scope,version,payload,schema_version,updated_at) VALUES('meta','offers','',jsonb_build_object('dirty',true,'generation',1),1,now()) ON CONFLICT(key) DO UPDATE SET payload=findi.public_cache_artifacts.payload || jsonb_build_object('dirty',true,'generation',COALESCE((findi.public_cache_artifacts.payload->>'generation')::bigint,0)+1),updated_at=now()");
     await client.query("INSERT INTO findi.public_cache_artifacts(key,scope,version,payload,schema_version,updated_at) SELECT 'catalog-revision','static','',jsonb_build_object('revision',revision),1,now() FROM findi.catalog_revisions WHERE scope='static' ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()");
    }
    await client.query('COMMIT');console.log(JSON.stringify({projectId,apply,classified:result.rowCount,concurrentChangesSkipped:plan.length-result.rowCount,counts,backup}));
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
 }finally{await c.close();}
}catch(e){console.error('PRODUCT_SCOPE_CLASSIFICATION_FAILED',e.code||e.message?.slice(0,180));process.exitCode=1;}
