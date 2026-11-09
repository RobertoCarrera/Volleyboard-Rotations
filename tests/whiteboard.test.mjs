import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhiteboardHandler } from '../server/whiteboard.mjs';

const origin = 'https://volleyboard.sincronia.agency';
const env = { AUTH_ORIGIN: origin, NCB_DATA_API_URL: 'https://eu-api.nocodebackend.com', NCB_INSTANCE: 'test', NCB_SECRET_KEY: 'server-test-secret' };
const board = (rotation = 'R1') => JSON.stringify({ sets: [{ id: 1, name: 'Set 1', rotation, phase: 'receiving', roster: [] }], activeId: 1 });
const request = (user, method = 'GET', payload, headers = {}) => new Request(`${origin}/api/whiteboard`, {
  method,
  headers: { ...(user ? { cookie: `test-user=${user}` } : {}), ...(method === 'PUT' ? { origin, 'content-type': 'application/json' } : {}), ...headers },
  ...(payload ? { body: JSON.stringify(payload) } : {})
});

function fixture({ ignoreFilter = false, upstreamFailure = false, race = false, cacheReads = false } = {}) {
  const rows = [];
  const readCache = new Map();
  let calls = 0;
  const handle = createWhiteboardHandler({
    readSession: async (req) => {
      const id = req.headers.get('cookie')?.match(/^test-user=(.+)$/)?.[1];
      return id ? { user: { id } } : null;
    },
    fetchImpl: async (input, options = {}) => {
      calls++;
      const url = new URL(input);
      assert.equal(url.origin, 'https://eu-api.nocodebackend.com');
      assert.equal(new Headers(options.headers).get('authorization'), 'Bearer server-test-secret');
      assert.equal(url.searchParams.get('Instance'), 'test');
      if (upstreamFailure) return Response.json({ message: 'server-test-secret private upstream diagnostics' }, { status: 500 });
      if (url.pathname === '/read/whiteboard_sets') {
        const owner = url.searchParams.get('owner_key');
        assert.match(owner, /^[a-f0-9]{64}$/);
        const fresh = options.cache === 'no-store' && /no-cache/.test(new Headers(options.headers).get('cache-control') || '');
        if (cacheReads && !fresh && readCache.has(url.href)) return Response.json(readCache.get(url.href));
        const data = { status: 'success', data: structuredClone(rows.filter((row) => ignoreFilter || row.owner_key === owner)) };
        if (cacheReads && !fresh) readCache.set(url.href, data);
        return Response.json(data);
      }
      const payload = JSON.parse(options.body);
      if (url.pathname === '/create/whiteboard_sets') {
        if (race) {
          rows.push({ id: 100, ...payload });
          race = false;
          return Response.json({ status: 'failed', message: 'Duplicate entry' }, { status: 409 });
        }
        assert.equal(options.method, 'POST');
        const id = rows.length + 1;
        rows.push({ id, ...payload });
        return Response.json({ status: 'success', id }, { status: 201 });
      }
      if (url.pathname.startsWith('/update/whiteboard_sets/')) {
        assert.equal(options.method, 'PUT');
        const row = rows.find((r) => r.id === Number(url.pathname.split('/').at(-1)));
        assert.ok(row, 'only an existing owned row may be updated');
        Object.assign(row, payload);
        return Response.json({ status: 'success', message: 'Record updated successfully' });
      }
      assert.fail(`Unexpected upstream route: ${url.pathname}`);
    }
  });
  return { handle: (req) => handle(req, env), rows, calls: () => calls };
}

test('unauthenticated reads and saves cannot reach private data', async () => {
  const f = fixture();
  for (const method of ['GET', 'PUT']) {
    const res = await f.handle(request(null, method, method === 'PUT' ? { state: board() } : undefined));
    assert.equal(res.status, 401);
    assert.match(res.headers.get('cache-control'), /no-store/);
  }
  assert.equal(f.calls(), 0);
});

test('each account saves and restores only its own board, ignoring spoofed owner and record ids', async () => {
  const f = fixture();
  assert.deepEqual((await (await f.handle(request('alice'))).json()).data, null);
  const a = await f.handle(request('alice', 'PUT', { state: board(), name: 'Pizarra', owner_key: 'bob', user_id: 'bob', id: 999 }));
  assert.equal(a.status, 200);
  const b = await f.handle(request('bob', 'PUT', { state: board('R6') }));
  assert.equal(b.status, 200);
  await f.handle(request('alice', 'PUT', { state: board('R2'), id: 2 }));
  const loadedA = (await (await f.handle(request('alice'))).json()).data;
  const loadedB = (await (await f.handle(request('bob'))).json()).data;
  assert.equal(loadedA.state, board('R2'));
  assert.equal(loadedB.state, board('R6'));
  assert.equal(f.rows.length, 2);
  assert.equal(f.rows[0].user_id, undefined);
  assert.notEqual(f.rows[0].owner_key, f.rows[1].owner_key);
  assert.equal(loadedA.owner_key, undefined);
});

test('cross-origin and missing-origin writes fail before a backend request', async () => {
  const f = fixture();
  for (const value of ['https://attacker.example', 'null', '']) {
    const res = await f.handle(request('alice', 'PUT', { state: board() }, { origin: value }));
    assert.equal(res.status, 403);
  }
  assert.equal(f.calls(), 0);
});

test('gateway refuses unsupported methods, malformed boards and oversized payloads', async () => {
  const f = fixture();
  assert.equal((await f.handle(request('alice', 'DELETE'))).status, 405);
  assert.equal((await f.handle(request('alice', 'PUT', { state: '{broken' }))).status, 400);
  assert.equal((await f.handle(request('alice', 'PUT', { state: JSON.stringify({ sets: [], activeId: 1 }) }))).status, 400);
  assert.equal((await f.handle(request('alice', 'PUT', { state: 'x'.repeat(70000) }))).status, 413);
  assert.equal(f.calls(), 0);
});

test('gateway fails closed when upstream ignores the owner filter', async () => {
  const f = fixture({ ignoreFilter: true });
  await f.handle(request('alice', 'PUT', { state: board() }));
  const res = await f.handle(request('bob'));
  assert.equal(res.status, 502);
  assert.equal((await res.text()).includes('R1'), false);
});

test('upstream errors never expose credentials or private diagnostic messages', async () => {
  const f = fixture({ upstreamFailure: true });
  const res = await f.handle(request('alice'));
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.equal(text.includes('server-test-secret'), false);
  assert.equal(text.includes('private upstream'), false);
});

test('a concurrent first save recovers the same owned row instead of duplicating a board', async () => {
  const f = fixture({ race: true });
  const res = await f.handle(request('alice', 'PUT', { state: board('R3') }));
  assert.equal(res.status, 200);
  assert.equal(f.rows.length, 1);
  assert.equal((await (await f.handle(request('alice'))).json()).data.state, board('R3'));
});

test('a fresh personal-board read cannot reuse a cached state after saving a new rotation', async () => {
  const f = fixture({ cacheReads: true });
  assert.equal((await f.handle(request('alice', 'PUT', { state: board('R1') }))).status, 200);
  await f.handle(request('alice'));
  assert.equal((await f.handle(request('alice', 'PUT', { state: board('R6') }))).status, 200);
  const loaded = (await (await f.handle(request('alice'))).json()).data;
  assert.ok(loaded, 'A cached empty read must not hide the saved board');
  assert.equal(loaded.state, board('R6'));
  assert.equal(f.rows.length, 1);
});
