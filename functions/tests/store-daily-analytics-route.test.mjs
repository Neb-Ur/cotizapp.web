import test from 'node:test';import assert from 'node:assert/strict';
import {storeMetricsRouter} from '../lib/routes/store-metrics.routes.js';
import {requireAuth} from '../lib/lib/auth.js';
import {refreshStoreDailyAnalytics} from '../lib/jobs/store-daily-analytics.job.js';
const route=storeMetricsRouter.stack.find(layer=>layer.route?.path==='/ferreterias/propietario/:ownerId/dashboard').route;
test('the daily dashboard is authenticated and role-protected',()=>{
 assert.equal(route.stack[0].handle,requireAuth);assert.equal(route.stack.length,3);
});
test('a store cannot read another owners daily snapshot',async()=>{
 let status,body;const res={status(value){status=value;return this;},json(value){body=value;return this;}};
 await route.stack.at(-1).handle({authUserId:'owner',authRole:'ferreteria',params:{ownerId:'other'}},res);
 assert.equal(status,403);assert.equal(body.error.code,'AUTH_FORBIDDEN');
});
test('daily analytics run at night in Chile with bounded concurrency and no automatic retries',()=>{
 const endpoint=refreshStoreDailyAnalytics.__endpoint;
 assert.equal(endpoint.scheduleTrigger.schedule,'0 2 * * *');assert.equal(endpoint.scheduleTrigger.timeZone,'America/Santiago');assert.equal(endpoint.concurrency,1);
});
