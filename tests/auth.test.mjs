import assert from 'node:assert/strict';
import test from 'node:test';
import { encode } from '@auth/core/jwt';
import { createAuthConfig, handleAuth, getSession } from '../server/auth.mjs';

const ORIGIN = 'https://volleyboard.sincronia.agency';
const env = {
  AUTH_ORIGIN: ORIGIN,
  AUTH_SECRET: 'test-only-auth-secret-with-at-least-32-characters',
  AUTH_GOOGLE_ID: 'test-client.apps.googleusercontent.com',
  AUTH_GOOGLE_SECRET: 'test-only-google-secret',
};

const identity = {
  sub: '107000000000000000001',
  email: 'player@example.invalid',
  name: 'Test player',
  provider: 'google',
  emailVerified: true,
};

async function sessionCookie(token = identity, options = {}) {
  const value = await encode({
    token,
    secret: env.AUTH_SECRET,
    salt: '__Secure-authjs.session-token',
    maxAge: 3600,
    ...options,
  });
  return `__Secure-authjs.session-token=${value}`;
}

function cookieHeader(response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
}

function signInRequest(body, headers = {}) {
  return new Request(`${ORIGIN}/api/auth/signin/google`, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
      ...headers,
    },
    body: new URLSearchParams(body),
  });
}

