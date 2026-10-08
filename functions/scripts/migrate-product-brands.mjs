import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { Firestore } from '@google-cloud/firestore';
import { brandIdentity } from '../lib/domain/brand-identity.js';
const projectId=process.env.FIREBASE_PROJECT_ID;
const apply=process.argv.includes('--apply');
if(!projectId || (apply && process.env.CONFIRM_PROJECT_ID!==projectId)) throw new Error('Indica FIREBASE_PROJECT_ID y CONFIRM_PROJECT_ID para aplicar.');
let authClient;
if(process.argv.includes('--firebase-cli-auth')) {
 const config=JSON.parse(await readFile(`${homedir()}/.config/configstore/firebase-tools.json`,'utf8'));
 if(!config.tokens?.access_token || config.tokens.expires_at<Date.now()+60000)throw new Error('Renueva la sesión Firebase CLI.');
 authClient=new OAuth2Client();authClient.setCredentials({access_token:config.tokens.access_token,expiry_date:config.tokens.expires_at});
} else authClient=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/datastore']}).getClient();
const db=new Firestore({projectId,authClient});
const products=await db.collection('productosMaestro').get();
let linked=0,skipped=0,unchanged=0;
const identities=new Set();
for(const product of products.docs) {
 const value=product.data();const identity=brandIdentity(value.marca);
 if(!identity){skipped++;continue;}
 identities.add(identity.id);
 if(!apply){if(value.marcaId===identity.id)unchanged++;else linked++;continue;}
 const changed=await db.runTransaction(async transaction=>{
  const brandRef=db.collection('marcas').doc(identity.id);
  const [current,brand]=await Promise.all([transaction.get(product.ref),transaction.get(brandRef)]);
  // Do not overwrite a product modified while this migration was running.
  if(!current.exists || current.data().marca!==value.marca)return false;
  const canonical=brand.data()?.nombre || identity.nombre;
  if(!brand.exists)transaction.create(brandRef,{nombre:identity.nombre,nombreNormalizado:identity.nombreNormalizado,creadoEn:new Date().toISOString()});
  if(current.data().marcaId===identity.id && current.data().marca===canonical)return false;
  transaction.update(product.ref,{marcaId:identity.id,marca:canonical});
  return true;
 });
 if(changed)linked++;else unchanged++;
}
console.log(JSON.stringify({projectId,apply,products:products.size,brands:identities.size,linked,skipped,unchanged}));
