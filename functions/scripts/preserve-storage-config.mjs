import {preserveServerConfig} from './lib/server-config.mjs';
// CI deployments must not silently reset the storage selector to Firestore.
import {GoogleAuth} from 'google-auth-library';
import {writeFile} from 'node:fs/promises';
const project=process.env.FIREBASE_PROJECT_ID||'cotizapp-d71c8';
const auth=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
const result=await auth.request({url:`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/southamerica-west1/functions/api`});
const existing=result.data.serviceConfig?.environmentVariables||{};
const config=preserveServerConfig(existing,project,process.env.REQUESTED_USE_SQL_DATABASE);
await writeFile(new URL('../.env',import.meta.url),Object.entries(config).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n',{mode:0o600});
console.log(`Preserving server storage configuration: USE_SQL_DATABASE=${config.USE_SQL_DATABASE}`);
