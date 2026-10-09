import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReport, reportWeight, jobTypeFor } from '../src/lib/verification.js';

test('report close to the facility counts fully and verifies on its own', () => {
  const v = evaluateReport({ hasFacility: true, type: 'broken', reporterKey: 'a', distanceM: 40, recent: [] });
  assert.deepEqual(v, { duplicate: false, weight: 1, verified: true });
});

test('far-away report counts 0.4 and stays unverified', () => {
  const v = evaluateReport({ hasFacility: true, type: 'dirty', reporterKey: 'a', distanceM: 5000, recent: [] });
  assert.equal(v.weight, 0.4);
  assert.equal(v.verified, false);
});

test('three far-away reports from different people corroborate each other', () => {
  const recent = [{ reporter_key: 'a', weight: 0.4 }, { reporter_key: 'b', weight: 0.4 }];
  const v = evaluateReport({ hasFacility: true, type: 'dirty', reporterKey: 'c', distanceM: 5000, recent });
  assert.equal(v.verified, true);
});

test('same reporter twice in a day is a duplicate', () => {
  const v = evaluateReport({ hasFacility: true, type: 'full', reporterKey: 'a', distanceM: 10, recent: [{ reporter_key: 'a', weight: 1 }] });
  assert.equal(v.duplicate, true);
  assert.equal(v.verified, false);
});

test('no GPS gives half weight; illegal dumping is accepted without a facility', () => {
  assert.equal(reportWeight({ hasFacility: true, distanceM: null }), 0.5);
  const v = evaluateReport({ hasFacility: false, type: 'dumping', reporterKey: 'a', distanceM: null, recent: [] });
  assert.equal(v.verified, true);
});

test('which reports raise a provider job', () => {
  assert.equal(jobTypeFor({ type: 'full', category: 'toilet' }), 'pit');
  assert.equal(jobTypeFor({ type: 'full', category: 'waste' }), 'waste');
  assert.equal(jobTypeFor({ type: 'broken', category: 'water' }), 'water');
  assert.equal(jobTypeFor({ type: 'dirty', category: 'toilet' }), null);
  assert.equal(jobTypeFor({ type: 'dumping' }), 'waste');
});
