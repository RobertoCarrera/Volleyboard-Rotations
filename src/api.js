export const AUTH_STATE_EVENT = 'volley:auth-state';

const AUTH_ERRORS = {
  AccessDenied: 'No se ha autorizado el acceso con Google. Puedes volver a intentarlo.',
  OAuthSignin: 'No se pudo abrir el acceso con Google. Vuelve a intentarlo.',
  OAuthSignInError: 'No se pudo abrir el acceso con Google. Vuelve a intentarlo.',
  OAuthCallback: 'No se pudo completar la sesión con Google. Vuelve a iniciar sesión.',
  OAuthCallbackError: 'No se pudo completar la sesión con Google. Vuelve a iniciar sesión.',
  CallbackRouteError: 'No se pudo completar la sesión con Google. Vuelve a iniciar sesión.',
  OAuthAccountNotLinked: 'Este correo ya utiliza otro método de acceso. Inicia sesión con el método original.',
  Configuration: 'El acceso con Google no está disponible en este momento. Vuelve a intentarlo más tarde.',
  MissingCSRF: 'La solicitud de acceso ha caducado. Recarga la página y vuelve a intentarlo.',
  InvalidCheck: 'La solicitud de acceso ha caducado. Vuelve a iniciar sesión con Google.',
  Verification: 'La solicitud de acceso ha caducado. Vuelve a iniciar sesión con Google.',
  SessionRequired: 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
};

function authError(code) {
  return Object.hasOwn(AUTH_ERRORS, code) ? AUTH_ERRORS[code]
    : 'No se pudo iniciar sesión con Google. Vuelve a intentarlo.';
}

function failure(error, httpStatus) {
  return { status: 'error', data: null, error, ...(httpStatus ? { httpStatus } : {}) };
}

function responseError(body, status) {
  if (status === 401) return AUTH_ERRORS.SessionRequired;
  const code = typeof body?.error === 'string' ? body.error : '';
  if (Object.hasOwn(AUTH_ERRORS, code)) return authError(code);
  if (status >= 500) return 'El servicio no está disponible. Vuelve a intentarlo en unos instantes.';
  if (status === 403) return 'No se pudo verificar la solicitud. Recarga la página y vuelve a intentarlo.';
  return typeof body?.message === 'string' ? body.message
    : code || 'No se pudo completar la solicitud. Vuelve a intentarlo.';
}

async function requestJson(path, options = {}) {
  try {
    const response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...options.headers }
    });
    let body;
    try {
      body = await response.json();
    } catch {
      return failure('El servidor devolvió una respuesta no válida. Vuelve a intentarlo.', response.status);
    }
    if (!response.ok || body?.status === 'error' || body?.error) {
      return failure(responseError(body, response.status), response.status);
    }
    if (body?.status === 'success' && Object.hasOwn(body, 'data')) return body;
    return { status: 'success', data: body };
  } catch (error) {
    if (error?.name === 'AbortError') return { ...failure(''), aborted: true };
    return failure('No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.');
  }
}

// Auth.js keeps credentials in same-origin HttpOnly cookies. Old URL tokens
// are removed during migration, but are never accepted as authentication.
export function captureOAuthReturn() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('error');
  let changed = false;
  for (const name of ['error', 'code', 'token', 'ncb_login', 'user_id', 'db', 'Instance']) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name);
      changed = true;
    }
  }
  if (changed) window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  return code ? authError(code) : '';
}

async function postAuthAction(action, options = {}) {
  const csrf = await requestJson('/api/auth/csrf', { signal: options.signal });
  if (csrf.status !== 'success') return csrf;
  if (typeof csrf.data?.csrfToken !== 'string' || !csrf.data.csrfToken) {
    return failure('No se pudo preparar el acceso seguro. Recarga la página y vuelve a intentarlo.');
  }
  const callbackUrl = window.location.origin + window.location.pathname;
  const response = await requestJson(`/api/auth/${action}`, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1'
    },
    body: new URLSearchParams({ csrfToken: csrf.data.csrfToken, callbackUrl })
  });
  if (response.status !== 'success') return response;
  try {
    if (typeof response.data?.url !== 'string' || !response.data.url) throw new Error('Missing redirect');
    const target = new URL(response.data.url, window.location.origin);
    if (!['https:', 'http:'].includes(target.protocol)) throw new Error('Invalid redirect');
    const error = target.searchParams.get('error');
    if (error) return failure(authError(error));
    if (action === 'signout' && target.origin !== window.location.origin) throw new Error('Invalid sign-out redirect');
    return { status: 'success', data: { url: target.href } };
  } catch {
    return failure('No se pudo completar el acceso seguro. Recarga la página y vuelve a intentarlo.');
  }
}

