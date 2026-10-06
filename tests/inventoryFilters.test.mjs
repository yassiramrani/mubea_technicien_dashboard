import test from 'node:test';
import assert from 'node:assert/strict';
import { filterInventory } from '../src/lib/inventoryFilters.ts';

const tools = [
  { id: 'a', name: 'Clé 10', qrCode: 'MUB-001', status: 'ASSIGNED', technician: { name: 'Yassir Amrani', idNumber: '1042' }, isOverdue: true, checkedOutAt: '2026-10-02T08:00:00Z', labelPrinted: false, usageCount: 4 },
  { id: 'b', name: 'Clé 2', qrCode: 'MUB-002', status: 'AVAILABLE', technician: null, isOverdue: false, checkedOutAt: '2026-09-01T08:00:00Z', labelPrinted: true, usageCount: 9 },
  { id: 'c', name: 'Drill', qrCode: 'MUB-003', status: 'ASSIGNED', technician: { name: 'Nadia', idNumber: '1043' }, isOverdue: false, checkedOutAt: '2026-10-05T08:00:00Z', labelPrinted: true, usageCount: 12 },
  { id: 'd', name: 'Gauge', qrCode: 'MUB-004', status: 'ASSIGNED', technician: { name: 'Omar' }, isOverdue: false, checkedOutAt: null, labelPrinted: false, usageCount: 0 },
];
const view = (overrides = {}) => filterInventory(tools, {search:'',status:'all',label:'all',sort:'name',lang:'en',...overrides});

test('search combines words and ignores accents, case and outer spaces', () => {
  assert.deepEqual(view({search:'  CLE amrani 1042 '}).map(t=>t.id), ['a']);
  assert.deepEqual(view({search:'mub-003'}).map(t=>t.id), ['c']);
  assert.equal(view({search:'missing'}).length, 0);
});
test('overdue status, pending labels and search intersect', () => {
  assert.deepEqual(view({status:'overdue',label:'pending',search:'Yassir'}).map(t=>t.id), ['a']);
  assert.equal(view({status:'overdue',label:'printed'}).length, 0);
  assert.deepEqual(view({status:'AVAILABLE'}).map(t=>t.id), ['b']);
});
test('oldest checkout ignores an available tool’s historical checkout', () => {
  assert.deepEqual(view({sort:'oldest'}).map(t=>t.id), ['a','c','b','d']);
});
test('natural name and usage sorting are deterministic without mutating source', () => {
  const original = tools.map(t=>t.id);
  assert.deepEqual(view().map(t=>t.id), ['b','a','c','d']);
  assert.deepEqual(view({sort:'usage'}).map(t=>t.id), ['c','b','a','d']);
  assert.deepEqual(tools.map(t=>t.id), original);
});
test('a pending-label filter includes both available and assigned tools', () => {
  assert.deepEqual(view({label:'pending'}).map(t=>t.id), ['a','d']);
  assert.deepEqual(filterInventory([], {search:'',status:'all',label:'all',sort:'name',lang:'fr'}), []);
});
