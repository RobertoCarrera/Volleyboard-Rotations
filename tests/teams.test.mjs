import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTeamsHandler } from '../server/teams.mjs';

const origin = 'https://volleyboard.sincronia.agency';
const env = { AUTH_ORIGIN: origin, NCB_DATA_API_URL: 'https://eu-api.nocodebackend.com', NCB_INSTANCE: 'test', NCB_SECRET_KEY: 'server-test-secret' };
const owner = (user) => createHash('sha256').update(`google:${user}`).digest('hex');
const ratings = { COL: 0, O: 1, R: 2, C: 3, L: 4 };
const board = (roster = []) => ({ sets: [{ id: 1, name: 'Set 1', rotation: 'R1', phase: 'receiving', roster }], activeId: 1 });
const request = (user, path = '/api/teams', method = 'GET', payload, headers = {}) => new Request(`${origin}${path}`, {
  method,
  headers: { ...(user ? { cookie: `test-user=${user}` } : {}), ...(!['GET', 'HEAD'].includes(method) ? { origin, 'content-type': 'application/json' } : {}), ...headers },
  ...(payload !== undefined ? { body: JSON.stringify(payload) } : {})
});

function fixture({ ignoreOwner = false, ignoreTeam = false, upstreamFailure = false, repeatPage = false,
  cacheReads = false, staleAfterUpdate = false, staleDeletedTable = null, numericStrings = false,
  collectionCache = false, recordOverride = null } = {}) {
  const tables = { volley_teams: [], volley_players: [] };
  const calls = [];
  const cached = new Map();
  let oldRow = null;
  const handle = createTeamsHandler({
    readSession: async (req) => {
      const id = req.headers.get('cookie')?.match(/^test-user=(.+)$/)?.[1];
      return id ? { user: { id } } : null;
    },
    fetchImpl: async (input, options = {}) => {
      const url = new URL(input);
      const requestHeaders = new Headers(options.headers);
      calls.push({ url: url.href, method: options.method ?? 'GET', cache: options.cache,
        cacheControl: requestHeaders.get('cache-control'), pragma: requestHeaders.get('pragma') });
      assert.equal(url.origin, 'https://eu-api.nocodebackend.com');
      assert.equal(new Headers(options.headers).get('authorization'), 'Bearer server-test-secret');
      assert.equal(url.searchParams.get('Instance'), 'test');
      assert.equal(options.redirect, 'error');
      if (upstreamFailure) return Response.json({ error: 'server-test-secret private upstream diagnostics' }, { status: 500 });
      const match = /^\/(read|create|update)\/(volley_teams|volley_players)(?:\/(\d+))?$/.exec(url.pathname);
      assert.ok(match, `Only fixed application tables may be accessed: ${url.pathname}`);
      const [, operation, table, rowId] = match;
      const rows = tables[table];
      if (operation === 'read') {
        assert.equal(options.method ?? 'GET', 'GET');
        if (!rowId) assert.match(url.searchParams.get('owner_key'), /^[a-f0-9]{64}$/);
        const bypass = requestHeaders.get('cache-control')?.split(',').map((value) => value.trim()).includes('no-cache');
        const reuseCache = (cacheReads && !bypass) || (collectionCache && !rowId);
        if (reuseCache && cached.has(url.href)) return Response.json(cached.get(url.href));
        let selected = rowId
          ? rows.filter((row) => row.id === Number(rowId))
          : rows.filter((row) => ignoreOwner || row.owner_key === url.searchParams.get('owner_key'));
        if (!rowId && url.searchParams.has('team_id')) selected = selected.filter((row) => ignoreTeam || row.team_id === Number(url.searchParams.get('team_id')));
        if (!rowId && url.searchParams.has('id')) selected = selected.filter((row) => row.id === Number(url.searchParams.get('id')));
        selected.sort((a, b) => a.id - b.id);
        const page = repeatPage ? 1 : Number(url.searchParams.get('page') ?? 1);
        const limit = Number(url.searchParams.get('limit') ?? 50);
        selected = structuredClone(selected.slice((page - 1) * limit, page * limit));
        if (staleAfterUpdate && oldRow?.table === table && (rowId ?? url.searchParams.get('id')) === String(oldRow.row.id)) {
          selected = selected.map((row) => row.id === oldRow.row.id ? oldRow.row : row);
          oldRow = null;
        }
        if (staleDeletedTable === table) selected = selected.map((row) => ({ ...row, deleted: 1 }));
        if (numericStrings) selected = selected.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? String(value) : value])));
        if (rowId && !selected.length) return Response.json({ status: 'error', message: 'Record Not Found' }, { status: 404 });
        let record = selected[0];
        if (rowId && recordOverride === 'owner') record = { ...record, owner_key: owner('other-account') };
        if (rowId && recordOverride === 'team' && table === 'volley_players') record = { ...record, team_id: Number(record.team_id) + 1 };
        if (rowId && recordOverride === 'id') record = { ...record, id: Number(record.id) + 1 };
        if (rowId && recordOverride === 'shape') record = [];
        const result = { status: 'success', data: rowId ? record : selected };
        if (reuseCache) cached.set(url.href, structuredClone(result));
        return Response.json(result);
      }
      const payload = JSON.parse(options.body);
      if (operation === 'create') {
        assert.equal(options.method, 'POST');
        const id = Math.max(...rows.map((row) => row.id), 0) + 1;
        if (table === 'volley_players') {
          assert.ok(tables.volley_teams.some((team) => team.id === payload.team_id && team.owner_key === payload.owner_key), 'player ownership and team foreign key must agree');
        }
        rows.push({ id, deleted: 0, created_at: '2026-11-09 00:00:00', updated_at: '2026-11-09 00:00:00', ...(table === 'volley_teams' ? { board_state: null } : { rating_col: null, rating_o: null, rating_r: null, rating_c: null, rating_l: null }), ...payload });
        return Response.json({ status: 'success', message: 'Record created successfully', id }, { status: 201 });
      }
      assert.equal(options.method, 'PUT');
      const row = rows.find((item) => item.id === Number(rowId));
      assert.ok(row, 'only existing, previously authorized records may be updated');
      assert.equal(payload.owner_key, undefined);
      assert.equal(payload.team_id, undefined);
      if (staleAfterUpdate) oldRow = { table, row: structuredClone(row) };
      Object.assign(row, payload, { updated_at: '2026-11-09 00:01:00' });
      return Response.json({ status: 'success', message: 'Record updated successfully' });
    }
  });
  const invoke = (user, path = '/api/teams', method = 'GET', payload, headers) => handle(request(user, path, method, payload, headers), env);
  const createTeam = async (user = 'alice', name = 'Mi equipo') => {
    const res = await invoke(user, '/api/teams', 'POST', { name });
    assert.equal(res.status, 201);
    return (await res.json()).data;
  };
  const createPlayer = async (teamId, user = 'alice', extra = {}) => {
    const res = await invoke(user, `/api/teams/${teamId}/players`, 'POST', { name: 'Sara', number: '7', ratings, ...extra });
    assert.equal(res.status, 201);
    return (await res.json()).data;
  };
  return { handle, invoke, tables, calls, createTeam, createPlayer };
}

