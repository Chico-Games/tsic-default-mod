// Mods screen — mod.io discovery rail + two-column mod library.
// Left column (Stockroom) = installed-but-inactive; right column (Shop Floor) =
// active mods in load order. Moving a mod between columns publishes
// UI.Cmd.Mod.SetEnabled; only the active column exposes load-order controls.
import { createClient, makeBaseUrl, listMods, getGameTags, subscribe,
         unsubscribe, logout } from '/shared/modio.js';
import { createAuth, loadToken, loadProfile } from '/shared/modio-auth.js';

let cfg = null;
let client = null;
let auth = null;
let activeTags = new Map();   // tagName -> groupName (preserves which group each chip belongs to)
let tagGroups = [];           // [{ name, tags:[...] }]
let offset = 0;
const PAGE = 24;
let searchTimer = null;
let searchAbort = null;       // AbortController for the in-flight listMods
let pendingSearch = false;    // true if a new search was requested while one was running
let installedMods = [];
let installedOrder = [];
let bootedBrowse = false;
let lastModItems = [];        // last rendered card payloads; used to repaint Subscribe state
let subscribedMap = new Map();
let dlProgress = new Map();   // NameId -> 0..1, or null while the size is unknown
let dlCreep = new Map();      // NameId -> { pct, timer } simulated fill while waiting
let dlStartedAt = new Map();  // NameId -> timestamp of the first visible progress
let finishingIds = new Set(); // NameIds playing the fill-to-100% completion beat
let checkingTimer = null;

// Tiny mods download in a single chunk — without a floor the bar blinks in
// and out before it reads as feedback. Completion fills the bar to 100%
// (FILL) and holds until at least MIN_FEEDBACK of total bar time has shown.
const DL_MIN_FEEDBACK_MS = 650;
const DL_FILL_MS = 420;

// Simulated fill while no sized progress has arrived: creeps asymptotically
// toward CREEP_CAP so the bar always visibly FILLS (a full-width
// indeterminate bar just reads as "already done"). Real progress overrides
// it forward, never backward; the completion beat finishes the last stretch.
const DL_CREEP_CAP = 0.85;
const DL_CREEP_TICK_MS = 120;
const DL_CREEP_RATE = 0.055;

const REDUCED_MOTION = window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function show(id) {
  for (const sel of ['signed-out', 'awaiting-code', 'signed-in', 'disabled']) {
    const el = document.getElementById('auth-' + sel);
    if (el) el.style.display = (sel === id) ? '' : 'none';
  }
}
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg || '';
  el.style.display = msg ? '' : 'none';
}
function showInstallError(msg) {
  const el = document.getElementById('install-error');
  el.textContent = msg || '';
  el.style.display = msg ? '' : 'none';
}
function safeHttpUrl(u) {
  if (!u) return '';
  try {
    const parsed = new URL(u);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      ? parsed.toString() : '';
  } catch (_) { return ''; }
}

// ---------------------------------------------------------------- auth ----

function bootAuth() {
  if (auth) return;
  auth = createAuth(client);
  auth.onChange((state) => {
    if (state === 'idle') show('signed-out');
    else if (state === 'awaiting-code') show('awaiting-code');
    else if (state === 'signed-in') {
      show('signed-in');
      const p = loadProfile();
      document.getElementById('username').textContent = (p && p.username) || 'mod.io user';
      refreshSubscribeButtons();
    }
  });
  if (loadToken()) {
    show('signed-in');
    const p = loadProfile();
    document.getElementById('username').textContent = (p && p.username) || 'mod.io user';
  } else {
    show('signed-out');
  }
  document.getElementById('btn-request').onclick = async () => {
    showAuthError('');
    try { await auth.requestCode(document.getElementById('email').value.trim()); }
    catch (e) { showAuthError(e.message); }
  };
  document.getElementById('btn-exchange').onclick = async () => {
    showAuthError('');
    try {
      await auth.exchangeCode(document.getElementById('code').value.trim().toUpperCase());
      const token = loadToken();
      const expires = localStorage.getItem('tsic.modio.tokenExpires');
      if (token) {
        tsic.publishMessage('UI.Cmd.Mod.SaveToken', {
          Token: token,
          ExpiresEpoch: Number(expires) || 0,
        });
      }
    } catch (e) { showAuthError(e.message); }
  };
  document.getElementById('btn-cancel-code').onclick = () => doSignOut();
  document.getElementById('btn-signout').onclick = () => doSignOut();
}

