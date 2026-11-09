import { createHash } from 'node:crypto';

const MAX_BODY_BYTES = 65536;
const rotations = new Set(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
const slots = new Set(['COL', 'O', 'R1', 'R2', 'C1', 'C2', 'L1', 'L2']);
const headers = { 'cache-control': 'private, no-store, max-age=0', 'cdn-cache-control': 'no-store', 'netlify-cdn-cache-control': 'no-store', vary: 'Cookie, Origin', 'x-content-type-options': 'nosniff' };
const reply = (data, status = 200) => Response.json(data, { status, headers });
const fail = (message, status) => reply({ status: 'error', error: message }, status);
const isId = (value) => Number.isSafeInteger(value) && value > 0;
const isText = (value, max) => typeof value === 'string' && value.length <= max;

function validBoard(state) {
  try {
    const saved = JSON.parse(state);
    if (!Array.isArray(saved?.sets) || saved.sets.length < 1 || saved.sets.length > 5) return false;
    if (!saved.sets.some((set) => set.id === saved.activeId)) return false;
    if (new Set(saved.sets.map((set) => set.id)).size !== saved.sets.length) return false;
    return saved.sets.every((set) => (
      isId(set.id) && isText(set.name, 100) && rotations.has(set.rotation)
      && ['receiving', 'serving'].includes(set.phase)
      && Array.isArray(set.roster) && set.roster.length <= 8
      && new Set(set.roster.map((player) => player.id)).size === set.roster.length
      && set.roster.every((player) => isId(player.id) && isText(player.name, 200)
        && isText(player.number, 20) && (player.slot === null || slots.has(player.slot)))
    ));
  } catch { return false; }
}

function publicRow(row) {
  return row ? { id: row.id, name: row.name, state: row.state } : null;
}

// Only this fixed table is exposed. Identity always comes from the verified session.
export function createWhiteboardHandler({ readSession, fetchImpl = fetch }) {
  return async (request, env) => {
    let origin;
    try {
      origin = new URL(env.AUTH_ORIGIN).origin;
      if (!origin.startsWith('https://') || !env.NCB_INSTANCE || !env.NCB_SECRET_KEY
        || env.NCB_DATA_API_URL !== 'https://eu-api.nocodebackend.com') throw new Error('Invalid config');
    } catch { return fail('El servicio de guardado no está configurado.', 503); }

    const url = new URL(request.url);
    if (url.origin !== origin) return fail('Origen no permitido.', 403);
    if (url.pathname !== '/api/whiteboard') return fail('Ruta no encontrada.', 404);
    if (!['GET', 'PUT'].includes(request.method)) {
      const response = fail('Método no permitido.', 405);
      response.headers.set('allow', 'GET, PUT');
      return response;
    }
    const source = request.headers.get('origin');
    if ((source && source !== origin) || (request.method === 'PUT' && source !== origin)
      || request.headers.get('sec-fetch-site') === 'cross-site') return fail('Origen no permitido.', 403);

    try {
      const session = await readSession(request, env);
      if (!session?.user?.id) return fail('Inicia sesión de nuevo para acceder a tu pizarra.', 401);
      const ownerKey = createHash('sha256').update(`google:${session.user.id}`).digest('hex');
      let payload;
      if (request.method === 'PUT') {
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail('Se requiere JSON.', 415);
        if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return fail('La pizarra supera el tamaño permitido.', 413);
        const body = await request.text();
        if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return fail('La pizarra supera el tamaño permitido.', 413);
        try { payload = JSON.parse(body); } catch { return fail('La pizarra no es válida.', 400); }
        if (!isText(payload?.state, MAX_BODY_BYTES) || !validBoard(payload.state)
          || (payload.name !== undefined && !isText(payload.name, 100))) return fail('La pizarra no es válida.', 400);
      }

      const upstream = async (path, { method = 'GET', body, filter = false } = {}) => {
        const endpoint = new URL(path, env.NCB_DATA_API_URL);
        endpoint.searchParams.set('Instance', env.NCB_INSTANCE);
        if (filter) { endpoint.searchParams.set('owner_key', ownerKey); endpoint.searchParams.set('limit', '2'); }
        const response = await fetchImpl(endpoint, {
          method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
          headers: { authorization: `Bearer ${env.NCB_SECRET_KEY}`, accept: 'application/json', 'cache-control': 'no-cache, no-store', pragma: 'no-cache', ...(body ? { 'content-type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {})
        });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') throw new Error('Storage request failed');
        return data;
      };
      const readOwned = async () => {
        const result = await upstream('/read/whiteboard_sets', { filter: true });
        if (!Array.isArray(result.data) || result.data.length > 1
          || result.data.some((row) => row.owner_key !== ownerKey || !isId(Number(row.id)))) throw new Error('Storage ownership check failed');
        return result.data[0] ?? null;
      };

      let row = await readOwned();
      if (request.method === 'GET') return reply({ status: 'success', data: publicRow(row) });
      const changes = { name: payload.name ?? 'Pizarra', state: payload.state };
      if (!row) {
        try {
          const created = await upstream('/create/whiteboard_sets', { method: 'POST', body: { ...changes, owner_key: ownerKey } });
          const id = Number(created.id ?? created.data?.id);
          if (!isId(id)) throw new Error('Invalid created record');
          return reply({ status: 'success', data: { id, ...changes } });
        } catch {
          // A unique owner_key prevents duplicate boards when two first saves race.
          row = await readOwned();
          if (!row) throw new Error('Storage create failed');
        }
      }
      await upstream(`/update/whiteboard_sets/${Number(row.id)}`, { method: 'PUT', body: changes });
      return reply({ status: 'success', data: { id: row.id, ...changes } });
    } catch {
      // Upstream diagnostics can contain credentials and must never reach the client.
      return fail('No se ha podido sincronizar la pizarra. Inténtalo de nuevo.', 502);
    }
  };
}
