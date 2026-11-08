import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import * as api from '../src/api.js';

const SITE = 'https://volleyboard.sincronia.agency';
const savedBoard = {
  sets: [{ id: 1, name: 'Set 1', rotation: 'R1', phase: 'receiving', roster: [] }],
  activeId: 1
};

function browser(t, href = `${SITE}/`) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const redirects = [];
  let current = new URL(href);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        get href() { return current.href; },
        get origin() { return current.origin; },
        get pathname() { return current.pathname; },
        assign(url) { redirects.push(url); }
      },
      history: { replaceState(_state, _title, url) { current = new URL(url, current); } }
    }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  });
  return { redirects, get url() { return current; } };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('restores the verified same-origin session without forwarding browser tokens', async (t) => {
  browser(t);
  const session = {
    user: { id: 'google-user-123', name: 'Entrenadora', email: 'coach@example.test', image: null },
    expires: '2027-01-01T00:00:00.000Z'
  };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/auth/session');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    const headers = new Headers(options.headers);
    assert.equal(headers.has('Authorization'), false);
    assert.equal(headers.has('X-Database-Instance'), false);
    return json(session);
  });
  assert.deepEqual(await api.authFetch('get-session'), { status: 'success', data: session });
});

test('distinguishes a signed-out visitor from an unavailable session service', async (t) => {
  browser(t);
  t.mock.method(globalThis, 'fetch', async () => json(null));
  assert.deepEqual(await api.authFetch('get-session'), { status: 'success', data: null });
  globalThis.fetch = async () => json({ error: 'Configuration' }, 503);
  const result = await api.authFetch('get-session');
  assert.equal(result.status, 'error');
  assert.equal(result.httpStatus, 503);
  assert.equal(result.data, null);
  assert.match(result.error, /sesión|configura|disponible/i);
});

test('starts Google using the local CSRF form contract and a clean callback URL', async (t) => {
  const page = browser(t, `${SITE}/?token=legacy&ncb_login=1&db=old&Instance=old`);
  const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=server-state';
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push(url);
    assert.equal(options.credentials, 'same-origin');
    if (url === '/api/auth/csrf') return json({ csrfToken: 'test-csrf' });
    assert.equal(url, '/api/auth/signin/google');
    assert.equal(options.method, 'POST');
    const headers = new Headers(options.headers);
    assert.equal(headers.get('X-Auth-Return-Redirect'), '1');
    assert.match(headers.get('Content-Type'), /application\/x-www-form-urlencoded/);
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('csrfToken'), 'test-csrf');
    assert.equal(body.get('callbackUrl'), `${SITE}/`);
    return json({ url: authorizationUrl });
  });
  assert.equal(await api.startGoogleSignIn(), null);
  assert.deepEqual(requests, ['/api/auth/csrf', '/api/auth/signin/google']);
  assert.deepEqual(page.redirects, [authorizationUrl]);
});

test('does not attempt Google sign-in when CSRF initialization fails', async (t) => {
  const page = browser(t);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(url);
    return json({});
  });
  const error = await api.startGoogleSignIn();
  assert.equal(typeof error, 'string');
  assert.ok(error.length > 0);
  assert.deepEqual(requests, ['/api/auth/csrf']);
  assert.deepEqual(page.redirects, []);
});

test('shows a callback failure returned by Auth.js instead of navigating into an error loop', async (t) => {
  const page = browser(t);
  t.mock.method(globalThis, 'fetch', async (url) => url === '/api/auth/csrf'
    ? json({ csrfToken: 'test-csrf' })
    : json({ url: `${SITE}/?error=OAuthCallbackError` }));
  const error = await api.startGoogleSignIn();
  assert.match(error, /Google|sesión/i);
  assert.equal(error.includes('OAuthCallbackError'), false);
  assert.deepEqual(page.redirects, []);
});

test('returns an actionable OAuth error from the URL and removes obsolete auth parameters', (t) => {
  const page = browser(t, `${SITE}/?error=AccessDenied&token=legacy&ncb_login=1&user_id=forged&db=old&Instance=old`);
  const error = api.captureOAuthReturn();
  assert.equal(typeof error, 'string');
  assert.match(error, /permiso|autoriz|cancel/i);
  assert.equal(page.url.search, '');
});

