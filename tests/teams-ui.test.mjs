import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test, { after, before } from 'node:test';
import { build } from 'esbuild';
import React from 'react';
import { act, create } from 'react-test-renderer';

const SITE = 'https://volleyboard.sincronia.agency';
const rootDirectory = fileURLToPath(new URL('../', import.meta.url));
let bundleDirectory;
let Whiteboard;

before(async () => {
  bundleDirectory = await mkdtemp(join(rootDirectory, 'node_modules', '.teams-ui-'));
  await build({
    entryPoints: [join(rootDirectory, 'src/components/Whiteboard.jsx')],
    outfile: join(bundleDirectory, 'Whiteboard.mjs'), bundle: true,
    packages: 'external', format: 'esm', platform: 'node',
    loader: { '.css': 'empty' }, logLevel: 'silent'
  });
  Whiteboard = (await import(pathToFileURL(join(bundleDirectory, 'Whiteboard.mjs')).href)).default;
});

after(async () => { if (bundleDirectory) await rm(bundleDirectory, { recursive: true, force: true }); });

function installBrowser() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const browser = new EventTarget();
  browser.location = { href: `${SITE}/`, origin: SITE, pathname: '/', assign() {} };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  return () => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  };
}

function backend(t) {
  const teams = [{ id: 12, name: 'Equipo A', deleted: false }, { id: 13, name: 'Equipo B', deleted: false }];
  const players = [{ id: 31, teamId: 12, name: 'Ana', number: '7', deleted: false,
    ratings: { COL: 5, O: null, R: 0, C: 2, L: null } }];
  const boards = new Map([[12, { activeId: 1, sets: [
    { id: 1, name: 'Set 1', rotation: 'R1', phase: 'receiving', roster: [{ id: 31, slot: 'COL' }] }
  ] }]]);
  const mutations = [];
  let failSave = false;
  let teamCreateWait = null;
  let staleDeletionResponse = false;
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url === '/api/auth/session') return Response.json({ user: { id: 'coach-123', name: 'Coach' }, expires: '2027-01-01T00:00:00.000Z' });
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    const parts = url.split('/').filter(Boolean);
    if (method !== 'GET') mutations.push({ url, method, body });
    const ok = (data) => Response.json({ status: 'success', data });
    if (url === '/api/whiteboard') return ok(null);
    assert.equal(parts[1], 'teams', `Unexpected request: ${url}`);
    if (parts.length === 2) {
      if (method === 'POST') {
        if (teamCreateWait) await teamCreateWait;
        const team = { id: 14 + teams.length, name: body.name, deleted: false };
        teams.push(team);
        return ok(team);
      }
      return ok(teams.map((team) => ({ ...team })));
    }
    const teamId = Number(parts[2]);
    const team = teams.find((item) => item.id === teamId);
    assert.ok(team, 'The UI must request an existing team');
    if (parts[3] === 'whiteboard') {
      if (method === 'PUT') {
        if (failSave) return Response.json({ error: 'Unavailable' }, { status: 503 });
        boards.set(teamId, JSON.parse(body.state));
      }
      return ok(boards.has(teamId) ? { id: teamId, name: 'Pizarra', state: JSON.stringify(boards.get(teamId)) } : null);
    }
    if (parts[3] === 'players') {
      if (parts.length === 4 && method === 'POST') {
        const player = { id: 32 + players.length, teamId, ...body, deleted: false };
        players.push(player);
        return ok(player);
      }
      const player = players.find((item) => item.id === Number(parts[4]) && item.teamId === teamId);
      assert.ok(player, 'The UI must scope a player mutation to its team');
      const previousDeleted = player.deleted;
      if (method === 'DELETE') player.deleted = true;
      else Object.assign(player, body);
      return ok({ ...player, deleted: staleDeletionResponse && (method === 'DELETE' || body?.deleted === false) ? previousDeleted : player.deleted });
    }
    const previousDeleted = team.deleted;
    if (method === 'DELETE') team.deleted = true;
    if (method === 'PATCH') Object.assign(team, body);
    return ok({ ...team, deleted: staleDeletionResponse && (method === 'DELETE' || body?.deleted === false) ? previousDeleted : team.deleted,
      players: players.filter((player) => player.teamId === teamId).map((player) => ({ ...player })) });
  });
  return { teams, players, boards, mutations, setSaveFailure(value) { failSave = value; },
    setStaleDeletionResponse(value) { staleDeletionResponse = value; },
    holdTeamCreate() { let release; teamCreateWait = new Promise((resolve) => { release = resolve; }); return release; } };
}

