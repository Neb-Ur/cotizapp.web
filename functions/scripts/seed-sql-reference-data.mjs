import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {cloudAuth,cloudPool,secretValue,requireApply,projectId} from './lib/sql-cloud.mjs';
import {catalogLandings,seoProductSlug} from '../lib/domain/catalog-seo.js';
import {ensureAgreementDocument} from '../lib/database/codec.js';
const root=new URL('../../',import.meta.url);
// Legacy form spelling Paihuano corresponds to SUBDERE CUT commune 04105 (Paiguano).
const communeAlias=new Map([['paihuano','04105']]);
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/(\d)([a-z])/g,'$1 $2').replace(/[^a-z0-9]+/g,' ').trim();
async function localConstants(path){const code=ts.transpileModule(await readFile(new URL(path,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
async function bulk(client,table,columns,rows,conflict){
 if(!rows.length)return;
 const types=Object.entries(columns).map(([name,type])=>`"${name}" ${type}`).join(',');const names=Object.keys(columns).map(k=>'"'+k+'"').join(',');
 await client.query(`INSERT INTO ${table}(${names}) SELECT ${names} FROM jsonb_to_recordset($1::jsonb) AS data(${types}) ${conflict}`,[JSON.stringify(rows)]);
}
async function main(){
 requireApply();const geo=JSON.parse(await readFile(new URL('sql/findi/data/chile-territories.json',root),'utf8'));
 if(geo.regions.length!==16||geo.provinces.length!==56||geo.communes.length!==346)throw Error('Catálogo territorial incompleto.');
 const {CHILE_CITY_OPTIONS}=await localConstants('src/app/core/utils/chile-locations.util.ts');
 const {LEGAL_IDENTITY}=await localConstants('src/app/core/config/legal-identity.config.ts');
 const auth=await cloudAuth();const {pool,close}=await cloudPool(auth,'findi_migration',await secretValue(auth,'FINDI_SQL_MIGRATION_PASSWORD'),1);
 const client=await pool.connect();
 try {
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(583728493)');
  const state=(await client.query("SELECT status FROM findi.database_migration_state WHERE id='firestore-to-sql' FOR UPDATE")).rows[0];
  if(!['verified','active'].includes(state?.status))throw Error('Conciliar la copia antes de cargar referencias.');
  const tables=['countries','regions','provinces','communes','cities','city_communes','account_locations','store_locations','legal_documents','seo_routes','catalog_search_documents'];
  const before={};for(const table of tables)before[table]=(await client.query('SELECT * FROM findi.'+table)).rows;
  await mkdir(new URL('tmp/sql-migration/',root),{recursive:true});await writeFile(new URL('tmp/sql-migration/reference-backup-'+Date.now()+'.json',root),JSON.stringify({projectId,tables:before}),{mode:0o600,flag:'wx'});
  await bulk(client,'findi.countries',{code:'text',name:'text'},[{code:'CL',name:'Chile'}],'ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name');
  await bulk(client,'findi.regions',{code:'text',country_code:'text',name:'text',abbreviation:'text',source_reference:'text'},geo.regions.map(r=>({...r,country_code:'CL',source_reference:geo.source.url})),'ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,abbreviation=EXCLUDED.abbreviation,source_reference=EXCLUDED.source_reference');
  await bulk(client,'findi.provinces',{code:'text',region_code:'text',name:'text'},geo.provinces.map(r=>({...r,region_code:r.regionCode})),'ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,region_code=EXCLUDED.region_code');
  await bulk(client,'findi.communes',{code:'text',province_code:'text',name:'text',normalized_name:'text'},geo.communes.map(r=>({...r,province_code:r.provinceCode,normalized_name:normalize(r.name)})),'ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,province_code=EXCLUDED.province_code,normalized_name=EXCLUDED.normalized_name');
  const citySource='src/app/core/utils/chile-locations.util.ts';
  const cities=CHILE_CITY_OPTIONS.map(c=>({id:'cl-'+normalize(c.city).replace(/ /g,'-'),country_code:'CL',name:c.city,kind:'application_group',source_reference:citySource}));
  await bulk(client,'findi.cities',{id:'text',country_code:'text',name:'text',kind:'text',source_reference:'text'},cities,'ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind,source_reference=EXCLUDED.source_reference');
  const links=[];
  for(let i=0;i<CHILE_CITY_OPTIONS.length;i++)for(const name of CHILE_CITY_OPTIONS[i].communes){const matches=geo.communes.filter(c=>normalize(c.name)===normalize(name)||c.code===communeAlias.get(normalize(name)));if(matches.length!==1)throw Error('Comuna del formulario ambigua o ausente: '+name);links.push({city_id:cities[i].id,commune_code:matches[0].code,source_reference:citySource});}
  await bulk(client,'findi.city_communes',{city_id:'text',commune_code:'text',source_reference:'text'},links,'ON CONFLICT(city_id,commune_code) DO UPDATE SET source_reference=EXCLUDED.source_reference');
  for(const [source,target,key]of [['users','account_locations','user_id'],['stores','store_locations','store_id']]){
   const rows=(await client.query(`SELECT id,city,commune,region FROM findi.${source}`)).rows;
   const matches=[];for(const row of rows){const city=cities.find(c=>normalize(c.name)===normalize(row.city));const options=geo.communes.filter(c=>normalize(c.name)===normalize(row.commune)||c.code===communeAlias.get(normalize(row.commune)));const commune=options.length===1?options[0]:options.find(c=>links.some(l=>l.city_id===city?.id&&l.commune_code===c.code));const province=geo.provinces.find(p=>p.code===commune?.provinceCode);const region=province?.regionCode||geo.regions.find(r=>normalize(r.name)===normalize(row.region))?.code;if(city||commune||region)matches.push({[key]:row.id,city_id:city?.id,commune_code:commune?.code,region_code:region});}
   await bulk(client,'findi.'+target,{[key]:'text',city_id:'text',commune_code:'text',region_code:'text'},matches,`ON CONFLICT(${key}) DO UPDATE SET city_id=EXCLUDED.city_id,commune_code=EXCLUDED.commune_code,region_code=EXCLUDED.region_code,matched_at=now()`);
  }
  await ensureAgreementDocument(client);
  for(const [kind,path,version]of [['terms','terminos',LEGAL_IDENTITY.termsVersion],['privacy_notice','privacidad',LEGAL_IDENTITY.privacyPolicyVersion]]){
   const source='src/app/pages/public/'+path+'/'+path+'.component.html';const template=await readFile(new URL(source,root),'utf8');
   const html=template.replace(/\{\{\s*legalIdentity\.(\w+)\s*\}\}/g,(_,key)=>{if(LEGAL_IDENTITY[key]===undefined)throw Error('Referencia legal desconocida');return LEGAL_IDENTITY[key];});
   const content={source,html,identity:LEGAL_IDENTITY};const hash=createHash('sha256').update(JSON.stringify(content)).digest('hex');
   const current=(await client.query('SELECT version,document_hash FROM findi.legal_documents WHERE kind=$1 AND is_current',[kind])).rows[0];
   if(current&&(current.version!==version||current.document_hash!==hash))throw Error('Existe otra versión legal vigente: '+kind);
   await client.query("INSERT INTO findi.legal_documents(kind,version,document_hash,content,effective_at,is_current) VALUES($1,$2,$3,$4,'2026-10-05T00:00:00-03:00',true) ON CONFLICT(kind,version,document_hash) DO NOTHING",[kind,version,hash,JSON.stringify(content)]);
  }
  const payloads=async table=>(await client.query(`SELECT id,api_payload FROM findi.${table} WHERE api_payload IS NOT NULL`)).rows.map(r=>({id:r.id,...r.api_payload}));
  const products=await payloads('products'),categories=await payloads('categories'),subs=await payloads('subcategories'),families=await payloads('families'),brands=await payloads('brands');
  const active=products.filter(p=>p.estado!=='inactivo');const revision=(await client.query("SELECT revision FROM findi.catalog_revisions WHERE scope='static'")).rows[0].revision;
  const taxonomy=rows=>new Map(rows.map(r=>[r.id,r.nombre]));const cats=taxonomy(categories),sub=taxonomy(subs),fam=taxonomy(families);
  const docs=active.map(p=>({product_id:p.id,normalized_text:normalize([p.nombre,p.marca,p.tipoProducto,cats.get(p.categoriaId),sub.get(p.subcategoriaId),fam.get(p.familiaId)].filter(Boolean).join(' ')),version:revision}));
  await client.query("INSERT INTO findi.catalog_search_documents(product_id,normalized_text,search_vector,version,updated_at) SELECT product_id,normalized_text,to_tsvector('simple',normalized_text),version,now() FROM jsonb_to_recordset($1::jsonb) AS x(product_id text,normalized_text text,version bigint) ON CONFLICT(product_id) DO UPDATE SET normalized_text=EXCLUDED.normalized_text,search_vector=EXCLUDED.search_vector,version=EXCLUDED.version,updated_at=EXCLUDED.updated_at",[JSON.stringify(docs)]);
  const routes=active.map(p=>({path:'/productos/'+seoProductSlug(p,products),product_id:p.id}));
  for(const page of catalogLandings([products,categories,subs,families,brands]))routes.push({path:page.path,...(page.filters.marcaId?{brand_id:page.filters.marcaId}:page.filters.familia?{family_id:page.filters.familia}:{category_id:page.filters.categoria})});
  await bulk(client,'findi.seo_routes',{path:'text',product_id:'text',category_id:'text',family_id:'text',brand_id:'text'},routes,'ON CONFLICT(path) DO NOTHING');
  for(const table of tables)console.log(table,(await client.query('SELECT count(*)::int n FROM findi.'+table)).rows[0].n);
  if((await client.query('SELECT count(*)::int n FROM findi.catalog_search_documents')).rows[0].n<active.length)throw Error('Índice incompleto.');
  await client.query('COMMIT');console.log(JSON.stringify({seeded:true,officialCommunes:geo.communes.length,cityGroups:cities.length,searchDocuments:docs.length,seoRoutes:routes.length}));
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await close();}
}
main().catch(error=>{console.error('SQL_REFERENCE_SEED_FAILED',error.code||error.message);process.exitCode=1;});
