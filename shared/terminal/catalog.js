// shared/terminal/catalog.js
//
// Pure program-catalog logic: manifest parsing, per-tier runnable/locked
// classification, the launcher list, and launch-attempt resolution into a
// program or a structured error. No DOM, no bridge — testable in isolation.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};
  const ERR = NS.ERR;

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
    };
  }

  function runnable(program, tier) {
    return !!program && program.minTier <= tier;
  }

  function listForTerminal(opts) {
    const programs = opts.programs || [];
    const unlocked = new Set(opts.unlockedIds || []);
    const tier = opts.tier;
    return programs
      .filter(function (p) { return p && unlocked.has(p.id); })
      .map(function (p) { return { program: p, locked: !runnable(p, tier) }; })
      .sort(function (a, b) {
        return a.program.name.toLowerCase().localeCompare(b.program.name.toLowerCase());
      });
  }

  function resolveLaunch(programId, opts) {
    const programs = opts.programs || [];
    const unlocked = new Set(opts.unlockedIds || []);
    const tier = opts.tier;
    const program = programs.find(function (p) { return p && p.id === programId; });
    if (!program) return { ok: false, code: ERR.NOT_FOUND, info: { id: programId } };
    if (!unlocked.has(program.id)) return { ok: false, code: ERR.NOT_UNLOCKED, info: { id: programId } };
    if (!runnable(program, tier)) {
      return { ok: false, code: ERR.TIER_TOO_LOW, info: { required: program.minTier, current: tier } };
    }
    return { ok: true, program: program };
  }

  NS.catalog = { parseManifest: parseManifest, runnable: runnable, listForTerminal: listForTerminal, resolveLaunch: resolveLaunch };
})(window);
