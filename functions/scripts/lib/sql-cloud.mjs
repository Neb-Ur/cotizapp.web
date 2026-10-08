import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {GoogleAuth,OAuth2Client} from 'google-auth-library';
import {Connector,IpAddressTypes} from '@google-cloud/cloud-sql-connector';
import pg from 'pg';
export const projectId=process.env.FIREBASE_PROJECT_ID||'cotizapp-d71c8';
export const instanceId='cotizapp-d71c8-instance';
export const database='cotizapp-d71c8-database';
export async function cloudAuth(){
 if(process.argv.includes('--firebase-cli-auth')){
  const config=JSON.parse(await readFile(homedir()+'/.config/configstore/firebase-tools.json','utf8'));
  if(!config.tokens?.access_token||config.tokens.expires_at<Date.now()+60_000)throw new Error('Renueva Firebase CLI con firebase projects:list antes de ejecutar la migración.');
  const client=new OAuth2Client();client.setCredentials({access_token:config.tokens.access_token,expiry_date:config.tokens.expires_at});return client;
 }
 return new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
}
export async function cloudRequest(auth,url,method='GET',data){return (await auth.request({url,method,data})).data;}
export async function secretValue(auth,name){
 const result=await cloudRequest(auth,`https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${name}/versions/latest:access`);
 return Buffer.from(result.payload.data,'base64').toString();
}
export async function cloudPool(auth,user,password,max=12){
 const connector=new Connector({auth});const options=await connector.getOptions({instanceConnectionName:`${projectId}:us-east4:${instanceId}`,ipType:IpAddressTypes.PUBLIC});
 const pool=new pg.Pool({...options,database,user,password,max,connectionTimeoutMillis:30_000,idleTimeoutMillis:10_000});
 return {pool,close:async()=>{await pool.end();connector.close();}};
}
export function requireApply(){
 if(!process.argv.includes('--apply')||process.env.CONFIRM_PROJECT_ID!==projectId)throw new Error('Para aplicar: --apply y CONFIRM_PROJECT_ID igual al destino.');
 if(projectId!=='cotizapp-d71c8')throw new Error('Esta configuración pertenece a cotizapp-d71c8.');
}
export async function waitSqlOperation(auth,operation){
 while(operation.status!=='DONE'){
  await new Promise(resolve=>setTimeout(resolve,1500));
  operation=await cloudRequest(auth,`https://sqladmin.googleapis.com/v1/projects/${projectId}/operations/${operation.name}`);
 }
 if(operation.error)throw new Error('CloudSQL operation failed: '+JSON.stringify(operation.error.errors?.map(e=>e.code)));
}
