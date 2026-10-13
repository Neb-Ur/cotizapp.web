import {buildBaseAutoPartDocuments} from './lib/base-auto-parts.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {cloudAuth,secretValue,cloudPool,projectId,requireApply} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
const plan=JSON.parse(await readFile(new URL('../../docs/catalogo/catalogo-repuestos-base.json',import.meta.url),'utf8'));
const apply=process.argv.includes('--apply');if(apply)requireApply();
const now=new Date().toISOString();const documents=buildBaseAutoPartDocuments(plan,now);
const auth=await cloudAuth();const c=await cloudPool(auth,apply?'findi_runtime':'findi_migration',await secretValue(auth,apply?'FINDI_SQL_PASSWORD':'FINDI_SQL_MIGRATION_PASSWORD'),1);
try{
 const db=new PostgresDatabase(c.pool);const existing=[];const create=[];
 for(const d of documents){const found=await db.collection(d.collection).doc(d.id).get();if(found.exists){const old=found.data();for(const key of ['nombre','categoriaId','subcategoriaId','familiaId','catalogoNivel'])if(d.data[key]!==undefined&&old[key]!==d.data[key])throw new Error('CATALOG_IDENTITY_CONFLICT:'+d.id);existing.push(d.id);}else create.push(d);}
 console.log(JSON.stringify({projectId,apply,create:create.length,existing:existing.length,offersCreated:0}));
 if(!apply)process.exitCode=0;
 else {
  const dir=homedir()+'/.local/share/cotizapp/backups';await mkdir(dir,{recursive:true,mode:0o700});const receipt=dir+'/base-auto-parts-'+Date.now()+'.json';
  await writeFile(receipt,JSON.stringify({projectId,createdAt:now,planned:documents.map(({collection,id})=>({collection,id})),existing},null,2),{mode:0o600,flag:'wx'});
  await db.runTransaction(async tx=>{const snapshots=[];for(const d of documents)snapshots.push(await tx.get(db.collection(d.collection).doc(d.id)));for(const [i,d]of documents.entries())if(!snapshots[i].exists)tx.create(db.collection(d.collection).doc(d.id),d.data);});
  const ids=plan.products.map(p=>p.id);const offers=(await c.pool.query('SELECT count(*)::int n FROM findi.offers WHERE product_id=ANY($1::text[])',[ids])).rows[0].n;
  console.log(JSON.stringify({created:create.length,products:ids.length,offers,allInSharedCatalog:true}));
 }
}finally{await c.close();}