async function doSignOut() {
  if (!auth) return;
  try { if (client && loadToken()) await logout(client); } catch (_) {}
  auth.signOut();
  tsic.publishMessage('UI.Cmd.Mod.ClearToken', {});
  subscribedMap.clear();
  refreshSubscribeButtons();
}

// ------------------------------------------------------------ discovery ----

async function loadTags() {
  if (!client) return;
  try {
    const r = await getGameTags(client);
    tagGroups = (r.tag_options || []).map(g => ({
      name: String(g.name || ''),
      tags: (g.tags || []).map(String),
    }));
    renderTagChips();
  } catch (e) { console.warn('tags failed', e); }
}
function renderTagChips() {
  const host = document.getElementById('tag-chips');
  host.replaceChildren();
  for (const g of tagGroups) {
    if (!g.tags.length) continue;
    if (g.name) {
      const label = document.createElement('span');
      label.className = 'tag-group-label';
      label.textContent = g.name + ':';
      host.appendChild(label);
    }
    for (const t of g.tags) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tag-chip' + (activeTags.has(t) ? ' on' : '');
      b.textContent = t;
      b.onclick = () => {
        if (activeTags.has(t)) activeTags.delete(t);
        else activeTags.set(t, g.name);
        renderTagChips();
        searchSoon();
      };
      host.appendChild(b);
    }
  }
}
function buildTagsInQuery() {
  // mod.io accepts both bare 'tags-in' and group-scoped 'tags-in[Group]'.
  // We send the bare list (one CSV) since that's what the API spec documents
  // for the generic filter. Grouping is preserved client-side for UX only.
  if (!activeTags.size) return undefined;
  return Array.from(activeTags.keys()).join(',');
}
async function loadPage(reset) {
  if (!client) return;
  if (reset && searchAbort) { searchAbort.abort(); }
  const myAbort = new AbortController();
  searchAbort = myAbort;
  if (reset) {
    offset = 0;
    document.getElementById('browse').replaceChildren();
    lastModItems = [];
  }
  try {
    const q = document.getElementById('search').value.trim();
    const sort = tsic.dropdown.get(document.getElementById('sort')) || 'popular';
    const tagsIn = buildTagsInQuery();
    const r = await listMods(client, { q, sort, tagsIn, limit: PAGE, offset }, myAbort.signal);
    if (myAbort.signal.aborted) return;
    const items = r.data || [];
    renderMods(items, reset);
    offset += items.length;
    const more = (offset < (r.result_total || 0));
    document.getElementById('btn-loadmore').style.display = more ? '' : 'none';
  } catch (e) {
    if (e && (e.name === 'AbortError' || myAbort.signal.aborted)) return;
    showAuthError(e.message);
  } finally {
    if (searchAbort === myAbort) searchAbort = null;
    // Fire the deferred search even when THIS request was the one just aborted — that is
    // exactly the case searchSoon() schedules. Gating on !myAbort.signal.aborted made the
    // refetch unreachable (the aborted controller is always our own), silently dropping it.
    if (pendingSearch) {
      pendingSearch = false;
      loadPage(true);
    }
  }
}
function renderMods(items, reset) {
  const host = document.getElementById('browse');
  if (reset) host.replaceChildren();
  const subbed = !!loadToken();
  let i = 0;
  for (const m of items) {
    lastModItems.push(m);
    const card = buildCard(m, subbed);
    card.style.animationDelay = (Math.min(i++, 20) * 22) + 'ms';
    host.appendChild(card);
    if (dlProgress.has(String(m && m.name_id || ''))) {
      paintCardDownload(String(m.name_id));
    }
  }
}
function buildCard(m, subbed) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.nameId = String(m && m.name_id || '');

  const logo = document.createElement('div');
  logo.className = 'logo';
  const logoUrl = safeHttpUrl(m && m.logo && m.logo.thumb_320x180);
  if (logoUrl) {
    logo.style.backgroundImage = `url("${logoUrl.replace(/"/g, '%22')}")`;
  }
  el.appendChild(logo);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = String(m && m.name || '');
  name.title = String(m && m.name || '');
  el.appendChild(name);

  const summary = document.createElement('div');
  summary.className = 'summary';
  summary.textContent = String(m && m.summary || '').slice(0, 120);
  el.appendChild(summary);

  const btn = document.createElement('button');
  btn.className = 'card-sub';
  paintSubscribeButton(btn, m, subbed);
  el.appendChild(btn);

  return el;
}
function paintSubscribeButton(btn, m, subbed) {
  const nameId = String(m && m.name_id || '');
  const sub = subscribedMap.get(nameId);
  const installing = dlProgress.has(nameId);
  btn.classList.toggle('is-busy', installing);
  btn.classList.toggle('is-sub', !installing && subbed && !!sub);
  if (installing) {
    btn.textContent = 'Installing…';
    btn.disabled = true;
    btn.title = '';
    btn.onclick = null;
  } else if (!subbed) {
    btn.textContent = 'Subscribe';
    btn.disabled = true;
    btn.title = 'Sign in to subscribe';
    btn.onclick = null;
  } else if (sub && sub.installed) {
    btn.textContent = 'Uninstall';
    btn.disabled = false;
    btn.title = '';
    btn.onclick = () => doUninstallFromCard(m);
  } else if (sub) {
    btn.textContent = 'Unsubscribe';
    btn.disabled = false;
    btn.title = '';
    btn.onclick = () => doUnsubscribe(m);
  } else {
    btn.textContent = 'Subscribe';
    btn.disabled = false;
    btn.title = '';
    btn.onclick = () => doSubscribe(m);
  }
}
function refreshSubscribeButtons() {
  const host = document.getElementById('browse');
  if (!host) return;
  const subbed = !!loadToken();
  for (const card of host.querySelectorAll('.card')) {
    const nameId = card.dataset.nameId || '';
    const btn = card.querySelector('.card-sub');
    if (!btn) continue;
    const m = lastModItems.find(mod => String(mod.name_id) === nameId);
    if (m) paintSubscribeButton(btn, m, subbed);
  }
}
function searchSoon() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (searchAbort) {
      // A previous fetch is in flight — schedule a refetch when it completes.
      pendingSearch = true;
      searchAbort.abort();
    } else {
      loadPage(true);
    }
  }, 300);
}
async function doSubscribe(m) {
  if (!loadToken()) { showAuthError('Sign in to subscribe.'); return; }
  showInstallError('');
  try {
    await subscribe(client, m.id);
    tsic.publishMessage('UI.Cmd.Mod.Subscribe', {
      ModIoId: m.id,
      NameId: String(m.name_id || ''),
      DisplayName: String(m.name || ''),
    });
    subscribedMap.set(String(m.name_id), { modIoId: m.id, hasUpdate: false, installed: false });
    // The install pipeline starts server-side right away; show the card as
    // busy (indeterminate) until the first sized progress event lands.
    setDownloadProgress(String(m.name_id || ''), null);
  } catch (e) { showInstallError(e.message); }
}
async function doUnsubscribe(m) {
  if (!loadToken()) { return; }
  showInstallError('');
  try {
    await unsubscribe(client, m.id);
    tsic.publishMessage('UI.Cmd.Mod.Unsubscribe', {
      NameId: String(m.name_id || ''),
    });
    subscribedMap.delete(String(m.name_id));
    refreshSubscribeButtons();
  } catch (e) { showInstallError(e.message); }
}

