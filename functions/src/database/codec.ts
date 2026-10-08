import mappings from './source-mapping.json' with {type:'json'};
import columns from './table-columns.json' with {type:'json'};
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Data } from './port.js';
import {CURRENT_STORE_AGREEMENT_VERSION,STORE_AGREEMENT_PROVIDER,STORE_AGREEMENT_CLAUSES} from '../lib/legal.js';
export type SqlClient = Pick<PoolClient,'query'>;
export const mappingByCollection = new Map(Object.entries(mappings).map(([key,value])=>[value.sourceCollection,{key,...value}]));
export const quote = (name: string) => '"'+name.replaceAll('"','""')+'"';
export const tableColumns = (table: string) => columns.filter(col=>col.table_name===table);
export function mappingFor(collection: string) {
 const mapping=mappingByCollection.get(collection);
 if(!mapping) throw new Error('SQL_COLLECTION_NOT_SUPPORTED:'+collection);
 return mapping;
}
export function primaryKey(table:string,id:string,data:Data):Data {
 if(table==='marketing_suppressions')return {email_hash:id};
 if(table==='store_event_counters')return {store_id:id};
 if(table==='store_daily_analytics')return {store_id:id,local_date:String(data.computedAt).slice(0,10)};
 if(table==='job_runs')return {job_name:id,local_date:data.attemptDate};
 if(table==='public_cache_artifacts')return {key:id};
 return {id};
}
export async function upsert(client:SqlClient,table:string,values:Data,keys:string[]) {
 const cols=Object.keys(values), params=cols.map(c=>values[c]);
 const updates=cols.filter(c=>!keys.includes(c)).map(c=>`${quote(c)}=EXCLUDED.${quote(c)}`);
 await client.query(`INSERT INTO findi.${quote(table)} (${cols.map(quote).join(',')}) VALUES (${cols.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT (${keys.map(quote).join(',')}) DO ${updates.length?'UPDATE SET '+updates.join(','):'NOTHING'}`,params);
}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const get=(data:Data,path:string)=>path.split('.').reduce((v,k)=>v?.[k],data);
async function resolved(client:SqlClient,table:string,id:any):Promise<string|null>{if(!id)return null;const rows=await client.query(`SELECT id FROM findi.${quote(table)} WHERE id=$1`,[id]);return rows.rows.length?String(id):null;}
export async function writeDocument(client:SqlClient,collection:string,id:string,input:Data) {
 const mapping=mappingFor(collection),key=mapping.key;
 if(key==='projectOwnerLocks')return; // serialization lock is acquired by transaction, no document table
 if(key==='publicCache'){
  await upsert(client,'public_cache_artifacts',{key:id,scope:id==='catalog-revision'?'static':'offers',version:String(input.version||''),payload:input,schema_version:1,updated_at:input.updatedAt||new Date().toISOString()},['key']);return;
 }
 const table=mapping.tables[0];
 const data={...input};
 if(key==='projects'){
  data.name??=data.nombre;data.address??=data.direccionObra;data.createdAt??=data.creadoEn;data.updatedAt??=data.actualizadoEn;
 }
 const allowed=new Set(tableColumns(table).map(c=>c.column_name));
 const values:Data={...primaryKey(table,id,data),api_payload:input};
 for(const [source,target]of Object.entries(mapping.fields)){
  const match=new RegExp('^'+table+'\\.([a-z_]+)$').exec(target);
  if(match&&allowed.has(match[1])&&data[source]!==undefined)values[match[1]]=data[source];
 }
 if(key==='brands'&&!values.normalized_name)values.normalized_name=String(data.nombre).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 if(key==='masterProducts'){
  if(data.modelo){const modelId=digest('model:'+data.familiaId+':'+(data.marcaId||'')+':'+data.modelo);await upsert(client,'product_models',{id:modelId,family_id:data.familiaId,name:data.modelo},['id']);values.model_id=modelId;}else values.model_id=null;
  values.legacy_brand_label=data.marca||null;values.model_label=data.modelo??null;values.manufacturer_code=data.codigoFabricante??null;values.catalog_evidence=data.evidenciaCatalogo??null;}
 if(key==='masterAttributes'){
  const p=await client.query('SELECT family_id FROM findi.products WHERE id=$1',[data.productoMaestroId]);
  if(!p.rows.length)throw new Error('ATTRIBUTE_PRODUCT_MISSING');values.family_id=p.rows[0].family_id;
 }
 if(key==='contactRequests'&&!values.privacy_consent)values.privacy_consent=data.legalAcceptance??{};
 if(key==='priceHistory'){
  values.offer_reference=data.productoFerreteriaId||'';values.store_reference=data.ferreteriaId||'';values.product_reference=data.productoMaestroId||'';
  values.offer_id=await resolved(client,'offers',data.productoFerreteriaId);values.store_id=await resolved(client,'stores',data.ferreteriaId);values.product_id=await resolved(client,'products',data.productoMaestroId);
  values.action=data.action||'price_update';values.source=data.source||'legacy_price_history';values.includes_vat=data.incluyeIva!==false;
 }
 if(key==='storeAgreements'){
  values.store_reference=data.ferreteriaId;values.store_id=await resolved(client,'stores',data.ferreteriaId);
  await ensureAgreementDocument(client,data.version,data.documentHash);
 }
 if(key==='projects'){
  const proximity=data.proximity??data.proximidad;
  values.proximity_latitude=proximity?.latitude??null;values.proximity_longitude=proximity?.longitude??null;values.proximity_radius_km=proximity?.radiusKm??null;
  values.single_store_reference=data.singleStoreId??data.ferreteriaUnicaId??null;
  values.single_store_id=await resolved(client,'stores',values.single_store_reference);
  values.single_store_name_snapshot=data.singleStoreName??data.ferreteriaUnica??null;
 }
 if(key==='priceReports'){
  values.store_reference=data.storeId;values.offer_reference=data.offerId;
  values.store_id=await resolved(client,'stores',data.storeId);values.offer_id=await resolved(client,'offers',data.offerId);
 }
 if(key==='intellectualPropertyReports'){
  for(const [field,col]of Object.entries({name:'claimant_name',email:'claimant_email',organization:'claimant_organization',capacity:'claimant_capacity'}))values[col]=data.claimant?.[field]??null;
  values.target_reference=data.targetId??null;
  const refs:Record<string,string>={master_product:'products',store_offer:'offers',store:'stores'};
  if(refs[data.targetType])values[{master_product:'product_id',store_offer:'offer_id',store:'store_id'}[data.targetType as 'store']]=await resolved(client,refs[data.targetType],data.targetId);
 }
 if(key==='storeDailyAnalytics')for(const [field,col]of Object.entries({total:'catalog_total',published:'catalog_published',inStock:'catalog_in_stock',outOfStock:'catalog_out_of_stock',stalePrices:'catalog_stale_prices'}))values[col]=data.catalog?.[field]??0;
 const keys=Object.keys(primaryKey(table,id,data));
 const missing=tableColumns(table).filter(c=>c.is_nullable==='NO'&&c.column_default===null&&values[c.column_name]===undefined);
 if(missing.length)throw new Error(`SQL_REQUIRED_FIELDS:${collection}:${missing.map(c=>c.column_name).join(',')}`);
 await upsert(client,table,values,keys);
 await materializeChildren(client,key,id,data);
}
async function materializeChildren(client:SqlClient,key:string,id:string,data:Data) {
 if(key==='familyDefinitions'){
  const options=Array.isArray(data.opcionesJson)?data.opcionesJson:[];
  if(options.length)await client.query(`INSERT INTO findi.attribute_options(definition_id,value,label,position)
   SELECT $1,entry.value,entry.label,entry.position FROM jsonb_to_recordset($2::jsonb) AS entry(value text,label text,position integer)
   ON CONFLICT(definition_id,value) DO UPDATE SET label=EXCLUDED.label,position=EXCLUDED.position`,[id,JSON.stringify(options.map((item:any,position:number)=>({value:typeof item==='string'?item:item.value??item.valor,label:typeof item==='string'?item:item.label??item.etiqueta,position})))]);
  await client.query('DELETE FROM findi.attribute_options WHERE definition_id=$1 AND NOT(value=ANY($2::text[]))',[id,options.map((v:any)=>typeof v==='string'?v:v.value??v.valor)]);
 }
 if(key==='masterProducts'){
  const parent=await client.query('SELECT s.id subcategory_id,s.category_id FROM findi.families f JOIN findi.subcategories s ON s.id=f.subcategory_id WHERE f.id=$1',[data.familiaId]);
  if(!parent.rows.length||data.categoriaId&&data.categoriaId!==parent.rows[0].category_id||data.subcategoriaId&&data.subcategoriaId!==parent.rows[0].subcategory_id)throw new Error('SQL_PRODUCT_TAXONOMY_MISMATCH');
  await client.query('DELETE FROM findi.product_features WHERE product_id=$1',[id]);
  for(const [position,text]of (Array.isArray(data.caracteristicasDestacadas)?data.caracteristicasDestacadas:[]).entries())await upsert(client,'product_features',{product_id:id,position,text},['product_id','position']);
  await client.query('DELETE FROM findi.product_media WHERE product_id=$1',[id]);
  const gallery=Array.isArray(data.galeriaJson)?data.galeriaJson:[];
  const urls=gallery.map((url:any)=>({url, in_gallery:true}));
  if(data.imagenPrincipalUrl&&!gallery.includes(data.imagenPrincipalUrl))urls.push({url:data.imagenPrincipalUrl,in_gallery:false});
  const imageRights=digest('image-rights:'+id),textRights=digest('text-rights:'+id);
  if(data.referenciaAutorizacion)await upsert(client,'content_rights',{id:imageRights,source_type:data.origenImagen||'unknown',provider:data.proveedorImagen||null,source_terms_url:data.terminosFuenteUrl||null,authorization_reference:data.referenciaAutorizacion,contains_third_party_marks:!!data.contieneMarcasTerceros,trademark_authorization_reference:data.referenciaAutorizacionMarca||null,reviewed_by:data.derechosRevisadosPor||null,reviewed_at:data.derechosRevisadosEn||null},['id']);
  if(data.referenciaDerechosContenido){
   await upsert(client,'content_rights',{id:textRights,source_type:data.origenContenido||'unknown',source_url:data.fuenteContenidoUrl||null,authorization_reference:data.referenciaDerechosContenido,reviewed_by:data.derechosContenidoRevisadosPor||null,reviewed_at:data.derechosContenidoRevisadosEn||null},['id']);
   await upsert(client,'product_content_rights',{product_id:id,rights_id:textRights},['product_id']);
  }else await client.query('DELETE FROM findi.product_content_rights WHERE product_id=$1',[id]);
  let primaryChosen=false;
  for(const [position,item]of urls.entries()){
   const assetId=digest(`product-media:${id}:${position}`),isPrimary:boolean=!primaryChosen&&item.url===data.imagenPrincipalUrl;primaryChosen ||= isPrimary;
   await upsert(client,'media_assets',{id:assetId,url:item.url,origin:data.origenImagen||'unknown',rights_id:data.referenciaAutorizacion?imageRights:null},['id']);
   await upsert(client,'product_media',{product_id:id,asset_id:assetId,position,in_gallery:item.in_gallery,is_primary:isPrimary},['product_id','asset_id']);
  }
  await client.query('DELETE FROM findi.media_assets a WHERE a.id=ANY($1::text[]) AND NOT EXISTS(SELECT 1 FROM findi.product_media m WHERE m.asset_id=a.id)',[Array.from({length:200},(_,position)=>digest(`product-media:${id}:${position}`))]);
 }
 if(key==='projects'){
  await client.query('DELETE FROM findi.quotation_items WHERE quotation_id=$1',[id]);
  for(const [position,item]of (data.items||[]).entries()){
   const product=await resolved(client,'products',item.productoMaestroId),store=await resolved(client,'stores',item.storeId),offer=await resolved(client,'offers',item.productoFerreteriaId);
   await upsert(client,'quotation_items',{id:digest(`quotation-line:${id}:${position}`),quotation_id:id,position,product_id:product,product_name_snapshot:item.productName,quantity:item.quantity,selected_store_id:store,selected_store_name_snapshot:item.storeName??null,selected_offer_id:offer,product_reference:item.productoMaestroId??null,store_reference:item.storeId??null,offer_reference:item.productoFerreteriaId??null,resolution_state:product?'id':'unresolved'},['id']);
  }
 }
 if(key==='intellectualPropertyReports'){
  await client.query('DELETE FROM findi.ip_report_events WHERE report_id=$1',[id]);
  for(const [position,item]of (data.history||[]).entries())await upsert(client,'ip_report_events',{id:digest(`ip-event:${id}:${position}`),report_id:id,position,status:item.status,occurred_at:item.at||item.occurredAt,actor_kind:item.actor||null,actor_user_id:await resolved(client,'users',item.usuarioId||item.actorId),resolution:item.resolution||null},['id']);
 }
 if(key==='storeDailyAnalytics'){
  const localDate=String(data.computedAt).slice(0,10);
  await client.query('DELETE FROM findi.store_daily_top_products WHERE store_id=$1 AND local_date=$2',[id,localDate]);
  for(const [index,item]of (data.topProducts||[]).entries())await upsert(client,'store_daily_top_products',{store_id:id,local_date:localDate,rank:index+1,product_id:await resolved(client,'products',item.productId),product_reference:item.productId,product_name_snapshot:item.name,quotation_count:item.quotationCount,units:item.units,active_amount:item.activeAmount,stock:item.stock},['store_id','local_date','rank']);
 }
}

export async function ensureAgreementDocument(client:SqlClient,version=CURRENT_STORE_AGREEMENT_VERSION,documentHash?:string){
 const content={version:CURRENT_STORE_AGREEMENT_VERSION,provider:STORE_AGREEMENT_PROVIDER,clauses:STORE_AGREEMENT_CLAUSES};
 const currentHash=createHash('sha256').update(JSON.stringify(content)).digest('hex');
 const hash=documentHash||currentHash,isCurrent=version===CURRENT_STORE_AGREEMENT_VERSION&&hash===currentHash;
 if(isCurrent)await client.query("UPDATE findi.legal_documents SET is_current=false WHERE kind='store_agreement' AND (version<>$1 OR document_hash<>$2)",[version,hash]);
 await upsert(client,'legal_documents',{kind:'store_agreement',version,document_hash:hash,content:isCurrent?content:{version,hash,source:'historical_agreement_snapshot'},is_current:isCurrent},['kind','version','document_hash']);
}
