const assert = require('node:assert/strict');
const test = require('node:test');

test('tab visibility and blur signals in one transition count as one violation', async () => {
  const { createViolationDeduper } = await import('../src/lib/violationDeduper.ts');
  let now = 1_000;
  const deduper = createViolationDeduper(750, () => now);

  assert.equal(deduper.shouldRecord('visibilitychange'), true);
  now = 1_050;
  assert.equal(deduper.shouldRecord('blur'), false);
  now = 1_800;
  assert.equal(deduper.shouldRecord('blur'), true);
});
