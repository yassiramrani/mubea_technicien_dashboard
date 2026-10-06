import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPurchaseGuide } from '../src/lib/purchaseGuide.ts';

const tools = [
  { id: 'b1', name: 'Torque wrench', status: 'ASSIGNED', usageCount: 50 },
  { id: 'b2', name: 'Drill', status: 'AVAILABLE', usageCount: 30 },
  { id: 'b3', name: 'Grinder', status: 'ASSIGNED', usageCount: 12 },
  { id: 'm1', name: 'Gauge', status: 'AVAILABLE', usageCount: 3 },
  { id: 'z1', name: 'Special key', status: 'AVAILABLE', usageCount: 0 },
  { id: 'z2', name: 'Old pump', status: 'ASSIGNED', usageCount: 0 },
];

test('most used is ranked by uses and flags the busy tools that are out', () => {
  const { mostUsed } = buildPurchaseGuide(tools, 3);
  assert.deepEqual(mostUsed.map(e => e.id), ['b1','b2','b3']);
  assert.deepEqual(mostUsed.map(e => e.verdict), ['order','watch','order']);
  assert.deepEqual(mostUsed.map(e => e.out), [true,false,true]);
});
test('least used starts with the never scanned tools and never repeats a most-used tool', () => {
  const { mostUsed, leastUsed } = buildPurchaseGuide(tools, 3);
  const shown = new Set(mostUsed.map(e => e.id));
  assert.deepEqual(leastUsed.map(e => e.id), ['z2','z1','m1']);
  assert.deepEqual(leastUsed.map(e => e.verdict), ['never','never','rarely']);
  assert.ok(leastUsed.every(e => !shown.has(e.id)));
});
test('when the limit covers the inventory the two lists stay disjoint', () => {
  const { mostUsed, leastUsed } = buildPurchaseGuide(tools, 5);
  assert.equal(mostUsed.length, 4);
  assert.deepEqual(leastUsed.map(e => e.id), ['z2','z1']);
  assert.deepEqual(leastUsed.map(e => e.verdict), ['never','never']);
  const ids = [...mostUsed, ...leastUsed].map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
});
test('ties are broken by name so the order is stable', () => {
  const tied = [
    { id: 't1', name: 'Bravo', status: 'AVAILABLE', usageCount: 0 },
    { id: 't2', name: 'Alpha', status: 'AVAILABLE', usageCount: 0 },
    { id: 't3', name: 'Charlie', status: 'AVAILABLE', usageCount: 4 },
    { id: 't4', name: 'Echo', status: 'AVAILABLE', usageCount: 4 },
  ];
  const { mostUsed, leastUsed } = buildPurchaseGuide(tied, 2);
  assert.deepEqual(mostUsed.map(e => e.name), ['Charlie','Echo']);
  assert.deepEqual(leastUsed.map(e => e.name), ['Alpha','Bravo']);
});
test('an inventory without scans produces empty most-used and least-used lists', () => {
  const { mostUsed, leastUsed } = buildPurchaseGuide([], 5);
  assert.deepEqual(mostUsed, []);
  assert.deepEqual(leastUsed, []);
  const unused = buildPurchaseGuide([{ id: 'a', name: 'A', status: 'AVAILABLE', usageCount: 0 }], 5);
  assert.deepEqual(unused.mostUsed, []);
  assert.deepEqual(unused.leastUsed.map(e => e.verdict), ['never']);
});
