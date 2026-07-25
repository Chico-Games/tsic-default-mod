// shared/terminal/scp3d.js
//
// Pure 3D helpers for the tier-3 "SCiPnet" volumetric topology: a radial layout
// that places ROOT + program/folder nodes in 3D space, and a turntable camera
// projection (yaw spin + a fixed downward pitch + perspective). No DOM, no time,
// no deps — the tier-3 shell owns the canvas / DOM nodes / render loop; this
// module is just the math, so it stays unit-testable like boot.js / console-core.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};

  const R1 = 165;   // top-level ring radius (root programs + folder anchors)
  const R2 = 95;    // folder-child offset out from its anchor's ring
  const Y1 = 28;    // top-level height stagger (alternating)
  const Y2 = 20;    // folder-child height stagger
  const FAN = 0.52; // angular spread of a folder's children around its anchor

  // Build the node cloud from the program manifest. Mirrors the 2D topology
  // hierarchy (ROOT -> root programs + folder anchors -> foldered children) but
  // lays it out radially in the X/Z plane so a yaw turntable reveals depth.
  function layout3d(programList) {
    // ROOT is just the network hub everything links to; the SCiPnet shell is a
    // first-class TERMINAL node on the ring — one program among the others.
    const nodes = [{ id: 'root', label: 'ROOT_NODE', type: 'anchor', x: 0, y: 0, z: 0, parent: null }];
    const roots = [], folders = new Map();
    (programList || []).forEach(function (e) {
      const f = e.program.folder;
      if (f) { if (!folders.has(f)) folders.set(f, []); folders.get(f).push(e); return; }
      roots.push(e);
    });
    const top = [{ kind: 'terminal' }];
    roots.forEach(function (e) { top.push({ kind: 'prog', e: e }); });
    folders.forEach(function (entries, name) { top.push({ kind: 'folder', name: name, entries: entries }); });
    const n = Math.max(top.length, 1);
    top.forEach(function (item, i) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * R1, z = Math.sin(a) * R1;
      const y = ((i % 2) ? 1 : -1) * Y1;
      if (item.kind === 'terminal') {
        nodes.push({ id: 'terminal', label: 'TERMINAL', type: 'file', x: x, y: y, z: z, parent: 'root', isConsole: true });
        return;
      }
      if (item.kind === 'prog') {
        nodes.push({ id: 'p:' + item.e.program.id, label: item.e.program.name, type: 'file', x: x, y: y, z: z, parent: 'root', programId: item.e.program.id, icon: item.e.program.icon, badge: item.e.badge, locked: item.e.locked });
        return;
      }
      const anchorId = 'g:' + item.name;
      const anyNew = item.entries.some(function (c) { return c.badge; });
      nodes.push({ id: anchorId, label: item.name, type: 'anchor', x: x, y: y, z: z, parent: 'root', badge: anyNew ? 'NEW' : null });
      const m = Math.max(item.entries.length, 1);
      item.entries.forEach(function (c, j) {
        const b = a + (j - (m - 1) / 2) * FAN;
        const cx = Math.cos(b) * (R1 + R2), cz = Math.sin(b) * (R1 + R2);
        const cy = y + ((j % 2) ? 1 : -1) * Y2;
        nodes.push({ id: 'p:' + c.program.id, label: c.program.name, type: 'file', x: cx, y: cy, z: cz, parent: anchorId, programId: c.program.id, icon: c.program.icon, badge: c.badge, locked: c.locked });
      });
    });
    return nodes;
  }

  // Default turntable camera. The shell mutates `yaw` (drag/scroll/auto-spin) and
  // sets cx/cy to the canvas centre each frame.
  function defaultCamera() {
    return { yaw: 0, pitch: -0.34, dist: 560, focal: 560, cx: 0, cy: 0 };
  }

  // Project a world point to screen space. Returns sx/sy (px), scale (depth size
  // factor: nearer = larger) and depth (camera-space distance; larger = farther,
  // used for painter's-order sort + atmospheric fade).
  function project(p, cam) {
    const cyaw = Math.cos(cam.yaw), syaw = Math.sin(cam.yaw);
    const x = p.x * cyaw + p.z * syaw;      // rotate around vertical (Y) axis
    const z = -p.x * syaw + p.z * cyaw;
    const cpit = Math.cos(cam.pitch), spit = Math.sin(cam.pitch);
    const y2 = p.y * cpit - z * spit;       // rotate around X (fixed pitch)
    const z2 = p.y * spit + z * cpit;
    const depth = cam.dist + z2;
    const scale = cam.focal / Math.max(depth, 1);
    return { sx: cam.cx + x * scale, sy: cam.cy + y2 * scale, scale: scale, depth: depth };
  }

  NS.scp3d = { layout3d: layout3d, project: project, defaultCamera: defaultCamera, R1: R1, R2: R2 };
})(window);
