import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {cloudAuth,cloudPool,secretValue,requireApply} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
const names=['Trovio Norte (Prueba)','Trovio Sur (Prueba)','Trovio Centro (Prueba)','Trovio Construcción (Prueba)'];
const batchId='findi-pilot-2026-10';
const hash=value=>createHash('sha256').update(value).digest().readUInt32BE(0);
function basePrice(name){
 const rules=[[/cemento/i,4800],[/sierra|taladro|esmeril/i,85000],[/tablero|mdf|osb|terciado/i,19500],[/pintura|esmalte|latex/i,21000],[/ladrillo|bloque de hormig/i,850],[/tornillo|tuerca|arandela|clavo/i,1900],[/casco|guante|mascarilla/i,5900],[/tubo|cañería|perfil/i,7800],[/puerta|ventana/i,85000],[/grifer|lavamanos|inodoro/i,43000],[/silicona|sellador|adhesivo/i,5300]];
 return rules.find(([pattern])=>pattern.test(name))?.[1] || 4500+hash(name)%25000;
}
async function main(){
 requireApply(); const deactivate=process.argv.includes('--deactivate');
 const auth=await cloudAuth(),{pool,close}=await cloudPool(auth,'findi_runtime',await secretValue(auth,'FINDI_SQL_PASSWORD'),2);
 try{
 const db=new PostgresDatabase(pool,true),now=new Date().toISOString();
 const products=(await pool.query("SELECT id,name,api_payload FROM findi.products WHERE deleted_at IS NULL AND coalesce(api_payload->>'estado','activo')<>'inactivo' ORDER BY id")).rows;
 const before=(await pool.query("SELECT 'store' AS kind,id,api_payload FROM findi.stores WHERE api_payload->>'lotePrueba'=$1 UNION ALL SELECT 'offer',id,api_payload FROM findi.offers WHERE api_payload->>'lotePrueba'=$1",[batchId])).rows;
 await mkdir('tmp/sql-migration',{recursive:true});await writeFile(`tmp/sql-migration/pilot-backup-${Date.now()}.json`,JSON.stringify(before),{mode:0o600,flag:'wx'});
 if(deactivate){
  const client=await pool.connect();try{
   await client.query('BEGIN');
   await client.query("UPDATE findi.stores SET status='inactivo',updated_at=now(),api_payload=api_payload || jsonb_build_object('estado','inactivo','actualizadoEn',$2::text) WHERE api_payload->>'lotePrueba'=$1",[batchId,now]);
   await client.query("UPDATE findi.users SET account_status='inactivo',updated_at=now(),api_payload=api_payload || jsonb_build_object('estadoCuenta','inactivo','actualizadoEn',$2::text) WHERE api_payload->>'lotePrueba'=$1",[batchId,now]);
   await client.query("UPDATE findi.offers SET active=false,published=false,updated_at=now(),api_payload=api_payload || jsonb_build_object('activo',false,'publicado',false,'actualizadoEn',$2::text) WHERE api_payload->>'lotePrueba'=$1",[batchId,now]);
   await client.query("UPDATE findi.catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope='offers'");
   await client.query("UPDATE findi.public_cache_artifacts SET payload=payload || jsonb_build_object('dirty',true,'generation',coalesce((payload->>'generation')::bigint,0)+1),updated_at=now() WHERE key='meta'");
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  console.log(JSON.stringify({deactivatedStores:before.filter(r=>r.kind==='store').length,deactivatedOffers:before.filter(r=>r.kind==='offer').length}));return;
 }
 const occupied=await pool.query("SELECT id,api_payload FROM findi.users WHERE id LIKE 'pilot-owner-%' UNION ALL SELECT id,api_payload FROM findi.stores WHERE id LIKE 'pilot-store-%'");
 if(occupied.rows.some(r=>r.api_payload?.lotePrueba!==batchId))throw Error('PILOT_IDS_OCCUPIED');
 for(let n=0;n<names.length;n++){
  const storeId=`pilot-store-${n+1}`,ownerId=`pilot-owner-${n+1}`;
  const profile={rol:'ferreteria',nombre:names[n],correo:`pilot-${n+1}@example.invalid`,telefono:'',direccion:'',region:'',ciudad:'',comuna:'',estadoCuenta:'activo',creadoEn:now,esPrueba:true,lotePrueba:batchId,marketingConsent:false};
  const store={usuarioDuenoId:ownerId,nombreComercial:names[n],razonSocial:'Entidad ficticia para pruebas Trovio',rut:null,direccion:'',region:'',ciudad:'',comuna:'',latitud:null,longitud:null,correoContactoPublico:'',telefonoContactoPublico:'',estado:'activo',contratoEstado:'pendiente',esPrueba:true,lotePrueba:batchId,creadoEn:now,actualizadoEn:now,catalogoActualizadoEn:now};
  if(!before.some(r=>r.kind==='store'&&r.id===storeId)){const init=db.batch();init.set(db.collection('usuarios').doc(ownerId),profile);init.set(db.collection('real_ferreterias').doc(storeId),store);await init.commit();}
  const entries=products.map(p=>{
    const h=hash(p.id),variation=0.82+((h+n*7)%29)/100;
    const price=Math.max(100,Math.round(basePrice(p.name)*variation/10)*10);
    return {id:`pilot-${n+1}-${p.id}`,payload:{ferreteriaId:storeId,productoMaestroId:p.id,skuFerreteria:`PRUEBA-${n+1}-${h}`,precio:price,stock:(h+n*13)%19===0?0:20+(h+n*17)%181,incluyeIva:true,activo:true,publicado:true,patrocinado:false,esPrueba:true,lotePrueba:batchId,condicionesOferta:'SOLO PRUEBA. Ferretería ficticia; precio y stock simulados. No disponible para compra ni retiro.',vigenteDesde:now,vigenteHasta:null,creadoEn:now,actualizadoEn:now}};
  });
  const client=await pool.connect();try{
    await client.query('BEGIN');
    await client.query(`INSERT INTO findi.offers(id,store_id,product_id,store_sku,price,stock,includes_vat,active,published,sponsored,conditions,valid_from,created_at,updated_at,api_payload)
      SELECT id,payload->>'ferreteriaId',payload->>'productoMaestroId',payload->>'skuFerreteria',(payload->>'precio')::numeric,(payload->>'stock')::bigint,true,true,true,false,payload->>'condicionesOferta',(payload->>'vigenteDesde')::timestamptz,(payload->>'creadoEn')::timestamptz,(payload->>'actualizadoEn')::timestamptz,payload
      FROM jsonb_to_recordset($1::jsonb) AS x(id text,payload jsonb) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(entries)]);
    await client.query("UPDATE findi.catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope='offers'");
    await client.query("UPDATE findi.public_cache_artifacts SET payload=payload || jsonb_build_object('dirty',true,'generation',coalesce((payload->>'generation')::bigint,0)+1),updated_at=now() WHERE key='meta'");
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  console.log(JSON.stringify({storeId,name:names[n],offers:products.length}));
 }
 console.log(JSON.stringify({stores:4,offers:products.length*4,synthetic:true}));
 }finally{await close();}
}
main().catch(e=>{console.error('PILOT_SEED_FAILED', e.message?.startsWith('SQL_REQUIRED_FIELDS:') ? e.message : e.code||(/^[A-Z_]+$/.test(e.message)?e.message:'ERROR'));process.exitCode=1;});
