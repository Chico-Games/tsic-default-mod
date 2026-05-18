// shared/modio.js — mod.io REST client (ported from tsic-definition-editor).
// Consumer-only: keeps emailRequest/emailExchange/getMe/listMods/getMod/
// getGameTags/listModfiles/listSubscribed/subscribe/unsubscribe.
// Drops authoring endpoints (addMod, editMod, addModfile, dependencies, events).

export class ModioError extends Error {
  constructor(status, ref, message, errors, requestId) {
    super(message);
    this.status = status;
    this.ref = ref;
    this.errors = errors;
    this.requestId = requestId;
  }
}

export function makeBaseUrl(gameId, env) {
  return env === 'test'
    ? `https://g-${gameId}.test.mod.io/v1`
    : `https://g-${gameId}.modapi.io/v1`;
}

export function createClient(cfg, getToken, opts = {}) {
  const platform = opts.platform || 'windows';
  const portal   = opts.portal   || 'itchio';
  const fetcher  = opts.fetcher  || ((req) => fetch(req));

  function buildUrl(path, query, useApiKey) {
    const url = new URL(cfg.baseUrl + path);
    if (query) {
      for (const k of Object.keys(query)) {
        const v = query[k];
        if (v == null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    if (useApiKey) url.searchParams.set('api_key', cfg.apiKey);
    return url.toString();
  }
  function authHeaders(useToken) {
    const h = {
      'Accept': 'application/json',
      'X-Modio-Platform': platform,
      'X-Modio-Portal': portal,
    };
    if (useToken) {
      const t = getToken();
      if (t) h['Authorization'] = `Bearer ${t}`;
    }
    return h;
  }
  async function send(req) {
    let attempts = 0;
    while (true) {
      attempts++;
      const resp = await fetcher(req);
      if (resp.status === 429 && attempts === 1) {
        const ra = Number(resp.headers.get('retry-after') || '0');
        const ms = Math.max(0, Math.min(60, ra)) * 1000;
        await new Promise((r) => setTimeout(r, ms));
        continue;
      }
      if (resp.ok) {
        if (resp.status === 204) return undefined;
        const ct = resp.headers.get('content-type') || '';
        return ct.includes('application/json') ? resp.json() : resp.text();
      }
      let envelope = null;
      try { envelope = await resp.json(); } catch (_) {}
      const ref = (envelope && envelope.error && envelope.error.error_ref)
        || Number(resp.headers.get('x-modio-error-ref')) || undefined;
      const reqId = resp.headers.get('x-modio-request-id') || undefined;
      const message = (envelope && envelope.error && envelope.error.message)
        || `HTTP ${resp.status}`;
      throw new ModioError(resp.status, ref, message,
        envelope && envelope.error && envelope.error.errors, reqId);
    }
  }
  function encodeForm(body) {
    const params = new URLSearchParams();
    const entries = Array.isArray(body) ? body : Object.entries(body);
    for (const [k, v] of entries) params.append(k, String(v));
    return params.toString();
  }

  return {
    cfg,
    async get(path, { auth = true, query, signal } = {}) {
      const useToken = auth !== false;
      const token = getToken();
      const useApiKey = !useToken || !token;
      const req = new Request(buildUrl(path, query, useApiKey),
        { method: 'GET', headers: authHeaders(useToken && !!token), signal });
      return send(req);
    },
    async post(path, body, { auth = true, signal } = {}) {
      const useToken = auth !== false;
      const token = getToken();
      if (useToken && !token) throw new ModioError(0, 11005, 'Not signed in to mod.io.');
      const useApiKey = !useToken;
      const req = new Request(buildUrl(path, undefined, useApiKey), {
        method: 'POST',
        headers: { ...authHeaders(useToken),
                   'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodeForm(body),
        signal,
      });
      return send(req);
    },
    async delete(path, { signal } = {}) {
      const token = getToken();
      if (!token) throw new ModioError(0, 11005, 'Not signed in to mod.io.');
      const req = new Request(buildUrl(path), {
        method: 'DELETE',
        headers: { ...authHeaders(true),
                   'Content-Type': 'application/x-www-form-urlencoded' },
        body: '',
        signal,
      });
      return send(req);
    },
  };
}

// --- Endpoints ----------------------------------------------------------

export function emailRequest(c, email) {
  return c.post('/oauth/emailrequest',
    { api_key: c.cfg.apiKey, email }, { auth: false });
}

export function emailExchange(c, code, dateExpires) {
  const body = { api_key: c.cfg.apiKey, security_code: code };
  if (dateExpires) body.date_expires = dateExpires;
  return c.post('/oauth/emailexchange', body, { auth: false });
}

export function logout(c) { return c.post('/oauth/logout', {}); }

export function getMe(c, signal) { return c.get('/me', { signal }); }

export function getGameTags(c, signal) {
  return c.get(`/games/${c.cfg.gameId}/tags`, { auth: false, signal });
}

export function listMods(c, args = {}, signal) {
  return c.get(`/games/${c.cfg.gameId}/mods`, {
    signal,
    query: {
      _q: args.q,
      _limit: args.limit != null ? args.limit : 24,
      _offset: args.offset != null ? args.offset : 0,
      _sort: args.sort,
      tags: args.tags,
      'tags-in': args.tagsIn,
      submitted_by: args.submittedById,
      name_id: args.nameId,
    },
  });
}

export function getMod(c, modId, signal) {
  return c.get(`/games/${c.cfg.gameId}/mods/${modId}`, { signal });
}

export function listModfiles(c, modId, args = {}, signal) {
  return c.get(`/games/${c.cfg.gameId}/mods/${modId}/files`, {
    signal,
    query: {
      _limit: args.limit != null ? args.limit : 1,
      _offset: args.offset != null ? args.offset : 0,
      _sort: args.sort || '-date_added',
    },
  });
}

export function listSubscribed(c, args = {}, signal) {
  return c.get('/me/subscribed', {
    signal,
    query: { game_id: c.cfg.gameId,
             _limit: args.limit != null ? args.limit : 100,
             _offset: args.offset != null ? args.offset : 0 },
  });
}

export function subscribe(c, modId) {
  return c.post(`/games/${c.cfg.gameId}/mods/${modId}/subscribe`, {});
}
export function unsubscribe(c, modId) {
  return c.delete(`/games/${c.cfg.gameId}/mods/${modId}/subscribe`);
}
