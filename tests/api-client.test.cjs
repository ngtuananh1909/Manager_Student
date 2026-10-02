const assert = require('node:assert/strict');
const test = require('node:test');

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test('apiFetch attaches the opaque session without overwriting caller headers', async () => {
  global.sessionStorage = createStorage();
  global.window = { dispatchEvent() {} };
  let captured = null;
  global.fetch = async (input, init) => {
    captured = { input, init };
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const api = await import('../src/lib/api.ts');
  api.setAccessToken('opaque-token');
  await api.apiFetch('http://127.0.0.1:4000/api/settings', {
    headers: { 'X-Request-ID': 'test-request' }
  });

  const headers = new Headers(captured.init.headers);
  assert.equal(headers.get('Authorization'), 'Bearer opaque-token');
  assert.equal(headers.get('X-Request-ID'), 'test-request');
});

test('apiFetch clears an expired token after a 401 response', async () => {
  global.sessionStorage = createStorage();
  let dispatched = false;
  global.window = { dispatchEvent() { dispatched = true; } };
  global.fetch = async () => new Response('{}', { status: 401 });

  const api = await import('../src/lib/api.ts');
  api.setAccessToken('expired-token');
  await api.apiFetch('http://127.0.0.1:4000/api/settings');

  assert.equal(api.getAccessToken(), null);
  assert.equal(dispatched, true);
});

test('downloadAuthenticatedFile downloads a protected response through apiFetch', async () => {
  global.sessionStorage = createStorage();
  global.window = { dispatchEvent() {} };
  let clicked = false;
  let appended = false;
  const anchor = { href: '', download: '', click() { clicked = true; }, remove() {} };
  global.document = {
    createElement() { return anchor; },
    body: { appendChild() { appended = true; } }
  };
  global.URL.createObjectURL = () => 'blob:authenticated';
  global.URL.revokeObjectURL = () => {};
  global.fetch = async () => new Response('report', { status: 200 });

  const api = await import('../src/lib/api.ts');
  api.setAccessToken('opaque-token');
  await api.downloadAuthenticatedFile('http://127.0.0.1:4000/api/export/csv', 'report.csv');

  assert.equal(appended, true);
  assert.equal(clicked, true);
  assert.equal(anchor.href, 'blob:authenticated');
  assert.equal(anchor.download, 'report.csv');
});
