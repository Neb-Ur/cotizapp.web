import {writeFile} from 'node:fs/promises';
import {cloudAuth,cloudPool,secretValue} from './lib/sql-cloud.mjs';
const auth=await cloudAuth();const {pool,close}=await cloudPool(auth,'findi_migration',await secretValue(auth,'FINDI_SQL_MIGRATION_PASSWORD'),1);
try {
 const names=(await pool.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('findi','findi_migration') ORDER BY 1,2")).rows;
 const counts=[];for(const t of names){const rows=(await pool.query(`SELECT count(*)::int n FROM ${t.schemaname}.${t.tablename}`)).rows[0].n;counts.push({table:t.schemaname+'.'+t.tablename,rows});}
 console.log(JSON.stringify(counts,null,2));
 await writeFile(new URL('../../tmp/sql-data-audit.json',import.meta.url),JSON.stringify(counts,null,2)+'\n');
 console.log('Control',(await pool.query('SELECT status FROM findi.database_migration_state')).rows);

}finally{await close();}
