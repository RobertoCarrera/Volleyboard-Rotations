import process from 'node:process';
import { Auth } from '@auth/core';
import Google from '@auth/core/providers/google';

const BASE_PATH = '/api/auth';

function canonicalOrigin(env) {
  const value = env.AUTH_ORIGIN;
  if (typeof value !== 'string' || !value.trim()) throw new Error('AUTH_ORIGIN is required');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('AUTH_ORIGIN must be an HTTPS origin');
  }
  return url.origin;
}

function verifiedProfile(account, profile) {
  return account?.provider === 'google'
    && profile?.email_verified === true
    && typeof profile.sub === 'string' && profile.sub.length > 0
    && account.providerAccountId === profile.sub
    && typeof profile.email === 'string' && profile.email.length > 0;
}

function verifiedToken(token) {
  return token?.provider === 'google' && token.emailVerified === true
    && typeof token.sub === 'string' && token.sub.length > 0
    && typeof token.email === 'string' && token.email.length > 0;
}

function allowedRequest(request, origin) {
  const url = new URL(request.url);
  if (url.origin !== origin) return false;
  const host = request.headers.get('host');
  if (host && host !== url.host && host !== `${url.hostname}:443`) return false;
  const source = request.headers.get('origin');
  if (source !== null && source !== origin) return false;
  if (!['GET', 'HEAD'].includes(request.method) && source !== origin) return false;
  const isOAuthCallback = request.method === 'GET' && url.pathname === `${BASE_PATH}/callback/google`;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite) && !isOAuthCallback) return false;
  return true;
}

function noStore(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Netlify-CDN-Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('Vary', 'Cookie, Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Auth.js owns OAuth, CSRF, encrypted sessions and cookie chunking. */
export function createAuthConfig(env = process.env) {
  const origin = canonicalOrigin(env);
  if (typeof env.AUTH_SECRET !== 'string' || env.AUTH_SECRET.length < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 characters');
  }
  if (!env.AUTH_GOOGLE_ID || !env.AUTH_GOOGLE_SECRET) {
    throw new Error('Google authentication is not configured');
  }
  return {
    basePath: BASE_PATH,
    secret: env.AUTH_SECRET,
    trustHost: true, // Requests are checked against AUTH_ORIGIN before calling Auth.
    useSecureCookies: true,
    debug: false,
    session: { strategy: 'jwt' },
    providers: [Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: {
        url: 'https://accounts.google.com/o/oauth2/v2/auth',
        params: { scope: 'openid email profile' },
      },
      checks: ['pkce', 'state', 'nonce'],
    })],
    pages: { signIn: '/', error: '/' },
    callbacks: {
      signIn({ account, profile }) {
        return verifiedProfile(account, profile);
      },
      jwt({ token, account, profile }) {
        if (account || profile) {
          if (!verifiedProfile(account, profile)) return null;
          return {
            ...token,
            sub: profile.sub,
            email: profile.email,
            provider: 'google',
            emailVerified: true,
          };
        }
        // Session-update bodies never replace signed identity claims.
        return verifiedToken(token) ? token : null;
      },
      session({ session, token }) {
        if (!verifiedToken(token)) return null;
        return {
          expires: session.expires,
          user: { id: token.sub, name: token.name, email: token.email, image: token.picture },
        };
      },
      redirect({ url }) {
        try {
          const target = new URL(url, `${origin}/`);
          if (target.origin === origin && !target.username && !target.password
            && target.pathname !== BASE_PATH && !target.pathname.startsWith(`${BASE_PATH}/`)) {
            return target.href;
          }
        } catch { /* Invalid destinations return to the public sign-in page. */ }
        return `${origin}/`;
      },
    },
    // Auth.js error causes can include provider responses. Log only the category.
    logger: {
      error(error) {
        const type = /^[A-Za-z][A-Za-z0-9]*$/.test(error?.type ?? '') ? error.type : 'AuthenticationError';
        globalThis.console.error('[auth]', type);
      },
      warn() {},
      debug() {},
    },
  };
}

export async function handleAuth(request, env = process.env) {
  let config;
  let origin;
  try {
    origin = canonicalOrigin(env);
    config = createAuthConfig(env);
  } catch {
    return noStore(Response.json({ error: 'Authentication is not configured.' }, { status: 503 }));
  }
  if (!allowedRequest(request, origin)) {
    return noStore(Response.json({ error: 'Forbidden' }, { status: 403 }));
  }
  return noStore(await Auth(request, config));
}

/** Read a browser cookie session for a server-side data route; bearer tokens are ignored. */
export async function getSession(request, env = process.env) {
  let config;
  let origin;
  try {
    origin = canonicalOrigin(env);
    config = createAuthConfig(env);
  } catch {
    return null;
  }
  if (!allowedRequest(request, origin)) return null;
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const response = await Auth(new Request(`${origin}${BASE_PATH}/session`, {
    headers: { cookie },
  }), config);
  if (!response.ok) return null;
  const session = await response.json();
  return session?.user?.id ? session : null;
}