// Card-side uninstall for an installed subscription. UI.Cmd.Mod.Uninstall
// removes the files AND the mod.io subscription server-side, then broadcasts
// fresh InstalledList/Subscriptions — the library row leaves via its own
// animation and this card reverts to Subscribe.
function doUninstallFromCard(m) {
  const nameId = String(m && m.name_id || '');
  if (!nameId) { return; }
  showInstallError('');
  tsic.publishMessage('UI.Cmd.Mod.Uninstall', { NameId: nameId });
  subscribedMap.delete(nameId);
  refreshSubscribeButtons();
}
function bootBrowse() {
  if (bootedBrowse) return;
  bootedBrowse = true;
  loadTags();
  loadPage(true);
  document.getElementById('search').oninput = searchSoon;
  document.getElementById('sort').addEventListener('tsic-change', () => loadPage(true));
  document.getElementById('btn-loadmore').onclick = () => loadPage(false);
}

// ------------------------------------------------------------- library ----

function isActive(m) { return !!(m.bEnabled || m.bLocked); }
function findMod(modId) { return installedMods.find(m => m.ModId === modId) || null; }
function orderIndex(id) {
  const i = installedOrder.indexOf(id);
  return i >= 0 ? i : 9999;
}

// FLIP: capture row rects keyed by ModId, mutate the DOM, then animate every
// surviving row from its old rect to its new one (this is what carries a row
// visually across the column gap and slides its old/new neighbours apart).
// Rows with no prior rect just landed (fresh install) — they get the
// slide-up entrance animation instead, staggered by list position.
function animateLibraryChange(mutate) {
  const rowsNow = document.querySelectorAll('.lib-row');
  const before = new Map();
  for (const r of rowsNow) before.set(r.dataset.modId, r.getBoundingClientRect());

  mutate();

  if (REDUCED_MOTION) return;
  for (const r of document.querySelectorAll('.lib-row')) {
    const b = before.get(r.dataset.modId);
    if (!b) {
      const idx = Array.prototype.indexOf.call(r.parentElement.children, r);
      r.style.animationDelay = Math.min(idx * 30, 240) + 'ms';
      r.classList.add('row-enter');
      continue;
    }
    const a = r.getBoundingClientRect();
    const dx = b.left - a.left;
    const dy = b.top - a.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    r.classList.remove('row-enter');
    r.classList.add('is-flying');
    r.style.transition = 'none';
    r.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      r.style.transition = 'transform 280ms cubic-bezier(0.2, 0.7, 0.2, 1)';
      r.style.transform = '';
      r.addEventListener('transitionend', () => {
        r.style.transition = '';
        r.classList.remove('is-flying');
      }, { once: true });
    }));
  }
}

