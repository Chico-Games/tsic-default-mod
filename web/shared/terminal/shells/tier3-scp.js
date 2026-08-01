// shared/terminal/shells/tier3-scp.js
//
// Tier-3 "SCiPnet" terminal — Katie's hacked, networked evolution of Durham OS.
// It keeps the v2 functionality (multiple program windows, the command console,
// the same programs + NEW flags) by reusing the shared engine (console-core, the
// sandbox runtime, and the screen's per-window sink plumbing) — but swaps the
// paradigm: the "desktop" is a NETWORK TOPOLOGY map. Programs are nodes; clicking
// one opens it in a window. Amber-phosphor tactical CRT chrome (grid, HUD bars,
// telemetry stream). Chrome lives here; wiring lives in shared/screens/terminal.js.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};
  NS.shells = NS.shells || {};

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  const CONSOLE_BANNER = [
    { text: 'SCiPnet SECURE SHELL  //  NODE RAISA-04' },
    { text: 'KATIE//ROOT — CLEARANCE OVERRIDE ACTIVE' },
    { text: 'Type HELP for a list of commands.' },
    { text: '' },
  ];
  function mapCls(cls) {
    if (cls === 'tsic-term-echo') return 't3-echo';
    if (cls === 'tsic-term-err') return 't3-err';
    return cls || '';
  }

  function create(container, host) {
    const doc = container.ownerDocument;

    container.innerHTML =
      '<div class="tsic-term tsic-term--t3">' +
      '  <div class="t3-hud t3-hud--top"><span>[ SCiPnet // RAISA-04 TOPOLOGY ]</span><span class="t3-clock"></span></div>' +
      '  <div class="t3-net"><canvas class="t3-net-canvas" id="t3-canvas"></canvas><div class="t3-nodes" id="t3-nodes"></div></div>' +
      '  <aside class="t3-telemetry" id="t3-telemetry"></aside>' +
      '  <div class="t3-workspace" id="t3-workspace"></div>' +
      '  <div class="t3-hud t3-hud--bottom">' +
      '    <span class="t3-sys" id="t3-sys">SYS_STATUS: SECURE_NORMAL</span>' +
      '    <div class="t3-rot" title="Drag to rotate — or scroll over the map">' +
      '      <span class="t3-rot-icon">⟳</span>' +
      '      <div class="t3-rot-track" id="t3-rot-track"><div class="t3-rot-thumb" id="t3-rot-thumb"></div></div>' +
      '    </div>' +
      '    <span>CLEARANCE: L-4 // KATIE//ROOT</span>' +
      '  </div>' +
      '  <div class="t3-crt"></div>' +
      '</div>';

    const rootEl = container.querySelector('.tsic-term--t3');
    const canvasEl = container.querySelector('#t3-canvas');
    const ctx2d = canvasEl.getContext('2d');   // null under jsdom — link draw is then skipped
    const nodesEl = container.querySelector('#t3-nodes');
    const teleEl = container.querySelector('#t3-telemetry');
    const clockEl = container.querySelector('.t3-clock');
    const workspace = container.querySelector('#t3-workspace');
    const netEl = container.querySelector('.t3-net');

    let programList = [];
    let destroyed = false;
    const windows = [];
    let zTop = 10, openCount = 0, dragState = null, consoleRef = null;

    // ── Clock + telemetry stream ──────────────────────────────────
    function tickClock() {
      if (destroyed || !clockEl) return;
      const d = new Date();
      clockEl.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }
    tickClock();
    const clockTimer = setInterval(tickClock, 1000);

    const HEX = '0123456789ABCDEF';
    function tickTele() {
      if (destroyed || !teleEl) return;
      let s = '> 0x';
      for (let i = 0; i < 8; i++) s += HEX[Math.floor(Math.random() * 16)];
      const warn = Math.random() > 0.9;
      s += warn ? ' [WARN]' : ' [ OK ]';
      const row = doc.createElement('div');
      row.className = 't3-tele-line' + (warn ? ' is-warn' : '');
      row.textContent = s;
      teleEl.appendChild(row);
      while (teleEl.childElementCount > 32) teleEl.removeChild(teleEl.firstChild);
    }
    const teleTimer = setInterval(tickTele, 220);

    // ── Program helpers ───────────────────────────────────────────
    function nameFor(id) {
      for (let i = 0; i < programList.length; i++) if (programList[i].program.id === id) return programList[i].program.name;
      return id;
    }
    function entryFor(id) {
      for (let i = 0; i < programList.length; i++) if (programList[i].program.id === id) return programList[i];
      return null;
    }
    function isGui(program) {
      const granted = NS.grantedCaps ? NS.grantedCaps(host.tier, (program && program.capabilities) || []) : [];
      return granted.indexOf('gfx.canvas') !== -1;
    }

    // ── Window manager (lean: drag / focus / close / multi) ───────
    function bringToFront(rec) {
      zTop += 1;
      rec.el.style.zIndex = String(zTop);
      windows.forEach(function (w) { w.el.classList.toggle('is-focused', w === rec); });
    }
    function focusTopmost() {
      let top = null, max = -1;
      windows.forEach(function (w) { const z = parseInt(w.el.style.zIndex || '0', 10); if (z > max) { max = z; top = w; } });
      if (top) bringToFront(top);
    }
    function raiseIfOpen(key) {
      for (let i = 0; i < windows.length; i++) if (windows[i].key === key) { bringToFront(windows[i]); return true; }
      return false;
    }
    function placeWindow(w) {
      const dr = workspace.getBoundingClientRect();
      const step = 28, slot = openCount % 5;
      openCount += 1;
      let left = Math.round(dr.width * 0.30) + slot * step;
      let top = Math.round(dr.height * 0.16) + slot * step;
      const maxL = Math.max(8, dr.width - w.offsetWidth - 8);
      const maxT = Math.max(8, dr.height - w.offsetHeight - 8);
      if (left > maxL) left = maxL;
      if (top > maxT) top = maxT;
      w.style.left = left + 'px';
      w.style.top = top + 'px';
    }
    function makeWindow(title, opts) {
      opts = opts || {};
      const w = doc.createElement('div');
      w.className = 't3-window';
      w.innerHTML =
        '<div class="t3-titlebar"><span class="t3-title"></span>' +
        '<button class="t3-zoom" type="button" title="Maximize"></button>' +
        '<button class="t3-close" type="button" title="Close">X</button></div>' +
        '<div class="t3-window-body"><div class="t3-content"></div></div>' +
        '<span class="t3-resize" title="Resize"></span>';
      w.querySelector('.t3-title').textContent = '+ [ ' + (title || 'NODE') + ' ]';
      const rec = { el: w, content: w.querySelector('.t3-content'), key: opts.key || null, onCloseFns: [] };
      if (opts.gui) rec.content.classList.add('t3-content--gui');
      if (opts.width && opts.height) { w.style.width = opts.width + 'px'; w.style.height = opts.height + 'px'; rec.content.classList.add('t3-content--sized'); }
      w.querySelector('.t3-close').addEventListener('click', function () { closeWindowRec(rec); });
      w.querySelector('.t3-zoom').addEventListener('click', function () { toggleMax(w); });
      w.addEventListener('pointerdown', function () { bringToFront(rec); }, true);
      enableDrag(w.querySelector('.t3-titlebar'), w);
      enableResize(w.querySelector('.t3-resize'), w);
      workspace.appendChild(w);
      windows.push(rec);
      placeWindow(w);
      bringToFront(rec);
      return rec;
    }
    function closeWindowRec(rec) {
      if (!rec) return;
      const fns = rec.onCloseFns; rec.onCloseFns = [];
      fns.forEach(function (fn) { try { fn(); } catch (e) {} });
      if (rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
      const i = windows.indexOf(rec); if (i >= 0) windows.splice(i, 1);
      focusTopmost();
    }
    function closeAllWindows() { windows.slice().forEach(closeWindowRec); }
    function enableDrag(handle, w) {
      handle.addEventListener('pointerdown', function (ev) {
        if (ev.target.closest('.t3-close') || ev.target.closest('.t3-zoom')) return;
        if (w.classList.contains('is-max')) return;
        const wr = w.getBoundingClientRect();
        dragState = { dx: ev.clientX - wr.left, dy: ev.clientY - wr.top };
        w.classList.add('is-dragging');
        try { handle.setPointerCapture(ev.pointerId); } catch (e) {}
      });
      handle.addEventListener('pointermove', function (ev) {
        if (!dragState) return;
        const dr = workspace.getBoundingClientRect();
        let left = ev.clientX - dr.left - dragState.dx;
        let top = ev.clientY - dr.top - dragState.dy;
        left = left < 2 ? 2 : Math.min(left, dr.width - w.offsetWidth - 2);
        top = top < 2 ? 2 : Math.min(top, dr.height - w.offsetHeight - 2);
        w.style.left = left + 'px'; w.style.top = top + 'px';
      });
      function end(ev) { if (!dragState) return; dragState = null; w.classList.remove('is-dragging'); try { handle.releasePointerCapture(ev.pointerId); } catch (e) {} }
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    }
    // Lock an auto-sized window to an explicit size so resize/maximize have a base.
    function ensureSized(w) {
      if (w.classList.contains('is-sized')) return;
      w.style.width = w.offsetWidth + 'px';
      w.style.height = w.offsetHeight + 'px';
      w.classList.add('is-sized');
    }
    // Maximize: fill the workspace; toggle restores the prior box.
    function toggleMax(w) {
      if (w.classList.contains('is-max')) {
        const r = w.__restore || {};
        w.style.left = r.left || ''; w.style.top = r.top || '';
        w.style.width = r.width || ''; w.style.height = r.height || '';
        w.classList.remove('is-max');
        return;
      }
      ensureSized(w);
      w.__restore = { left: w.style.left, top: w.style.top, width: w.style.width, height: w.style.height };
      w.style.left = '0px'; w.style.top = '0px';
      w.style.width = workspace.clientWidth + 'px';
      w.style.height = workspace.clientHeight + 'px';
      w.classList.add('is-max');
    }
    // Bottom-right grow box, clamped to the workspace.
    function enableResize(grip, w) {
      let rs = null;
      grip.addEventListener('pointerdown', function (ev) {
        if (w.classList.contains('is-max')) return;
        ev.preventDefault();
        ensureSized(w);
        rs = { x: ev.clientX, y: ev.clientY, w: w.offsetWidth, h: w.offsetHeight, left: w.offsetLeft, top: w.offsetTop };
        try { grip.setPointerCapture(ev.pointerId); } catch (e) {}
      });
      grip.addEventListener('pointermove', function (ev) {
        if (!rs) return;
        let width = rs.w + (ev.clientX - rs.x);
        let height = rs.h + (ev.clientY - rs.y);
        const maxW = workspace.clientWidth - rs.left - 2;
        const maxH = workspace.clientHeight - rs.top - 2;
        width = width < 260 ? 260 : (width > maxW ? maxW : width);
        height = height < 150 ? 150 : (height > maxH ? maxH : height);
        w.style.width = width + 'px'; w.style.height = height + 'px';
      });
      function rend(ev) { if (!rs) return; rs = null; try { grip.releasePointerCapture(ev.pointerId); } catch (e) {} }
      grip.addEventListener('pointerup', rend);
      grip.addEventListener('pointercancel', rend);
    }

    // ── Program I/O sinks ─────────────────────────────────────────
    function appendRowTo(content, text, cls) {
      if (!content) return;
      const row = doc.createElement('div');
      row.className = 't3-row' + (cls ? ' ' + cls : '');
      row.textContent = text;
      content.appendChild(row);
      content.scrollTop = content.scrollHeight;
      return row;
    }
    function windowReadLine(content, prompt) {
      if (!content) return Promise.resolve('');
      return new Promise(function (resolve) {
        const row = doc.createElement('div'); row.className = 't3-inputline';
        const pr = doc.createElement('span'); pr.className = 't3-input-prompt'; pr.textContent = prompt || '';
        const inp = doc.createElement('input'); inp.className = 't3-input-field'; inp.setAttribute('autocomplete', 'off'); inp.setAttribute('spellcheck', 'false');
        row.appendChild(pr); row.appendChild(inp); content.appendChild(row);
        content.scrollTop = content.scrollHeight;
        try { inp.focus({ preventScroll: true }); } catch (e) {}
        inp.addEventListener('keydown', function (ev) {
          if (ev.key !== 'Enter') return;
          const v = inp.value;
          row.removeChild(inp);
          pr.textContent = (prompt ? prompt + ' ' : '') + v;
          row.className = 't3-row t3-echo';
          resolve(v);
        });
      });
    }
    function showWindowError(rec, res, name) {
      const c = rec.content; c.classList.remove('t3-content--gui');
      if (res.code === NS.ERR.TIER_TOO_LOW) {
        appendRowTo(c, 'CANNOT OPEN ' + String(name || '').toUpperCase(), 't3-err');
        appendRowTo(c, 'Requires ' + NS.hardwareName(res.info.required) + ' (tier ' + res.info.required + ').', 't3-err');
        return;
      }
      if (res.code === NS.ERR.NOT_UNLOCKED || res.code === NS.ERR.NOT_FOUND) {
        appendRowTo(c, 'NODE NOT FOUND ON THIS NETWORK.', 't3-err');
        return;
      }
      appendRowTo(c, 'ERROR: ' + res.code, 't3-err');
    }
    function makeWindowSink(rec) {
      return {
        container: rec.content,
        print: function (text) { appendRowTo(rec.content, String(text)); },
        clear: function () { rec.content.innerHTML = ''; },
        requestInput: function (prompt) { return windowReadLine(rec.content, prompt); },
        setTheme: function (name) { rootEl.classList.toggle('theme-breach', name === 'red'); },
        reboot: function () { closeWindowRec(rec); },
        endProgram: function () { closeWindowRec(rec); },
        onClose: function (fn) { rec.onCloseFns.push(fn); },
      };
    }

    // ── Launch a program node into a window ───────────────────────
    function launch(id) {
      const entry = entryFor(id);
      const program = entry ? entry.program : { id: id, name: nameFor(id), capabilities: [] };
      if (raiseIfOpen('app:' + id)) return;
      const gui = isGui(program);
      const rec = makeWindow(program.name || nameFor(id), gui ? { key: 'app:' + id, gui: true, width: 620, height: 430 } : { key: 'app:' + id, width: 460, height: 300 });
      const sink = makeWindowSink(rec);
      host.run(id, { sink: sink }).then(function (res) { if (res && !res.ok) showWindowError(rec, res, program.name || nameFor(id)); });
    }

    // ── The command console (ROOT node) ───────────────────────────
    function openConsole() {
      if (raiseIfOpen('console')) return;
      const rec = makeWindow('SCiPnet SHELL', { key: 'console', width: 560, height: 360 });
      const cContent = rec.content;
      cContent.classList.add('t3-console', 't3-content--sized');
      const line = doc.createElement('div');
      line.className = 't3-console-line';
      line.innerHTML =
        '<span class="t3-console-prompt">SCP//&gt;</span><span class="t3-console-mirror"></span>' +
        '<span class="t3-console-cursor"></span>' +
        '<input class="t3-console-input" autocomplete="off" spellcheck="false" data-tsic-initial-focus>';
      cContent.appendChild(line);
      const promptEl = line.querySelector('.t3-console-prompt');
      const mirror = line.querySelector('.t3-console-mirror');
      const cInput = line.querySelector('.t3-console-input');
      function syncMirror() { mirror.textContent = cInput.value; }
      cInput.addEventListener('input', syncMirror);
      // Clicking anywhere in the console refocuses the (invisible) input, so a
      // click on the window body never strands the keyboard (cf. tier-1).
      cContent.addEventListener('mousedown', function (ev) {
        if (ev.target === cInput) return;
        ev.preventDefault();
        try { cInput.focus({ preventScroll: true }); } catch (e) {}
      });

      const view = {
        appendRow: function (cls) {
          const div = doc.createElement('div');
          div.className = 't3-row' + (cls ? ' ' + mapCls(cls) : '');
          cContent.insertBefore(div, line);
          return { setText: function (s) { div.textContent = s; } };
        },
        clearRows: function () { const r = cContent.querySelectorAll('.t3-row'); for (let i = 0; i < r.length; i++) r[i].remove(); },
        scrollToEnd: function () { cContent.scrollTop = cContent.scrollHeight; },
        setBooting: function (b) { line.style.visibility = b ? 'hidden' : ''; },
        // Publish the readiness marker console-core documents (tier-1 does the same).
        // Focusing is focusInput's job — finishBoot calls it right after this — and
        // doing it here made setReady(false) on reboot steal focus back to the prompt.
        setReady: function (b) { if (b) cContent.setAttribute('data-term-ready', '1'); else cContent.removeAttribute('data-term-ready'); },
        setPromptVisible: function (b) { promptEl.style.visibility = b ? '' : 'hidden'; },
        clearInput: function () { cInput.value = ''; syncMirror(); },
        focusInput: function () { try { cInput.focus({ preventScroll: true }); } catch (e) {} },
        applyTheme: function (name) { rootEl.classList.toggle('theme-breach', name === 'red'); },
        alive: function () { return !destroyed && !!cContent && cContent.isConnected; },
        getCharDelay: function () { return NS.shells.tier3.charDelayMs; },
        getCharsPerTick: function () { return NS.shells.tier3.charsPerTick; },
      };

      const consoleKillFns = [];
      const consoleSink = {
        print: function (t, o) { if (consoleCore) consoleCore.printToProgram(t, o); },
        clear: function () { if (consoleCore) consoleCore.clearScreen(); },
        requestInput: function (p) { return consoleCore ? consoleCore.beginProgramInput(p) : Promise.resolve(''); },
        setTheme: function (n) { if (consoleCore) consoleCore.setTheme(n); },
        reboot: function () { if (consoleCore) consoleCore.reboot(); },
        endProgram: function () { if (consoleCore) consoleCore.endProgram(); },
        onClose: function (fn) { consoleKillFns.push(fn); },
      };
      const consoleHost = {
        tier: host.tier,
        run: function (id) {
          const e = entryFor(id);
          if (e && isGui(e.program)) { launch(id); return Promise.resolve({ ok: true }); }
          return host.run(id, { sink: consoleSink });
        },
        close: function () { closeWindowRec(rec); },
        autoRun: null,
      };
      const consoleCore = NS.createConsole(view, consoleHost, { prompt: 'SCP//>', bootLines: CONSOLE_BANNER, bootLogo: null });
      consoleRef = consoleCore;
      consoleCore.onPrograms(programList);
      rec.onCloseFns.push(function () { consoleCore.destroy(); consoleKillFns.forEach(function (f) { try { f(); } catch (e) {} }); if (consoleRef === consoleCore) consoleRef = null; });
      cInput.addEventListener('keydown', function (ev) {
        if (consoleCore.isBooting()) { ev.preventDefault(); consoleCore.skipBoot(); return; }
        if (ev.key !== 'Enter') return;
        const v = cInput.value; cInput.value = ''; syncMirror();
        consoleCore.submitLine(v);
      });
      try { cInput.focus({ preventScroll: true }); } catch (e) {}
    }

    // ── Volumetric topology (3D turntable) ────────────────────────
    // Nodes are DOM divs positioned each frame from a pure projection
    // (shared/terminal/scp3d.js); links are drawn on a 2D canvas between the
    // projected centres, back-to-front with depth fade. The cloud spins around
    // the vertical axis — auto-drift when idle, driven by the HUD scrubber and
    // wheel-over-map otherwise.
    const view = doc.defaultView || global;
    const cam = NS.scp3d.defaultCamera();
    let nodes3d = [];
    let byId3d = {};
    const nodeEls = new Map();          // id -> element
    let focusId = null;                 // last-hovered node we're gliding to the front
    let focusReachedAt = 0;             // ms the focus node first reached centre (for dwell)
    let targetYaw = cam.yaw;            // every input drives this; cam.yaw eases toward it
    let lastInteract = -1e9;            // ms; stale => auto-spin runs
    let revealStart = 0;                // ms; for the fade-in
    let rafId = 0;
    const reducedMotion = !!(view.matchMedia && view.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const AUTO_SPIN = 0.0006;           // rad/frame ambient yaw drift (very slow)
    const YAW_EASE = 0.085;             // general fluidity (scroll / scrubber / idle catch-up)
    const FOCUS_EASE = 0.03;            // slower, cinematic glide when focusing a hovered node
    const FOCUS_DWELL = 1700;           // ms a focused node lingers centre-stage before drift resumes
    const FOCUS_EPS = 0.05;             // rad: "close enough" to count as centred
    const FRONT_FRAC = 0.5;             // only nodes in the front this fraction of depth are hoverable
    const PITCH_BASE = -0.35;           // resting downward tilt
    const PITCH_AMP = 0.42;             // how far it tilts up/down
    const PITCH_PERIOD = 17000;         // ms for one full up-down sweep
    const IDLE_MS = 2200;
    let pitchTarget = PITCH_BASE;       // cam.pitch always eases toward this (no snaps)
    function now3d() { return (view.performance && view.performance.now) ? view.performance.now() : Date.now(); }
    function noteInteract() { lastInteract = now3d(); }
    function shortestAngle(from, to) {
      let d = (to - from) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
      return d;
    }
    // Resolve an absolute angle to a target co-terminal with the current yaw, so
    // eases always take the short way and targetYaw tracks cam.yaw's range.
    function aimAt(absAngle) { return cam.yaw + shortestAngle(cam.yaw, absAngle); }
    // Yaw that swings a node to the front (nearest the camera, horizontally centred).
    function frontYawFor(id) {
      const n = byId3d[id];
      if (!n || (Math.abs(n.x) + Math.abs(n.z) < 1)) return null;   // origin/ROOT: nothing to aim at
      return Math.atan2(-n.x, n.z) + Math.PI;
    }

    const trackEl = container.querySelector('#t3-rot-track');
    const thumbEl = container.querySelector('#t3-rot-thumb');

    function pathToRoot(id) {
      const out = []; let cur = byId3d[id];
      while (cur && cur.parent) { out.push(cur.id); cur = byId3d[cur.parent]; }
      return out;
    }

    function buildNodes() {
      nodes3d = NS.scp3d.layout3d(programList);
      byId3d = {};
      nodes3d.forEach(function (n) { byId3d[n.id] = n; });
      nodesEl.innerHTML = '';
      nodeEls.clear();
      nodes3d.forEach(function (n) {
        const el = doc.createElement('div');
        el.className = 't3-node t3-node--' + n.type + (n.locked ? ' is-locked' : '') + (n.badge ? ' is-new' : '');
        el.style.opacity = '0';
        const iconSvg = NS.iconSvgFor ? NS.iconSvgFor({ isConsole: n.isConsole, type: n.type, icon: n.icon }) : '';
        el.innerHTML = '<span class="t3-node-core">' + iconSvg + '</span><span class="t3-node-label">' + esc(n.label) + '</span>' +
          (n.badge ? '<span class="t3-node-new">NEW</span>' : '');
        // Hovering a node "focuses" it — it glides to the front and stays
        // focused after the cursor leaves, until its dwell elapses (see frame).
        el.addEventListener('mouseenter', function () { focusId = n.id; focusReachedAt = 0; });
        if (n.isConsole) {
          el.addEventListener('click', openConsole);
        } else if (n.programId) {
          el.addEventListener('click', function () {
            el.classList.add('is-fire'); setTimeout(function () { el.classList.remove('is-fire'); }, 140);
            launch(n.programId);
          });
        }
        nodesEl.appendChild(el);
        nodeEls.set(n.id, el);
      });
      if (!revealStart) revealStart = now3d();
    }

    function cssColor(name, fallback) {
      const v = view.getComputedStyle(rootEl).getPropertyValue(name).trim();
      return v || fallback;
    }

    function renderFrame() {
      rafId = 0;
      if (destroyed) return;
      const t = now3d();
      let yawEase = YAW_EASE;
      if (focusId && byId3d[focusId]) {
        // Focused node glides to the front, lingers centre-stage a beat, then
        // releases so the idle drift carries on — no constant hovering needed.
        yawEase = FOCUS_EASE;            // slower, more cinematic than scroll/scrubber
        const fy = frontYawFor(focusId);
        if (fy !== null) targetYaw = aimAt(fy);
        pitchTarget = PITCH_BASE;
        const centred = (fy === null) || Math.abs(shortestAngle(cam.yaw, fy)) < FOCUS_EPS;
        if (centred) {
          if (!focusReachedAt) focusReachedAt = t;
          else if (t - focusReachedAt > FOCUS_DWELL) focusId = null;
        } else {
          focusReachedAt = 0;
        }
      } else if (!reducedMotion && (t - lastInteract) > IDLE_MS) {
        // Idle: slow drift + up/down sweep.
        targetYaw += AUTO_SPIN;
        pitchTarget = PITCH_BASE + PITCH_AMP * Math.sin((t / PITCH_PERIOD) * Math.PI * 2);
      }
      cam.yaw += shortestAngle(cam.yaw, targetYaw) * yawEase;    // every input eases through here
      cam.pitch += (pitchTarget - cam.pitch) * 0.06;             // always smooth, no snaps

      const r = netEl.getBoundingClientRect();
      cam.cx = r.width / 2; cam.cy = r.height / 2;
      if (ctx2d) {
        if (canvasEl.width !== Math.round(r.width)) canvasEl.width = Math.round(r.width);
        if (canvasEl.height !== Math.round(r.height)) canvasEl.height = Math.round(r.height);
      }

      const proj = {};
      let minD = Infinity, maxD = -Infinity;
      for (let i = 0; i < nodes3d.length; i++) {
        const p = NS.scp3d.project(nodes3d[i], cam);
        proj[nodes3d[i].id] = p;
        if (p.depth < minD) minD = p.depth;
        if (p.depth > maxD) maxD = p.depth;
      }
      const span = (maxD > minD) ? (maxD - minD) : 1;
      const reveal = revealStart ? Math.max(0, Math.min(1, (t - revealStart) / 600)) : 1;

      nodeEls.forEach(function (el, id) {
        const p = proj[id]; if (!p) return;
        const s = Math.max(0.4, Math.min(1.7, p.scale));
        el.style.left = p.sx.toFixed(1) + 'px';
        el.style.top = p.sy.toFixed(1) + 'px';
        el.style.transform = 'translate(-50%,-50%) scale(' + s.toFixed(3) + ')';
        el.style.zIndex = String(2000 - Math.round(p.depth));
        const far = (p.depth - minD) / span;           // 0 near .. 1 far
        el.style.opacity = ((1 - far * 0.62) * reveal).toFixed(3);
        // Only foreground nodes are hoverable/clickable — keeps hovering a
        // barely-visible back node from swinging the whole cloud around.
        el.style.pointerEvents = (far < FRONT_FRAC) ? 'auto' : 'none';
        el.classList.toggle('is-focus', id === focusId);
      });

      if (ctx2d) {
        ctx2d.clearRect(0, 0, canvasEl.width, canvasEl.height);
        const fg = cssColor('--t3-fg', '#ffb000');
        const dim = cssColor('--t3-dim', '#4a3400');
        const hi = focusId ? pathToRoot(focusId) : null;
        const links = [];
        for (let i = 0; i < nodes3d.length; i++) {
          const n = nodes3d[i]; if (!n.parent) continue;
          const a = proj[n.parent], b = proj[n.id]; if (!a || !b) continue;
          links.push({ a: a, b: b, id: n.id, mid: (a.depth + b.depth) / 2 });
        }
        links.sort(function (l1, l2) { return l2.mid - l1.mid; });   // far first
        ctx2d.lineCap = 'round';
        links.forEach(function (l) {
          const far = (l.mid - minD) / span;
          const active = hi && hi.indexOf(l.id) !== -1;
          ctx2d.globalAlpha = (active ? 1 : (1 - far * 0.7)) * reveal;
          ctx2d.strokeStyle = active ? fg : dim;
          ctx2d.lineWidth = active ? 2.4 : 1.4;
          ctx2d.beginPath();
          ctx2d.moveTo(l.a.sx, l.a.sy);
          ctx2d.lineTo(l.b.sx, l.b.sy);
          ctx2d.stroke();
        });
        ctx2d.globalAlpha = 1;
      }

      if (thumbEl) {
        let frac = (cam.yaw / (Math.PI * 2)) % 1; if (frac < 0) frac += 1;
        thumbEl.style.left = (frac * 100).toFixed(1) + '%';
      }
      if (view.requestAnimationFrame) rafId = view.requestAnimationFrame(renderFrame);
    }

    function startLoop() {
      if (rafId || destroyed || !view.requestAnimationFrame) return;
      rafId = view.requestAnimationFrame(renderFrame);
    }

    // Wheel over the map spins the turntable — nudges the target so it eases.
    function onWheel(ev) {
      ev.preventDefault();
      targetYaw += ev.deltaY * 0.0022;
      focusId = null;
      noteInteract();
    }
    netEl.addEventListener('wheel', onWheel, { passive: false });

    // HUD scrubber: drag to set yaw directly.
    let scrubbing = false;
    function yawFromClientX(clientX) {
      if (!trackEl) return;
      const r = trackEl.getBoundingClientRect();
      let frac = (clientX - r.left) / Math.max(1, r.width);
      frac = Math.max(0, Math.min(1, frac));
      targetYaw = aimAt(frac * Math.PI * 2);   // cam eases toward it -> smooth bar
      focusId = null;
      noteInteract();
    }
    function onScrubDown(ev) { scrubbing = true; yawFromClientX(ev.clientX); try { trackEl.setPointerCapture(ev.pointerId); } catch (e) {} }
    function onScrubMove(ev) { if (scrubbing) yawFromClientX(ev.clientX); }
    function onScrubUp(ev) { scrubbing = false; try { trackEl.releasePointerCapture(ev.pointerId); } catch (e) {} }
    if (trackEl) {
      trackEl.addEventListener('pointerdown', onScrubDown);
      trackEl.addEventListener('pointermove', onScrubMove);
      trackEl.addEventListener('pointerup', onScrubUp);
      trackEl.addEventListener('pointercancel', onScrubUp);
    }

    // ── Boot overlay (SCiPnet hijack) ──────────────────────────────
    // Authentic SCiPNET secure login → glitch/breach → KATIE//ROOT override →
    // network online. Implements the tier-3 boot `view` contract; done() brings
    // the topology online (staggered node power-on via the .is-online class).
    function buildBootOverlay() {
      const ov = doc.createElement('div');
      ov.className = 't3-boot';
      ov.innerHTML = '<div class="t3-boot-out"></div>';
      rootEl.appendChild(ov);
      const outEl = ov.querySelector('.t3-boot-out');
      let glitchTimer = null;
      return {
        el: ov,
        // Type the line out one tick at a time (v1 BIOS typewriter). Resolves
        // when fully revealed; instant / a live skip() flush the rest at once.
        line: function (t, o) {
          o = o || {};
          const text = String(t);
          const cls = o.cls;
          const row = doc.createElement('div');
          row.className = 't3-boot-line' + (cls === 'danger' ? ' is-danger' : (cls === 'ok' ? ' is-ok' : ''));
          outEl.appendChild(row);
          const delay = (o.charDelay != null) ? o.charDelay : NS.shells.tier3.bootCharDelayMs;
          const step = (o.charsPerTick > 0) ? o.charsPerTick : (NS.shells.tier3.bootCharsPerTick > 0 ? NS.shells.tier3.bootCharsPerTick : 1);
          const skip = function () { return destroyed || (o.skip && o.skip()); };
          return new Promise(function (resolve) {
            if (o.instant || !(delay > 0) || skip()) {
              row.textContent = text; outEl.scrollTop = outEl.scrollHeight; resolve(); return;
            }
            row.classList.add('is-typing');
            let i = 0;
            (function tick() {
              if (skip()) { row.textContent = text; row.classList.remove('is-typing'); outEl.scrollTop = outEl.scrollHeight; resolve(); return; }
              i += step;
              row.textContent = text.slice(0, i);
              outEl.scrollTop = outEl.scrollHeight;
              if (i >= text.length) { row.classList.remove('is-typing'); resolve(); return; }
              setTimeout(tick, delay);
            })();
          });
        },
        glitch: function () {
          ov.classList.remove('is-glitch');
          void ov.offsetWidth;            // reflow so the animation restarts
          ov.classList.add('is-glitch');
          if (glitchTimer) clearTimeout(glitchTimer);
          glitchTimer = setTimeout(function () { ov.classList.remove('is-glitch'); }, 400);
        },
        breach: function (on) { rootEl.classList.toggle('theme-breach', !!on); },
        alive: function () { return !destroyed && ov.isConnected; },
        done: function () {
          if (glitchTimer) clearTimeout(glitchTimer);
          rootEl.classList.remove('theme-breach');
          if (netEl) netEl.classList.add('is-online');     // staggered node power-on
          ov.classList.add('is-done');
          setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 260);
        },
      };
    }

    // Play the hijack boot, THEN reveal the live topology + run any auto-launch.
    // Any key / pointer fast-forwards.
    const bootView = buildBootOverlay();
    let bootSkipped = false;
    function onBootKey() { bootSkipped = true; }
    bootView.el.addEventListener('pointerdown', onBootKey);
    doc.addEventListener('keydown', onBootKey, true);
    const whenBooted = (NS.boot && NS.boot.tier3
        ? NS.boot.tier3.run(bootView, { skip: function () { return bootSkipped; }, instant: !!NS.shells.tier3.instantBoot })
        : Promise.resolve().then(function () { bootView.done(); }))
      .then(function () {
        doc.removeEventListener('keydown', onBootKey, true);
        if (!destroyed && host.autoRun) launch(host.autoRun);
      });

    return {
      onPrograms: function (entries) {
        programList = entries || [];
        buildNodes();
        startLoop();
        if (consoleRef) consoleRef.onPrograms(programList);
      },
      whenBooted: whenBooted,
      destroy: function () {
        destroyed = true;
        if (rafId && view.cancelAnimationFrame) view.cancelAnimationFrame(rafId);
        netEl.removeEventListener('wheel', onWheel);
        doc.removeEventListener('keydown', onBootKey, true);
        clearInterval(clockTimer); clearInterval(teleTimer);
        closeAllWindows();
        container.innerHTML = '';
      },
    };
  }

  // charDelay/charsPerTick drive the console typewriter; bootCharDelay/bootCharsPerTick
  // drive the hijack boot overlay (read live, so tests can zero them).
  NS.shells.tier3 = { create: create, charDelayMs: 6, charsPerTick: 3, bootCharDelayMs: 8, bootCharsPerTick: 3, instantBoot: false };
})(window);
