import test from 'node:test';
import assert from 'node:assert/strict';
import {storeAnalyticsPeriod} from '../lib/domain/store-analytics-schedule.js';
test('summer intervals share a claim within two hours and advance at the next cut', () => {
  assert.deepEqual(storeAnalyticsPeriod(new Date('2026-10-11T05:00:00Z')), {date:'2026-10-11',key:'2026-10-11T02'});
  assert.equal(storeAnalyticsPeriod(new Date('2026-10-11T06:59:59Z')).key,'2026-10-11T02');
  assert.equal(storeAnalyticsPeriod(new Date('2026-10-11T07:00:00Z')).key,'2026-10-11T04');
});
test('midnight belongs to the new local date in summer and winter', () => {
  assert.equal(storeAnalyticsPeriod(new Date('2026-10-12T02:59:59Z')).key,'2026-10-11T22');
  assert.equal(storeAnalyticsPeriod(new Date('2026-10-12T03:00:00Z')).key,'2026-10-12T00');
  assert.equal(storeAnalyticsPeriod(new Date('2026-06-12T03:59:59Z')).key,'2026-06-11T22');
  assert.equal(storeAnalyticsPeriod(new Date('2026-06-12T04:00:00Z')).key,'2026-06-12T00');
});