function buildRow(m, opts) {
  const row = document.createElement('div');
  row.className = 'lib-row';
  row.dataset.modId = m.ModId;

  if (opts.active) {
    // ← back to the stockroom (or a lock when the mod is pinned)
    if (m.bLocked) {
      const lock = document.createElement('span');
      lock.className = 'lock';
      lock.textContent = '🔒';
      lock.title = 'Required — always active';
      row.appendChild(lock);
    } else {
      const left = document.createElement('button');
      left.type = 'button';
      left.className = 'btn-move btn-move--left';
      left.textContent = '←';
      left.title = 'Deactivate (move to Stockroom)';
      left.onclick = () => setModActive(m, false);
      row.appendChild(left);
    }

    const ord = document.createElement('span');
    ord.className = 'ord';
    ord.textContent = String(opts.index + 1);
    row.appendChild(ord);
  }

  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  nameSpan.textContent = String(m.DisplayName || '');
  nameSpan.title = String(m.DisplayName || '');
  if (m.Version) {
    const v = document.createElement('span');
    v.className = 'ver';
    v.textContent = String(m.Version);
    nameSpan.appendChild(v);
  }
  row.appendChild(nameSpan);

  const subInfo = subscribedMap.get(m.ModId);
  if (subInfo && subInfo.hasUpdate) {
    const updateBtn = document.createElement('button');
    updateBtn.type = 'button';
    updateBtn.className = 'btn-update';
    const busy = dlProgress.has(m.ModId);
    updateBtn.textContent = busy ? 'Updating…' : 'Update';
    updateBtn.disabled = busy;
    updateBtn.onclick = () =>
      tsic.publishMessage('UI.Cmd.Mod.CheckUpdates', { NameId: m.ModId });
    row.appendChild(updateBtn);
  }

  if (opts.active) {
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'btn-step';
    up.textContent = '↑';
    up.title = 'Load earlier';
    up.disabled = !!m.bLocked || opts.index === 0;
    up.onclick = () => moveActive(m.ModId, -1);
    row.appendChild(up);

    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'btn-step';
    down.textContent = '↓';
    down.title = 'Load later';
    down.disabled = !!m.bLocked || opts.index === opts.count - 1;
    down.onclick = () => moveActive(m.ModId, +1);
    row.appendChild(down);
  }

  // Shipped mods (base game + bundled mods) can only be deactivated —
  // there is nothing to uninstall.
  if (!m.bShipped && !m.bLocked) {
    const uninstallBtn = document.createElement('button');
    uninstallBtn.type = 'button';
    uninstallBtn.className = 'btn-uninstall';
    uninstallBtn.textContent = 'Uninstall';
    uninstallBtn.onclick = () => doUninstall(m);
    row.appendChild(uninstallBtn);
  }

  if (!opts.active) {
    // → onto the shop floor
    const right = document.createElement('button');
    right.type = 'button';
    right.className = 'btn-move btn-move--right';
    right.textContent = '→';
    right.title = 'Activate (move to Shop Floor)';
    right.onclick = () => setModActive(m, true);
    row.appendChild(right);
  }

  const bar = document.createElement('div');
  bar.className = 'dl-bar';
  const fill = document.createElement('div');
  fill.className = 'dl-fill';
  bar.appendChild(fill);
  row.appendChild(bar);
  if (dlProgress.has(m.ModId)) applyDownloadPaint(row, '.dl-bar', '.dl-fill', m.ModId, 'is-downloading');

  return row;
}

