import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { HISTORICAL_MIGRATIONS } from './schema-migrations.mjs';

export const SELECTED_TABLES = Object.freeze([
  'countries', 'regions', 'provinces', 'communes', 'cities', 'city_communes',
  'users', 'categories', 'subcategories', 'families', 'brands', 'brand_uses',
  'product_models', 'attribute_definitions', 'attribute_options', 'products',
  'product_features', 'product_attributes', 'content_rights', 'product_content_rights',
  'media_assets', 'product_media', 'stores', 'offers', 'legal_documents',
  'store_agreements', 'consent_events', 'marketing_suppressions', 'store_reviews',
  'product_requests', 'ip_reports', 'ip_report_events', 'privacy_requests',
  'price_reports', 'contact_messages'
]);
export const EXCLUDED_TABLES = Object.freeze([
  'quotations', 'quotation_items', 'quotation_verifications', 'account_preferences',
  'offer_history', 'admin_audit_logs', 'security_incidents', 'governance_evidence',
  'store_event_counters', 'store_daily_analytics', 'store_daily_top_products',
  'visit_daily_keys', 'visit_daily_totals', 'job_runs', 'import_batches', 'import_rows',
  'outbox_events', 'public_cache_artifacts', 'catalog_search_documents', 'seo_routes',
  'source_replication_versions', 'account_deletion_jobs', 'deletion_receipts'
]);
const openStatuses = {
  product_requests: ['pendiente'], ip_reports: ['recibida', 'en_revision', 'retiro_preventivo', 'esperando_respuesta'],
  privacy_requests: ['recibida', 'en_revision'], price_reports: ['recibido', 'en_revision'],
  contact_messages: ['pendiente', 'contactado']
};
const stagedColumns = new Map(['products', 'stores', 'offers'].map(table => [table, ['ip_report_id']]));
const quote = pg.escapeIdentifier;
const relation = table => `findi.${quote(table)}`;
const digest = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
const rowHash = rows => digest(JSON.stringify([...rows].sort(compare)));
const referenceKey = values => JSON.stringify(values);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const hashDtoDocuments = documents => digest(JSON.stringify(documents.map(stable).sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)));

export async function expectedDtoHashes(snapshot) {
  const mappings = JSON.parse(await readFile(new URL('../../src/database/source-mapping.json', import.meta.url), 'utf8'));
  const result = {};
  for (const [key, mapping] of Object.entries(mappings)) {
    if (key === 'projectOwnerLocks') continue;
    const table = mapping.tables[0];
    if (!snapshot.tables[table]?.columns.some(column => column.column_name === 'api_payload')) continue;
    const documents = snapshot.tables[table].rows.map(row => JSON.parse(row.json))
      .filter(row => row.api_payload !== null && (key !== 'masterProducts' || row.deleted_at === null))
      .map(row => ({ id: key === 'marketingSuppressions' ? row.email_hash : row.id, data: key === 'users' ? { ...row.api_payload, quotationLimit: row.quotation_limit } : row.api_payload }));
    result[mapping.sourceCollection] = { count: documents.length, sha256: hashDtoDocuments(documents) };
  }
  return result;
}

