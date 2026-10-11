import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {recordUniqueVisit,visitKey,adminVisitDashboard,pruneVisitAnalytics} from '../lib/services/visit-analytics.service.js';
import {visitAnalyticsRouter} from '../lib/routes/visit-analytics.routes.js';
import {requireAuth} from '../lib/lib/auth.js';
const secret='test-key-for-analytics-at-least-32-characters';
test('IP keys normalize IPv4 and IPv6 and change daily without exposing the address',()=>{
 const key=visitKey('203.0.113.2',secret,'2026-10-11');assert.match(key,/^[a-f0-9]{64}$/);
 assert.equal(key,visitKey('::ffff:203.0.113.2',secret,'2026-10-11'));
 assert.equal(visitKey('2001:0db8:0:0:0:0:0:1',secret,'2026-10-11'),visitKey('2001:db8::1',secret,'2026-10-11'));
 assert.notEqual(key,visitKey('203.0.113.2',secret,'2026-10-12'));assert.equal(visitKey('unknown',secret,'2026-10-11'),null);
});
test('unauthorized analytics does not reach storage, and admin reports require authentication',async()=>{
 const route=visitAnalyticsRouter.stack.find(l=>l.route?.path==='/analytics/visit').route;
 let status,body;const res={set(){return this;},status(s){status=s;return this;},json(b){body=b;return this;}};
 await route.stack[0].handle({get:()=>undefined,body:{analyticsConsent:false,ip:'203.0.113.2'}},res);
 assert.equal(status,400);assert.equal(body.error.code,'ANALYTICS_CONSENT_REQUIRED');
 await route.stack[0].handle({baseUrl:'/api',get:()=>undefined,body:{analyticsConsent:true,consentVersion:3}},res);assert.equal(status,400);assert.equal(body.error.code,'ANALYTICS_DIRECT_ENDPOINT_REQUIRED');
 const admin=visitAnalyticsRouter.stack.find(l=>l.route?.path==='/admin/dashboard').route;
 assert.equal(admin.stack[0].handle,requireAuth);assert.equal(admin.stack.length,3);
 let denied;await admin.stack[1].handle({authUserId:'master',authRole:'maestro'},res,()=>{denied=false;});assert.equal(status,403);
});
test('SQL counts an IP once per Chilean day, keeps daily totals after expiring keys and reports empty days',async t=>{
 const pg=new PGlite();t.after(()=>pg.close());
 for(const file of ['001-schema.sql','002-public-views.sql','003-security.sql','005-runtime-compatibility.sql','014-visit-analytics.sql'])await pg.exec(await readFile(new URL('../../sql/findi/'+file,import.meta.url),'utf8'));
 const now=new Date('2026-10-11T16:00:00Z');
 assert.equal(await recordUniqueVisit(pg,'203.0.113.2',secret,now),true);
 assert.equal(await recordUniqueVisit(pg,'203.0.113.2',secret,now),false);
 assert.equal(await recordUniqueVisit(pg,'203.0.113.3',secret,now),true);
 assert.equal(await recordUniqueVisit(pg,'203.0.113.2',secret,new Date('2026-10-12T03:00:00Z')),true);
 const report=await adminVisitDashboard(pg,new Date('2026-10-12T04:00:00Z'));
 assert.equal(report.today,1);assert.equal(report.week,3);assert.equal(report.month,3);assert.equal(report.days.length,14);assert.equal(report.days.at(-2).visits,2);
 await pruneVisitAnalytics(pg,new Date('2026-10-12T04:00:00Z'));
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.visit_daily_keys')).rows[0].n,1);
 assert.equal((await adminVisitDashboard(pg,new Date('2026-10-12T04:00:00Z'))).week,3);
 assert.equal((await pg.query("SELECT column_name FROM information_schema.columns WHERE table_schema='findi' AND table_name='visit_daily_keys' AND column_name LIKE '%ip%'")).rows.length,0);
 await pruneVisitAnalytics(pg,new Date('2027-02-01T05:00:00Z'));
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.visit_daily_totals')).rows[0].n,0);
});