test('anonymous callers cannot read or mutate team data', async () => {
  const f = fixture();
  for (const [path, method, payload] of [
    ['/api/teams', 'GET'], ['/api/teams', 'POST', { name: 'Team' }],
    ['/api/teams/1', 'PATCH', { name: 'Other' }], ['/api/teams/1', 'DELETE'],
    ['/api/teams/1/players', 'POST', { name: 'Player' }], ['/api/teams/1/whiteboard', 'GET']
  ]) {
    const response = await f.invoke(null, path, method, payload);
    assert.equal(response.status, 401);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  assert.equal(f.calls.length, 0);
});

test('team CRUD preserves ownership, private fields and recoverable deletion', async () => {
  const f = fixture();
  const response = await f.invoke('alice', '/api/teams', 'POST', { name: '  Equipo mixto  ', owner_key: owner('bob'), id: 777, board_state: 'spoof' });
  assert.equal(response.status, 201);
  const team = (await response.json()).data;
  assert.equal(team.name, 'Equipo mixto');
  assert.equal(team.deleted, false);
  assert.equal(team.owner_key, undefined);
  assert.equal(f.tables.volley_teams[0].owner_key, owner('alice'));
  assert.equal(f.tables.volley_teams[0].board_state, null);
  const renamed = await f.invoke('alice', `/api/teams/${team.id}`, 'PATCH', { name: 'Equipo A', owner_key: owner('bob') });
  assert.equal((await renamed.json()).data.name, 'Equipo A');
  await f.invoke('alice', `/api/teams/${team.id}`, 'DELETE');
  assert.equal((await f.invoke('alice', `/api/teams/${team.id}`, 'DELETE')).status, 200);
  assert.equal((await f.invoke('alice', `/api/teams/${team.id}`)).status, 404);
  const listing = (await (await f.invoke('alice')).json()).data;
  assert.equal(listing[0].deleted, true);
  const restored = await f.invoke('alice', `/api/teams/${team.id}`, 'PATCH', { deleted: false });
  assert.equal((await restored.json()).data.deleted, false);
  assert.equal((await f.invoke('alice', `/api/teams/${team.id}`)).status, 200);
  assert.equal(f.tables.volley_teams.length, 1);
});

test('players preserve zero, every rating value and unassigned positions across edits', async () => {
  const f = fixture();
  const team = await f.createTeam();
  const player = await f.createPlayer(team.id);
  assert.deepEqual(player, { id: 1, teamId: team.id, name: 'Sara', number: '7', ratings, deleted: false });
  const changed = await f.invoke('alice', `/api/teams/${team.id}/players/${player.id}`, 'PATCH', { name: ' Sara S. ', number: ' 12 ', ratings: { COL: 5, O: null }, owner_key: owner('bob'), team_id: 999 });
  assert.equal(changed.status, 200);
  assert.deepEqual((await changed.json()).data, { id: 1, teamId: team.id, name: 'Sara S.', number: '12', ratings: { COL: 5, O: null, R: 2, C: 3, L: 4 }, deleted: false });
  const created = await f.createPlayer(team.id, 'alice', { name: 'No evaluado', ratings: undefined });
  assert.deepEqual(created.ratings, { COL: null, O: null, R: null, C: null, L: null });
  const details = (await (await f.invoke('alice', `/api/teams/${team.id}`)).json()).data;
  assert.equal(details.players.length, 2);
  assert.equal(details.players[0].owner_key, undefined);
});

test('out of range, fractional or incorrectly typed ratings never persist', async () => {
  const f = fixture();
  const team = await f.createTeam();
  const player = await f.createPlayer(team.id);
  const before = structuredClone(f.tables.volley_players);
  for (const invalid of [-1, 6, 2.5, '3', true, {}, []]) {
    assert.equal((await f.invoke('alice', `/api/teams/${team.id}/players`, 'POST', { name: 'Invalid', ratings: { COL: invalid } })).status, 400);
    assert.equal((await f.invoke('alice', `/api/teams/${team.id}/players/${player.id}`, 'PATCH', { ratings: { COL: invalid } })).status, 400);
  }
  for (const invalid of [null, [], 'red', { UNKNOWN: 3 }]) {
    assert.equal((await f.invoke('alice', `/api/teams/${team.id}/players`, 'POST', { name: 'Invalid', ratings: invalid })).status, 400);
  }
  assert.deepEqual(f.tables.volley_players, before);
});

test('foreign accounts and mismatched team/player identifiers cannot access any CRUD action', async () => {
  const f = fixture();
  const alice = await f.createTeam();
  const alicePlayer = await f.createPlayer(alice.id);
  const bob = await f.createTeam('bob', 'Privado de Bob');
  const bobPlayer = await f.createPlayer(bob.id, 'bob', { name: 'Jugador privado' });
  const before = structuredClone(f.tables);
  for (const [path, method, payload] of [
    [`/api/teams/${bob.id}`, 'GET'], [`/api/teams/${bob.id}`, 'PATCH', { name: 'Robado' }], [`/api/teams/${bob.id}`, 'DELETE'],
    [`/api/teams/${bob.id}`, 'PATCH', { deleted: false }], [`/api/teams/${bob.id}/players`, 'POST', { name: 'Intruso' }],
    [`/api/teams/${bob.id}/players/${bobPlayer.id}`, 'PATCH', { name: 'Intruso' }], [`/api/teams/${bob.id}/players/${bobPlayer.id}`, 'DELETE'],
    [`/api/teams/${alice.id}/players/${bobPlayer.id}`, 'PATCH', { name: 'Intruso' }], [`/api/teams/${alice.id}/players/${bobPlayer.id}`, 'DELETE'],
    [`/api/teams/${bob.id}/players/${alicePlayer.id}`, 'PATCH', { deleted: false }],
    [`/api/teams/${bob.id}/whiteboard`, 'GET'], [`/api/teams/${bob.id}/whiteboard`, 'PUT', { state: JSON.stringify(board()) }]
  ]) {
    const response = await f.invoke('alice', path, method, payload);
    assert.equal(response.status, 404, `${method} ${path}`);
    assert.equal((await response.text()).includes('privado'), false);
  }
  assert.deepEqual(f.tables, before);
  assert.deepEqual((await (await f.invoke('alice')).json()).data.map((team) => team.id), [alice.id]);
});

test('player deletion and restoration retain ratings without exposing archived team contents', async () => {
  const f = fixture();
  const team = await f.createTeam();
  const player = await f.createPlayer(team.id);
  const path = `/api/teams/${team.id}/players/${player.id}`;
  assert.equal((await f.invoke('alice', path, 'DELETE')).status, 200);
  assert.equal((await f.invoke('alice', path, 'DELETE')).status, 200);
  const details = (await (await f.invoke('alice', `/api/teams/${team.id}`)).json()).data;
  assert.equal(details.players[0].deleted, true);
  assert.deepEqual(details.players[0].ratings, ratings);
  assert.equal((await f.invoke('alice', path, 'PATCH', { name: 'Wrong' })).status, 404);
  const restored = (await (await f.invoke('alice', path, 'PATCH', { deleted: false })).json()).data;
  assert.equal(restored.deleted, false);
  assert.deepEqual(restored.ratings, ratings);
  await f.invoke('alice', `/api/teams/${team.id}`, 'DELETE');
  for (const [suffix, method, payload] of [
    ['', 'GET'], ['/players', 'POST', { name: 'New' }], [`/players/${player.id}`, 'PATCH', { deleted: false }],
    [`/players/${player.id}`, 'DELETE'], ['/whiteboard', 'GET'], ['/whiteboard', 'PUT', { state: JSON.stringify(board()) }]
  ]) assert.equal((await f.invoke('alice', `/api/teams/${team.id}${suffix}`, method, payload)).status, 404);
  assert.equal(f.tables.volley_players.length, 1);
});

test('team boards store canonical player references and never trust spoofed player profile fields', async () => {
  const f = fixture();
  const team = await f.createTeam();
  const player = await f.createPlayer(team.id);
  const path = `/api/teams/${team.id}/whiteboard`;
  assert.deepEqual((await (await f.invoke('alice', path)).json()).data, null);
  const state = board([{ id: player.id, slot: 'COL', name: 'Spoof', number: '999', ratings: { COL: 99 }, owner_key: owner('bob') }]);
  state.ignored = 'discard';
  const saved = await f.invoke('alice', path, 'PUT', { state: JSON.stringify(state), owner_key: owner('bob'), id: 999 });
  assert.equal(saved.status, 200);
  assert.deepEqual(JSON.parse((await saved.json()).data.state), board([{ id: player.id, slot: 'COL' }]));
  const loaded = (await (await f.invoke('alice', path)).json()).data;
  assert.equal(loaded.id, team.id);
  assert.equal(loaded.name, 'Pizarra');
  assert.deepEqual(JSON.parse(loaded.state), board([{ id: player.id, slot: 'COL' }]));
  assert.equal(f.tables.volley_players[0].name, 'Sara');
});

test('deleted owned player references remain restorable on board read and write', async () => {
  const f = fixture();
  const team = await f.createTeam();
  const player = await f.createPlayer(team.id);
  const path = `/api/teams/${team.id}/whiteboard`;
  const payload = { state: JSON.stringify(board([{ id: player.id, slot: 'COL' }])) };
  await f.invoke('alice', path, 'PUT', payload);
  await f.invoke('alice', `/api/teams/${team.id}/players/${player.id}`, 'DELETE');
  assert.deepEqual(JSON.parse((await (await f.invoke('alice', path)).json()).data.state), board([{ id: player.id, slot: 'COL' }]));
  const saved = await f.invoke('alice', path, 'PUT', payload);
  assert.equal(saved.status, 200);
  assert.deepEqual(JSON.parse((await saved.json()).data.state), board([{ id: player.id, slot: 'COL' }]));
  assert.equal(f.tables.volley_players[0].deleted, 1);
});

test('unknown players, other-team players and malformed lineups cannot enter a team board', async () => {
  const f = fixture();
  const team = await f.createTeam();
  const player = await f.createPlayer(team.id);
  const other = await f.createTeam('alice', 'Other');
  const otherPlayer = await f.createPlayer(other.id);
  const secondPlayer = await f.createPlayer(team.id, 'alice', { name: 'Second' });
  const invalid = [
    board([{ id: 999, slot: null }]), board([{ id: otherPlayer.id, slot: 'COL' }]),
    board([{ id: player.id, slot: 'BAD' }]), board([{ id: player.id, slot: null }, { id: player.id, slot: 'O' }]),
    board([{ id: player.id, slot: 'COL' }, { id: secondPlayer.id, slot: 'COL' }]),
    { sets: [], activeId: 1 }, { ...board(), activeId: 999 },
    { sets: Array.from({ length: 6 }, (_, i) => ({ ...board().sets[0], id: i + 1 })), activeId: 1 },
    { sets: [{ ...board().sets[0], rotation: 'R0' }], activeId: 1 },
    { sets: [{ ...board().sets[0], phase: 'attack' }], activeId: 1 },
    { sets: [{ ...board().sets[0], id: -1 }], activeId: -1 },
    { sets: [board().sets[0], board().sets[0]], activeId: 1 },
    board(Array.from({ length: 9 }, (_, i) => ({ id: i + 1, slot: null })))
  ];
  for (const state of invalid) assert.equal((await f.invoke('alice', `/api/teams/${team.id}/whiteboard`, 'PUT', { state: JSON.stringify(state) })).status, 400);
  assert.equal(f.tables.volley_teams[0].board_state, null);
});

test('every mutation requires the canonical Origin before storage is reached', async () => {
  const f = fixture();
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    const path = method === 'POST' ? '/api/teams' : method === 'PUT' ? '/api/teams/1/whiteboard' : '/api/teams/1';
    for (const source of ['', 'null', 'https://attacker.example']) {
      assert.equal((await f.invoke('alice', path, method, method === 'DELETE' ? undefined : {}, { origin: source })).status, 403);
    }
  }
  assert.equal((await f.invoke('alice', '/api/teams', 'GET', undefined, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await f.handle(new Request('https://elsewhere.example/api/teams'), env)).status, 403);
  assert.equal(f.calls.length, 0);
});

test('invalid routes, identifiers, content types and oversized payloads fail closed', async () => {
  const f = fixture();
  for (const path of ['/api/teams/0', '/api/teams/-1', '/api/teams/1.1', '/api/teams/01', '/api/teams/9007199254740992', '/api/teams/1/players/0', '/api/teams/1/players/nope', '/api/teams/1/unknown']) {
    assert.equal((await f.invoke('alice', path)).status, 404, path);
  }
  assert.equal((await f.invoke('alice', '/api/teams', 'PUT', {})).status, 405);
  assert.equal((await f.invoke('alice', '/api/teams', 'POST', { name: 'Bad' }, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await f.invoke('alice', '/api/teams', 'POST', { name: 'x'.repeat(70000) })).status, 413);
  const malformed = new Request(`${origin}/api/teams`, { method: 'POST', headers: { origin, cookie: 'test-user=alice', 'content-type': 'application/json' }, body: '{broken' });
  assert.equal((await f.handle(malformed, env)).status, 400);
  for (const name of ['', '  ', 'x'.repeat(101), 23, null]) assert.equal((await f.invoke('alice', '/api/teams', 'POST', { name })).status, 400);
  assert.equal(f.tables.volley_teams.length, 0);
});

test('owned lists paginate completely and archived records count toward storage limits', async () => {
  const f = fixture();
  for (let id = 1; id <= 100; id++) f.tables.volley_teams.push({ id, owner_key: owner('alice'), name: `Team ${id}`, deleted: id % 2, board_state: null });
  const listed = (await (await f.invoke('alice')).json()).data;
  assert.equal(listed.length, 100);
  assert.equal(new Set(listed.map((team) => team.id)).size, 100);
  assert.equal((await f.invoke('alice', '/api/teams', 'POST', { name: 'Too many' })).status, 409);
  const teamId = 2;
  for (let id = 1; id <= 200; id++) f.tables.volley_players.push({ id, owner_key: owner('alice'), team_id: teamId, name: `Player ${id}`, number: '', deleted: id % 2, rating_col: null, rating_o: null, rating_r: null, rating_c: null, rating_l: null });
  const team = (await (await f.invoke('alice', `/api/teams/${teamId}`)).json()).data;
  assert.equal(team.players.length, 200);
  assert.equal((await f.invoke('alice', `/api/teams/${teamId}/players`, 'POST', { name: 'Too many' })).status, 409);
});

test('upstream filters that leak another owner or team fail without returning private data', async () => {
  const f = fixture({ ignoreOwner: true });
  await f.createTeam('bob', 'Secret team');
  const response = await f.invoke('alice');
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes('Secret team'), false);
  const g = fixture({ ignoreTeam: true });
  const a = await g.createTeam();
  const b = await g.createTeam('alice', 'Second team');
  await g.createPlayer(b.id);
  assert.equal((await g.invoke('alice', `/api/teams/${a.id}`)).status, 502);
});

test('a broken pagination response cannot loop forever or silently drop records', async () => {
  const f = fixture({ repeatPage: true });
  for (let id = 1; id <= 100; id++) f.tables.volley_teams.push({ id, owner_key: owner('alice'), name: `Team ${id}`, deleted: 0 });
  assert.equal((await f.invoke('alice')).status, 502);
  assert.ok(f.calls.length <= 4);
});

test('configuration and storage failures are redacted and never cached', async () => {
  const f = fixture({ upstreamFailure: true });
  const response = await f.invoke('alice');
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.equal(body.includes('server-test-secret'), false);
  assert.equal(body.includes('private upstream'), false);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await f.handle(request('alice'), { ...env, NCB_DATA_API_URL: 'https://attacker.example' })).status, 503);
  assert.equal((await f.handle(request('alice'), { ...env, AUTH_ORIGIN: `${origin}/unexpected` })).status, 503);
});