async function metadata(client) {
  const columns = (await client.query(`SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,is_identity,is_generated
    FROM information_schema.columns WHERE table_schema='findi' ORDER BY table_name,ordinal_position`)).rows;
  const keys = (await client.query(`SELECT k.table_name,k.column_name,k.ordinal_position
    FROM information_schema.table_constraints c JOIN information_schema.key_column_usage k
      ON k.constraint_schema=c.constraint_schema AND k.constraint_name=c.constraint_name AND k.table_name=c.table_name
    WHERE c.table_schema='findi' AND c.constraint_type='PRIMARY KEY' ORDER BY k.table_name,k.ordinal_position`)).rows;
  const references = (await client.query(`SELECT child.relname AS child_table,fk.conname AS constraint_name,ca.attname AS child_column,
    pn.nspname AS parent_schema,parent.relname AS parent_table,pa.attname AS parent_column,
    keys.position AS ordinal_position,CASE WHEN ca.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable
    FROM pg_constraint fk JOIN pg_class child ON child.oid=fk.conrelid
    JOIN pg_namespace cn ON cn.oid=child.relnamespace JOIN pg_class parent ON parent.oid=fk.confrelid
    JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    CROSS JOIN LATERAL unnest(fk.conkey,fk.confkey) WITH ORDINALITY keys(child_number,parent_number,position)
    JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=keys.child_number
    JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=keys.parent_number
    WHERE fk.contype='f' AND cn.nspname='findi' ORDER BY child.relname,fk.conname,keys.position`)).rows;
  const tables = Object.fromEntries(SELECTED_TABLES.map(table => [table, {
    columns: columns.filter(column => column.table_name === table),
    primaryKey: keys.filter(key => key.table_name === table).map(key => key.column_name)
  }]));
  for (const [table, info] of Object.entries(tables)) if (!info.columns.length || !info.primaryKey.length) throw new Error(`TRANSFER_SCHEMA_MISSING: ${table}`);
  const foreignKeys = [];
  for (const ref of references) {
    let constraint = foreignKeys.find(key => key.childTable === ref.child_table && key.name === ref.constraint_name);
    if (!constraint) {
      constraint = { name: ref.constraint_name, childTable: ref.child_table, parentSchema: ref.parent_schema, parentTable: ref.parent_table, childColumns: [], parentColumns: [], nullable: [] };
      foreignKeys.push(constraint);
    }
    constraint.childColumns.push(ref.child_column); constraint.parentColumns.push(ref.parent_column); constraint.nullable.push(ref.is_nullable === 'YES');
  }
  return { tables, foreignKeys };
}

async function rawRows(client, table, primaryKey) {
  const result = await client.query(`SELECT to_jsonb(source.*)::text AS json,jsonb_build_array(${primaryKey.map(column => `source.${quote(column)}`).join(',')})::text AS key FROM ${relation(table)} source`);
  return result.rows.map(row => ({ key: row.key, json: row.json })).sort(compare);
}

async function historicalState(client) {
  const rows = (await client.query('SELECT version,sha256 FROM public.findi_schema_migrations ORDER BY version')).rows;
  if (rows.length !== HISTORICAL_MIGRATIONS.length || rows.some(row => !HISTORICAL_MIGRATIONS.includes(row.version))) throw new Error('TRANSFER_SOURCE_MIGRATIONS_UNEXPECTED');
  for (const version of HISTORICAL_MIGRATIONS) {
    const sql = await readFile(new URL('../../../sql/findi/' + version, import.meta.url), 'utf8');
    if (rows.find(row => row.version === version)?.sha256 !== digest(sql)) throw new Error(`TRANSFER_SOURCE_HASH_MISMATCH: ${version}`);
  }
  const state = (await client.query("SELECT to_jsonb(state)::text AS json FROM findi.database_migration_state state WHERE id='firestore-to-sql'")).rows[0];
  if (!state || JSON.parse(state.json).status !== 'active') throw new Error('TRANSFER_SOURCE_NOT_ACTIVE');
  return { migrations: rows, sourceState: state.json };
}

