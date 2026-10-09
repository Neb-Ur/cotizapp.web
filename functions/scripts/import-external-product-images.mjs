import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {cloudAuth,cloudPool,secretValue,requireApply,projectId} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
const root=new URL('../../',import.meta.url);
async function main(){
 requireApply();const manifest=JSON.parse(await readFile(new URL('docs/catalogo/imagenes-externas-tanda-01.json',root),'utf8'));
 const auth=await cloudAuth();const {pool,close}=await cloudPool(auth,'findi_runtime',await secretValue(auth,'FINDI_SQL_PASSWORD'),2);
 try {
  const db=new PostgresDatabase(pool,true);const matches=[];
  for(const image of manifest.images){
   const found=await pool.query('SELECT id,api_payload FROM findi.products WHERE name=$1 AND deleted_at IS NULL',[image.name]);
   if(found.rows.length!==1)throw Error('Coincidencia de producto ausente o ambigua: '+image.name);
   const row=found.rows[0];if(row.api_payload.imagenStorageUrl||row.api_payload.imagenPrincipalUrl){console.log('Preserved existing image',row.id);continue;}
   const response=await fetch(image.url,{signal:AbortSignal.timeout(20000)});if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('Imagen dejó de estar disponible: '+row.id);await response.arrayBuffer();
   matches.push({id:row.id,before:row.api_payload,image});
  }
  await mkdir(new URL('tmp/sql-migration/',root),{recursive:true});await writeFile(new URL('tmp/sql-migration/image-backup-'+Date.now()+'.json',root),JSON.stringify({projectId,products:matches.map(({id,before})=>({id,before}))}),{mode:0o600,flag:'wx'});
  await db.runTransaction(async tx=>{
   const docs=[];for(const item of matches)docs.push(await tx.get(db.collection('productosMaestro').doc(item.id)));
   for(const [i,item]of matches.entries()){
    if(!docs[i].exists||docs[i].data()?.imagenPrincipalUrl)throw Error('La imagen cambió durante la carga; no se sobrescribe.');
    tx.update(db.collection('productosMaestro').doc(item.id),{imagenPrincipalUrl:item.image.url,imagenExternaUrl:item.image.url,origenImagen:'external_url',proveedorImagen:new URL(item.image.sourceUrl).hostname,fuenteImagenUrl:item.image.sourceUrl,imagenVerificadaEn:new Date().toISOString(),actualizadoEn:new Date().toISOString()});
   }
  });
  const counts=(await pool.query('SELECT (SELECT count(*)::int FROM findi.media_assets) assets,(SELECT count(*)::int FROM findi.product_media) associations')).rows[0];
  console.log(JSON.stringify({imported:matches.length,...counts,source:'external HTTPS URLs, no Storage downloads or uploads'}));
 }finally{await close();}
}
main().catch(error=>{console.error('IMAGE_IMPORT_FAILED',error.code||error.message);process.exitCode=1;});