test('unknown OAuth error parameters always produce safe display text', (t) => {
  browser(t, `${SITE}/?error=__proto__`);
  const error = api.captureOAuthReturn();
  assert.equal(typeof error, 'string');
  assert.match(error, /sesión/i);
});

test('sign-out uses the same-origin CSRF form endpoint', async (t) => {
  browser(t);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push(url);
    if (url === '/api/auth/csrf') return json({ csrfToken: 'signout-csrf' });
    assert.equal(url, '/api/auth/signout');
    assert.equal(options.method, 'POST');
    assert.equal(new Headers(options.headers).get('X-Auth-Return-Redirect'), '1');
    assert.equal(new URLSearchParams(options.body).get('csrfToken'), 'signout-csrf');
    return json({ url: `${SITE}/` });
  });
  assert.deepEqual(await api.authFetch('sign-out', { method: 'POST' }), {
    status: 'success', data: { url: `${SITE}/` }
  });
  assert.deepEqual(requests, ['/api/auth/csrf', '/api/auth/signout']);
});

test('loads the owner-scoped whiteboard and validates its saved state before hydration', async (t) => {
  assert.equal(typeof api.loadWhiteboard, 'function');
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/whiteboard');
    assert.equal(options.method || 'GET', 'GET');
    return json({ status: 'success', data: { id: 7, name: 'Pizarra', state: JSON.stringify(savedBoard) } });
  });
  assert.deepEqual(await api.loadWhiteboard(), { status: 'success', data: savedBoard });
});

test('rejects corrupt stored whiteboards instead of treating them as an empty account', async (t) => {
  assert.equal(typeof api.loadWhiteboard, 'function');
  t.mock.method(globalThis, 'fetch', async () => json({
    status: 'success', data: { id: 7, name: 'Pizarra', state: '{not-json' }
  }));
  const result = await api.loadWhiteboard();
  assert.equal(result.status, 'error');
  assert.equal(result.data, null);
  assert.match(result.error, /pizarra|datos/i);
});

test('saves the board with PUT while leaving owner and row selection to the server', async (t) => {
  assert.equal(typeof api.saveWhiteboard, 'function');
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/whiteboard');
    assert.equal(options.method, 'PUT');
    assert.deepEqual(JSON.parse(options.body), { name: 'Pizarra', state: JSON.stringify(savedBoard) });
    return json({ status: 'success', data: { id: 7 } });
  });
  const result = await api.saveWhiteboard({ ...savedBoard, user_id: 'forged-owner', id: 99 });
  assert.equal(result.status, 'success');
});

test('reports an expired session when saving fails with 401', async (t) => {
  assert.equal(typeof api.saveWhiteboard, 'function');
  t.mock.method(globalThis, 'fetch', async () => json({ status: 'error', error: 'Unauthorized' }, 401));
  const result = await api.saveWhiteboard(savedBoard);
  assert.equal(result.status, 'error');
  assert.equal(result.httpStatus, 401);
  assert.match(result.error, /sesión.*iniciar|iniciar.*sesión/i);
});

test('the service worker leaves session, data, and OAuth callback requests to the network', async () => {
  const listeners = new Map();
  const context = {
    URL,
    self: { location: { origin: SITE }, addEventListener: (name, handler) => listeners.set(name, handler) },
    fetch: async () => json({}),
    caches: { match: async () => undefined, open: async () => ({ put() {} }) }
  };
  vm.runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
  for (const [path, mode] of [
    ['/api/auth/session', 'cors'],
    ['/api/whiteboard', 'cors'],
    ['/api/auth/callback/google?state=example', 'navigate']
  ]) {
    let intercepted = false;
    listeners.get('fetch')({
      request: { method: 'GET', url: `${SITE}${path}`, mode },
      respondWith() { intercepted = true; }
    });
    assert.equal(intercepted, false, `${path} must never use an app-shell/cache response`);
  }
});