export async function snapshotSelectedData(sourceClient) {
  await sourceClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await sourceClient.query("SET LOCAL TIME ZONE 'UTC'");
    const history = await historicalState(sourceClient);
    const structure = await metadata(sourceClient);
    const all = {}, selected = {};
    for (const table of SELECTED_TABLES) {
      all[table] = (await rawRows(sourceClient, table, structure.tables[table].primaryKey)).map(row => ({ ...row, values: JSON.parse(row.json) }));
      selected[table] = new Map(all[table].filter(row => table !== 'ip_report_events' && (!openStatuses[table] || openStatuses[table].includes(row.values.status))).map(row => [row.key, row]));
    }
    // Parent closure preserves even resolved reports still referenced by catalog
    // moderation, while unrelated closed requests are left behind.
    let changed = true;
    const parentIndexes = new Map();
    while (changed) {
      changed = false;
      for (const fk of structure.foreignKeys.filter(key => SELECTED_TABLES.includes(key.childTable))) {
        for (const child of selected[fk.childTable].values()) {
          const values = fk.childColumns.map(column => child.values[column]);
          if (values.some(value => value === null || value === undefined)) continue;
          if (fk.parentSchema !== 'findi' || !SELECTED_TABLES.includes(fk.parentTable)) throw new Error(`TRANSFER_EXCLUDED_PARENT: ${fk.childTable}.${fk.name}`);
          const indexKey = fk.parentTable + ':' + fk.parentColumns.join(',');
          if (!parentIndexes.has(indexKey)) parentIndexes.set(indexKey, new Map(all[fk.parentTable].map(row => [referenceKey(fk.parentColumns.map(column => row.values[column])), row])));
          const parent = parentIndexes.get(indexKey).get(referenceKey(values));
          if (!parent) throw new Error(`TRANSFER_MISSING_PARENT: ${fk.childTable}.${fk.name}`);
          if (!selected[fk.parentTable].has(parent.key)) { selected[fk.parentTable].set(parent.key, parent); changed = true; }
        }
      }
      const reportIds = new Set([...selected.ip_reports.values()].map(row => row.values.id));
      for (const event of all.ip_report_events) if (reportIds.has(event.values.report_id) && !selected.ip_report_events.has(event.key)) { selected.ip_report_events.set(event.key, event); changed = true; }
    }
    const tables = {};
    for (const table of SELECTED_TABLES) {
      const rows = [...selected[table].values()].map(({ key, json }) => ({ key, json })).sort(compare);
      tables[table] = { ...structure.tables[table], rows, sourceCount: all[table].length, count: rows.length, sha256: rowHash(rows) };
    }
    const snapshot = { version: 1, ...history, foreignKeys: structure.foreignKeys.filter(key => SELECTED_TABLES.includes(key.childTable)), tables };
    snapshot.manifest = Object.fromEntries(Object.entries(tables).map(([table, info]) => [table, { count: info.count, sha256: info.sha256 }]));
    snapshot.dtoManifest = await expectedDtoHashes(snapshot);
    snapshot.excludedSource = {};
    for (const table of EXCLUDED_TABLES) {
      if (!(await sourceClient.query('SELECT to_regclass($1) AS relation', [`findi.${table}`])).rows[0].relation) continue;
      snapshot.excludedSource[table] = (await sourceClient.query(`SELECT count(*)::int AS count FROM ${relation(table)}`)).rows[0].count;
    }
    await sourceClient.query('COMMIT');
    return snapshot;
  } catch (error) { await sourceClient.query('ROLLBACK'); throw error; }
}

function validateSnapshot(snapshot) {
  if (snapshot?.version !== 1 || Object.keys(snapshot.tables || {}).length !== SELECTED_TABLES.length || Object.keys(snapshot.tables).some(table => !SELECTED_TABLES.includes(table))) throw new Error('TRANSFER_SNAPSHOT_INVALID');
  for (const table of SELECTED_TABLES) {
    const info = snapshot.tables[table];
    if (!Array.isArray(info.rows) || info.count !== info.rows.length || info.sha256 !== rowHash(info.rows)) throw new Error(`TRANSFER_SNAPSHOT_HASH_MISMATCH: ${table}`);
  }
}

function insertOrder(snapshot) {
  const remaining = new Set(SELECTED_TABLES), ordered = [];
  while (remaining.size) {
    const ready = [...remaining].filter(table => snapshot.foreignKeys.filter(fk => fk.childTable === table).every(fk => {
      if (fk.childColumns.every(column => stagedColumns.get(table)?.includes(column))) {
        if (!fk.nullable.every(Boolean)) throw new Error(`TRANSFER_NON_NULL_CYCLE: ${table}.${fk.name}`);
        return true;
      }
      return !remaining.has(fk.parentTable);
    }));
    if (!ready.length) throw new Error('TRANSFER_UNSUPPORTED_FOREIGN_KEY_CYCLE');
    for (const table of ready) { remaining.delete(table); ordered.push(table); }
  }
  return ordered;
}