function renderLibrary() {
  const activeHost = document.getElementById('list-active');
  const inactiveHost = document.getElementById('list-inactive');
  activeHost.replaceChildren();
  inactiveHost.replaceChildren();

  const active = installedMods.filter(isActive)
    .sort((a, b) => orderIndex(a.ModId) - orderIndex(b.ModId));
  const inactive = installedMods.filter(m => !isActive(m))
    .sort((a, b) => String(a.DisplayName || '').localeCompare(String(b.DisplayName || '')));

  active.forEach((m, i) =>
    activeHost.appendChild(buildRow(m, { active: true, index: i, count: active.length })));
  inactive.forEach(m =>
    inactiveHost.appendChild(buildRow(m, { active: false })));

  if (!active.length) {
    const empty = document.createElement('div');
    empty.className = 'lib-empty';
    empty.textContent = 'Nothing on display. Move mods here to activate them.';
    activeHost.appendChild(empty);
  }
  if (!inactive.length) {
    const empty = document.createElement('div');
    empty.className = 'lib-empty';
    empty.textContent = installedMods.length
      ? 'The stockroom is empty — everything is on display.'
      : 'No mods installed yet. Subscribe to one in the catalogue above.';
    inactiveHost.appendChild(empty);
  }

  document.getElementById('count-active').textContent = String(active.length);
  document.getElementById('count-inactive').textContent = String(inactive.length);

  const hasAnyUpdate = installedMods.some(m => {
    const s = subscribedMap.get(m.ModId);
    return s && s.hasUpdate;
  });
  document.getElementById('btn-update-all').style.display = hasAnyUpdate ? '' : 'none';
}

function renderLibraryAnimated() { animateLibraryChange(renderLibrary); }

function mergeNewModsIntoOrder() {
  // Any installed mod missing from order goes to the end so the published
  // Order is complete and SetOrder doesn't drop its slot.
  const known = new Set(installedOrder);
  for (const m of installedMods) {
    if (m && m.ModId && !known.has(m.ModId)) {
      installedOrder.push(m.ModId);
      known.add(m.ModId);
    }
  }
}

