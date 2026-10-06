import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { OAuth2Client, GoogleAuth } from 'google-auth-library';
import { Firestore } from '@google-cloud/firestore';

async function main() {
 const projectId=process.env.FIREBASE_PROJECT_ID, apply=process.argv.includes('--apply');
 if(!projectId || (apply && process.env.CONFIRM_PROJECT_ID!==projectId)) throw new Error('Indica el proyecto y confirma el destino para aplicar.');
 let authClient;
 if(process.argv.includes('--firebase-cli-auth')){
  const config=JSON.parse(await readFile(`${homedir()}/.config/configstore/firebase-tools.json`,'utf8'));
  if(!config.tokens?.access_token || config.tokens.expires_at<Date.now()+60000) throw new Error('Renueva la sesión de Firebase CLI.');
  authClient=new OAuth2Client();authClient.setCredentials({access_token:config.tokens.access_token,expiry_date:config.tokens.expires_at});
 }else authClient=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/datastore']}).getClient();
 const db=new Firestore({projectId,authClient});
 const plan=JSON.parse(await readFile(new URL('../../docs/catalogo/inventario-propuesto.json',import.meta.url),'utf8'));
 const targets=[];
 for(let offset=0;offset<plan.productTypes.length;offset+=100){
  const snapshots=await db.getAll(...plan.productTypes.slice(offset,offset+100).map(item=>db.doc(`productosMaestro/base-${item.id}`)));
  for(const snapshot of snapshots){
   if(!snapshot.exists) throw new Error(`Falta una ficha base: ${snapshot.id}`);
   if(snapshot.data().catalogoNivel==='tipo_base' && snapshot.data().estado==='inactivo') targets.push(snapshot);
  }
 }
 console.log(JSON.stringify({projectId,mode:apply?'apply':'dry-run',activate:targets.length}));
 if(!apply)return;
 const dir=new URL('../../tmp/catalog-import/',import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL(`activation-${Date.now()}.json`,dir),JSON.stringify({projectId,paths:targets.map(doc=>doc.ref.path),previousState:'inactivo'},null,2),{mode:0o600,flag:'wx'});
 for(let offset=0;offset<targets.length;offset+=400){
  const batch=db.batch();for(const doc of targets.slice(offset,offset+400))batch.update(doc.ref,{estado:'activo',actualizadoEn:new Date().toISOString()},{lastUpdateTime:doc.updateTime});
  await batch.commit();
 }
 // Refresh public catalog even when a deployment has no event triggers yet.
 await db.doc('real_cachePublico/meta').set({dirty:true},{merge:true});
 const all=await db.collection('productosMaestro').get();
 const bases=all.docs.filter(doc=>doc.data().catalogoNivel==='tipo_base' && doc.data().estado==='activo');
 console.log(JSON.stringify({ok:true,activeBases:bases.length,withoutImages:bases.filter(doc=>!doc.data().imagenPrincipalUrl && !doc.data().galeriaJson?.length).length}));
}
main().catch(error=>{console.error(JSON.stringify({ok:false,message:error.message,code:error.code}));process.exitCode=1;});
