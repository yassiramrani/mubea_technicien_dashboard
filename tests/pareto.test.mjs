import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPareto, PARETO_TARGET_SHARE } from '../src/lib/pareto.ts';

const tools = [
  { name: 'A', usageCount: 50, isOverdue: false },
  { name: 'B', usageCount: 30, isOverdue: true },
  { name: 'C', usageCount: 10, isOverdue: true },
  { name: 'D', usageCount: 5, isOverdue: false },
  { name: 'E', usageCount: 5, isOverdue: true },
  { name: 'Unused', usageCount: 0, isOverdue: true },
];
const othersLabel = 'Other tools ({count})';

test('ranks by uses, computes the cumulative share and keeps the target share at 80%', () => {
  const { data, totalUses, vitalFew } = buildPareto(tools, 0, othersLabel);
  assert.equal(totalUses, 100);
  assert.equal(PARETO_TARGET_SHARE, 80);
  assert.deepEqual(data.map(r => r.name), ['A','B','C','D','E']);
  assert.deepEqual(data.map(r => r.uses), [50,30,10,5,5]);
  assert.deepEqual(data.map(r => r.cumulative), [50,80,90,95,100]);
  assert.equal(vitalFew, 2);
});
test('groups the tools past the limit into a single row that is never red', () => {
  const { data } = buildPareto(tools, 3, othersLabel);
  assert.deepEqual(data.map(r => r.name), ['A','B','C','Other tools (2)']);
  assert.deepEqual(data.map(r => r.uses), [50,30,10,10]);
  assert.deepEqual(data.map(r => r.cumulative), [50,80,90,100]);
  assert.equal(data[3].overdue, false);
});
test('flags exactly the overdue tools, and only on their own bar', () => {
  const { data } = buildPareto(tools, 0, othersLabel);
  assert.deepEqual(data.map(r => r.overdue), [false,true,true,false,true]);
});
test('drops unused tools and leaves the source order untouched', () => {
  const before = tools.map(t => t.name);
  const { data, totalUses } = buildPareto(tools, 0, othersLabel);
  assert.equal(totalUses, 100);
  assert.deepEqual(tools.map(t => t.name), before);
  assert.ok(!data.some(r => r.name === 'Unused'));
});
test('handles an empty or fully unused inventory', () => {
  for (const input of [[], [{ name: 'Unused', usageCount: 0 }]]) {
    const { data, totalUses, vitalFew } = buildPareto(input, 15, othersLabel);
    assert.deepEqual(data, []);
    assert.equal(totalUses, 0);
    assert.equal(vitalFew, 0);
  }
});