test('restoring a team bypasses an earlier cached archived row and the next GET is active', async () => {
  const f = fixture({ cacheReads: true });
  f.tables.volley_teams.push({ id: 1, owner_key: owner('alice'), name: 'Restaurable', deleted: 1, board_state: null });
  assert.equal((await f.invoke('alice', '/api/teams/1')).status, 404);
  const restored = await f.invoke('alice', '/api/teams/1', 'PATCH', { deleted: false });
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).data.deleted, false);
  const loaded = await f.invoke('alice', '/api/teams/1');
  assert.equal(loaded.status, 200);
  assert.equal((await loaded.json()).data.deleted, false);
  for (const call of f.calls) {
    assert.equal(call.cache, 'no-store');
    assert.match(call.cacheControl, /no-cache/);
    assert.match(call.cacheControl, /no-store/);
    assert.equal(call.pragma, 'no-cache');
  }
});

test('renaming a team returns the new name despite a previously cached read', async () => {
  const f = fixture({ cacheReads: true });
  const team = await f.createTeam('alice', 'Before');
  await f.invoke('alice', `/api/teams/${team.id}`);
  const renamed = await f.invoke('alice', `/api/teams/${team.id}`, 'PATCH', { name: 'After' });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).data.name, 'After');
});

test('creating a player refreshes its team roster before the new reference is saved', async () => {
  const f = fixture({ cacheReads: true });
  const team = await f.createTeam();
  assert.equal((await (await f.invoke('alice', `/api/teams/${team.id}`)).json()).data.players.length, 0);
  const player = await f.createPlayer(team.id);
  const details = (await (await f.invoke('alice', `/api/teams/${team.id}`)).json()).data;
  assert.equal(details.players.length, 1);
  const saved = await f.invoke('alice', `/api/teams/${team.id}/whiteboard`, 'PUT', { state: JSON.stringify(board([{ id: player.id, slot: 'COL' }])) });
  assert.equal(saved.status, 200);
  assert.deepEqual(JSON.parse((await saved.json()).data.state), board([{ id: player.id, slot: 'COL' }]));
});