function setModActive(m, active) {
  if (m.bLocked) return;
  m.bEnabled = active;  // optimistic — reconciled by the next InstalledList broadcast
  mergeNewModsIntoOrder();
  tsic.publishMessage('UI.Cmd.Mod.SetEnabled', { ModId: m.ModId, Enabled: active });
  renderLibraryAnimated();
}

// Reorder within the ACTIVE subset only, then rebuild the full order list
// (inactive mods keep a slot at the back so the published Order stays complete).
function moveActive(modId, delta) {
  mergeNewModsIntoOrder();
  const act = installedOrder.filter(id => { const m = findMod(id); return m && isActive(m); });
  const rest = installedOrder.filter(id => { const m = findMod(id); return !(m && isActive(m)); });
  const i = act.indexOf(modId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= act.length) return;
  [act[i], act[j]] = [act[j], act[i]];
  installedOrder = act.concat(rest);
  tsic.publishMessage('UI.Cmd.Mod.SetLoadOrder', { Order: installedOrder.slice() });
  renderLibraryAnimated();
}

function doUninstall(m) {
  tsic.publishMessage('UI.Cmd.Mod.Uninstall', { NameId: m.ModId });
  subscribedMap.delete(m.ModId);
  refreshSubscribeButtons();
  const row = document.querySelector(`.lib-row[data-mod-id="${CSS.escape(m.ModId)}"]`);
  if (!row || REDUCED_MOTION) {
    installedMods = installedMods.filter(x => x.ModId !== m.ModId);
    renderLibraryAnimated();
    return;
  }
  // Slide the row out, then collapse the gap with a FLIP pass. The next
  // InstalledList broadcast is the authoritative reconcile.
  row.classList.add('row-exit');
  row.addEventListener('transitionend', () => {
    installedMods = installedMods.filter(x => x.ModId !== m.ModId);
    renderLibraryAnimated();
  }, { once: true });
}

function setChecking(on) {
  const el = document.getElementById('lib-status');
  el.style.display = on ? '' : 'none';
  clearTimeout(checkingTimer);
  if (on) checkingTimer = setTimeout(() => { el.style.display = 'none'; }, 12000);
}

function flashEl(el, cls) {
  if (!el) return;
  el.classList.remove('flash-ok', 'flash-fail');
  void el.offsetWidth;  // restart the animation if it was already applied
  el.classList.add(cls);
}
function flashRow(modId, cls) {
  flashEl(document.querySelector(`.lib-row[data-mod-id="${CSS.escape(modId)}"]`), cls);
}
function findCard(nameId) {
  return document.querySelector(`.card[data-name-id="${CSS.escape(nameId)}"]`);
}

// The bar's displayed value: real progress when ahead, otherwise the creep.
function displayedPct(nameId) {
  const real = dlProgress.get(nameId);
  const creep = dlCreep.get(nameId);
  return Math.max(typeof real === 'number' ? real : 0, creep ? creep.pct : 0);
}

function stopCreep(nameId) {
  const creep = dlCreep.get(nameId);
  if (creep) clearInterval(creep.timer);
  dlCreep.delete(nameId);
}

function startCreep(nameId) {
  if (dlCreep.has(nameId)) return;
  const creep = { pct: 0, timer: 0 };
  creep.timer = setInterval(() => {
    creep.pct = Math.min(DL_CREEP_CAP, creep.pct + (DL_CREEP_CAP - creep.pct) * DL_CREEP_RATE);
    const real = dlProgress.get(nameId);
    if (typeof real === 'number' && real > creep.pct) creep.pct = real;
    paintRowDownload(nameId);
    paintCardDownload(nameId);
  }, DL_CREEP_TICK_MS);
  dlCreep.set(nameId, creep);
}

// Shared painter for a download bar — a striped fill at the displayed
// percentage (creep or real, whichever is ahead).
function applyDownloadPaint(host, barSel, fillSel, nameId, busyClass) {
  const active = dlProgress.has(nameId);
  host.classList.toggle(busyClass, active);
  const bar = host.querySelector(barSel);
  const fill = host.querySelector(fillSel);
  if (!bar || !fill) return;
  fill.style.width = active ? Math.round(displayedPct(nameId) * 100) + '%' : '0%';
}

