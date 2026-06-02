// shared/modio-auth.js — mod.io email-OTP sign-in state machine.

import { ModioError, emailRequest, emailExchange, getMe } from './modio.js';

const TOKEN_KEY    = 'tsic.modio.token';
const EXPIRES_KEY  = 'tsic.modio.tokenExpires';
const PROFILE_KEY  = 'tsic.modio.profile';

export function loadToken() {
  const t = localStorage.getItem(TOKEN_KEY);
  const exp = Number(localStorage.getItem(EXPIRES_KEY) || '0');
  if (!t) return null;
  if (exp && Date.now() / 1000 > exp) {
    clearToken();
    return null;
  }
  return t;
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem(PROFILE_KEY);
}
export function loadProfile() {
  const s = localStorage.getItem(PROFILE_KEY);
  try { return s ? JSON.parse(s) : null; } catch (_) { return null; }
}

export function createAuth(client) {
  let state = loadToken() ? 'signed-in' : 'idle';
  const listeners = new Set();
  function emit() { for (const cb of listeners) cb(state); }

  return {
    get state() { return state; },
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },

    async requestCode(email) {
      state = 'requesting'; emit();
      try {
        await emailRequest(client, email);
        state = 'awaiting-code'; emit();
      } catch (e) {
        state = 'idle'; emit();
        throw e;
      }
    },
    async exchangeCode(code, dateExpires) {
      state = 'exchanging'; emit();
      try {
        const r = await emailExchange(client, code, dateExpires);
        localStorage.setItem(TOKEN_KEY, r.access_token);
        if (r.date_expires) localStorage.setItem(EXPIRES_KEY, String(r.date_expires));
        const me = await getMe(client);
        localStorage.setItem(PROFILE_KEY, JSON.stringify({
          id: me.id, username: me.username, avatar: me.avatar
        }));
        state = 'signed-in'; emit();
      } catch (e) {
        // emailExchange may have succeeded and persisted a token before getMe failed. Roll the
        // half-written credentials back, otherwise a valid token is left in storage while the UI
        // reports the user as signed-out — an authenticated-but-signed-out client that can still
        // subscribe, and that reloads as signed-in with no profile.
        clearToken();
        state = 'idle'; emit();
        throw e;
      }
    },
    signOut() {
      clearToken();
      state = 'idle';
      emit();
    },
  };
}
