import {CURRENT_STORE_AGREEMENT_VERSION} from '../lib/legal.js';
import {storeAgreementDocumentHash} from './store-agreement.service.js';
import {pilotStoresEnabled} from './pilot-stores.service.js';
import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
interface Queryable { query(text: string, values?: any[]): Promise<any>; }
export function chileVisitDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function visitKey(ip: string, secret: string, date: string): string | null {
  let address = ip.replace(/^::ffff:/i,'');
  const version = isIP(address);
  if (!version || secret.length < 32) return null;
  if (version === 6) address = new URL(`http://[${address}]/`).hostname.toLowerCase();
  return createHmac('sha256',secret).update(`${date}\0${address}`).digest('hex');
}
export async function recordUniqueVisit(database: Queryable, ip: string, secret: string, now=new Date()): Promise<boolean> {
  const date=chileVisitDate(now), key=visitKey(ip,secret,date);
  if (!key) return false;
  const result=await database.query(`WITH added AS (
    INSERT INTO findi.visit_daily_keys(visit_date,visitor_key,expires_at)
    VALUES ($1::date,$2,($1::date+1)::timestamp AT TIME ZONE 'America/Santiago')
    ON CONFLICT DO NOTHING RETURNING visit_date
  ) INSERT INTO findi.visit_daily_totals(visit_date,unique_visits)
    SELECT visit_date,1 FROM added
    ON CONFLICT(visit_date) DO UPDATE SET unique_visits=findi.visit_daily_totals.unique_visits+1
    RETURNING unique_visits`,[date,key]);
  return result.rows.length>0;
}
export async function pruneVisitAnalytics(database: Queryable, now=new Date()): Promise<void> {
  await database.query('DELETE FROM findi.visit_daily_keys WHERE expires_at <= $1',[now.toISOString()]);
  await database.query('DELETE FROM findi.visit_daily_totals WHERE visit_date < $1::date-89',[chileVisitDate(now)]);
}
export async function adminVisitDashboard(database: Queryable, now=new Date()) {
  const date=chileVisitDate(now);
  const result=await database.query(`SELECT
   coalesce((SELECT unique_visits FROM findi.visit_daily_totals WHERE visit_date=$1::date),0)::int AS today,
   coalesce((SELECT sum(unique_visits) FROM findi.visit_daily_totals WHERE visit_date BETWEEN $1::date-6 AND $1::date),0)::int AS week,
   coalesce((SELECT sum(unique_visits) FROM findi.visit_daily_totals WHERE visit_date BETWEEN $1::date-29 AND $1::date),0)::int AS month,
   (SELECT count(*) FROM findi.users WHERE role='maestro')::int AS maestros,
   (SELECT count(*) FROM findi.stores WHERE status='activo')::int AS stores,
   (SELECT count(*) FROM findi.stores WHERE status='activo' AND api_payload->>'esPrueba'='true')::int AS demo_stores,
   (SELECT count(*) FROM findi.products WHERE deleted_at IS NULL AND status='activo')::int AS products,
   (SELECT count(*) FROM findi.offers o JOIN findi.stores s ON s.id=o.store_id JOIN findi.users u ON u.id=s.owner_id JOIN findi.products p ON p.id=o.product_id WHERE o.active AND o.published AND o.stock>0 AND s.status='activo' AND u.account_status='activo' AND p.status='activo' AND p.deleted_at IS NULL AND ($3::boolean OR (s.api_payload->>'esPrueba' IS DISTINCT FROM 'true' AND p.api_payload->>'esPrueba' IS DISTINCT FROM 'true' AND o.api_payload->>'esPrueba' IS DISTINCT FROM 'true')) AND ((s.agreement_status='vigente' AND s.agreement_version=$4 AND s.agreement_document_hash=$5) OR ($3::boolean AND s.api_payload->>'esPrueba'='true')) AND (o.valid_until IS NULL OR o.valid_until>$2::timestamptz) AND (o.valid_from IS NULL OR o.valid_from<=$2::timestamptz))::int AS offers,
   (SELECT count(*) FROM findi.quotations)::int AS quotations,
   (SELECT count(*) FROM findi.quotations WHERE created_at >= $1::date::timestamp AT TIME ZONE 'America/Santiago')::int AS quotations_today,
   (SELECT count(*) FROM findi.product_requests WHERE status='pendiente')::int AS pending_requests,
   (SELECT min(visit_date)::text FROM findi.visit_daily_totals) AS tracking_since`,[date,now.toISOString(),pilotStoresEnabled(),CURRENT_STORE_AGREEMENT_VERSION,storeAgreementDocumentHash()]);
  const days=await database.query(`SELECT d::date::text AS date,coalesce(t.unique_visits,0)::int AS visits
    FROM generate_series($1::date-13,$1::date,interval '1 day') d
    LEFT JOIN findi.visit_daily_totals t ON t.visit_date=d::date ORDER BY d`,[date]);
  return {computedAt:now.toISOString(),timeZone:'America/Santiago',...result.rows[0],days:days.rows};
}