async function verify(client, snapshot) {
  const report = { verified: true, tables: {}, excluded: {} };
  for (const table of SELECTED_TABLES) {
    const expected = snapshot.tables[table];
    const rows = await rawRows(client, table, expected.primaryKey);
    const sha256 = rowHash(rows);
    if (rows.length !== expected.count || sha256 !== expected.sha256) throw new Error(`TRANSFER_TARGET_MISMATCH: ${table}`);
    report.tables[table] = { count: rows.length, sha256 };
  }
  for (const table of EXCLUDED_TABLES) {
    const exists = (await client.query('SELECT to_regclass($1) AS relation', [`findi.${table}`])).rows[0].relation;
    if (!exists) continue;
    const count = (await client.query(`SELECT count(*)::int AS count FROM ${relation(table)}`)).rows[0].count;
    if (count !== 0) throw new Error(`TRANSFER_EXCLUDED_NOT_EMPTY: ${table}`);
    report.excluded[table] = count;
  }
  for (const table of ['source_documents', 'issues']) {
    const count = (await client.query(`SELECT count(*)::int AS count FROM findi_migration.${quote(table)}`)).rows[0].count;
    if (count !== 0) throw new Error(`TRANSFER_STAGING_NOT_EMPTY: ${table}`);
  }
  return report;
}

export async function verifySelectedData(targetClient, snapshot) {
  validateSnapshot(snapshot);
  await targetClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await targetClient.query("SET LOCAL TIME ZONE 'UTC'");
    const result = await verify(targetClient, snapshot);
    await targetClient.query('COMMIT');
    return result;
  } catch (error) { await targetClient.query('ROLLBACK'); throw error; }
}

export async function applySelectedData(targetClient, snapshot) {
  validateSnapshot(snapshot);
  const ordered = insertOrder(snapshot);
  await targetClient.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    await targetClient.query("SET LOCAL TIME ZONE 'UTC'");
    await targetClient.query('SELECT pg_advisory_xact_lock(583728494)');
    const target = await metadata(targetClient);
    for (const table of SELECTED_TABLES) {
      if (JSON.stringify(target.tables[table]) !== JSON.stringify({ columns: snapshot.tables[table].columns, primaryKey: snapshot.tables[table].primaryKey })) throw new Error(`TRANSFER_SCHEMA_MISMATCH: ${table}`);
      if ((await targetClient.query(`SELECT count(*)::int AS count FROM ${relation(table)}`)).rows[0].count !== 0) throw new Error(`TRANSFER_TARGET_NOT_EMPTY: ${table}`);
    }
    for (const table of ordered) {
      const info = snapshot.tables[table];
      const columns = info.columns.filter(column => column.is_generated === 'NEVER').map(column => column.column_name);
      const values = columns.map(column => stagedColumns.get(table)?.includes(column) ? 'NULL' : `record.${quote(column)}`);
      for (let offset = 0; offset < info.rows.length; offset += 500) {
        const payload = '[' + info.rows.slice(offset, offset + 500).map(row => row.json).join(',') + ']';
        await targetClient.query(`INSERT INTO ${relation(table)} (${columns.map(quote).join(',')}) SELECT ${values.join(',')} FROM jsonb_populate_recordset(NULL::${relation(table)},$1::jsonb) record`, [payload]);
      }
    }
    for (const [table, delayed] of stagedColumns) {
      const info = snapshot.tables[table];
      const payload = '[' + info.rows.map(row => row.json).join(',') + ']';
      if (!info.rows.length) continue;
      await targetClient.query(`UPDATE ${relation(table)} target SET ${delayed.map(column => `${quote(column)}=record.${quote(column)}`).join(',')} FROM jsonb_populate_recordset(NULL::${relation(table)},$1::jsonb) record WHERE ${info.primaryKey.map(column => `target.${quote(column)}=record.${quote(column)}`).join(' AND ')}`, [payload]);
    }
    // Locations are derived by the existing triggers. Their reference geography
    // may have been inserted after users, so recompute links with unchanged data.
    await targetClient.query('UPDATE findi.users SET region=region');
    await targetClient.query('UPDATE findi.stores SET region=region');
    const report = await verify(targetClient, snapshot);
    await targetClient.query('COMMIT');
    return report;
  } catch (error) { await targetClient.query('ROLLBACK'); throw error; }
}
