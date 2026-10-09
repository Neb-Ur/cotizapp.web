import {cloudAuth,cloudPool,secretValue,requireApply} from './lib/sql-cloud.mjs';
async function main(){requireApply();const auth=await cloudAuth(),{pool,close}=await cloudPool(auth,'findi_runtime',await secretValue(auth,'FINDI_SQL_PASSWORD'),1);
 try{const client=await pool.connect();try{await client.query('BEGIN');
 const stores=await client.query("UPDATE findi.stores SET business_name=replace(business_name,'Findi','Trovio'),api_payload=jsonb_set(api_payload,'{nombreComercial}',to_jsonb(replace(business_name,'Findi','Trovio'))),updated_at=now() WHERE api_payload->>'lotePrueba'='findi-pilot-2026-10' AND api_payload->>'esPrueba'='true' AND business_name LIKE 'Findi %' RETURNING id");
 const owners=await client.query("UPDATE findi.users SET name=replace(name,'Findi','Trovio'),api_payload=jsonb_set(api_payload,'{nombre}',to_jsonb(replace(name,'Findi','Trovio'))),updated_at=now() WHERE api_payload->>'lotePrueba'='findi-pilot-2026-10' AND api_payload->>'esPrueba'='true' AND name LIKE 'Findi %'");
 if(stores.rowCount){await client.query("UPDATE findi.catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope='offers'");await client.query("UPDATE findi.public_cache_artifacts SET payload=payload || jsonb_build_object('dirty',true,'generation',coalesce((payload->>'generation')::bigint,0)+1),updated_at=now() WHERE key='meta'");}
 await client.query('COMMIT');console.log(JSON.stringify({storesRenamed:stores.rowCount,ownersRenamed:owners.rowCount,pricesPreserved:true}));
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}finally{await close();}}
main().catch(e=>{console.error('PILOT_REBRAND_FAILED',e.code||'ERROR');process.exitCode=1;});
