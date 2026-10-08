// CI deployments must not silently reset the storage selector to Firestore.
import {GoogleAuth} from 'google-auth-library';
import {writeFile} from 'node:fs/promises';
const project=process.env.FIREBASE_PROJECT_ID||'cotizapp-d71c8';
const auth=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
const result=await auth.request({url:`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/southamerica-west1/functions/api`});
const existing=result.data.serviceConfig?.environmentVariables||{};
const selected=process.env.REQUESTED_USE_SQL_DATABASE||existing.USE_SQL_DATABASE||'false';
if(!['true','false'].includes(selected))throw new Error('USE_SQL_DATABASE must be true or false');
const preserved=Object.fromEntries(Object.entries(existing).filter(([key])=>['ALLOWED_ORIGINS','REQUIRE_ADMIN_MFA'].includes(key)||key.startsWith('COTIZAPP_')));
const config={...preserved,USE_SQL_DATABASE:selected,SQL_REPLICATION_ENABLED:existing.SQL_REPLICATION_ENABLED||'false',SQL_INSTANCE_CONNECTION_NAME:existing.SQL_INSTANCE_CONNECTION_NAME||`${project}:us-east4:cotizapp-d71c8-instance`,SQL_DATABASE_NAME:existing.SQL_DATABASE_NAME||'cotizapp-d71c8-database',SQL_DATABASE_USER:existing.SQL_DATABASE_USER||'findi_runtime'};
await writeFile(new URL('../.env',import.meta.url),Object.entries(config).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n',{mode:0o600});
console.log(`Preserving server storage configuration: USE_SQL_DATABASE=${selected}`);
