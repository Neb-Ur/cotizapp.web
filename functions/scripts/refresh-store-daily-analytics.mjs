import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { Firestore } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import { aggregateStoreDailyAnalytics } from '../lib/domain/store-daily-analytics.js';
const projectId=process.env.FIREBASE_PROJECT_ID;
if (!projectId || process.env.CONFIRM_PROJECT_ID !== projectId) throw new Error('Indica el proyecto y su confirmación para actualizar los resúmenes diarios.');
const config=JSON.parse(await readFile(`${homedir()}/.config/configstore/firebase-tools.json`,'utf8'));
if (!config.tokens?.access_token || config.tokens.expires_at < Date.now()+60000) throw new Error('Renueva la sesión Firebase CLI antes de generar el resumen.');
const auth=new OAuth2Client();auth.setCredentials({access_token:config.tokens.access_token,expiry_date:config.tokens.expires_at});
const db=new Firestore({projectId,authClient:auth});
const read=async collection=>(await db.collection(collection).get()).docs.map(doc=>({id:doc.id,...doc.data()}));
const site=process.env.ANALYTICS_SITE_URL || `https://${projectId}.web.app`;
const metadata=await fetch(`${site}/api/catalogo-publico/version`).then(response=>response.json());
const response=await fetch(`${site}/api/catalogo-publico?v=${encodeURIComponent(metadata.data?.version || '')}`);
if (!response.ok) throw new Error('No se pudo obtener el corte de ofertas públicas.');
const snapshot=(await response.json()).data;
if (!Array.isArray(snapshot?.searchRows)) throw new Error('El catálogo público no contiene ofertas.');
const [stores,projects,catalog,products,events]=await Promise.all([
 read('real_ferreterias'),read('real_proyectos'),read('real_productosFerreteria'),read('productosMaestro'),read('real_storeMetrics')
]);
const reports=[...aggregateStoreDailyAnalytics(stores,projects,snapshot.searchRows,catalog,products,events)];
for(let offset=0;offset<reports.length;offset+=400){const batch=db.batch();for(const [id,report] of reports.slice(offset,offset+400))batch.set(db.collection('real_storeDailyAnalytics').doc(id),report);await batch.commit();}
console.log(JSON.stringify({projectId,stores:reports.length,refreshed:true}));