export async function authFetch(path, options = {}) {
  if (path === 'sign-out') return postAuthAction('signout', options);
  if (path !== 'get-session') return failure('La operación de acceso no está disponible.');
  const response = await requestJson('/api/auth/session', { method: 'GET', signal: options.signal });
  if (response.status !== 'success') return response;
  const session = response.data;
  if (session === null || (session && typeof session === 'object' && Object.keys(session).length === 0)) {
    return { status: 'success', data: null };
  }
  if (!session?.user?.id || typeof session.expires !== 'string') {
    return failure('No se pudo comprobar la sesión. Recarga la página y vuelve a intentarlo.');
  }
  return response;
}

export async function startGoogleSignIn() {
  const response = await postAuthAction('signin/google');
  if (response.status !== 'success') return response.error;
  window.location.assign(response.data.url);
  return null;
}

export async function endSession() {
  window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT, { detail: 'signing-out' }));
  const response = await authFetch('sign-out');
  if (response.status !== 'success') {
    window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT, { detail: 'signout-failed' }));
    return response.error;
  }
  window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT, { detail: 'signed-out' }));
  window.location.assign(response.data.url);
  return null;
}

function validId(value) {
  return (typeof value === 'string' && value.length > 0) || (typeof value === 'number' && Number.isFinite(value));
}

const positiveId = (value) => Number.isSafeInteger(value) && value > 0;
const playerSlots = new Set(['COL', 'O', 'R1', 'R2', 'C1', 'C2', 'L1', 'L2']);
const ratingPositions = ['COL', 'O', 'R', 'C', 'L'];

function routeId(value) {
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) return null;
  if (!['number', 'string'].includes(typeof value)) return null;
  return positiveId(Number(value)) ? String(Number(value)) : null;
}

function boardPath(teamId) {
  if (teamId === undefined || teamId === null) return '/api/whiteboard';
  const id = routeId(teamId);
  return id ? `/api/teams/${id}/whiteboard` : null;
}

function validTeam(team) {
  return team && positiveId(team.id) && typeof team.name === 'string'
    && team.name.trim().length > 0 && team.name.length <= 100 && typeof team.deleted === 'boolean';
}

function validPlayer(player, teamId) {
  return player && positiveId(player.id) && player.teamId === Number(teamId)
    && typeof player.name === 'string' && player.name.trim().length > 0 && player.name.length <= 100
    && typeof player.number === 'string' && player.number.length <= 20
    && typeof player.deleted === 'boolean' && player.ratings && ratingPositions.every((position) => (
      player.ratings[position] === null
      || (Number.isInteger(player.ratings[position]) && player.ratings[position] >= 0 && player.ratings[position] <= 5)
    ));
}

async function teamRequest(path, method, data, options = {}, validate) {
  if (!path) return failure('El identificador no es válido.');
  const response = await requestJson(path, {
    method, signal: options.signal,
    ...(data !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {})
  });
  if (response.status === 'success' && validate && !validate(response.data)) {
    return failure(method === 'GET'
      ? 'Los datos del equipo no se pueden leer. No se han sobrescrito tus datos.'
      : 'El servidor aún no ha confirmado el cambio. Vuelve a cargar los datos antes de repetirlo.');
  }
  return response;
}

function teamPath(teamId, tail = '') {
  const id = routeId(teamId);
  return id ? `/api/teams/${id}${tail}` : null;
}

function playerPath(teamId, playerId) {
  const id = routeId(playerId);
  return id ? teamPath(teamId, `/players/${id}`) : null;
}

function matchesChanges(record, changes) {
  for (const key of ['name', 'number', 'deleted']) {
    if (Object.hasOwn(changes, key)) {
      const expected = typeof changes[key] === 'string' ? changes[key].trim() : changes[key];
      if (record[key] !== expected) return false;
    }
  }
  if (Object.hasOwn(changes, 'ratings')) {
    if (!changes.ratings || typeof changes.ratings !== 'object' || Array.isArray(changes.ratings)) return false;
    if (!Object.entries(changes.ratings).every(([key, value]) => record.ratings?.[key] === value)) return false;
  }
  return true;
}