function paintRowDownload(nameId) {
  const row = document.querySelector(`.lib-row[data-mod-id="${CSS.escape(nameId)}"]`);
  if (row) applyDownloadPaint(row, '.dl-bar', '.dl-fill', nameId, 'is-downloading');
}

function paintCardDownload(nameId) {
  const card = findCard(nameId);
  if (!card) return;
  let bar = card.querySelector('.card-dl');
  if (!bar && dlProgress.has(nameId)) {
    bar = document.createElement('div');
    bar.className = 'card-dl';
    const fill = document.createElement('div');
    fill.className = 'card-dl-fill';
    bar.appendChild(fill);
    card.appendChild(bar);
  }
  applyDownloadPaint(card, '.card-dl', '.card-dl-fill', nameId, 'is-installing');
}

function setDownloadProgress(nameId, pct) {
  if (finishingIds.has(nameId)) return;  // completion beat owns the bar now
  if (!dlStartedAt.has(nameId)) dlStartedAt.set(nameId, Date.now());
  dlProgress.set(nameId, pct);
  startCreep(nameId);
  paintRowDownload(nameId);
  paintCardDownload(nameId);
  refreshSubscribeButtons();
}

function finalizeDownload(nameId, ok) {
  finishingIds.delete(nameId);
  stopCreep(nameId);
  dlProgress.delete(nameId);
  dlStartedAt.delete(nameId);
  paintRowDownload(nameId);
  paintCardDownload(nameId);
  const card = findCard(nameId);
  if (card) {
    const bar = card.querySelector('.card-dl');
    if (bar) bar.remove();
  }
  if (ok) {
    const sub = subscribedMap.get(nameId);
    if (sub) sub.installed = true;
    renderLibraryAnimated();
    flashRow(nameId, 'flash-ok');
    flashEl(card, 'flash-ok');
  } else {
    flashRow(nameId, 'flash-fail');
    flashEl(card, 'flash-fail');
  }
  refreshSubscribeButtons();
}

function finishDownload(nameId, ok) {
  if (finishingIds.has(nameId)) return;
  if (!ok || REDUCED_MOTION) {
    finalizeDownload(nameId, ok);
    return;
  }
  // Success: sweep the bar from wherever the creep/progress left it to 100%
  // and hold long enough that even an instant download reads as
  // "downloaded, installed".
  finishingIds.add(nameId);
  stopCreep(nameId);
  const shownFor = Date.now() - (dlStartedAt.get(nameId) || Date.now());
  const holdMs = DL_FILL_MS + Math.max(0, DL_MIN_FEEDBACK_MS - shownFor);
  const row = document.querySelector(`.lib-row[data-mod-id="${CSS.escape(nameId)}"]`);
  const card = findCard(nameId);
  for (const host of [row, card]) {
    const fill = host && host.querySelector('.dl-fill, .card-dl-fill');
    if (fill) fill.style.transition = `width ${DL_FILL_MS}ms ease-out`;
  }
  dlProgress.set(nameId, 1);
  paintRowDownload(nameId);
  paintCardDownload(nameId);
  setTimeout(() => finalizeDownload(nameId, true), holdMs);
}

// ---------------------------------------------------------------- boot ----

function teardown() {
  clearTimeout(searchTimer);
  searchTimer = null;
  clearTimeout(checkingTimer);
  checkingTimer = null;
  for (const creep of dlCreep.values()) clearInterval(creep.timer);
  dlCreep.clear();
  if (searchAbort) { try { searchAbort.abort(); } catch (_) {} searchAbort = null; }
  pendingSearch = false;
}
window.addEventListener('pagehide', teardown);
window.addEventListener('beforeunload', teardown);

