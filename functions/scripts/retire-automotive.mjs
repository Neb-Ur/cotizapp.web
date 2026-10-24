import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {retirementMediaKeys,removeRetirementMedia} from './lib/retirement-media.mjs';
import {createHash} from 'node:crypto';
import {cloudAuth,cloudPool,secretValue,projectId,requireApply} from './lib/sql-cloud.mjs';
try{process.loadEnvFile(fileURLToPath(new URL('../.env',import.meta.url)));}catch(error){if(error.code!=='ENOENT')throw error;}
const apply=process.argv.includes('--apply');
const mediaManifest=homedir()+'/.local/share/cotizapp/retirement-media.json';
let mediaKeys=[];
try{mediaKeys=JSON.parse(await readFile(mediaManifest,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(apply)requireApply();
// The old backend writes the tables being dropped. Require the matching release.
if(apply){
 const response=await fetch('https://trovio.cl/api/health',{redirect:'error'});
 const health=await response.json();
 if(!response.ok||health.data?.catalogSchema!=='hardware-only-v1')throw Error('Publica primero el backend hardware-only-v1; todavía no es compatible con este borrado.');
}
const auth=await cloudAuth();
const connection=await cloudPool(auth,'findi_migration',await secretValue(auth,'FINDI_SQL_MIGRATION_PASSWORD'),1);
try {
 const client=await connection.pool.connect();
 try {
  await client.query('SELECT pg_advisory_lock(583728492)');
  const file='023-hardware-only.sql';
  const applied=await client.query('SELECT sha256 FROM public.findi_schema_migrations WHERE version=$1',[file]);
  const sql=await readFile(new URL('../../sql/findi/'+file,import.meta.url),'utf8');
  const sha256=createHash('sha256').update(sql).digest('hex');
  if(applied.rows.length){if(applied.rows[0].sha256!==sha256)throw Error('MIGRATION_CHECKSUM_MISMATCH');console.log('El borrado ya se aplicó.');}
  else {
   const {rows:[counts]}=await client.query("SELECT (SELECT count(*)::int FROM findi.stores WHERE business_type<>'ferreteria') stores,(SELECT count(*)::int FROM findi.products WHERE api_payload->>'categoriaId'='cat-repuestos-automotrices' OR api_payload->>'ambitoComercial'='desarmaduria' OR automotive_identity IS NOT NULL) products,(SELECT count(*)::int FROM findi.donor_vehicles) donorVehicles");
   console.log(JSON.stringify({projectId,apply,counts}));
   if(apply){
    const products=(await client.query('SELECT id,api_payload,automotive_identity,family_id FROM findi.products')).rows;
    const stores=(await client.query("SELECT id FROM findi.stores WHERE business_type<>'ferreteria' OR api_payload->>'tipoNegocio' IN ('repuestos','desarmaduria')")).rows;
    const retiredFamilies=new Set((await client.query("SELECT f.id FROM findi.families f JOIN findi.subcategories s ON s.id=f.subcategory_id WHERE s.category_id='cat-repuestos-automotrices'")).rows.map(f=>f.id));
    const ids=new Set(products.filter(p=>retiredFamilies.has(p.family_id)||p.automotive_identity||p.api_payload?.categoriaId==='cat-repuestos-automotrices'||p.api_payload?.ambitoComercial==='desarmaduria'||p.api_payload?.compatibilidadVehiculos?.length).map(p=>p.id));
    const storeIds=new Set(stores.map(s=>s.id));
    const offers=(await client.query('SELECT product_id,store_id,donor_vehicle_id,api_payload FROM findi.offers')).rows;
    const donors=(await client.query('SELECT api_payload FROM findi.donor_vehicles')).rows.map(r=>r.api_payload);
    const retired=o=>ids.has(o.product_id)||storeIds.has(o.store_id)||o.donor_vehicle_id;
    mediaKeys=[...new Set([...mediaKeys,...retirementMediaKeys(products.filter(p=>ids.has(p.id)).map(p=>p.api_payload),offers.filter(retired).map(o=>o.api_payload),donors,products.filter(p=>!ids.has(p.id)).map(p=>p.api_payload),offers.filter(o=>!retired(o)).map(o=>o.api_payload))])];
    await mkdir(homedir()+'/.local/share/cotizapp',{recursive:true,mode:0o700});
    await writeFile(mediaManifest,JSON.stringify(mediaKeys),{mode:0o600});
    // The migration contains its transaction; place the ledger write before its COMMIT.
    await client.query(sql.replace(/COMMIT;\s*$/,`INSERT INTO public.findi_schema_migrations(version,sha256) VALUES('${file}','${sha256}');\nCOMMIT;`));
    console.log('Datos y tablas retirados. Caché invalidada.');
   }
  }
  if(apply){await removeRetirementMedia(mediaKeys,auth,secretValue);await rm(mediaManifest,{force:true});console.log('Imágenes propias retiradas del almacenamiento.');}
 } finally {await client.query('SELECT pg_advisory_unlock(583728492)');client.release();}
} finally {await connection.close();}