test('CSRF endpoint issues secure host-only cookies and prevents caching', async () => {
  const response = await handleAuth(new Request(`${ORIGIN}/api/auth/csrf`), env);
  assert.equal(response.status, 200);
  assert.match((await response.json()).csrfToken, /^[a-f0-9]+$/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const csrf = response.headers.getSetCookie().find((cookie) => cookie.startsWith('__Host-authjs.csrf-token='));
  assert.ok(csrf);
  assert.match(csrf, /; HttpOnly/i);
  assert.match(csrf, /; Secure/i);
  assert.doesNotMatch(csrf, /; Domain=/i);
});

test('canonical host and origin restrictions also protect GET endpoints', async () => {
  const requests = [
    new Request('https://attacker.invalid/api/auth/csrf'),
    new Request(`${ORIGIN}/api/auth/csrf`, { headers: { origin: 'https://attacker.invalid' } }),
    new Request(`${ORIGIN}/api/auth/session`, { headers: { 'sec-fetch-site': 'cross-site' } }),
    new Request(`${ORIGIN}/api/auth/csrf`, { headers: { host: 'attacker.invalid' } }),
    new Request(`${ORIGIN}/api/auth/signout`, { method: 'POST' }),
  ];
  for (const request of requests) {
    const response = await handleAuth(request, env);
    assert.equal(response.status, 403);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
});

test('sign-in requires the Auth.js CSRF token and matching cookie', async () => {
  const response = await handleAuth(signInRequest({ callbackUrl: '/' }), env);
  const result = await response.json();
  const destination = new URL(result.url);
  assert.equal(destination.origin, ORIGIN);
  assert.ok(destination.searchParams.has('error'));
  assert.equal(destination.hostname, 'volleyboard.sincronia.agency');
  assert.ok(!response.headers.getSetCookie().some((cookie) => cookie.includes('authjs.pkce.code_verifier=')));
});

test('sign-in keeps Google redirect URI canonical and enables state, PKCE and nonce', async () => {
  const csrfResponse = await handleAuth(new Request(`${ORIGIN}/api/auth/csrf`), env);
  const { csrfToken } = await csrfResponse.json();
  const response = await handleAuth(signInRequest({
    csrfToken,
    callbackUrl: 'https://attacker.invalid/steal',
  }, {
    cookie: cookieHeader(csrfResponse),
    'x-forwarded-host': 'attacker.invalid',
    'x-forwarded-proto': 'http',
  }), env);
  assert.equal(response.status, 200);
  const destination = new URL((await response.json()).url);
  assert.equal(destination.origin, 'https://accounts.google.com');
  assert.equal(destination.searchParams.get('redirect_uri'), `${ORIGIN}/api/auth/callback/google`);
  assert.equal(destination.searchParams.get('client_id'), env.AUTH_GOOGLE_ID);
  assert.equal(destination.searchParams.get('response_type'), 'code');
  assert.equal(destination.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(destination.searchParams.get('code_challenge'));
  assert.ok(destination.searchParams.get('state'));
  assert.ok(destination.searchParams.get('nonce'));
  const cookies = response.headers.getSetCookie();
  for (const name of ['authjs.state', 'authjs.pkce.code_verifier', 'authjs.nonce']) {
    const cookie = cookies.find((value) => value.startsWith(`__Secure-${name}=`));
    assert.ok(cookie, `${name} cookie is required`);
    assert.match(cookie, /; Secure/i);
    assert.match(cookie, /; HttpOnly/i);
    assert.doesNotMatch(cookie, /; Domain=/i);
  }
  const callbackCookie = cookies.find((value) => value.startsWith('__Secure-authjs.callback-url='));
  if (callbackCookie) assert.ok(!decodeURIComponent(callbackCookie).includes('attacker.invalid'));
});

test('redirect callback rejects external, protocol-relative and credentialed URLs', async () => {
  const { redirect } = createAuthConfig(env).callbacks;
  for (const url of ['https://attacker.invalid', '//attacker.invalid', 'javascript:alert(1)', 'https://user:pass@volleyboard.sincronia.agency/']) {
    assert.equal(await redirect({ url, baseUrl: 'https://attacker.invalid' }), `${ORIGIN}/`);
  }
  assert.equal(await redirect({ url: '/?view=rotations', baseUrl: 'https://attacker.invalid' }), `${ORIGIN}/?view=rotations`);
});

test('only verified Google profiles are authorized and Google subject is the stable user id', async () => {
  const { signIn, jwt } = createAuthConfig(env).callbacks;
  const account = { provider: 'google', providerAccountId: identity.sub, type: 'oidc' };
  const profile = { sub: identity.sub, email: identity.email, email_verified: true };
  assert.equal(await signIn({ account, profile }), true);
  assert.equal(await signIn({ account, profile: { ...profile, email_verified: false } }), false);
  assert.equal(await signIn({ account, profile: { ...profile, email_verified: 'true' } }), false);
  assert.equal(await signIn({ account: { ...account, provider: 'github' }, profile }), false);
  assert.equal(await signIn({ account, profile: { ...profile, sub: '' } }), false);
  const token = await jwt({ token: { sub: 'generated-random-id' }, account, profile });
  assert.equal(token.sub, identity.sub);
  assert.equal(token.provider, 'google');
  assert.equal(token.emailVerified, true);
  const updated = await jwt({ token, trigger: 'update', session: { user: { id: 'attacker' } } });
  assert.equal(updated.sub, identity.sub);
});

test('getSession authenticates encrypted chunked cookies and returns the Google subject', async () => {
  const fullCookie = await sessionCookie();
  const value = fullCookie.slice(fullCookie.indexOf('=') + 1);
  const split = Math.floor(value.length / 2);
  const cookie = `__Secure-authjs.session-token.1=${value.slice(split)}; __Secure-authjs.session-token.0=${value.slice(0, split)}`;
  const session = await getSession(new Request(`${ORIGIN}/api/data/teams`, { headers: { cookie } }), env);
  assert.equal(session.user.id, identity.sub);
  assert.equal(session.user.email, identity.email);
  assert.equal(session.user.name, identity.name);
  assert.equal(session.user.access_token, undefined);
});

test('getSession rejects tampered, expired, unverified and foreign-provider sessions', async () => {
  const cookies = [
    '__Secure-authjs.session-token=invalid',
    await sessionCookie(identity, { maxAge: -120 }),
    await sessionCookie({ ...identity, emailVerified: false }),
    await sessionCookie({ ...identity, provider: 'github' }),
    await sessionCookie({ ...identity, sub: '' }),
  ];
  for (const cookie of cookies) {
    assert.equal(await getSession(new Request(`${ORIGIN}/api/data/teams`, { headers: { cookie } }), env), null);
  }
});

test('getSession rejects bearer-only sessions and cross-origin reads with valid cookies', async () => {
  const cookie = await sessionCookie();
  const bearer = cookie.slice(cookie.indexOf('=') + 1);
  assert.equal(await getSession(new Request(`${ORIGIN}/api/data/teams`, { headers: { authorization: `Bearer ${bearer}` } }), env), null);
  assert.equal(await getSession(new Request(`${ORIGIN}/api/data/teams`, { headers: { cookie, origin: 'https://attacker.invalid' } }), env), null);
});

test('standard session endpoint is private and exposes the stable id', async () => {
  const response = await handleAuth(new Request(`${ORIGIN}/api/auth/session`, { headers: { cookie: await sessionCookie() } }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await response.json()).user.id, identity.sub);
});

test('standard signout consumes CSRF and expires the session cookie', async () => {
  const csrf = await handleAuth(new Request(`${ORIGIN}/api/auth/csrf`), env);
  const { csrfToken } = await csrf.json();
  const response = await handleAuth(new Request(`${ORIGIN}/api/auth/signout`, {
    method: 'POST',
    headers: { origin: ORIGIN, cookie: `${cookieHeader(csrf)}; ${await sessionCookie()}`, 'X-Auth-Return-Redirect': '1', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, callbackUrl: '/' }),
  }), env);
  assert.equal((await response.json()).url, `${ORIGIN}/`);
  assert.ok(response.headers.getSetCookie().some((cookie) => cookie.startsWith('__Secure-authjs.session-token=;') && /Max-Age=0/i.test(cookie)));
});

test('missing configuration fails closed without returning secrets', async () => {
  assert.throws(() => createAuthConfig({ ...env, AUTH_ORIGIN: 'http://volleyboard.sincronia.agency' }));
  const response = await handleAuth(new Request(`${ORIGIN}/api/auth/csrf`), { ...env, AUTH_GOOGLE_SECRET: '' });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /test-only|test-client/);
});