function text(node) { return typeof node === 'string' ? node : node.children.map(text).join(''); }
function button(tree, label) {
  const result = tree.root.findAllByType('button').find((node) => text(node).trim() === label || node.props['aria-label'] === label);
  assert.ok(result, `Missing action: ${label}`);
  return result;
}
async function click(tree, label) { await act(async () => { await button(tree, label).props.onClick(); }); }
async function change(tree, label, value) {
  const node = tree.root.findByProps({ 'aria-label': label });
  await act(async () => { node.props.onChange({ target: { value } }); });
}
async function submit(tree, label) {
  await act(async () => { await tree.root.findByProps({ 'aria-label': label }).props.onSubmit({ preventDefault() {} }); });
}
async function mount(t) {
  const restore = installBrowser();
  const api = backend(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let tree;
  await act(async () => { tree = create(React.createElement(Whiteboard, { onClose() {} })); });
  t.after(async () => { await act(async () => { tree.unmount(); }); restore(); });
  return { tree, api };
}

test('creates a persistent team and player, retaining a real zero rating separately from unassigned positions', async (t) => {
  const { tree, api } = await mount(t);
  await click(tree, 'Nuevo equipo');
  await change(tree, 'Nombre del equipo', 'Vóley Mixto');
  await submit(tree, 'Crear equipo');
  const team = api.teams.find((item) => item.name === 'Vóley Mixto');
  assert.ok(team);
  await click(tree, 'Plantilla');
  await click(tree, 'Nuevo jugador');
  await change(tree, 'Nombre del jugador', 'Sofía');
  await change(tree, 'Dorsal del jugador', '11');
  await change(tree, 'Valoración en Punta / receptor', '0');
  await change(tree, 'Valoración en Líbero', '5');
  await submit(tree, 'Guardar jugador');
  const player = api.players.find((item) => item.name === 'Sofía');
  assert.equal(player.teamId, team.id);
  assert.equal(player.ratings.R, 0);
  assert.equal(player.ratings.L, 5);
  assert.equal(player.ratings.COL, null);
  assert.ok(tree.root.findAllByProps({ 'data-score': 0 }).length > 0, 'Zero must render a rated badge');
  assert.ok(tree.root.findAllByProps({ 'data-score': 5 }).length > 0);
});

test('an unassigned slider accepts zero on the first click and can be cleared without altering other positions', async (t) => {
  const { tree, api } = await mount(t);
  await click(tree, 'Plantilla');
  await click(tree, 'Editar a Ana');
  const nativeZero = { value: '0', matches: () => false };
  await act(async () => {
    tree.root.findByProps({ 'aria-label': 'Valoración en Opuesto' }).props.onPointerUp({ button: 2, currentTarget: nativeZero });
  });
  assert.equal(tree.root.findByProps({ 'aria-label': 'Valoración en Opuesto' }).props['aria-valuetext'], 'Sin asignar',
    'Opening the context menu must not assign a rating');
  await act(async () => {
    // The native range already has DOM value 0, so there is no change event.
    tree.root.findByProps({ 'aria-label': 'Valoración en Opuesto' }).props.onPointerUp({ button: 0, currentTarget: nativeZero });
  });
  await submit(tree, 'Guardar jugador');
  assert.equal(api.players[0].ratings.O, 0);
  assert.equal(api.players[0].ratings.COL, 5);
  await click(tree, 'Editar a Ana');
  await act(async () => {
    button(tree, 'Quitar valoración de Opuesto').props.onClick({ currentTarget: { matches: () => false } });
  });
  await submit(tree, 'Guardar jugador');
  assert.equal(api.players[0].ratings.O, null);
  assert.equal(api.players[0].ratings.R, 0, 'Clearing a position must preserve a zero in another position');
});

test('slider keyboard and direct score choices keep null explicit and ignore disabled interactions', async (t) => {
  const { tree, api } = await mount(t);
  await click(tree, 'Plantilla');
  await click(tree, 'Editar a Ana');
  const range = () => tree.root.findByProps({ 'aria-label': 'Valoración en Opuesto' });
  await act(async () => {
    range().props.onKeyUp({ key: 'Tab', currentTarget: { value: '0', matches: () => false } });
  });
  assert.equal(range().props['aria-valuetext'], 'Sin asignar', 'Focusing the range must not assign zero');
  await act(async () => {
    range().props.onKeyUp({ key: 'Home', currentTarget: { value: '0', matches: () => false } });
  });
  assert.equal(range().props['aria-valuetext'], '0 de 5');
  await act(async () => {
    button(tree, '4 de 5 en Opuesto').props.onClick({ currentTarget: { matches: () => false } });
  });
  await act(async () => {
    range().props.onPointerUp({ button: 0, currentTarget: { value: '5', matches: () => true } });
    range().props.onKeyUp({ key: 'End', currentTarget: { value: '5', matches: () => true } });
  });
  await submit(tree, 'Guardar jugador');
  assert.equal(api.players[0].ratings.O, 4);
  assert.equal(api.players[0].ratings.L, null);
});

test('player edits resolve across sets, removing a set member is distinct from reversible catalogue deletion', async (t) => {
  const { tree, api } = await mount(t);
  await click(tree, 'Nuevo set (1/5)');
  await act(async () => { t.mock.timers.tick(801); });
  await click(tree, 'Plantilla');
  await click(tree, 'Editar a Ana');
  await change(tree, 'Nombre del jugador', 'Ana María');
  await submit(tree, 'Guardar jugador');
  await click(tree, 'Pizarra');
  assert.ok(tree.root.findAllByProps({ 'aria-label': 'Ana María en COL, zona 1' }).length > 0);
  await click(tree, 'Quitar a Ana María de este set');
  await act(async () => { t.mock.timers.tick(801); });
  assert.equal(api.players.find((item) => item.id === 31).deleted, false);
  assert.equal(api.boards.get(12).sets[1].roster.length, 0);
  assert.equal(api.boards.get(12).sets[0].roster[0].id, 31);
  await click(tree, 'Set 1');
  assert.ok(tree.root.findAllByProps({ 'aria-label': 'Ana María en COL, zona 1' }).length > 0);
  await click(tree, 'Plantilla');
  await click(tree, 'Eliminar a Ana María');
  assert.equal(api.players.find((item) => item.id === 31).deleted, false, 'Removal must first ask for confirmation');
  await click(tree, 'Confirmar eliminación');
  assert.equal(api.players.find((item) => item.id === 31).deleted, true);
  await click(tree, 'Papelera de jugadores');
  await click(tree, 'Restaurar a Ana María');
  assert.equal(api.players.find((item) => item.id === 31).deleted, false);
});

test('a failed pending save keeps the selected team in place instead of discarding edits', async (t) => {
  const { tree, api } = await mount(t);
  await click(tree, 'Nuevo set (1/5)');
  api.setSaveFailure(true);
  await change(tree, 'Equipo de la pizarra', '13');
  assert.equal(tree.root.findByProps({ 'aria-label': 'Equipo de la pizarra' }).props.value, '12');
  assert.ok(tree.root.findAllByProps({ role: 'alert' }).length > 0);
  assert.equal(api.mutations.some((entry) => entry.url === '/api/teams/13/whiteboard'), false);
  api.setSaveFailure(false);
  await click(tree, 'Reintentar');
  await change(tree, 'Equipo de la pizarra', '13');
  assert.equal(tree.root.findByProps({ 'aria-label': 'Equipo de la pizarra' }).props.value, '13');
  assert.equal(api.boards.get(12).sets.length, 2, 'The original team must be saved before leaving');
});

test('team rename, deletion and restoration retain its saved roster and sets', async (t) => {
  const { tree, api } = await mount(t);
  await click(tree, 'Editar equipo');
  await change(tree, 'Nombre del equipo', 'Equipo Mixto');
  await submit(tree, 'Editar equipo');
  assert.equal(api.teams.find((team) => team.id === 12).name, 'Equipo Mixto');
  await click(tree, 'Eliminar equipo');
  assert.equal(api.teams.find((team) => team.id === 12).deleted, false, 'A team deletion must first ask for confirmation');
  await click(tree, 'Confirmar eliminación');
  assert.equal(api.teams.find((team) => team.id === 12).deleted, true);
  assert.equal(tree.root.findByProps({ 'aria-label': 'Equipo de la pizarra' }).props.value, 'personal');
  await click(tree, 'Papelera de equipos (1)');
  await click(tree, 'Restaurar equipo Equipo Mixto');
  assert.equal(api.teams.find((team) => team.id === 12).deleted, false);
  assert.equal(tree.root.findByProps({ 'aria-label': 'Equipo de la pizarra' }).props.value, '12');
  assert.equal(api.players.find((player) => player.id === 31).deleted, false);
  assert.equal(api.boards.get(12).sets[0].roster[0].id, 31);
  assert.ok(tree.root.findAllByProps({ 'aria-label': 'Ana en COL, zona 1' }).length > 0);
});

test('the personal editor stays locked while a team creation can replace its mounted board', async (t) => {
  const { tree, api } = await mount(t);
  await change(tree, 'Equipo de la pizarra', 'personal');
  await click(tree, 'Nuevo equipo');
  await change(tree, 'Nombre del equipo', 'Equipo nuevo');
  const release = api.holdTeamCreate();
  t.after(release);
  let saving;
  await act(async () => {
    saving = tree.root.findByProps({ 'aria-label': 'Crear equipo' }).props.onSubmit({ preventDefault() {} });
  });
  assert.equal(tree.root.findByProps({ 'aria-label': 'Editar pizarra' }).props.disabled, true,
    'New personal edits after the flush would be lost when creation switches teams');
  await act(async () => { release(); await saving; });
  assert.equal(tree.root.findByProps({ 'aria-label': 'Equipo de la pizarra' }).props.value,
    String(api.teams.find((team) => team.name === 'Equipo nuevo').id));
});

test('team and player forms are exclusive so creating a team cannot discard a player draft', async (t) => {
  const { tree, api } = await mount(t);
  await click(tree, 'Plantilla');
  await click(tree, 'Nuevo equipo');
  await change(tree, 'Nombre del equipo', 'Otro equipo');
  const queuedTeamSubmit = tree.root.findByProps({ 'aria-label': 'Crear equipo' }).props.onSubmit;
  assert.equal(button(tree, 'Nuevo jugador').props.disabled, true, 'A team form must block creation of a player draft');
  assert.equal(button(tree, 'Editar a Ana').props.disabled, true, 'A team form must block editing an existing player');
  assert.equal(button(tree, 'Pizarra').props.disabled, true);
  assert.equal(button(tree, 'Plantilla').props.disabled, true);
  assert.equal(tree.root.findByProps({ 'aria-label': 'Editar pizarra' }).props.disabled, true);
  await click(tree, 'Cancelar');
  await click(tree, 'Nuevo jugador');
  await change(tree, 'Nombre del jugador', 'Borrador conservado');
  assert.equal(button(tree, 'Nuevo equipo').props.disabled, true);
  await act(async () => { await queuedTeamSubmit({ preventDefault() {} }); });
  assert.equal(api.teams.some((team) => team.name === 'Otro equipo'), false, 'An already queued team submit must not replace an active player draft');
  assert.equal(tree.root.findByProps({ 'aria-label': 'Nombre del jugador' }).props.value, 'Borrador conservado');
});

test('a successful HTTP response with the old deletion state cannot hide or restore teams or players locally', async (t) => {
  const { tree, api } = await mount(t);
  const hasErrorWithoutSuccess = () => {
    assert.ok(tree.root.findAllByProps({ role: 'alert' }).length > 0);
    assert.equal(tree.root.findAllByProps({ className: 'wb-notice' }).length, 0, 'Do not announce an unconfirmed deletion or restoration');
  };
  api.setStaleDeletionResponse(true);
  await click(tree, 'Eliminar equipo');
  await click(tree, 'Confirmar eliminación');
  hasErrorWithoutSuccess();
  assert.equal(tree.root.findByProps({ 'aria-label': 'Equipo de la pizarra' }).props.value, '12');
  assert.ok(button(tree, 'Confirmar eliminación'), 'Keep the confirmation available for retry');

  api.setStaleDeletionResponse(false);
  await click(tree, 'Confirmar eliminación');
  await click(tree, 'Papelera de equipos (1)');
  api.setStaleDeletionResponse(true);
  await click(tree, 'Restaurar equipo Equipo A');
  hasErrorWithoutSuccess();
  assert.equal(tree.root.findByProps({ 'aria-label': 'Equipo de la pizarra' }).props.value, 'personal');
  assert.ok(button(tree, 'Restaurar equipo Equipo A'));

  api.setStaleDeletionResponse(false);
  await click(tree, 'Restaurar equipo Equipo A');
  await click(tree, 'Plantilla');
  api.setStaleDeletionResponse(true);
  await click(tree, 'Eliminar a Ana');
  await click(tree, 'Confirmar eliminación');
  hasErrorWithoutSuccess();
  assert.ok(button(tree, 'Editar a Ana'), 'The player remains in the visible catalogue until confirmed');

  api.setStaleDeletionResponse(false);
  await click(tree, 'Confirmar eliminación');
  await click(tree, 'Papelera de jugadores');
  api.setStaleDeletionResponse(true);
  await click(tree, 'Restaurar a Ana');
  hasErrorWithoutSuccess();
  assert.ok(button(tree, 'Restaurar a Ana'), 'A stale response must not remove the player from the trash');
});
