// shared/terminal/catalog.js
//
// Pure program-catalog logic: manifest parsing, per-tier runnable/locked
// classification, the launcher list, and launch-attempt resolution into a
// program or a structured error. No DOM, no bridge — testable in isolation.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};

  function parseManifest(raw) {
    if (!raw || !raw.id || !raw.entry) return null;
    return {
      id: String(raw.id),
      name: raw.name ? String(raw.name) : String(raw.id),
      version: raw.version ? String(raw.version) : '0',
      minTier: Number.isFinite(raw.minTier) ? raw.minTier : 1,
      entry: String(raw.entry),
      icon: raw.icon ? String(raw.icon) : null,
      capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.slice() : [],
      hidden: !!raw.hidden,   // secret programs: runnable by name, omitted from listings
      folder: raw.folder ? String(raw.folder) : null,   // desktop grouping (e.g. legacy "V1"); ignored by the text shell
    };
  }

  function runnable(program, tier) {
    return !!program && program.minTier <= tier;
  }

  function listForTerminal(opts) {
    const programs = opts.programs || [];
    const unlocked = new Set(opts.unlockedIds || []);
    const badges = opts.badges || {};
    const tier = opts.tier;
    return programs
      .filter(function (p) { return p && unlocked.has(p.id) && !p.hidden; })
      .map(function (p) { return { program: p, locked: !runnable(p, tier), badge: badges[p.id] || null }; })
      .sort(function (a, b) {
        return a.program.name.toLowerCase().localeCompare(b.program.name.toLowerCase());
      });
  }

  // Resolve a typed token to a program. Match priority: exact id, then
  // case-insensitive id, then case-insensitive name — so a user who sees
  // "HELLO  (com.tsic.hello)" in the listing can run it by typing "hello",
  // "HELLO", or the full id.
  function resolveLaunch(token, opts) {
    const programs = opts.programs || [];
    const unlocked = new Set(opts.unlockedIds || []);
    const tier = opts.tier;
    const needle = String(token == null ? '' : token).toLowerCase();
    const program =
      programs.find(function (p) { return p && p.id === token; }) ||
      programs.find(function (p) { return p && p.id.toLowerCase() === needle; }) ||
      programs.find(function (p) { return p && p.name.toLowerCase() === needle; });
    if (!program) return { ok: false, code: NS.ERR.NOT_FOUND, info: { id: token } };
    if (!unlocked.has(program.id)) return { ok: false, code: NS.ERR.NOT_UNLOCKED, info: { id: program.id } };
    if (!runnable(program, tier)) {
      return { ok: false, code: NS.ERR.TIER_TOO_LOW, info: { required: program.minTier, current: tier } };
    }
    return { ok: true, program: program };
  }

  NS.catalog = { parseManifest: parseManifest, runnable: runnable, listForTerminal: listForTerminal, resolveLaunch: resolveLaunch };
})(window);
