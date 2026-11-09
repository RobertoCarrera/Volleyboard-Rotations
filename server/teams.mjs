import { createHash } from 'node:crypto';

const MAX_BODY_BYTES = 65536;
const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const MAX_TEAMS = 100;
const MAX_PLAYERS = 200;
const TEAM_TABLE = 'volley_teams';
const PLAYER_TABLE = 'volley_players';
const RATING_COLUMNS = { COL: 'rating_col', O: 'rating_o', R: 'rating_r', C: 'rating_c', L: 'rating_l' };
const SLOTS = new Set(['COL', 'O', 'R1', 'R2', 'C1', 'C2', 'L1', 'L2']);
const ROTATIONS = new Set(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
const HEADERS = {
  'cache-control': 'private, no-store, max-age=0',
  'cdn-cache-control': 'no-store',
  'netlify-cdn-cache-control': 'no-store',
  vary: 'Cookie, Origin',
  'x-content-type-options': 'nosniff'
};
const reply = (data, status = 200) => Response.json({ status: 'success', data }, { status, headers: HEADERS });
const failure = (error, status) => Response.json({ status: 'error', error }, { status, headers: HEADERS });
const isId = (value) => Number.isSafeInteger(value) && value > 0;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

class RequestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function canonicalOrigin(env) {
  const value = new URL(env.AUTH_ORIGIN);
  if (value.protocol !== 'https:' || value.username || value.password || value.pathname !== '/' || value.search || value.hash
    || !env.NCB_INSTANCE || !env.NCB_SECRET_KEY || env.NCB_DATA_API_URL !== 'https://eu-api.nocodebackend.com') {
    throw new Error('Invalid configuration');
  }
  return value.origin;
}

function routeFor(pathname) {
  if (pathname === '/api/teams') return { kind: 'teams', methods: ['GET', 'POST'] };
  const match = /^\/api\/teams\/([1-9]\d*)(?:\/(whiteboard|players)(?:\/([1-9]\d*))?)?$/.exec(pathname);
  if (!match || !isId(Number(match[1])) || (match[3] && !isId(Number(match[3]))) || (match[2] === 'whiteboard' && match[3])) return null;
  const kind = match[2] === 'whiteboard' ? 'board' : match[2] === 'players' ? (match[3] ? 'player' : 'players') : 'team';
  return {
    kind,
    teamId: Number(match[1]),
    playerId: match[3] ? Number(match[3]) : null,
    methods: { team: ['GET', 'PATCH', 'DELETE'], board: ['GET', 'PUT'], players: ['POST'], player: ['PATCH', 'DELETE'] }[kind]
  };
}

function textField(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new RequestError('Revisa los nombres y dorsales: no pueden estar vacíos ni superar el tamaño permitido.');
  return value.trim();
}

function teamChanges(payload, creating = false) {
  const changes = {};
  if (creating || Object.hasOwn(payload, 'name')) changes.name = textField(payload.name, 100, true);
  if (!creating && Object.hasOwn(payload, 'deleted')) {
    if (payload.deleted !== false) throw new RequestError('Usa la opción Eliminar para enviar el equipo a la papelera.');
    changes.deleted = 0;
  }
  if (!Object.keys(changes).length) throw new RequestError('No hay cambios válidos que guardar.');
  return changes;
}

function playerChanges(payload, creating = false) {
  const changes = {};
  if (creating || Object.hasOwn(payload, 'name')) changes.name = textField(payload.name, 100, true);
  if (creating || Object.hasOwn(payload, 'number')) changes.number = textField(payload.number ?? (creating ? '' : null), 20);
  if (creating) for (const column of Object.values(RATING_COLUMNS)) changes[column] = null;
  if (Object.hasOwn(payload, 'ratings')) {
    if (!isObject(payload.ratings)) throw new RequestError('Las puntuaciones deben ser números enteros entre 0 y 5, o quedar sin asignar.');
    for (const [position, score] of Object.entries(payload.ratings)) {
      if (!Object.hasOwn(RATING_COLUMNS, position) || (score !== null && (!Number.isInteger(score) || score < 0 || score > 5))) {
        throw new RequestError('Las puntuaciones deben ser números enteros entre 0 y 5, o quedar sin asignar.');
      }
      changes[RATING_COLUMNS[position]] = score;
    }
  }
  if (!creating && Object.hasOwn(payload, 'deleted')) {
    if (payload.deleted !== false) throw new RequestError('Usa la opción Eliminar para enviar el jugador a la papelera.');
    changes.deleted = 0;
  }
  if (!Object.keys(changes).length) throw new RequestError('No hay cambios válidos que guardar.');
  return changes;
}

function deletedFlag(value) {
  if ([0, '0', false].includes(value)) return false;
  if ([1, '1', true].includes(value)) return true;
  throw new Error('Invalid stored deletion flag');
}

function publicTeam(row) {
  if (typeof row.name !== 'string') throw new Error('Invalid stored team');
  return {
    id: Number(row.id), name: row.name, deleted: deletedFlag(row.deleted),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null
  };
}

function publicPlayer(row) {
  if (typeof row.name !== 'string' || typeof row.number !== 'string') throw new Error('Invalid stored player');
  const ratings = {};
  for (const [position, column] of Object.entries(RATING_COLUMNS)) {
    const raw = row[column];
    const score = raw === null ? null : Number(raw);
    if (raw === undefined || (score !== null && (!Number.isInteger(score) || score < 0 || score > 5))) throw new Error('Invalid stored rating');
    ratings[position] = score;
  }
  return { id: Number(row.id), teamId: Number(row.team_id), name: row.name, number: row.number, ratings, deleted: deletedFlag(row.deleted) };
}

function normalizeBoard(encoded, players) {
  let saved;
  try { saved = JSON.parse(encoded); } catch { throw new RequestError('La pizarra no es válida.'); }
  const invalid = () => { throw new RequestError('La pizarra no es válida. Revisa los jugadores y sus posiciones.'); };
  if (!isObject(saved) || !Array.isArray(saved.sets) || saved.sets.length < 1 || saved.sets.length > 5
    || !isId(saved.activeId) || !saved.sets.some((set) => set?.id === saved.activeId)) invalid();
  const playerIds = new Set(players.map((player) => Number(player.id)));
  const setIds = new Set();
  const sets = saved.sets.map((set) => {
    if (!isObject(set) || !isId(set.id) || setIds.has(set.id) || typeof set.name !== 'string' || set.name.length > 100
      || !set.name.trim() || !ROTATIONS.has(set.rotation) || !['receiving', 'serving'].includes(set.phase)
      || !Array.isArray(set.roster) || set.roster.length > 8) invalid();
    setIds.add(set.id);
    const rosterIds = new Set();
    const occupied = new Set();
    const roster = set.roster.map((entry) => {
      if (!isObject(entry) || !isId(entry.id) || !playerIds.has(entry.id) || rosterIds.has(entry.id)
        || (entry.slot !== null && !SLOTS.has(entry.slot)) || (entry.slot && occupied.has(entry.slot))) invalid();
      rosterIds.add(entry.id);
      if (entry.slot) occupied.add(entry.slot);
      // Own archived references remain recoverable. The client hides them from
      // the court until restored; no profile fields are stored in a lineup.
      return { id: entry.id, slot: entry.slot };
    });
    return { id: set.id, name: set.name, rotation: set.rotation, phase: set.phase, roster };
  });
  return JSON.stringify({ sets, activeId: saved.activeId });
}

async function readPayload(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new RequestError('Se requiere JSON.', 415);
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new RequestError('La solicitud supera el tamaño permitido.', 413);
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw new RequestError('La solicitud supera el tamaño permitido.', 413);
  let payload;
  try { payload = JSON.parse(body); } catch { throw new RequestError('La solicitud no contiene JSON válido.'); }
  if (!isObject(payload)) throw new RequestError('La solicitud no es válida.');
  return payload;
}

// The caller selects IDs, never owners or backend tables. Every row is checked
// again after the upstream filter so a storage-filter failure cannot leak data.
export function createTeamsHandler({ readSession, fetchImpl = fetch }) {
  return async (request, env) => {
    let origin;
    try { origin = canonicalOrigin(env); } catch { return failure('El servicio de equipos no está configurado.', 503); }
    const url = new URL(request.url);
    const host = request.headers.get('host');
    const source = request.headers.get('origin');
    const site = request.headers.get('sec-fetch-site');
    if (url.origin !== origin || (host && host !== url.host && host !== `${url.hostname}:443`)
      || (source !== null && source !== origin) || (!['GET', 'HEAD'].includes(request.method) && source !== origin)
      || (site && !['same-origin', 'none'].includes(site))) return failure('Origen no permitido.', 403);
    const route = routeFor(url.pathname);
    if (!route) return failure('Ruta no encontrada.', 404);
    if (!route.methods.includes(request.method)) {
      const response = failure('Método no permitido.', 405);
      response.headers.set('allow', route.methods.join(', '));
      return response;
    }
    try {
      const session = await readSession(request, env);
      if (!session?.user?.id) return failure('Inicia sesión de nuevo para acceder a tus equipos.', 401);
      const ownerKey = createHash('sha256').update(`google:${session.user.id}`).digest('hex');
      const payload = ['POST', 'PATCH', 'PUT'].includes(request.method) ? await readPayload(request) : null;
      const upstream = async (path, { method = 'GET', body, filters = {} } = {}) => {
        const endpoint = new URL(path, env.NCB_DATA_API_URL);
        endpoint.searchParams.set('Instance', env.NCB_INSTANCE);
        for (const [key, value] of Object.entries(filters)) endpoint.searchParams.set(key, String(value));
        const response = await fetchImpl(endpoint, {
          method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
          headers: {
            authorization: `Bearer ${env.NCB_SECRET_KEY}`, accept: 'application/json',
            'cache-control': 'no-cache, no-store', pragma: 'no-cache',
            ...(body ? { 'content-type': 'application/json' } : {})
          },
          ...(body ? { body: JSON.stringify(body) } : {})
        });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') throw new Error('Storage request failed');
        return data;
      };
      const validateRows = (rows, { id, teamId } = {}) => {
        if (!Array.isArray(rows) || rows.some((row) => !isObject(row) || row.owner_key !== ownerKey || !isId(Number(row.id))
          || (id !== undefined && Number(row.id) !== id) || (teamId !== undefined && Number(row.team_id) !== teamId))) {
          throw new Error('Storage ownership check failed');
        }
      };
      const readOne = async (table, id, teamId) => {
        const result = await upstream(`/read/${table}`, { filters: { owner_key: ownerKey, id, limit: 2, ...(teamId !== undefined ? { team_id: teamId } : {}) } });
        validateRows(result.data, { id, teamId });
        if (result.data.length > 1) throw new Error('Non-unique storage row');
        return result.data[0] ?? null;
      };
      const readAll = async (table, teamId) => {
        const rows = [];
        const seen = new Set();
        for (let page = 1; page <= MAX_PAGES; page++) {
          const result = await upstream(`/read/${table}`, { filters: { owner_key: ownerKey, ...(teamId !== undefined ? { team_id: teamId } : {}), page, limit: PAGE_SIZE, sort: 'id', order: 'asc' } });
          validateRows(result.data, { teamId });
          if (result.data.length > PAGE_SIZE) throw new Error('Invalid storage page');
          for (const row of result.data) {
            if (seen.has(Number(row.id))) throw new Error('Repeated storage page');
            seen.add(Number(row.id));
            rows.push(row);
          }
          if (result.data.length < PAGE_SIZE) return rows;
        }
        throw new Error('Storage list exceeds safe pagination range');
      };
      const update = async (table, row, changes) => {
        await upstream(`/update/${table}/${Number(row.id)}`, { method: 'PUT', body: changes });
        const updated = await readOne(table, Number(row.id), table === PLAYER_TABLE ? Number(row.team_id) : undefined);
        const confirmed = updated && Object.entries(changes).every(([key, expected]) => {
          const actual = updated[key];
          if (typeof expected === 'number') {
            return (typeof actual === 'number' || (typeof actual === 'string' && actual.trim() !== ''))
              && Number(actual) === expected;
          }
          return actual === expected;
        });
        // A provider may acknowledge a write before a later read reflects it.
        // Never report the old row as successfully saved, or coerce null to 0.
        if (!confirmed) throw new RequestError('No se ha podido confirmar el cambio. Recarga los datos antes de volver a intentarlo.', 409);
        return updated;
      };
      const create = async (table, changes, teamId) => {
        const result = await upstream(`/create/${table}`, { method: 'POST', body: { ...changes, owner_key: ownerKey, ...(teamId !== undefined ? { team_id: teamId } : {}) } });
        const id = Number(result.id ?? result.data?.id);
        if (!isId(id)) throw new Error('Invalid new record');
        const created = await readOne(table, id, teamId);
        if (!created) throw new Error('Created record missing');
        return created;
      };

      if (route.kind === 'teams') {
        const changes = request.method === 'POST' ? teamChanges(payload, true) : null;
        const teams = await readAll(TEAM_TABLE);
        if (request.method === 'GET') return reply(teams.map(publicTeam));
        if (teams.length >= MAX_TEAMS) throw new RequestError('Has alcanzado el límite de 100 equipos, incluidos los de la papelera.', 409);
        return reply(publicTeam(await create(TEAM_TABLE, changes)), 201);
      }

      const team = await readOne(TEAM_TABLE, route.teamId);
      if (!team) throw new RequestError('Equipo no encontrado.', 404);
      const archivedTeam = deletedFlag(team.deleted);
      if (route.kind === 'team') {
        if (request.method === 'DELETE') return reply(publicTeam(await update(TEAM_TABLE, team, { deleted: 1 })));
        if (request.method === 'PATCH') {
          if (archivedTeam && payload.deleted !== false) throw new RequestError('Equipo no encontrado.', 404);
          return reply(publicTeam(await update(TEAM_TABLE, team, teamChanges(payload))));
        }
        if (archivedTeam) throw new RequestError('Equipo no encontrado.', 404);
        return reply({ ...publicTeam(team), players: (await readAll(PLAYER_TABLE, route.teamId)).map(publicPlayer) });
      }
      if (archivedTeam) throw new RequestError('Equipo no encontrado.', 404);

      if (route.kind === 'players') {
        const changes = playerChanges(payload, true);
        const players = await readAll(PLAYER_TABLE, route.teamId);
        if (players.length >= MAX_PLAYERS) throw new RequestError('Has alcanzado el límite de 200 jugadores en este equipo, incluidos los de la papelera.', 409);
        return reply(publicPlayer(await create(PLAYER_TABLE, changes, route.teamId)), 201);
      }
      if (route.kind === 'player') {
        const player = await readOne(PLAYER_TABLE, route.playerId, route.teamId);
        if (!player) throw new RequestError('Jugador no encontrado.', 404);
        const archived = deletedFlag(player.deleted);
        if (request.method === 'DELETE') return reply(publicPlayer(await update(PLAYER_TABLE, player, { deleted: 1 })));
        if (archived && payload.deleted !== false) throw new RequestError('Jugador no encontrado.', 404);
        return reply(publicPlayer(await update(PLAYER_TABLE, player, playerChanges(payload))));
      }

      if (request.method === 'GET' && team.board_state === null) return reply(null);
      const encoded = request.method === 'GET' ? team.board_state : payload.state;
      if (typeof encoded !== 'string' || Buffer.byteLength(encoded, 'utf8') > MAX_BODY_BYTES) throw new RequestError('La pizarra no es válida.');
      const players = await readAll(PLAYER_TABLE, route.teamId);
      let state;
      try { state = normalizeBoard(encoded, players); } catch (error) {
        if (request.method === 'GET') throw new Error('Stored board is invalid');
        throw error;
      }
      if (request.method === 'PUT') await update(TEAM_TABLE, team, { board_state: state });
      return reply({ id: route.teamId, name: 'Pizarra', state });
    } catch (error) {
      if (error instanceof RequestError) return failure(error.message, error.status);
      // Provider errors can contain credentials or private rows; never echo them.
      return failure('No se han podido sincronizar los equipos. Inténtalo de nuevo.', 502);
    }
  };
}