export const listTeams = (options = {}) => teamRequest('/api/teams', 'GET', undefined, options,
  (teams) => Array.isArray(teams) && teams.every(validTeam)
    && new Set(teams.map((team) => team.id)).size === teams.length);
export const createTeam = (data, options = {}) => teamRequest('/api/teams', 'POST', data, options,
  (team) => validTeam(team) && matchesChanges(team, data));
export const getTeam = (id, options = {}) => teamRequest(teamPath(id), 'GET', undefined, options,
  (team) => validTeam(team) && team.id === Number(id) && Array.isArray(team.players)
    && team.players.every((player) => validPlayer(player, id))
    && new Set(team.players.map((player) => player.id)).size === team.players.length);
export const updateTeam = (id, data, options = {}) => teamRequest(teamPath(id), 'PATCH', data, options,
  (team) => validTeam(team) && team.id === Number(id) && matchesChanges(team, data));
export const deleteTeam = (id, options = {}) => teamRequest(teamPath(id), 'DELETE', undefined, options,
  (team) => validTeam(team) && team.id === Number(id) && team.deleted);
export const createPlayer = (teamId, data, options = {}) => teamRequest(teamPath(teamId, '/players'), 'POST', data, options,
  (player) => validPlayer(player, teamId) && matchesChanges(player, data));
export const updatePlayer = (teamId, id, data, options = {}) => teamRequest(playerPath(teamId, id), 'PATCH', data, options,
  (player) => validPlayer(player, teamId) && player.id === Number(id) && matchesChanges(player, data));
export const deletePlayer = (teamId, id, options = {}) => teamRequest(playerPath(teamId, id), 'DELETE', undefined, options,
  (player) => validPlayer(player, teamId) && player.id === Number(id) && player.deleted);

export async function loadWhiteboard(options = {}) {
  const path = boardPath(options.teamId);
  if (!path) return failure('El identificador del equipo no es válido.');
  const isTeam = options.teamId !== undefined && options.teamId !== null;
  const response = await requestJson(path, { method: 'GET', signal: options.signal });
  if (response.status !== 'success' || response.data === null) return response;
  try {
    const state = typeof response.data?.state === 'string' ? JSON.parse(response.data.state) : response.data?.state;
    if (!Array.isArray(state?.sets) || !state.sets.length || state.sets.length > 5 || !state.sets.every((set) => (
      set && validId(set.id) && typeof set.name === 'string'
      && /^R[1-6]$/.test(set.rotation) && ['receiving', 'serving'].includes(set.phase)
      && Array.isArray(set.roster) && set.roster.every((player) => (
        player && validId(player.id) && (isTeam || typeof player.name === 'string')
        && (player.slot == null || typeof player.slot === 'string')
      ))
    ))) throw new Error('Invalid whiteboard');
    if (isTeam && (new Set(state.sets.map((set) => set.id)).size !== state.sets.length
      || !state.sets.every((set) => positiveId(set.id) && set.name.length <= 100 && set.roster.length <= 8
        && new Set(set.roster.map((player) => player.id)).size === set.roster.length
        && new Set(set.roster.filter((player) => player.slot !== null).map((player) => player.slot)).size
          === set.roster.filter((player) => player.slot !== null).length
        && set.roster.every((player) => positiveId(player.id) && (player.slot === null || playerSlots.has(player.slot)))))) {
      throw new Error('Invalid team board');
    }
    const activeId = state.sets.some((set) => set.id === state.activeId) ? state.activeId : state.sets[0].id;
    return { status: 'success', data: { sets: state.sets, activeId } };
  } catch {
    return failure('La pizarra guardada no se puede leer. No se han sobrescrito tus datos.');
  }
}

export async function saveWhiteboard({ sets, activeId }, options = {}) {
  const path = boardPath(options.teamId);
  if (!path) return failure('El identificador del equipo no es válido.');
  const storedSets = options.teamId === undefined || options.teamId === null ? sets : sets.map((set) => ({
    id: set.id, name: set.name, rotation: set.rotation, phase: set.phase,
    roster: set.roster.map((player) => ({ id: player.id, slot: player.slot }))
  }));
  return requestJson(path, {
    method: 'PUT',
    signal: options.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Pizarra', state: JSON.stringify({ sets: storedSets, activeId }) })
  });
}
