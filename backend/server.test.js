// Run: node --test backend/server.test.js   (no install needed)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('./server.js');

const ORIGIN = 'https://mcaronnewrelic.github.io';
const TP = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

// Records what the server asks the APM agent to do.
function fakeNewRelic() {
  const calls = { attrs: [], errors: [] };
  return {
    calls,
    addCustomAttribute: (k, v) => calls.attrs.push([k, v]),
    noticeError: (e) => calls.errors.push(e.message),
    getTraceMetadata: () => ({ traceId: '4bf92f3577b34da6a3ce929d0e0e4736', spanId: 'aaaaaaaaaaaaaaaa' })
  };
}

async function withServer(opts, fn) {
  const server = createServer(Object.assign({ allowedOrigins: [ORIGIN] }, opts));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try { await fn(base); } finally { await new Promise(r => server.close(r)); }
}

test('preflight allows the trace headers for an allowed origin', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base + '/api/products', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'newrelic,traceparent,tracestate' }
    });
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), ORIGIN);
    const allowed = res.headers.get('access-control-allow-headers').toLowerCase();
    ['newrelic', 'traceparent', 'tracestate', 'content-type'].forEach(h => assert.ok(allowed.includes(h), h));
    assert.ok(res.headers.get('access-control-allow-methods').includes('POST'));
  });
});

test('private network preflight is answered for allowed origins', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base + '/api/products', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Private-Network': 'true' }
    });
    assert.strictEqual(res.headers.get('access-control-allow-private-network'), 'true');
  });
});

test('unknown origins get no CORS allow header', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(base + '/api/products', { headers: { Origin: 'https://evil.example' } });
    assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
  });
});

test('API responses echo received trace headers and APM trace metadata', async () => {
  const nr = fakeNewRelic();
  await withServer({ nr }, async (base) => {
    const res = await fetch(base + '/api/products?demoCode=NR-AB12&demoUser=Ada&rid=R1', {
      headers: { Origin: ORIGIN, traceparent: TP, tracestate: '123@nr=0-1', newrelic: 'eyJ2Ijp9' }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data.products) && body.data.products.length > 0);
    assert.strictEqual(body.trace.received.traceparent, TP);
    assert.strictEqual(body.trace.received.tracestate, '123@nr=0-1');
    assert.strictEqual(body.trace.received.newrelic, true);
    assert.deepStrictEqual(body.trace.apm, { traceId: '4bf92f3577b34da6a3ce929d0e0e4736', spanId: 'aaaaaaaaaaaaaaaa' });
    assert.deepStrictEqual(nr.calls.attrs, [['demoCode', 'NR-AB12'], ['demoUser', 'Ada']]);
  });
});

test('without an APM agent, apm is null and nothing throws', async () => {
  await withServer({ nr: null }, async (base) => {
    const body = await (await fetch(base + '/api/cart')).json();
    assert.strictEqual(body.trace.apm, null);
    assert.strictEqual(body.trace.received.traceparent, null);
    assert.strictEqual(body.trace.received.newrelic, false);
  });
});

test('checkout calls internal inventory and payment services', async () => {
  const seen = [];
  await withServer({ nr: null, onRequest: (p) => seen.push(p) }, async (base) => {
    const res = await fetch(base + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.match(body.data.orderId, /^ORD-/);
    assert.deepStrictEqual(body.data.steps.map(s => s.service), ['inventory', 'payment']);
    assert.ok(seen.includes('/internal/inventory') && seen.includes('/internal/payment'));
  });
});

test('slow waits the requested time, capped at 5000 ms', async () => {
  const waits = [];
  const sleep = (ms) => { waits.push(ms); return Promise.resolve(); };
  await withServer({ nr: null, sleep }, async (base) => {
    await fetch(base + '/api/slow?ms=1500');
    await fetch(base + '/api/slow?ms=999999');
    await fetch(base + '/api/slow?ms=abc');
  });
  assert.deepStrictEqual(waits, [1500, 5000, 1000]);
});

test('fail returns 500 and reports the error to APM', async () => {
  const nr = fakeNewRelic();
  await withServer({ nr }, async (base) => {
    const res = await fetch(base + '/api/fail?demoCode=NR-AB12');
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.ok(body.error);
    assert.ok(body.trace, 'trace info still returned on errors');
    assert.strictEqual(nr.calls.errors.length, 1);
    assert.ok(nr.calls.errors[0].includes('NR-AB12'));
  });
});

test('unknown API routes return a JSON 404 with trace info', async () => {
  await withServer({ nr: null }, async (base) => {
    const res = await fetch(base + '/api/missing');
    assert.strictEqual(res.status, 404);
    assert.ok((await res.json()).trace);
  });
});

test('health reports whether APM is attached', async () => {
  await withServer({ nr: fakeNewRelic() }, async (base) => {
    assert.deepStrictEqual((await (await fetch(base + '/api/health')).json()).data, { ok: true, apm: true });
  });
});
