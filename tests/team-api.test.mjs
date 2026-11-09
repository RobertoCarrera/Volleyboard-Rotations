import assert from 'node:assert/strict';
import test from 'node:test';
import * as api from '../src/api.js';

const team = { id: 12, name: 'Equipo mixto', deleted: false };
const player = { id: 31, teamId: 12, name: 'Ana', number: '7', deleted: false,
  ratings: { COL: 0, O: 1, R: 3, C: null, L: 5 } };
const board = { sets: [{ id: 1, name: 'Set 1', rotation: 'R6', phase: 'receiving',
  roster: [{ id: 31, slot: 'COL' }] }], activeId: 1 };
const ok = (data) => Response.json({ status: 'success', data });

test('team player creation and editing preserve zero, null and maximum scores over authenticated same-origin requests', async (t) => {
  assert.equal(typeof api.createPlayer, 'function');
  assert.equal(typeof api.updatePlayer, 'function');
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent.push({ url, method: options.method, body: JSON.parse(options.body) });
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(new Headers(options.headers).has('authorization'), false);
    return ok(player);
  });
  const draft = { name: 'Ana', number: '7', ratings: { COL: 0, O: 1, R: 3, C: null, L: 5 } };
  assert.deepEqual((await api.createPlayer(12, draft)).data, player);
  assert.deepEqual((await api.updatePlayer(12, 31, { ratings: draft.ratings })).data.ratings, draft.ratings);
  assert.deepEqual(sent, [
    { url: '/api/teams/12/players', method: 'POST', body: draft },
    { url: '/api/teams/12/players/31', method: 'PATCH', body: { ratings: draft.ratings } }
  ]);
});

test('team metadata and recoverable deletion use the matching resource without changing board state', async (t) => {
  assert.equal(typeof api.listTeams, 'function');
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent.push([url, options.method, options.body ? JSON.parse(options.body) : null]);
    if (options.method === 'GET' && url === '/api/teams') return ok([team]);
    return ok(team);
  });
  assert.deepEqual((await api.listTeams()).data, [team]);
  await api.createTeam({ name: 'Equipo mixto' });
  await api.updateTeam(12, { name: 'Nuevo nombre' });
  await api.deleteTeam(12);
  await api.updateTeam(12, { deleted: false });
  assert.deepEqual(sent, [
    ['/api/teams', 'GET', null], ['/api/teams', 'POST', { name: 'Equipo mixto' }],
    ['/api/teams/12', 'PATCH', { name: 'Nuevo nombre' }],
    ['/api/teams/12', 'DELETE', null], ['/api/teams/12', 'PATCH', { deleted: false }]
  ]);
});

test('corrupt team details cannot hydrate an unrelated roster or an out-of-range rating', async (t) => {
  assert.equal(typeof api.getTeam, 'function');
  let returned = { ...team, players: [{ ...player, teamId: 999 }] };
  t.mock.method(globalThis, 'fetch', async () => ok(returned));
  assert.equal((await api.getTeam(12)).status, 'error');
  returned = { ...team, players: [{ ...player, ratings: { ...player.ratings, COL: 6 } }] };
  assert.equal((await api.getTeam(12)).status, 'error');
  returned = { ...team, players: [player] };
  assert.deepEqual((await api.getTeam(12)).data.players, [player]);
});

test('malformed IDs are rejected before they can select an unintended API path', async (t) => {
  assert.equal(typeof api.getTeam, 'function');
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; return ok(team); });
  for (const bad of ['../auth/signout', '12?x=y', -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await api.getTeam(bad)).status, 'error');
    assert.equal((await api.loadWhiteboard({ teamId: bad })).status, 'error');
  }
  assert.equal(requests, 0);
});

test('team board hydration accepts canonical player references instead of demanding copied player names', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, '/api/teams/12/whiteboard');
    return ok({ id: 12, name: 'Pizarra', state: JSON.stringify(board) });
  });
  assert.deepEqual(await api.loadWhiteboard({ teamId: 12 }), { status: 'success', data: board });
});

test('team saves target the selected team and store roster references without duplicate player details', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/teams/12/whiteboard');
    assert.equal(options.method, 'PUT');
    assert.deepEqual(JSON.parse(JSON.parse(options.body).state), board);
    return ok({ id: 12 });
  });
  const withSnapshots = { ...board, sets: [{ ...board.sets[0], roster: [{ ...player, slot: 'COL' }] }] };
  assert.equal((await api.saveWhiteboard(withSnapshots, { teamId: 12 })).status, 'success');
});

test('invalid duplicate team roster references are not hydrated as a valid board', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ok({ state: JSON.stringify({ ...board,
    sets: [{ ...board.sets[0], roster: [{ id: 31, slot: 'COL' }, { id: 31, slot: 'O' }] }] }) }));
  assert.equal((await api.loadWhiteboard({ teamId: 12 })).status, 'error');
});

test('player deletion and restoration remain scoped to their team and support cancellation', async (t) => {
  assert.equal(typeof api.deletePlayer, 'function');
  const controller = new AbortController();
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.signal, controller.signal);
    sent.push([url, options.method, options.body ? JSON.parse(options.body) : null]);
    return ok(player);
  });
  await api.deletePlayer(12, 31, { signal: controller.signal });
  await api.updatePlayer(12, 31, { deleted: false }, { signal: controller.signal });
  assert.deepEqual(sent, [
    ['/api/teams/12/players/31', 'DELETE', null],
    ['/api/teams/12/players/31', 'PATCH', { deleted: false }]
  ]);
});

test('a stale successful response cannot confirm a team or player mutation', async (t) => {
  let data = { ...team, deleted: true };
  t.mock.method(globalThis, 'fetch', async () => ok(data));
  assert.equal((await api.updateTeam(12, { deleted: false })).status, 'error');
  data = team;
  assert.equal((await api.updateTeam(12, { name: 'Nombre actualizado' })).status, 'error');
  assert.equal((await api.deleteTeam(12)).status, 'error');
  data = { ...player, deleted: true };
  assert.equal((await api.updatePlayer(12, 31, { deleted: false })).status, 'error');
  data = player;
  assert.equal((await api.updatePlayer(12, 31, { ratings: { COL: 5 } })).status, 'error');
  assert.equal((await api.deletePlayer(12, 31)).status, 'error');
  data = { ...player, ratings: { ...player.ratings, COL: 0 } };
  assert.equal((await api.updatePlayer(12, 31, { ratings: { COL: 0 } })).status, 'success');
});
