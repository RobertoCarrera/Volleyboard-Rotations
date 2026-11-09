import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test, { after, before } from 'node:test';
import { build } from 'esbuild';
import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';

let bundleDirectory;
let useWhiteboardCloud;
const project = fileURLToPath(new URL('../', import.meta.url));
const makeBoard = (rotation) => ({ sets: [{ id: 1, name: 'Set 1', rotation,
  phase: 'receiving', roster: [] }], activeId: 1 });

before(async () => {
  bundleDirectory = await mkdtemp(join(project, 'node_modules', '.team-cloud-'));
  await build({ entryPoints: [join(project, 'src/components/useWhiteboardCloud.js')],
    outfile: join(bundleDirectory, 'hook.mjs'), bundle: true, packages: 'external',
    format: 'esm', platform: 'node', logLevel: 'silent' });
  useWhiteboardCloud = (await import(pathToFileURL(join(bundleDirectory, 'hook.mjs')).href)).default;
});
after(async () => { if (bundleDirectory) await rm(bundleDirectory, { recursive: true, force: true }); });

async function setup(t, options = {}) {
  let tree;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  t.after(async () => {
    await act(async () => { tree?.unmount(); });
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });
  const boards = new Map([[11, makeBoard('R1')], [22, makeBoard('R3')]]);
  const writes = [];
  let failSave = false;
  let failLoad = options.failLoad || false;
  let holdNext = false;
  let release;
  t.mock.method(globalThis, 'fetch', async (url, request = {}) => {
    if (url === '/api/auth/session') return Response.json({
      user: { id: 'coach-123', name: 'Coach' }, expires: '2027-01-01T00:00:00.000Z'
    });
    const match = url.match(/^\/api\/teams\/(11|22)\/whiteboard$/);
    if (!match) return Response.json({ status: 'error', error: 'Incorrect resource' }, { status: 404 });
    const id = Number(match[1]);
    if (request.method === 'PUT') {
      const state = JSON.parse(JSON.parse(request.body).state);
      writes.push({ id, state });
      if (holdNext) {
        holdNext = false;
        await new Promise((resolve) => { release = resolve; });
      }
      if (failSave) return Response.json({ status: 'error', error: 'Unavailable' }, { status: 503 });
      boards.set(id, state);
      return Response.json({ status: 'success', data: { id } });
    }
    if (failLoad) return Response.json({ status: 'error', error: 'Unavailable' }, { status: 503 });
    return Response.json({ status: 'success', data: { id, name: 'Pizarra', state: JSON.stringify(boards.get(id)) } });
  });
  let current;
  function Harness({ teamId }) {
    const [board, setBoard] = useState(makeBoard('R1'));
    const cloud = useWhiteboardCloud({ ...board, teamId, onLoad: setBoard });
    current = { board, setBoard, cloud };
    return React.createElement('div', { 'data-ready': cloud.isReady }, cloud.status);
  }
  await act(async () => { tree = create(React.createElement(Harness, { teamId: 11 })); });
  return { boards, writes, get current() { return current; },
    failSaves(value) { failSave = value; }, failLoads(value) { failLoad = value; },
    holdSave() { holdNext = true; }, releaseSave() { release?.(); },
    async edit(rotation) { await act(async () => { current.setBoard(makeBoard(rotation)); }); },
    async switchTeam(teamId) { await act(async () => { tree.update(React.createElement(Harness, { teamId })); }); }
  };
}

test('flush persists the departing team before switching and does not overwrite the arriving board', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ui = await setup(t);
  assert.equal(typeof ui.current.cloud.flush, 'function');
  assert.equal(ui.current.cloud.isReady, true);
  await ui.edit('R6');
  assert.equal(ui.writes.length, 0);
  let saved;
  await act(async () => { saved = await ui.current.cloud.flush(); });
  assert.equal(saved, true);
  assert.deepEqual(ui.writes, [{ id: 11, state: makeBoard('R6') }]);
  await ui.switchTeam(22);
  assert.deepEqual(ui.current.board, makeBoard('R3'));
  await act(async () => { t.mock.timers.tick(1000); });
  assert.equal(ui.writes.length, 1, 'Loading team B must not write the departing team state');
});

test('flush waits for an in-flight save and persists the newest edit before resolving', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ui = await setup(t);
  assert.equal(typeof ui.current.cloud.flush, 'function');
  ui.holdSave();
  await ui.edit('R6');
  await act(async () => { t.mock.timers.tick(801); });
  assert.equal(ui.writes.length, 1);
  await ui.edit('R5');
  let resolved = false;
  let pending;
  await act(async () => { pending = ui.current.cloud.flush().then((result) => { resolved = true; return result; }); });
  assert.equal(resolved, false, 'Team switch must wait for the actual server response');
  let saved;
  await act(async () => { ui.releaseSave(); saved = await pending; });
  assert.equal(saved, true);
  assert.deepEqual(ui.boards.get(11), makeBoard('R5'));
  assert.deepEqual(ui.writes.map((write) => write.state.sets[0].rotation), ['R6', 'R5']);
});

test('failed saves block flush and retry keeps the latest unsaved changes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ui = await setup(t);
  assert.equal(typeof ui.current.cloud.flush, 'function');
  ui.failSaves(true);
  await ui.edit('R6');
  let saved;
  await act(async () => { saved = await ui.current.cloud.flush(); });
  assert.equal(saved, false);
  assert.match(ui.current.cloud.error, /disponible|guard|sincron|conect/i);
  assert.deepEqual(ui.boards.get(11), makeBoard('R1'));
  await ui.edit('R5');
  ui.failSaves(false);
  await act(async () => { ui.current.cloud.retry(); });
  await act(async () => { saved = await ui.current.cloud.flush(); });
  assert.equal(saved, true);
  assert.deepEqual(ui.boards.get(11), makeBoard('R5'));
});

test('failed team hydration cannot be flushed over existing data', async (t) => {
  const ui = await setup(t, { failLoad: true });
  assert.equal(typeof ui.current.cloud.flush, 'function');
  assert.equal(ui.current.cloud.isReady, false);
  let saved;
  await act(async () => { saved = await ui.current.cloud.flush(); });
  assert.equal(saved, false);
  assert.equal(ui.writes.length, 0);
  assert.deepEqual(ui.boards.get(11), makeBoard('R1'));
});
