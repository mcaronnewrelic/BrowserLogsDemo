'use strict';
// Demo backend for tracing.html. Zero dependencies apart from the New Relic agent,
// which loads only when NEW_RELIC_LICENSE_KEY is set. It must be required before
// anything else so it can instrument the http module.
const nr = process.env.NEW_RELIC_LICENSE_KEY ? require('newrelic') : null;

const http = require('node:http');

const DEFAULT_ORIGINS = ['https://mcaronnewrelic.github.io', 'http://localhost:8080', 'http://127.0.0.1:8080'];
const ALLOW_HEADERS = 'newrelic, traceparent, tracestate, content-type';
const MAX_SLOW_MS = 5000;

const PRODUCTS = [
  { sku: 'NR-TEE', name: 'Observability tee', price: 24 },
  { sku: 'NR-MUG', name: 'Golden signals mug', price: 16 },
  { sku: 'NR-HOOD', name: 'Full-stack hoodie', price: 58 },
  { sku: 'NR-STICK', name: 'Sticker pack', price: 6 }
];

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rid = (prefix) => prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

function createServer(opts) {
  opts = opts || {};
  const agent = 'nr' in opts ? opts.nr : nr;
  const allowedOrigins = opts.allowedOrigins || DEFAULT_ORIGINS;
  const sleep = opts.sleep || defaultSleep;
  const onRequest = opts.onRequest || function () {};

  function apm(method) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (agent && typeof agent[method] === 'function') {
      try { return agent[method].apply(agent, args); } catch (e) { /* never break the demo */ }
    }
    return undefined;
  }

  function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
      // Lets a public page (GitHub Pages) call this server when it runs on localhost.
      if (req.headers['access-control-request-private-network'] === 'true') {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
      }
    }
  }

  function traceInfo(req) {
    const meta = agent ? apm('getTraceMetadata') : null;
    return {
      received: {
        traceparent: req.headers.traceparent || null,
        tracestate: req.headers.tracestate || null,
        newrelic: Boolean(req.headers.newrelic)
      },
      apm: meta && meta.traceId ? { traceId: meta.traceId, spanId: meta.spanId } : null
    };
  }

  function send(req, res, status, payload) {
    const body = JSON.stringify(Object.assign({}, payload, { trace: traceInfo(req) }));
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  }

  // Calls another endpoint on this same server over HTTP. The APM agent sees an
  // outbound request plus a new inbound transaction, which shows up as child spans.
  function callInternal(server, path) {
    return new Promise((resolve, reject) => {
      const port = server.address().port;
      const r = http.request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (resp) => {
        let data = '';
        resp.on('data', (c) => { data += c; });
        resp.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
      });
      r.on('error', reject);
      r.end('{}');
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    onRequest(path);
    cors(req, res);

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const demoCode = url.searchParams.get('demoCode');
    const demoUser = url.searchParams.get('demoUser');
    if (demoCode) apm('addCustomAttribute', 'demoCode', demoCode.slice(0, 32));
    if (demoUser) apm('addCustomAttribute', 'demoUser', demoUser.slice(0, 64));

    try {
      if (path === '/' || path === '/api/health') {
        apm('setTransactionName', 'api/health');
        return send(req, res, 200, { data: { ok: true, apm: Boolean(agent) } });
      }
      if (path === '/api/products' && req.method === 'GET') {
        apm('setTransactionName', 'api/products');
        return send(req, res, 200, { data: { products: PRODUCTS } });
      }
      if (path === '/api/cart' && req.method === 'GET') {
        apm('setTransactionName', 'api/cart');
        return send(req, res, 200, { data: { items: [{ sku: 'NR-TEE', qty: 2 }, { sku: 'NR-MUG', qty: 1 }], total: 64 } });
      }
      if (path === '/api/checkout' && req.method === 'POST') {
        apm('setTransactionName', 'api/checkout');
        const inventory = await callInternal(server, '/internal/inventory');
        const payment = await callInternal(server, '/internal/payment');
        return send(req, res, 200, { data: { orderId: rid('ORD'), steps: [inventory.data, payment.data] } });
      }
      if (path.startsWith('/api/orders/') && req.method === 'GET') {
        apm('setTransactionName', 'api/orders/:id');
        return send(req, res, 200, { data: { orderId: path.split('/').pop(), status: 'confirmed' } });
      }
      if (path === '/api/slow') {
        apm('setTransactionName', 'api/slow');
        const asked = parseInt(url.searchParams.get('ms'), 10);
        const ms = Math.min(Number.isFinite(asked) && asked > 0 ? asked : 1000, MAX_SLOW_MS);
        await sleep(ms);
        return send(req, res, 200, { data: { waitedMs: ms } });
      }
      if (path === '/api/fail') {
        apm('setTransactionName', 'api/fail');
        const err = new Error('Payment service unavailable' + (demoCode ? ' [' + demoCode + ']' : ''));
        apm('noticeError', err);
        return send(req, res, 500, { error: err.message });
      }
      if (path === '/internal/inventory') {
        apm('setTransactionName', 'internal/inventory');
        await sleep(40);
        return send(req, res, 200, { data: { service: 'inventory', reserved: true } });
      }
      if (path === '/internal/payment') {
        apm('setTransactionName', 'internal/payment');
        await sleep(120);
        return send(req, res, 200, { data: { service: 'payment', authorized: true } });
      }
      apm('setTransactionName', 'not-found');
      return send(req, res, 404, { error: 'Not found: ' + path });
    } catch (err) {
      apm('noticeError', err);
      return send(req, res, 500, { error: 'Unexpected server error' });
    }
  });
  return server;
}

module.exports = { createServer };

if (require.main === module) {
  const origins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
  const port = Number(process.env.PORT) || 3000;
  createServer({ allowedOrigins: origins }).listen(port, () => {
    console.log('Tracing demo backend on port ' + port + (nr ? ' with New Relic APM' : ' (no NEW_RELIC_LICENSE_KEY, APM off)'));
    console.log('Allowed origins: ' + origins.join(', '));
  });
}
