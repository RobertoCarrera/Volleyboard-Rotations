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
let App;
let Whiteboard;

before(async () => {
  bundleDirectory = await mkdtemp(join(rootDirectory, 'node_modules', '.whiteboard-lifecycle-'));
  await build({
    entryPoints: [join(rootDirectory, 'src/App.jsx'), join(rootDirectory, 'src/components/Whiteboard.jsx')],
    outdir: bundleDirectory,
    entryNames: '[name]',
    outExtension: { '.js': '.mjs' },
    bundle: true,
    packages: 'external',
    format: 'esm',
    platform: 'node',
    loader: { '.css': 'empty' },
    logLevel: 'silent'
  });
  App = (await import(pathToFileURL(join(bundleDirectory, 'App.mjs')).href)).default;
  Whiteboard = (await import(pathToFileURL(join(bundleDirectory, 'Whiteboard.mjs')).href)).default;
});

after(async () => {
  if (bundleDirectory) await rm(bundleDirectory, { recursive: true, force: true });
});

function installBrowser() {
  const originals = new Map(['window', 'navigator', 'document', 'sessionStorage']
    .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const browser = new EventTarget();
  const navigator = { userAgent: 'Node test renderer' };
  const document = new EventTarget();
  document.querySelector = () => null;
  document.body = { classList: { toggle() {}, remove() {} } };
  browser.matchMedia = () => ({ matches: false });
  browser.navigator = navigator;
  browser.location = { href: `${SITE}/`, origin: SITE, pathname: '/', assign() {} };
  browser.history = { replaceState() {} };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true, value: { getItem() { return null; }, setItem() {} }
  });
  return () => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
}

function backend(t, initialBoard = null) {
  let board = initialBoard;
  let failRead = false;
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url === '/api/teams') return Response.json({ status: 'success', data: [] });
    if (url === '/api/auth/session') {
      return Response.json({
        user: { id: 'coach-123', name: 'Entrenadora', email: 'coach@example.test', image: null },
        expires: '2027-01-01T00:00:00.000Z'
      });
    }
    assert.equal(url, '/api/whiteboard');
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      board = JSON.parse(body.state);
      writes.push(board);
      return Response.json({ status: 'success', data: { id: 1, name: 'Pizarra', state: body.state } });
    }
    if (failRead) return Response.json({ status: 'error', error: 'Unavailable' }, { status: 503 });
    return Response.json({
      status: 'success',
      data: board ? { id: 1, name: 'Pizarra', state: JSON.stringify(board) } : null
    });
  });
  return { writes, setReadFailure(value) { failRead = value; } };
}

function text(node) {
  return typeof node === 'string' ? node : node.children.map(text).join('');
}

function button(tree, label) {
  const match = tree.root.findAllByType('button').find((node) => text(node).includes(label));
  assert.ok(match, `The ${label} action must be available`);
  return match;
}

async function click(tree, label) {
  await act(async () => { button(tree, label).props.onClick(); });
}

function editor(tree) {
  return tree.root.findByProps({ 'aria-label': 'Editar pizarra' });
}

function hidden(node) {
  for (let current = node; current; current = current.parent) {
    if (current.props.hidden || current.props.style?.display === 'none') return true;
  }
  return false;
}

test('edits survive an immediate switch to the simulator and restore after reopening the app', async (t) => {
  const restoreBrowser = installBrowser();
  const api = backend(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let app;
  t.after(async () => {
    await act(async () => { app?.unmount(); });
    restoreBrowser();
  });
  await act(async () => { app = create(React.createElement(App)); });
  await click(app, '▦ Pizarra');
  assert.equal(editor(app).props.disabled, false);
  assert.equal(api.writes.length, 0, 'Opening an empty account must not save defaults');

  await click(app, 'Nuevo set');
  await click(app, '◈ Simulador');
  assert.equal(api.writes.length, 0, 'The switch happens before the autosave debounce');
  await act(async () => { t.mock.timers.tick(801); });
  assert.equal(api.writes.length, 1, 'Switching spaces must not cancel the pending save');
  assert.equal(api.writes[0].sets.length, 2);
  assert.equal(api.writes[0].activeId, 2);
  assert.equal(hidden(editor(app)), true, 'The retained board must not remain visible in the simulator');

  await click(app, '▦ Pizarra');
  assert.equal(hidden(editor(app)), false);
  await click(app, 'Nuevo set');
  await click(app, 'Volver al simulador');
  await act(async () => { t.mock.timers.tick(801); });
  assert.equal(api.writes.length, 2, 'The return action must also preserve pending saves');
  assert.equal(api.writes[1].sets.length, 3);

  await act(async () => { app.unmount(); });
  await act(async () => { app = create(React.createElement(App)); });
  await click(app, '▦ Pizarra');
  const restoredSets = app.root.findAllByType('button').filter((node) => /^Set \d+$/.test(text(node)));
  assert.equal(restoredSets.length, 3, 'A fresh mount must restore the saved edits');
  assert.equal(text(restoredSets.find((node) => node.props.className === 'active')), 'Set 3');
  await act(async () => { t.mock.timers.tick(1000); });
  assert.equal(api.writes.length, 2, 'Hydrating an existing board must not write it back');
});

test('failed hydration keeps the editor disabled until retry restores the saved board', async (t) => {
  const restoreBrowser = installBrowser();
  const saved = {
    sets: [{
      id: 4, name: 'Set 4', rotation: 'R3', phase: 'receiving',
      roster: [{ id: 7, name: 'Lucía', number: '7', slot: null }]
    }],
    activeId: 4
  };
  const api = backend(t, saved);
  api.setReadFailure(true);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let board;
  t.after(async () => {
    await act(async () => { board?.unmount(); });
    restoreBrowser();
  });
  await act(async () => { board = create(React.createElement(Whiteboard, { onClose() {} })); });
  assert.ok(board.root.findAllByProps({ role: 'alert' }).length > 0, 'The failed load must be visible');
  assert.equal(editor(board).props['aria-busy'], false, 'The failed request has finished');
  assert.equal(editor(board).props.disabled, true, 'A failed load must not enable edits that retry would discard');
  assert.equal(button(board, 'Reintentar').props.disabled, false, 'Retry must remain available outside the disabled editor');
  await act(async () => { t.mock.timers.tick(1000); });
  assert.equal(api.writes.length, 0);

  api.setReadFailure(false);
  await click(board, 'Reintentar');
  assert.equal(editor(board).props.disabled, false);
  assert.ok(board.root.findAllByType('input').some((node) => node.props.value === 'Lucía'));
  await act(async () => { t.mock.timers.tick(1000); });
  assert.equal(api.writes.length, 0, 'Recovery must hydrate the saved board without replacing it with defaults');
  await click(board, 'Nuevo set');
  await act(async () => { t.mock.timers.tick(801); });
  assert.equal(api.writes.length, 1);
  assert.equal(api.writes[0].sets[0].roster[0].name, 'Lucía');
  assert.equal(api.writes[0].sets.length, 2);
});
