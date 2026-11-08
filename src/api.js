const NCB_CONFIG = {
  conversationId: 'chat-5c0100fd-6a31-4032-b9f8-e4a5dbdad18a',
  proxyBase: 'https://rmvzorxcl35mttidiexhtp5g2m0hpsqo.lambda-url.us-east-2.on.aws',
  instance: '48534_pizarra_voley_eu'
};

function buildProxyUrl(path) {
  const url = new URL(path, NCB_CONFIG.proxyBase);
  url.searchParams.set('Instance', NCB_CONFIG.instance);
  url.searchParams.set('db', NCB_CONFIG.instance);
  return url.toString();
}

const SESSION_TOKEN_KEY = 'ncb_session_token';

function readSessionToken() {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function storeSessionToken(token) {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    /* private mode */
  }
}

export function clearSessionToken() {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* private mode */
  }
}

// Al volver de Google, el proxy puede devolver el token en la URL.
// Lo guardamos y limpiamos la dirección para no dejarlo a la vista.
export function captureOAuthReturn() {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    const returned = url.searchParams.get('ncb_login');
    if (token) storeSessionToken(token);
    if (token || returned) {
      ['token', 'ncb_login', 'user_id'].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
    return Boolean(returned || token);
  } catch {
    return false;
  }
}

// Inicia Google con el endpoint POST del proxy y navega a la URL OAuth devuelta.
export async function startGoogleSignIn() {
  try {
    const callback = new URL(window.location.href);
    callback.searchParams.set('ncb_login', '1');
    callback.searchParams.set('db', NCB_CONFIG.instance);
    callback.searchParams.set('Instance', NCB_CONFIG.instance);

    const response = await authFetch('sign-in/social', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'google',
        callbackURL: callback.toString()
      })
    });

    if (response?.status !== 'success') {
      return response?.error || 'No se pudo iniciar la autenticación con Google';
    }

    const redirectUrl = response?.data?.url ?? response?.data?.redirect;
    if (typeof redirectUrl !== 'string' || !redirectUrl) {
      return 'El proxy no devolvió la dirección de autenticación de Google';
    }

    window.location.assign(redirectUrl);
    return null;
  } catch {
    return 'No se pudo iniciar la autenticación con Google';
  }
}

async function ncbRequest(url, options = {}) {
  try {
    const token = readSessionToken();
    const res = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Database-Instance': NCB_CONFIG.instance,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      },
      ...options
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body?.token) storeSessionToken(body.token);
    if (!res.ok) {
      return {
        status: 'error',
        data: null,
        error: body?.message || body?.error || `HTTP ${res.status}`,
        httpStatus: res.status
      };
    }
    if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.status === 'string' && 'data' in body) {
      return body;
    }
    return { status: 'success', data: body };
  } catch (err) {
    return { status: 'error', data: null, error: err?.message || 'Network error' };
  }
}

export async function authFetch(path, options = {}) {
  return ncbRequest(buildProxyUrl(`/auth/${path}`), options);
}

export async function dataFetch(path, options = {}) {
  return ncbRequest(buildProxyUrl(`/data/${path}`), options);
}

export async function publicDataFetch(path, options = {}) {
  return ncbRequest(buildProxyUrl(`/public-data/${path}`), options);
}
