import {cloudAuth,cloudPool,secretValue} from './lib/sql-cloud.mjs';
const auth=await cloudAuth();const {pool,close}=await cloudPool(auth,'findi_migration',await secretValue(auth,'FINDI_SQL_MIGRATION_PASSWORD'),1);
try {console.log(JSON.stringify((await pool.query("SELECT rolname FROM pg_roles WHERE rolname LIKE 'firebase%' ORDER BY rolname")).rows));}finally{await close();}