test('a stale post-update read cannot be reported as confirmed success', async () => {
  const f = fixture({ staleAfterUpdate: true });
  const team = await f.createTeam('alice', 'Before');
  const renamed = await f.invoke('alice', `/api/teams/${team.id}`, 'PATCH', { name: 'After' });
  assert.equal(renamed.status, 409);
  const result = await renamed.json();
  assert.equal(result.status, 'error');
  assert.match(result.error, /confirmar/i);
  assert.match(result.error, /recarga/i);
  assert.equal(result.data, undefined);
  assert.equal(JSON.stringify(result).includes('server-test-secret'), false);
  assert.equal(f.tables.volley_teams[0].name, 'After', 'an ambiguous acknowledgement must not claim the write never happened');
});

test('update confirmation distinguishes an unassigned rating from a real zero', async () => {
  const f = fixture({ staleAfterUpdate: true });
  const team = await f.createTeam();
  const player = await f.createPlayer(team.id);
  const path = `/api/teams/${team.id}/players/${player.id}`;
  assert.equal((await f.invoke('alice', path, 'PATCH', { ratings: { COL: null } })).status, 409);
  assert.equal(f.tables.volley_players[0].rating_col, null);
  assert.equal((await f.invoke('alice', path, 'PATCH', { ratings: { COL: 0 } })).status, 409);
  assert.equal(f.tables.volley_players[0].rating_col, 0);
});

