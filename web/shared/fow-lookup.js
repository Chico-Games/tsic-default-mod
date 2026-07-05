// Fog-of-war hover lookup, shared by the live map (shared/screens/map.js) and
// the standalone map page (screens/map.html). Mirrors the C++ parity encoding
// in FFogOfWarGridState::GetValue: each explored row stores ascending "flip
// points" (integer columns); a cell at column X is explored iff an odd number
// of flips are <= X. Row Y and column X come from world coords as the C++
// UpdateExploredArea does it:
//   X = floor(worldX / CellSize)   (CenterX from PlayerPos.X)
//   Y = floor(worldY / CellSize)   (CenterY from PlayerPos.Y)
//
// Pure data only (no DOM), so it unit-tests cleanly and loads under node.
(function (root) {
  // Build a fast-lookup grid from the UI.Map.FowGrid bridge payload (PascalCase
  // fields, like the other map messages). Returns null when the payload is
  // unusable, which callers treat as "no fog data" -> fail open (never suppress).
  function build(p) {
    if (!p || !(p.CellSize > 0)) return null;
    const rows = new Map();
    const lines = Array.isArray(p.Lines) ? p.Lines : [];
    for (const ln of lines) {
      if (!ln || !Array.isArray(ln.Flips) || ln.Flips.length === 0) continue;
      rows.set(ln.Y | 0, ln.Flips);
    }
    return { gridSize: p.GridSize | 0, cellSize: p.CellSize, rows };
  }

  // True when (worldX, worldY) is explored. Fail-open: a missing/empty grid is
  // treated as explored so the hover panel never disappears when fog data
  // hasn't arrived yet (or fog of war is disabled).
  function exploredAt(grid, wx, wy) {
    if (!grid || !(grid.cellSize > 0)) return true;
    const fx = Math.floor(wx / grid.cellSize);
    const fy = Math.floor(wy / grid.cellSize);
    const flips = grid.rows.get(fy);
    if (!flips || flips.length === 0) return false; // row was never explored
    let count = 0;
    for (let i = 0; i < flips.length; i++) {
      if (flips[i] > fx) break;
      count++;
    }
    return (count % 2) === 1;
  }

  const TSICFow = { build, exploredAt };
  if (root) root.TSICFow = TSICFow;
  if (typeof module !== 'undefined' && module.exports) module.exports = TSICFow;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