(function boot() {
  if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
  tsic.whenReady(function () {
    tsic.on('tsic.msg.UI.Mod.IoConfig', (p) => {
      // Treat missing GameId OR missing ApiKey as "mod.io not configured".
      if (!p || !p.GameId || !p.ApiKey) { show('disabled'); return; }
      cfg = { gameId: Number(p.GameId), apiKey: p.ApiKey, env: p.Env,
              baseUrl: makeBaseUrl(Number(p.GameId), p.Env) };
      client = createClient(cfg, () => loadToken());
      bootAuth();
      bootBrowse();
    });
    tsic.on('tsic.msg.UI.Mod.InstalledList', (p) => {
      installedMods = (p && p.Mods) || [];
      renderLibraryAnimated();
    });
    tsic.on('tsic.msg.UI.Mod.LoadOrder', (p) => {
      installedOrder = (p && p.Order) ? p.Order.slice() : [];
      renderLibraryAnimated();
    });
    tsic.on('tsic.msg.UI.Mod.InstallFailed', (p) => {
      if (p && p.Reason) showInstallError(`Install failed (${p.ModId}): ${p.Reason}`);
    });
    tsic.on('tsic.msg.UI.Mod.Subscriptions', (p) => {
      subscribedMap.clear();
      const subs = (p && p.Subs) || [];
      for (const s of subs) {
        subscribedMap.set(s.NameId, {
          modIoId: s.ModIoId,
          hasUpdate: !!s.bHasUpdate,
          installed: !!s.bInstalled,
        });
      }
      refreshSubscribeButtons();
      renderLibraryAnimated();
    });
    tsic.on('tsic.msg.UI.Mod.UpdateProgress', (p) => {
      if (!p) return;
      if (p.State === 'checking') { setChecking(true); return; }
      setChecking(false);
      if (!p.NameId) return;
      if (p.State === 'downloading') {
        const pct = (typeof p.Progress === 'number' && p.Progress > 0) ? p.Progress : null;
        setDownloadProgress(p.NameId, pct);
      } else if (p.State === 'done') {
        finishDownload(p.NameId, true);
      } else if (p.State === 'failed') {
        finishDownload(p.NameId, false);
        if (p.Error) showInstallError(`Update failed (${p.NameId}): ${p.Error}`);
      }
    });

    document.getElementById('btn-update-all').onclick = () =>
      tsic.publishMessage('UI.Cmd.Mod.CheckUpdates', {});
    document.getElementById('btn-filters').onclick = (e) => {
      const tray = document.getElementById('tag-tray');
      const open = tray.classList.toggle('open');
      e.currentTarget.classList.toggle('open', open);
    };
    document.getElementById('btn-back').onclick = () =>
      tsic.publishMessage('UI.Cmd.Menu.Navigate', { Screen: 'MainMenu' });

    renderLibrary();  // empty-state paint before the first InstalledList lands

    // --- Modding tool tabs -----------------------------------------------
    // The editor tabs are external static web apps (GitHub Pages). They are
    // opened as a full-screen top-level navigation so the Definition Editor's
    // File System Access API works (it is blocked inside cross-origin iframes).
    // Each tool shows its own "Back to game" button (it is launched with
    // ?host=tsic) that navigates back to this screen via http://tsic.local/.
    const TOOL_URLS = {
      defeditor: 'https://chico-games.github.io/TSIC-Mod-Maker/?host=tsic',
      mapeditor: 'https://chico-games.github.io/TSICLevelEditor/?host=tsic',
    };
    function launchTool(url) {
      const msg = document.getElementById('tab-launch-msg');
      if (!navigator.onLine) {
        msg.textContent = 'These modding tools require an internet connection.';
        msg.style.display = '';
        return;
      }
      msg.style.display = 'none';
      window.location.href = url;
    }
    if (window.TSIC && TSIC.TabFilter) {
      const toolTabs = TSIC.TabFilter.create(
        document.getElementById('mods-tabs'),
        [
          { id: 'browse',    label: 'Browse & Install' },
          { id: 'defeditor', label: 'Definition Editor' },
          { id: 'mapeditor', label: 'Map Editor' },
        ],
        function (active) {
          if (active === 'browse') return;
          launchTool(TOOL_URLS[active]);
          // Revert highlight so returning to this screen lands on Browse and
          // the offline message (if shown) sits under the Browse tab.
          toolTabs.setActive('browse');
        }
      );
    }
  });
})();