test('update confirmation accepts numeric storage strings without treating null as zero', async () => {
  const f = fixture({ numericStrings: true });
  const team = await f.createTeam();
  const player = await f.createPlayer(team.id);
  await f.invoke('alice', `/api/teams/${team.id}`, 'DELETE');
  const restored = await f.invoke('alice', `/api/teams/${team.id}`, 'PATCH', { deleted: false });
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).data.deleted, false);
  const changed = await f.invoke('alice', `/api/teams/${team.id}/players/${player.id}`, 'PATCH', { ratings: { COL: 5, O: null } });
  assert.equal(changed.status, 200);
  assert.deepEqual((await changed.json()).data.ratings, { COL: 5, O: null, R: 2, C: 3, L: 4 });
});

test('DELETE still writes the requested state when a stale row says it is already archived', async () => {
  const teams = fixture({ staleDeletedTable: 'volley_teams' });
  const team = await teams.createTeam();
  assert.equal(teams.tables.volley_teams[0].deleted, 0);
  assert.equal((await teams.invoke('alice', `/api/teams/${team.id}`, 'DELETE')).status, 200);
  assert.equal(teams.tables.volley_teams[0].deleted, 1);

  const players = fixture({ staleDeletedTable: 'volley_players' });
  const activeTeam = await players.createTeam();
  const player = await players.createPlayer(activeTeam.id);
  assert.equal(players.tables.volley_players[0].deleted, 0);
  assert.equal((await players.invoke('alice', `/api/teams/${activeTeam.id}/players/${player.id}`, 'DELETE')).status, 200);
  assert.equal(players.tables.volley_players[0].deleted, 1);
});

