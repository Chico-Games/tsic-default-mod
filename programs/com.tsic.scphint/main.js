// Tier-3 demo program. On a tier-1/2 terminal it never runs (ERR_TIER_TOO_LOW).
(async function () {
  const term = await TSICProgram.connect();
  term.print('SCP RESTRICTED ACCESS — SITE CONTROLS');
  const r = await term.world.mutate('setTimeOfDay', { t: 0.5 });
  term.print('setTimeOfDay -> ' + (r && r.error ? r.error : 'ok'));
  term.exit();
})();
