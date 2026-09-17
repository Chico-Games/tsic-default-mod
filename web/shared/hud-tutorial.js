// shared/hud-tutorial.js — Objective chimes.
//
// The objectives themselves are a page of the Tab catalogue notebook, drawn by the game
// (UScpCataloguePageWidget), not by this page. What stays here is the sound: a chime when an
// objective is ticked off and a softer cue when a new one rolls in, so progress is heard
// without anything on screen.
//
// Channel: tsic.msg.UI.Tutorial.State — { Steps:[{Id,bDone}], bEnabled }
(function () {
  // Steps that tick off silently. Their completion fires in the middle of a
  // physical action, where a chime reads as that action's own SFX rather than as
  // an objective being checked off (grabbing furniture sounded like a pickup cue;
  // equipping a weapon sounded like the draw).
  var SILENT_STEPS = { DragFurniture: true, EquipWeapon: true };

  var prevDone = null;     // Id -> bool; null until the first state (sticky replay = no sound)

  function onState(p) {
    if (!p || !Array.isArray(p.Steps)) return;
    if (prevDone !== null && p.bEnabled !== false) {
      var newly = p.Steps.filter(function (s) { return s.bDone && !prevDone[s.Id]; });
      var appeared = p.Steps.some(function (s) { return !(s.Id in prevDone) && !s.bDone; });
      try {
        if (newly.some(function (s) { return !SILENT_STEPS[s.Id]; })) {
          tsic.playSound('Objective.Complete', 0.5);
        } else if (!newly.length && appeared) {
          tsic.playSound('Tutorial.NewStep', 0.4);
        }
      } catch (e) {}
    }
    prevDone = {};
    p.Steps.forEach(function (s) { prevDone[s.Id] = !!s.bDone; });
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Tutorial.State', onState);
    });
  })();
})();