test('single-record confirmation remains fresh when collection queries are cached despite no-cache', async () => {
  const f = fixture({ collectionCache: true });
  const team = await f.createTeam('alice', 'Before');
  await f.invoke('alice', `/api/teams/${team.id}`);
  const renamed = await f.invoke('alice', `/api/teams/${team.id}`, 'PATCH', { name: 'After' });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).data.name, 'After');
  assert.equal((await f.invoke('alice', `/api/teams/${team.id}`, 'DELETE')).status, 200);
  const restored = await f.invoke('alice', `/api/teams/${team.id}`, 'PATCH', { deleted: false });
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).data.deleted, false);
  const loaded = await f.invoke('alice', `/api/teams/${team.id}`);
  assert.equal(loaded.status, 200);
  assert.equal((await loaded.json()).data.name, 'After');
});

test('single-record responses belonging to another owner are unavailable without exposing data', async () => {
  const f = fixture({ recordOverride: 'owner' });
  f.tables.volley_teams.push({ id: 1, owner_key: owner('alice'), name: 'Private name', deleted: 0, board_state: null });
  const response = await f.invoke('alice', '/api/teams/1');
  assert.equal(response.status, 404);
  assert.equal((await response.text()).includes('Private name'), false);
});

test('a single-record player returned for the wrong team cannot be edited', async () => {
  const f = fixture({ recordOverride: 'team' });
  f.tables.volley_teams.push({ id: 1, owner_key: owner('alice'), name: 'Team', deleted: 0, board_state: null });
  f.tables.volley_players.push({ id: 1, owner_key: owner('alice'), team_id: 1, name: 'Original', number: '', deleted: 0,
    rating_col: null, rating_o: null, rating_r: null, rating_c: null, rating_l: null });
  const response = await f.invoke('alice', '/api/teams/1/players/1', 'PATCH', { name: 'Changed' });
  assert.equal(response.status, 404);
  assert.equal(f.tables.volley_players[0].name, 'Original');
});

