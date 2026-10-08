import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {GoogleAuth,OAuth2Client} from 'google-auth-library';
import {Firestore} from '@google-cloud/firestore';
import {buildCommercialDocuments,classifyCommercialDocuments} from './lib/commercial-catalog.mjs';
async function main(){
 const projectId=process.env.FIREBASE_PROJECT_ID,apply=process.argv.includes('--apply');
 if(!projectId || (apply && process.env.CONFIRM_PROJECT_ID!==projectId))throw new Error('FIREBASE_PROJECT_ID y CONFIRM_PROJECT_ID deben coincidir para aplicar.');
 const batch=JSON.parse(await readFile(new URL('../../docs/catalogo/productos-comerciales-tanda-01.json',import.meta.url),'utf8'));
 const plan=JSON.parse(await readFile(new URL('../../docs/catalogo/inventario-propuesto.json',import.meta.url),'utf8'));
 const documents=buildCommercialDocuments(batch,plan,new Date().toISOString());
 let authClient;
 if(process.argv.includes('--firebase-cli-auth')){
  const config=JSON.parse(await readFile(`${homedir()}/.config/configstore/firebase-tools.json`,'utf8'));
  if(!config.tokens?.access_token || config.tokens.expires_at<Date.now()+60000)throw new Error('Renueva la sesión Firebase CLI.');
  authClient=new OAuth2Client();authClient.setCredentials({access_token:config.tokens.access_token,expiry_date:config.tokens.expires_at});
 }else authClient=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/datastore']}).getClient();
 const db=new Firestore({projectId,authClient});
 const families=[...new Set(batch.products.map(p=>p.familyId))];
 const references=[...documents.map(doc=>db.doc(`${doc.collection}/${doc.id}`)),...families.map(id=>db.doc(`familias/${id}`))];
 const typeRefs=families.map(id=>db.doc(`definicionesAtributoFamilia/${id}--tipo_producto`));
 const snapshots=await db.getAll(...references,...typeRefs);
 const existing=new Map(snapshots.filter(doc=>doc.exists).map(doc=>[doc.ref.path,doc.data()]));
 for(const product of documents.filter(d=>d.collection==='productosMaestro')){
  const family=existing.get(`familias/${product.data.familiaId}`);
  if(!family || family.subcategoriaId!==product.data.subcategoriaId)throw new Error('Jerarquía de Firebase no coincide con el plan.');
 }
 const typeOptions=new Map(families.map(id=>[id,[...new Set(batch.products.filter(p=>p.familyId===id).map(p=>p.productType))]]));
 for(const ref of typeRefs)if(!existing.has(ref.path))throw new Error(`Falta definición: ${ref.path}`);
 const classified=classifyCommercialDocuments(documents,existing);
 const summary={projectId,apply,products:batch.products.length,brands:batch.brands.length,create:classified.create.length,skipped:classified.skipped.length,conflicts:classified.conflicts};
 if(classified.conflicts.length)throw new Error('Conflictos de identidad; no se modificó Firebase.');
 console.log(JSON.stringify(summary));if(!apply)return;
 await mkdir(new URL('../../tmp/catalog-import/',import.meta.url),{recursive:true});
 const receipt=new URL(`../../tmp/catalog-import/commercial-${Date.now()}.json`,import.meta.url);
 await writeFile(receipt,JSON.stringify({...summary,status:'planned',plannedPaths:classified.create.map(doc=>`${doc.collection}/${doc.id}`)},null,2),{mode:0o600,flag:'wx'});
 const created=await db.runTransaction(async transaction=>{
  const current=await transaction.getAll(...documents.map(doc=>db.doc(`${doc.collection}/${doc.id}`)),...typeRefs);
  const table=new Map(current.filter(doc=>doc.exists).map(doc=>[doc.ref.path,doc.data()]));
  const checked=classifyCommercialDocuments(documents,table);
  if(checked.conflicts.length)throw new Error('Conflicto concurrente; se canceló la importación.');
  for(const doc of checked.create)transaction.create(db.doc(`${doc.collection}/${doc.id}`),doc.data);
  for(const ref of typeRefs){
   const definition=table.get(ref.path);
   const previous=definition.opcionesJson || [];
   const options=[...new Set([...previous,...typeOptions.get(definition.familiaId)])];
   if(options.length!==previous.length)transaction.update(ref,{opcionesJson:options});
  }
  return checked.create.map(doc=>`${doc.collection}/${doc.id}`);
 });
 const verified=await db.getAll(...documents.map(doc=>db.doc(`${doc.collection}/${doc.id}`)));
 if(verified.some(doc=>!doc.exists))throw new Error('Verificación de registros incompleta.');
 await writeFile(receipt,JSON.stringify({...summary,status:'verified',createdPaths:created},null,2),{mode:0o600});
 console.log(JSON.stringify({ok:true,verified:verified.length,created:created.length,receipt:receipt.pathname}));
}
main().catch(error=>{console.error(JSON.stringify({ok:false,message:error.message}));process.exitCode=1});
