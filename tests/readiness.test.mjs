import test from 'node:test';
import assert from 'node:assert/strict';
import { readiness } from '../src/lib/readiness.ts';

test('readiness requires auth configuration, a working database and a bounded response', async () => {
  let called = false;
  assert.deepEqual(await readiness(async () => { called = true; }, false), { status: 'unavailable' });
  assert.equal(called, false);
  assert.deepEqual(await readiness(async () => 1, true), { status: 'ok' });
  assert.deepEqual(await readiness(async () => { throw new Error('SECRET DATABASE URL'); }, true), { status: 'unavailable' });
  assert.deepEqual(await readiness(() => new Promise(() => {}), true, 10), { status: 'unavailable' });
});