test('single-record missing IDs are not found and malformed or mismatched responses fail closed', async () => {
  const missing = fixture();
  assert.equal((await missing.invoke('alice', '/api/teams/999')).status, 404);
  for (const recordOverride of ['shape', 'id']) {
    const f = fixture({ recordOverride });
    f.tables.volley_teams.push({ id: 1, owner_key: owner('alice'), name: 'Private name', deleted: 0, board_state: null });
    const response = await f.invoke('alice', '/api/teams/1');
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes('Private name'), false);
  }
});

test('a fresh primary-key player can enter a board even when the roster collection remains stale', async () => {
  const f = fixture({ collectionCache: true });
  const team = await f.createTeam();
  await f.invoke('alice', `/api/teams/${team.id}`);
  const player = await f.createPlayer(team.id);
  const saved = await f.invoke('alice', `/api/teams/${team.id}/whiteboard`, 'PUT', {
    state: JSON.stringify(board([{ id: player.id, slot: 'COL' }]))
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(JSON.parse((await saved.json()).data.state), board([{ id: player.id, slot: 'COL' }]));
});

test('missing-reference fallback cannot admit another account or another team player', async () => {
  const f = fixture({ collectionCache: true });
  const team = await f.createTeam();
  await f.invoke('alice', `/api/teams/${team.id}`);
  f.tables.volley_players.push(
    { id: 1, owner_key: owner('alice'), team_id: 2, name: 'Other team' },
    { id: 2, owner_key: owner('bob'), team_id: team.id, name: 'Other account' }
  );
  for (const id of [1, 2, 999]) {
    const response = await f.invoke('alice', `/api/teams/${team.id}/whiteboard`, 'PUT', { state: JSON.stringify(board([{ id, slot: 'COL' }])) });
    assert.equal(response.status, 400);
    const text = await response.text();
    assert.equal(text.includes('Other team'), false);
    assert.equal(text.includes('Other account'), false);
  }
  assert.equal(f.tables.volley_teams[0].board_state, null);
});

test('missing-reference lookup is deduplicated and malformed board IDs never become upstream paths', async () => {
  const f = fixture({ collectionCache: true });
  const team = await f.createTeam();
  await f.invoke('alice', `/api/teams/${team.id}`);
  const player = await f.createPlayer(team.id);
  const shared = {
    sets: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `Set ${i + 1}`, rotation: 'R1', phase: 'receiving', roster: [{ id: player.id, slot: 'COL' }] })),
    activeId: 1
  };
  const before = f.calls.length;
  assert.equal((await f.invoke('alice', `/api/teams/${team.id}/whiteboard`, 'PUT', { state: JSON.stringify(shared) })).status, 200);
  assert.equal(f.calls.slice(before).filter((call) => new URL(call.url).pathname.startsWith('/read/volley_players/')).length, 1);
  for (const id of [0, -1, 1.5, '1', '1/../../volley_teams/1', null, true]) {
    const start = f.calls.length;
    assert.equal((await f.invoke('alice', `/api/teams/${team.id}/whiteboard`, 'PUT', { state: JSON.stringify(board([{ id, slot: 'COL' }])) })).status, 400);
    assert.equal(f.calls.slice(start).some((call) => new URL(call.url).pathname.startsWith('/read/volley_players/')), false);
  }
});
