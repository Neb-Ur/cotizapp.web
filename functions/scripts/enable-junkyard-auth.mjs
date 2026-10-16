import {readFile} from 'node:fs/promises';
import {initializeApp, deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {cloudAuth, cloudPool, secretValue, requireApply, projectId} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';

const simpleEmails = {
 'seed-auto-owner-desarmaduria':'trovio@demo.test',
 'seed-kuv-owner-norte':'norte@demo.test',
 'seed-kuv-owner-central':'central@demo.test',
 'seed-kuv-owner-sur':'sur@demo.test',
 'seed-junkyard-extra-owner-1':'oriente@demo.test',
 'seed-junkyard-extra-owner-2':'poniente@demo.test',
 'seed-junkyard-extra-owner-3':'mecanica@demo.test',
 'seed-junkyard-extra-owner-4':'carroceria@demo.test'
};

// Preserve the seeded UIDs and catalogs; synchronize only test login identities.
async function main(){
 const apply=process.argv.includes('--apply');if(apply)requireApply();
 const password=process.env.PILOT_AUTH_PASSWORD;
 if(apply&&(!password||password.length<6||password.length>128))throw Error('PILOT_AUTH_PASSWORD_REQUIRED');
 const stores=[];
 for(const file of ['semilla-repuestos-vehiculos.json','semilla-kuv100-ampliada.json','semilla-desarmadurias-whatsapp.json']){
  const seed=JSON.parse(await readFile(new URL('../../docs/catalogo/'+file,import.meta.url)));
  for(const store of seed.stores.filter(s=>s.businessType==='desarmaduria'))stores.push({...store,batch:seed.batch});
 }
 if(stores.length!==8||new Set(stores.map(s=>s.ownerId)).size!==8)throw Error('JUNKYARD_IDENTITY_COUNT_MISMATCH');
 const auth=await cloudAuth();
 const connection=await cloudPool(auth,'findi_runtime',await secretValue(auth,'FINDI_SQL_PASSWORD'),1);
 const app=initializeApp({projectId,credential:{getAccessToken:async()=>{
  const token=await auth.getAccessToken();if(!token.token)throw Error('CLOUD_TOKEN_REQUIRED');
  return {access_token:token.token,expires_in:300};
 }}},'junkyard-test-auth');
 try{
  const firebase=getAuth(app);
  const database=new PostgresDatabase(connection.pool);
  // Validate every identity and email before enabling any account.
  for(const expected of stores){
   const result=await connection.pool.query('SELECT u.id,u.api_payload AS profile,s.api_payload AS store FROM findi.users u JOIN findi.stores s ON s.owner_id=u.id WHERE u.id=$1 AND s.id=$2',[expected.ownerId,expected.id]);
   if(result.rows.length!==1)throw Error('JUNKYARD_IDENTITY_MISSING');
   const {profile,store}=result.rows[0];
   const email=simpleEmails[expected.ownerId];
   const allowedEmails=[expected.ownerId+'@example.invalid',email];
   if(!email||!allowedEmails.includes(profile.correo)||profile.rol!=='ferreteria'||profile.esPrueba!==true||store.esPrueba!==true||store.tipoNegocio!=='desarmaduria'||profile.lotePrueba!==expected.batch||store.lotePrueba!==expected.batch||store.usuarioDuenoId!==expected.ownerId)throw Error('JUNKYARD_IDENTITY_MISMATCH');
   if(profile.estadoCuenta!=='activo'||store.estado!=='activo')throw Error('JUNKYARD_INACTIVE');
   expected.email=email;expected.profileEmail=profile.correo;expected.name=store.nombreComercial;
   try{expected.account=await firebase.getUser(expected.ownerId);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
   if(expected.account&&!allowedEmails.includes(expected.account.email))throw Error('JUNKYARD_AUTH_ID_OCCUPIED');
   const collision=await connection.pool.query('SELECT id FROM findi.users WHERE lower(email)=lower($1) AND id<>$2',[email,expected.ownerId]);
   if(collision.rows.length)throw Error('JUNKYARD_SQL_EMAIL_OCCUPIED');
   try{const existing=await firebase.getUserByEmail(email);if(existing.uid!==expected.ownerId)throw Error('JUNKYARD_AUTH_EMAIL_OCCUPIED');}catch(error){if(error.code!=='auth/user-not-found')throw error;}
  }
  for(const store of stores){
   let action=store.account?'exists':'missing';
   if(apply&&!store.account){
    await firebase.createUser({uid:store.ownerId,email:store.email,password,displayName:store.name,emailVerified:true,disabled:false});action='created';
   }else if(apply&&store.account&&process.argv.includes('--reset-password')){
    await firebase.updateUser(store.ownerId,{email:store.email,password,disabled:false,emailVerified:true});await firebase.revokeRefreshTokens(store.ownerId);action='password-reset';
   }else if(apply&&store.account&&store.account.email!==store.email){
    await firebase.updateUser(store.ownerId,{email:store.email,emailVerified:true});await firebase.revokeRefreshTokens(store.ownerId);action='email-updated';
   }
   if(apply&&store.profileEmail!==store.email){
    await database.collection('usuarios').doc(store.ownerId).update({correo:store.email,actualizadoEn:new Date().toISOString()});
   }
   console.log(JSON.stringify({storeId:store.id,name:store.name,email:store.email,action}));
  }
 }finally{await connection.close();await deleteApp(app);}
}
main().catch(error=>{console.error('JUNKYARD_AUTH_FAILED',error.code||(/^[A-Z_]+$/.test(error.message)?error.message:'ERROR'));process.exitCode=1;});
