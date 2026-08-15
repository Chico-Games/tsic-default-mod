// Grid renderer + Minecraft-style cursor ("held stack") engine for the
// inventory and storage screens. Reads display data from tsic.itemCatalog.
//
// THE CURSOR MODEL (grid design §6): the held stack is CLIENT-SIDE VISUAL
// STATE ONLY. Picking up renders a ghost and dims the source cell; the item
// never leaves its cell server-side until a gesture commits as ONE atomic op
// (UI.Cmd.Inventory.Move / QuickMove / Collect / DropFromSlot — all id+slot
// addressed so concurrent edits reject as stale and the grid resyncs).
// Click–move–click and press–drag–release are the same gesture with
// different timing. Closing the screen with a held stack returns it (nothing
// ever moved).
//
// Depends on: shared/dom.js (TSIC.el), shared/icons.js (TSIC.itemIconUrl,
// TSIC.iconImg), shared/tsic-runtime.js (tsic.publishMessage/playSound)
(function(){
    var el = TSIC.el;

    var DRAG_THRESHOLD_PX = 6;
    var suppressClickUntil = 0;

    // The hotbar is the player grid's first HOTBAR_SLOTS cells. Nothing is "assigned" to it —
    // an item is on the bar because it is sitting in one of those cells. C++ owns the real
    // number and ships it on UI.Hotbar.Changed; this is the fallback for a cold render.
    //
    // Every panel that shows the bag draws those cells as a SEPARATE STRIP along the bottom of
    // the bag column (opts.endSlot), with the bag grid above starting after them
    // (opts.startSlot). Minecraft's layout: one row, set slightly apart, edited in the same
    // panel as everything else. The HUD bar is a read-only mirror of the same cells and is
    // never an editing surface — it sits under the screen overlay while a panel is open.
    var HOTBAR_SLOTS = 8;

    // Locked-preview region (grid design §10.1) — UI-ONLY grey "Requires backpack" cells that
    // fill the bag out to the tier the game ships, so a backpack upgrade is a visible unlock
    // rather than a silent number.
    //
    // THE BAG IS ALWAYS PREVIEW_TIER_SLOTS CELLS. Live + locked is a constant, so the grid is
    // the same six rows whatever the player is carrying: equipping a backpack turns grey cells
    // live, and nothing resizes, reflows or moves. That is the whole point — a bag that
    // changed shape as it upgraded made the panel jump under the player's hands.
    //
    // Shared, because EVERY surface that draws the bag has to draw the same one. Storage used
    // to omit these entirely, so opening a crate shortened the bag by two rows.
    var PREVIEW_TIER_SLOTS = 48;
    function lockedPreviewFor(slotCount) {
        var live = slotCount > 0 ? slotCount : 0;
        return Math.max(0, PREVIEW_TIER_SLOTS - live);
    }

    function publish(tag, payload) {
        if (window.tsic && window.tsic.publishMessage) window.tsic.publishMessage(tag, payload);
    }
    function sound(key, vol) {
        if (window.tsic && window.tsic.playSound) tsic.playSound(key, vol);
    }

    function injectCursorStyleOnce() {
        if (document.getElementById('tsic-grid-drag-style')) return;
        var s = document.createElement('style');
        s.id = 'tsic-grid-drag-style';
        s.textContent = [
            // Sits just under a grid slot. The ghost lives on <body>, outside any screen,
            // and reads the one global --tsic-slot every grid is sized from — so it matches
            // whichever screen the gesture started in without a per-screen override.
            '.tsic-drag-ghost {',
            '  position:fixed; z-index:2000;',
            '  width:calc(var(--tsic-slot) - 4px); height:calc(var(--tsic-slot) - 4px);',
            '  pointer-events:none; opacity:0.92; padding:4px;',
            '  background: rgba(241,229,207,0.92); border:2px solid rgba(10,10,10,0.85);',
            '  box-shadow: 3px 3px 0 rgba(10,10,10,0.85);',
            '}',
            '.tsic-drag-ghost .held-count {',
            '  position:absolute; right:1px; bottom:1px; padding:1px 3px; line-height:1;',
            '  font-size:10px; font-weight:700; color:#1a1612; background:#ffcc00;',
            '  border:1px solid rgba(10,10,10,0.85);',
            '}',
            // Outside the screen panel: releasing/clicking here drops into the world.
            '.tsic-drag-ghost--out {',
            '  border-color:#b91c1c;',
            '  box-shadow: 3px 3px 0 rgba(185,28,28,0.6);',
            '}',
            '.tsic-drag-ghost--out::after {',
            '  content:"DROP"; position:absolute; left:50%; bottom:-16px;',
            '  transform:translateX(-50%); font-size:9px; font-weight:700;',
            '  letter-spacing:1px; color:#f6efdf; background:rgba(185,28,28,0.92);',
            '  padding:1px 5px; border-radius:6px;',
            '}',

            // ---- Per-cell overlays (shared by every pane that renders a grid) ----
            // Wear bar sits flush along the cell's bottom edge so it reads as a
            // property of the item rather than another badge competing for a corner.
            '.tsic-slot .wear {',
            '  position:absolute; left:2px; right:2px; bottom:1px; height:3px;',
            '  background:rgba(10,10,10,0.35); pointer-events:none;',
            '}',
            '.tsic-slot .wear i { display:block; height:100%; background:#1e8f3e; }',
            '.tsic-slot .wear.warn i { background:#ffcc00; }',
            '.tsic-slot .wear.crit i { background:#e60000; }',
            // "New since you last looked" — cleared when the stack is hovered.
            // Top-CENTRE: the four corners are already taken (equipped, hotbar
            // number, stack count, lock) and an item can be new and equipped at once.
            '.tsic-slot .new-badge {',
            '  position:absolute; top:1px; left:50%; transform:translateX(-50%);',
            '  padding:1px 3px; line-height:1; font-size:8px; font-weight:700;',
            '  letter-spacing:0.06em; color:#1a1612;',
            '  background:#7fd4a2; border:1px solid rgba(10,10,10,0.85); pointer-events:none;',
            '}',

            // ---- Split dialog ----
            // `-dialog` is load-bearing. This was `.tsic-split`, which is ALSO the shared
            // panel scaffold in tsic-ui.css — the two-column body every station screen
            // mounts (crafting, production, shop, boss summoner) via recipe-station.js.
            // These rules are global and unscoped, and this sheet is injected the first time
            // a grid renders, i.e. the first time the player opens their bag. From that
            // moment every station panel's body inherited `position:fixed` from a dialog it
            // has nothing to do with: out of flow, sized to its content, escaping the panel's
            // overflow:hidden. The recipe list stopped being clipped or scrolled and simply
            // ran down the screen — issue #228's "there STILL isn't a scroll bar when there
            // are too many recipes, its just extending it down", which reproduced only after
            // visiting the inventory and so looked like a crafting bug. Any new global class
            // here needs a name nothing in tsic-ui.css claims.
            '.tsic-split-dialog {',
            '  position:fixed; z-index:2100; min-width:190px; padding:9px 11px;',
            '  background:#fffdf3; border:2px solid rgba(10,10,10,0.85);',
            '  box-shadow:4px 4px 0 rgba(10,10,10,0.85); font-size:12px; color:#1a1612;',
            '}',
            '.tsic-split-dialog .row { display:flex; align-items:center; gap:6px; margin-top:6px; }',
            '.tsic-split-dialog .lab { font-size:10px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.7; }',
            '.tsic-split-dialog input[type=range] { flex:1; min-width:0; accent-color:#e60000; }',
            '.tsic-split-dialog input[type=number] {',
            '  width:58px; font:inherit; padding:1px 4px; text-align:center;',
            '  background:#fffdf3; border:2px solid rgba(10,10,10,0.85); color:inherit;',
            '}',
            '.tsic-split-dialog button {',
            '  font:inherit; font-size:11px; letter-spacing:0.08em; cursor:pointer; padding:2px 9px;',
            '  background:#fffdf3; border:2px solid rgba(10,10,10,0.85); color:inherit;',
            '}',
            '.tsic-split-dialog button.go { background:var(--mag-red,#e60000); color:#fff; }',
            '.tsic-split-dialog button:hover { filter:brightness(1.08); }',
        ].join('\n');
        document.head.appendChild(s);
    }

    // ---- Freshly-arrived stacks -------------------------------------------
    // Instance ids seen in the last snapshot per owner. Anything in a new
    // snapshot that wasn't in the previous one is "new" until the player hovers
    // it, which is the cheap version of a pickup log: you can tell at a glance
    // what the last container actually gave you.
    var seenByOwner = new Map();   // ownerId -> Set(instanceId)
    var freshByOwner = new Map();  // ownerId -> Set(instanceId)

    function noteSnapshot(ownerId, items) {
        var current = new Set();
        for (var i = 0; i < (items || []).length; i++) {
            var it = items[i];
            if (it && it.InstanceId != null) current.add(String(it.InstanceId));
        }
        var previous = seenByOwner.get(ownerId);
        var fresh = freshByOwner.get(ownerId) || new Set();
        // First snapshot of a pane is the baseline, not a pile of new items.
        if (previous) {
            current.forEach(function (id) { if (!previous.has(id)) fresh.add(id); });
        }
        // Stop tracking ids that have left.
        fresh.forEach(function (id) { if (!current.has(id)) fresh.delete(id); });
        seenByOwner.set(ownerId, current);
        freshByOwner.set(ownerId, fresh);
    }
    function isFresh(ownerId, instanceId) {
        var fresh = freshByOwner.get(ownerId);
        return !!(fresh && instanceId != null && fresh.has(String(instanceId)));
    }
    function clearFresh(ownerId, instanceId) {
        var fresh = freshByOwner.get(ownerId);
        if (fresh && instanceId != null) fresh.delete(String(instanceId));
    }

    // ---- Held-stack state --------------------------------------------------
    // held = { ownerId, instanceId, itemId, fromSlot, count, sourceCount, iconUrl }
    var held = null;
    var ghostEl = null;
    var ghostFollowing = false;
    // Registered grid hosts, so held-source dimming and reconciliation can
    // reach every visible pane: host -> paneCtx (see renderGrid).
    var panes = new Set();

    function ghostShow(x, y) {
        injectCursorStyleOnce();
        if (!ghostEl) {
            ghostEl = document.createElement('div');
            ghostEl.className = 'tsic-drag-ghost';
            document.body.appendChild(ghostEl);
        }
        ghostEl.innerHTML = '';
        if (held && held.itemId) {
            var img = TSIC.iconImg(TSIC.itemIconUrl(held.itemId));
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
            ghostEl.appendChild(img);
        }
        if (held && held.count > 1) {
            ghostEl.appendChild(el('span', { class: 'held-count' }, String(held.count)));
        }
        if (x != null) ghostPosition({ clientX: x, clientY: y });
        if (!ghostFollowing) {
            document.addEventListener('pointermove', ghostPosition, true);
            ghostFollowing = true;
        }
    }
    function ghostPosition(ev) {
        if (!ghostEl) return;
        ghostEl.style.left = (ev.clientX - 24) + 'px';
        ghostEl.style.top = (ev.clientY - 24) + 'px';
        var overCell = !!cellUnder(ev.clientX, ev.clientY);
        ghostEl.classList.toggle('tsic-drag-ghost--out', !overCell && outsideEveryPane(ev));
    }
    function ghostHide() {
        if (ghostFollowing) {
            document.removeEventListener('pointermove', ghostPosition, true);
            ghostFollowing = false;
        }
        if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    }

    function outsideEveryPane(ev) {
        var anyBounds = false;
        for (var pane of panes) {
            var boundsEl = pane.panelEl || pane.host;
            if (!boundsEl || !boundsEl.isConnected) continue;
            anyBounds = true;
            var r = boundsEl.getBoundingClientRect();
            if (ev.clientX >= r.left && ev.clientX <= r.right &&
                ev.clientY >= r.top && ev.clientY <= r.bottom) return false;
        }
        return anyBounds;
    }

    function cellUnder(x, y) {
        var target = document.elementFromPoint(x, y);
        return target ? target.closest('.tsic-slot, .equip-slot') : null;
    }

    function refreshHeldSourceVisual() {
        for (var pane of panes) {
            if (!pane.host || !pane.host.isConnected) continue;
            for (var cell of pane.host.querySelectorAll('.tsic-slot')) {
                var isSource = !!(held && pane.ownerId === held.ownerId &&
                    Number(cell.dataset.grid) === held.fromSlot);
                cell.classList.toggle('is-held-source', isSource);
                // :not(.ammo) — the HUD bar's ammo readout also lives in a .count, and
                // rewriting it with a stack remainder would blank the loaded/spare figure.
                var badge = cell.querySelector('.count:not(.ammo)');
                if (isSource && badge) {
                    var remaining = held.sourceCount - held.count;
                    badge.textContent = remaining > 0 ? String(remaining) : '';
                    badge.style.visibility = remaining > 1 ? 'visible' : 'hidden';
                }
            }
        }
    }

    // Screens re-render their hint rows (and anything else held-dependent)
    // through this hook — fired on every pickup, commit, and cancel.
    var heldChangedCallbacks = [];
    function notifyHeldChanged() {
        for (var cb of heldChangedCallbacks) {
            try { cb(held); } catch (e) { /* listener errors never break gestures */ }
        }
    }

    // Same-cell release returns the stack — but DELAYED, so the second click
    // of a double-click (collect) can rescue the hold first.
    var pendingSameCellCancel = null;
    function clearPendingCancel() {
        if (pendingSameCellCancel) {
            clearTimeout(pendingSameCellCancel);
            pendingSameCellCancel = null;
        }
    }

    function pickUp(pane, item, cellIndex, count, ev) {
        clearPendingCancel();
        held = {
            ownerId: pane.ownerId,
            instanceId: item.InstanceId,
            itemId: item.ItemId,
            fromSlot: cellIndex,
            count: count,
            sourceCount: item.Count || 1,
        };
        ghostShow(ev && ev.clientX, ev && ev.clientY);
        refreshHeldSourceVisual();
        sound('Inventory.Pickup', 0.35);
        notifyHeldChanged();
    }

    function cancelHeld() {
        clearPendingCancel();
        if (!held) return;
        held = null;
        ghostHide();
        refreshHeldSourceVisual();
        notifyHeldChanged();
    }

    function heldCountArg() {
        // Whole-stack holds send Count 0 (server clamps live); partials send
        // the exact count (split-merge semantics server-side).
        return held.count >= held.sourceCount ? 0 : held.count;
    }

    // Commit the held stack onto a grid cell (one atomic id+slot-addressed op).
    function commitHeldToCell(targetPane, cellIndex) {
        if (!held) return;
        if (targetPane.ownerId === held.ownerId && cellIndex === held.fromSlot) {
            // Release over the source = return the stack — delayed so a
            // double-click (collect) can rescue the hold first.
            clearPendingCancel();
            pendingSameCellCancel = setTimeout(function () {
                pendingSameCellCancel = null;
                sound('Inventory.Drag.Return', 0.3);
                cancelHeld();
            }, 300);
            return;
        }
        // Landing on an occupied cell of the same item is a merge, not a move —
        // resolved before publishing because the broadcast re-renders the grid.
        var existing = targetPane.itemAt ? targetPane.itemAt(cellIndex) : null;
        var bMerge = !!(existing && existing.ItemId === held.itemId);
        publish('UI.Cmd.Inventory.Move', {
            FromOwnerId: held.ownerId, ToOwnerId: targetPane.ownerId,
            ItemId: held.instanceId, FromSlot: held.fromSlot,
            ToSlot: cellIndex, Count: heldCountArg(),
        });
        sound(bMerge ? 'Inventory.Stack' : 'Inventory.Transfer', 0.33);
        cancelHeld();
    }

    // ---- Global held-gesture tracker ---------------------------------------
    // Once a stack is held, EVERY left press-release commits at the release
    // point — cell, doll slot, hotbar (via its own click handler), or the
    // world (outside every pane). This is what makes click-move-click and
    // press-drag-release the same gesture even when the pickup happened on an
    // earlier click; without it a press-drag while holding dead-ends (the
    // browser fires no click when press and release land on different cells).
    var heldRelease = null; // armed by pointerdown while holding

    // ---- Drag-distribute (§6 P2) -------------------------------------------
    // While holding, an LMB press-drag sweeps up valid cells (empty or same
    // item, never the source) and the release splits the held count EVENLY
    // across them (remainder stays on the cursor). An RMB drag places ONE per
    // new cell swept — the same op as right-click place-one, per cell.
    var distributeTrail = null; // ordered unique sweep cells while LMB is down
    var rmbSweepPlaced = null;  // keys given one this RMB sweep (contextmenu dedup)

    function distributeTargetAt(x, y) {
        var t = cellUnder(x, y);
        if (!t || !t.classList.contains('tsic-slot') || t.classList.contains('is-locked')) return null;
        var hostEl = t.closest('[data-tsic-grid-host]');
        var pane = hostEl && hostEl._tsicPane;
        var index = t.dataset ? parseInt(t.dataset.grid, 10) : NaN;
        if (!pane || Number.isNaN(index)) return null;
        if (pane.ownerId === held.ownerId && index === held.fromSlot) return null;
        var item = pane.itemAt ? pane.itemAt(index) : null;
        if (item && item.ItemId !== held.itemId) return null;
        return { pane: pane, index: index, key: pane.ownerId + ':' + index };
    }

    /** Consume an RMB-sweep placement so the release's contextmenu doesn't
     *  place a second unit on the same cell. */
    function rmbSweepTake(pane, cellIndex) {
        if (!rmbSweepPlaced) return false;
        var key = pane.ownerId + ':' + cellIndex;
        if (!rmbSweepPlaced[key]) return false;
        delete rmbSweepPlaced[key];
        return true;
    }

    document.addEventListener('pointerdown', function (e) {
        if (!held) return;
        if (e.button === 2) {
            rmbSweepPlaced = {};
            return;
        }
        if (e.button !== 0) return;
        heldRelease = { x: e.clientX, y: e.clientY };
        distributeTrail = [];
        var first = distributeTargetAt(e.clientX, e.clientY);
        if (first) distributeTrail.push(first);
    }, true);
    document.addEventListener('pointermove', function (e) {
        if (!held) return;
        if (distributeTrail && (e.buttons & 1)) {
            var t = distributeTargetAt(e.clientX, e.clientY);
            if (t && !distributeTrail.some(function (c) { return c.key === t.key; })) {
                distributeTrail.push(t);
            }
        }
        if (e.buttons & 2) {
            if (!rmbSweepPlaced) rmbSweepPlaced = {};
            var r = distributeTargetAt(e.clientX, e.clientY);
            if (r && !rmbSweepPlaced[r.key]) {
                rmbSweepPlaced[r.key] = 1;
                placeOneToCell(r.pane, r.index);
            }
        }
    }, true);
    /** Release half of drag-distribute: split the held count evenly across the
     *  swept cells. Returns true when the release was consumed. */
    function tryDistributeRelease() {
        var trail = distributeTrail;
        distributeTrail = null;
        if (!held || !trail || trail.length < 2) return false;
        var share = Math.floor(held.count / trail.length);
        if (share < 1) return false;
        for (var c of trail) {
            publish('UI.Cmd.Inventory.Move', {
                FromOwnerId: held.ownerId, ToOwnerId: c.pane.ownerId,
                ItemId: held.instanceId, FromSlot: held.fromSlot,
                ToSlot: c.index, Count: share,
            });
        }
        sound('Inventory.Transfer', 0.33);
        suppressClickUntil = Date.now() + 200;
        var remainder = held.count - share * trail.length;
        if (remainder <= 0) {
            cancelHeld();
        } else {
            held.count = remainder;
            ghostShow();
            refreshHeldSourceVisual();
            notifyHeldChanged();
        }
        return true;
    }

    document.addEventListener('pointerup', function (e) {
        if (!heldRelease) return;
        heldRelease = null;
        if (!held || e.button !== 0) return;
        if (tryDistributeRelease()) return;
        var t = cellUnder(e.clientX, e.clientY);
        if (t && t.classList.contains('equip-slot')) {
            if (t._tsicEquipDrop) {
                var payload = { instanceId: held.instanceId, ownerId: held.ownerId };
                cancelHeld();
                suppressClickUntil = Date.now() + 200;
                sound('Inventory.Equip', 0.45);
                t._tsicEquipDrop(payload);
            } else {
                sound('Inventory.Invalid', 0.4);
            }
            return;
        }
        var hostEl = t && t.closest('[data-tsic-grid-host]');
        var targetPane = hostEl && hostEl._tsicPane;
        var targetIndex = t && t.dataset ? parseInt(t.dataset.grid, 10) : NaN;
        if (targetPane && !Number.isNaN(targetIndex) && !t.classList.contains('is-locked')) {
            commitHeldToCell(targetPane, targetIndex);
            suppressClickUntil = Date.now() + 200;
            return;
        }
        if (outsideEveryPane(e)) {
            dropHeldAtPlayer(true);
            suppressClickUntil = Date.now() + 200;
        }
        // Inside a panel but not on anything droppable: keep holding.
    }, true);
    // RMB outside every pane while holding drops ONE (rule 31); on cells the
    // cell's own contextmenu handler places one.
    document.addEventListener('contextmenu', function (e) {
        if (!held) return;
        if (!cellUnder(e.clientX, e.clientY) && outsideEveryPane(e)) {
            e.preventDefault();
            dropHeldAtPlayer(false);
        }
    }, true);

    // RMB with a held stack: place ONE (independent atomic op per click).
    function placeOneToCell(targetPane, cellIndex) {
        if (!held || held.count <= 0) return;
        if (targetPane.ownerId === held.ownerId && cellIndex === held.fromSlot) return;
        publish('UI.Cmd.Inventory.Move', {
            FromOwnerId: held.ownerId, ToOwnerId: targetPane.ownerId,
            ItemId: held.instanceId, FromSlot: held.fromSlot,
            ToSlot: cellIndex, Count: 1,
        });
        sound('Inventory.Transfer', 0.2);
        held.count -= 1;
        if (held.count <= 0) { cancelHeld(); return; }
        ghostShow();
        refreshHeldSourceVisual();
        notifyHeldChanged();
    }

    function dropHeldAtPlayer(all) {
        if (!held) return;
        var count = all ? heldCountArg() : 1;
        publish('UI.Cmd.Inventory.DropFromSlot', {
            OwnerId: held.ownerId, ItemId: held.instanceId,
            Slot: held.fromSlot, Count: count,
        });
        sound('Inventory.Drop');
        if (all || held.count <= 1) { cancelHeld(); return; }
        held.count -= 1;
        ghostShow();
        refreshHeldSourceVisual();
        notifyHeldChanged();
    }

    // Rule 40: a broadcast arriving mid-gesture re-renders the grid but keeps
    // the ghost while its source entry still matches; a full-stack hold tracks
    // the entry's new count (double-click collect grows it), anything else
    // cancels so the gesture can't apply against unknown state.
    function reconcileHeld(ownerId, items) {
        if (!held || held.ownerId !== ownerId) return;
        var wasFullStack = held.count >= held.sourceCount;
        for (var it of (items || [])) {
            if (it && it.InstanceId === held.instanceId && it.GridSlot === held.fromSlot) {
                var entryCount = it.Count || 1;
                if (wasFullStack) {
                    held.count = entryCount;
                    held.sourceCount = entryCount;
                } else if (entryCount < held.count) {
                    cancelHeld();
                    return;
                } else {
                    held.sourceCount = entryCount;
                }
                ghostShow();
                return;
            }
        }
        cancelHeld(); // source entry moved or vanished — gesture dissolves
    }

    function clickSuppressed() {
        return Date.now() < suppressClickUntil;
    }

    // ---- Split dialog -----------------------------------------------------
    // RMB half-pickup handles the common case; this covers the one it can't —
    // peeling an exact amount off a large stack without repeated halving.
    // Publishes UI.Cmd.Inventory.Split (ToSlot -1 = first free cell).
    var splitEl = null;

    function closeSplit() {
        if (!splitEl) return;
        splitEl.remove();
        splitEl = null;
        document.removeEventListener('pointerdown', onSplitOutside, true);
        document.removeEventListener('keydown', onSplitKey, true);
    }
    function onSplitOutside(ev) {
        if (splitEl && !splitEl.contains(ev.target)) closeSplit();
    }
    function onSplitKey(ev) {
        if (!splitEl) return;
        if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); closeSplit(); return; }
        if (ev.key === 'Enter') { ev.stopPropagation(); ev.preventDefault(); splitEl._commit(); }
    }

    function openSplitDialog(pane, item, cellIndex, anchorEl) {
        var total = item.Count || 1;
        if (total < 2) return;
        closeSplit();
        cancelHeld();
        injectCursorStyleOnce();

        var start = Math.floor(total / 2);
        var box = el('div', { class: 'tsic-split-dialog' });
        var cat = (window.tsic && window.tsic.itemCatalog) || {};
        var name = (cat[item.ItemId] && cat[item.ItemId].Name) || item.ItemId || 'Stack';
        box.appendChild(el('div', { class: 'lab' }, 'Split ' + name));

        var range = el('input', { type: 'range', min: '1', max: String(total - 1), value: String(start) });
        var num = el('input', { type: 'number', min: '1', max: String(total - 1), value: String(start) });
        var rowA = el('div', { class: 'row' });
        rowA.appendChild(range);
        rowA.appendChild(num);
        box.appendChild(rowA);

        var keepLabel = el('span', { class: 'lab' }, '');
        var rowB = el('div', { class: 'row' });
        rowB.appendChild(keepLabel);
        box.appendChild(rowB);

        function clamp(v) {
            v = parseInt(v, 10);
            if (!Number.isFinite(v)) v = 1;
            return Math.max(1, Math.min(total - 1, v));
        }
        function sync(v, fromRange) {
            var c = clamp(v);
            if (fromRange) num.value = String(c); else range.value = String(c);
            keepLabel.textContent = 'Take ' + c + ' · leave ' + (total - c);
        }
        range.addEventListener('input', function () { sync(range.value, true); });
        num.addEventListener('input', function () { sync(num.value, false); });
        sync(start, true);

        box._commit = function () {
            var count = clamp(num.value);
            publish('UI.Cmd.Inventory.Split', {
                OwnerId: pane.ownerId, FromSlot: cellIndex, ToSlot: -1, Count: count,
            });
            sound('Inventory.Split', 0.4);
            closeSplit();
        };

        var rowC = el('div', { class: 'row' });
        var cancel = el('button', { type: 'button' }, 'Cancel');
        var go = el('button', { class: 'go', type: 'button' }, 'Split');
        cancel.addEventListener('click', closeSplit);
        go.addEventListener('click', function () { box._commit(); });
        rowC.appendChild(cancel);
        rowC.appendChild(go);
        box.appendChild(rowC);

        document.body.appendChild(box);
        splitEl = box;

        // Anchor to the cell, then pull back inside the viewport.
        var rect = anchorEl.getBoundingClientRect();
        var w = box.offsetWidth, h = box.offsetHeight;
        box.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, rect.right + 8)) + 'px';
        box.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, rect.top)) + 'px';

        num.focus();
        num.select();
        // Deferred so the opening gesture's own pointerdown doesn't close it.
        setTimeout(function () {
            document.addEventListener('pointerdown', onSplitOutside, true);
            document.addEventListener('keydown', onSplitKey, true);
        }, 0);
    }

    // ---- Hovered/focused cell ----------------------------------------------
    // hoverTarget is the mouse's current cell; gamepad falls back to focus.
    var hoverTarget = null;

    function targetCell() {
        if (hoverTarget && hoverTarget.item) return hoverTarget;
        var cell = document.querySelector('.tsic-slot[data-tsic-focused]');
        if (!cell || cell.classList.contains('is-locked')) return null;
        var host = cell.closest('[data-tsic-grid-host]');
        var pane = host && host._tsicPane;
        var cellIndex = cell.dataset ? parseInt(cell.dataset.grid, 10) : NaN;
        if (!pane || Number.isNaN(cellIndex)) return null;
        var item = pane.itemAt ? pane.itemAt(cellIndex) : null;
        return item ? { pane: pane, item: item, cellIndex: cellIndex, cell: cell } : null;
    }

    // ---- Doll drag (equipment paper doll -> grid) --------------------------
    // The doll keeps the simple pointer-drag: dragging a worn item into a grid
    // cell unequips + places it. Grid cells route through the cursor engine.
    function beginPointerDrag(sourceEl, payload, iconUrl, e, opts) {
        if (e.button !== 0) return;
        injectCursorStyleOnce();
        var startX = e.clientX, startY = e.clientY;
        var ghost = null, lastTarget = null;
        function onMove(ev) {
            if (!ghost) {
                var dx = ev.clientX - startX, dy = ev.clientY - startY;
                if ((dx * dx + dy * dy) < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
                sourceEl.classList.add('is-dragging');
                ghost = document.createElement('div');
                ghost.className = 'tsic-drag-ghost';
                if (iconUrl) {
                    var img = TSIC.iconImg(iconUrl);
                    img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
                    ghost.appendChild(img);
                }
                document.body.appendChild(ghost);
            }
            ghost.style.left = (ev.clientX - 24) + 'px';
            ghost.style.top = (ev.clientY - 24) + 'px';
            var t = cellUnder(ev.clientX, ev.clientY);
            if (lastTarget && lastTarget !== t) lastTarget.classList.remove('is-drop-target');
            if (t && t !== sourceEl) t.classList.add('is-drop-target');
            lastTarget = t;
        }
        function onUp(ev) {
            document.removeEventListener('pointermove', onMove, true);
            document.removeEventListener('pointerup', onUp, true);
            if (lastTarget) lastTarget.classList.remove('is-drop-target');
            if (!ghost) return; // plain click
            sourceEl.classList.remove('is-dragging');
            ghost.remove();
            suppressClickUntil = Date.now() + 150;
            var t = cellUnder(ev.clientX, ev.clientY);
            if (!t) return;
            if (t.classList.contains('equip-slot')) {
                if (t._tsicEquipDrop) t._tsicEquipDrop(payload);
                return;
            }
            var host = t.closest('[data-tsic-grid-host]');
            var cellIndex = t.dataset ? parseInt(t.dataset.grid, 10) : NaN;
            if (host && host._tsicPane && host._tsicPane.onDollDrop && !Number.isNaN(cellIndex)) {
                host._tsicPane.onDollDrop(payload, cellIndex);
            }
        }
        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
    }

    // ---- Pane registration + shared cell overlays --------------------------

    /** Publish a host element as the live pane for its cells, replacing any stale
     *  registration for the same host (every re-render re-registers). */
    function registerPane(host, pane, items) {
        host._tsicPane = pane;
        host.setAttribute('data-tsic-grid-host', '');
        for (var existing of Array.from(panes)) {
            if (existing.host === host || !existing.host.isConnected) panes.delete(existing);
        }
        panes.add(pane);
        var byCell = new Map();
        for (var it of (items || [])) {
            if (it && it.GridSlot >= 0 && !byCell.has(it.GridSlot)) byCell.set(it.GridSlot, it);
        }
        // Gamepad §8 actions resolve the focused cell back to its item.
        pane.itemAt = function (cellIndex) { return byCell.get(cellIndex) || null; };
    }

    /** Condition bar, NEW badge and equipped badge — the overlays every cell carries
     *  regardless of which surface drew it. */
    function decorateCell(cell, ownerId, item, equippedIds) {
        if (!cell || !item) return;
        // Condition bar for gear that wears; C++ sends -1 for the rest.
        if (typeof item.Durability === 'number' && item.Durability >= 0 && item.MaxDurability > 0) {
            var wearRatio = Math.max(0, Math.min(1, item.Durability / item.MaxDurability));
            var wear = el('div', {
                class: 'wear' + (wearRatio <= 0.15 ? ' crit' : (wearRatio <= 0.4 ? ' warn' : '')),
                title: 'Condition ' + Math.round(wearRatio * 100) + '%',
            });
            wear.appendChild(el('i', { style: 'width:' + (wearRatio * 100).toFixed(1) + '%;' }));
            cell.appendChild(wear);
        }
        if (isFresh(ownerId, item.InstanceId)) {
            cell.appendChild(el('span', { class: 'new-badge' }, 'NEW'));
        }
        if (equippedIds && item.InstanceId != null && equippedIds.has(String(item.InstanceId))) {
            cell.classList.add('is-equipped');
            cell.appendChild(el('span', { class: 'equip-badge', title: 'Equipped' }, 'E'));
        }
    }

    window.TSICInventory = {
        beginPointerDrag: beginPointerDrag,
        clickSuppressed: clickSuppressed,
        cancelHeld: cancelHeld,
        reconcileHeld: reconcileHeld,
        getHeld() { return held; },
        /** Subscribe to held-stack changes (hint rows re-render off this). */
        onHeldChanged(cb) { if (typeof cb === 'function') heldChangedCallbacks.push(cb); },
        /** How many leading grid cells are the hotbar. C++ is the authority; screens override
         *  this from the UI.Hotbar.Changed payload's NumSlots. */
        HOTBAR_SLOTS: HOTBAR_SLOTS,

        /** How many greyed "Requires backpack" cells trail the player's live cells, for a bag
         *  of `slotCount` — always enough to total PREVIEW_TIER_SLOTS, so the grid never
         *  changes size. Every surface that draws the bag must use this. */
        lockedPreviewFor: lockedPreviewFor,
        /** The bag's constant cell count: live + locked always equals this. */
        PREVIEW_TIER_SLOTS: PREVIEW_TIER_SLOTS,

        /** Diff a snapshot against the previous one to mark freshly-arrived stacks. */
        noteSnapshot: noteSnapshot,

        /** Open the exact-amount split dialog on the hovered/focused cell. */
        splitOnTarget() {
            var t = targetCell();
            if (!t || (t.item.Count || 1) < 2) return false;
            openSplitDialog(t.pane, t.item, t.cellIndex, t.cell);
            return true;
        },

        /** Close the split dialog (screens call this on unmount / Escape). */
        closeSplit: closeSplit,

        /**
         * Gamepad grid actions (§8.2), keyed on the FOCUSED cell: 'split' (Y —
         * pick up the larger half / place one while holding), 'quickmove' (X),
         * 'drop' (d-pad down — drop one). The held ghost snaps to the focused
         * cell. Returns false when no grid cell has focus.
         */
        behaviorOnFocused(kind) {
            var cell = document.querySelector('.tsic-slot[data-tsic-focused]');
            if (!cell || cell.classList.contains('is-locked')) return false;
            var host = cell.closest('[data-tsic-grid-host]');
            var pane = host && host._tsicPane;
            var cellIndex = cell.dataset ? parseInt(cell.dataset.grid, 10) : NaN;
            if (!pane || Number.isNaN(cellIndex)) return false;
            var item = pane.itemAt ? pane.itemAt(cellIndex) : null;
            var r = cell.getBoundingClientRect();
            var fakeEv = { clientX: r.left + r.width / 2 + 8, clientY: r.top + r.height / 2 + 8 };
            if (kind === 'split') {
                if (held) {
                    placeOneToCell(pane, cellIndex);
                } else if (item) {
                    pickUp(pane, item, cellIndex, Math.ceil((item.Count || 1) / 2), fakeEv);
                }
                return true;
            }
            if (kind === 'quickmove') {
                if (!held && item && pane.quickMove) pane.quickMove(item, cellIndex);
                return true;
            }
            if (kind === 'drop') {
                if (held) {
                    dropHeldAtPlayer(false);
                } else if (item) {
                    window.TSICInventory.dropHovered(pane, item, false);
                }
                return true;
            }
            return false;
        },

        // Q / Ctrl+Q on a hovered cell (§7.3): drop one / the whole stack.
        dropHovered(pane, item, wholeStack) {
            if (!item || item.GridSlot == null || item.GridSlot < 0) return;
            publish('UI.Cmd.Inventory.DropFromSlot', {
                OwnerId: pane.ownerId, ItemId: item.InstanceId,
                Slot: item.GridSlot, Count: wholeStack ? 0 : 1,
            });
            sound('Inventory.Drop');
        },

        /**
         * Append the shared per-cell overlays — condition bar, NEW badge, equipped badge — to a
         * cell. Public so any surface that builds its own cells decorates them identically;
         * a second implementation elsewhere would drift.
         */
        decorateCell: decorateCell,

        /**
         * Slot grid v2. Cells startSlot..slotCount-1 laid out gridWidth wide; items
         * land at their persistent GridSlot. Items parked past the cap (load
         * overflow fallback) extend the grid by whole rows so nothing is ever
         * hidden. opts.lockedPreviewCells greyed cells render after the live
         * ones ("Requires backpack" — UI-only, never a target).
         *
         * opts.startSlot / opts.endSlot bound the cells this host draws, which is how the
         * hotbar strip and the bag grid above it split one inventory between two hosts
         * without either drawing the other's cells. endSlot is exclusive, and it also pins
         * the strip's length: overflow parked past the cap extends the BAG, never the strip.
         * opts.hotbarSlots marks the leading cells with their number chip.
         *
         * paneCtx: { ownerId, panelEl, publish?, quickMove(item), otherOwnerId(),
         *            onHover(it, cell), onLeave(),
         *            onDollDrop(payload, cell) }
         */
        renderGrid(host, items, opts) {
            injectCursorStyleOnce();
            var cat = (opts && opts.catalog) || (window.tsic && window.tsic.itemCatalog) || {};
            var cols = opts.gridWidth > 0 ? opts.gridWidth : 8;
            var liveSlots = opts.slotCount > 0 ? opts.slotCount
                : (opts.gridHeight > 0 ? cols * opts.gridHeight : cols * 4);

            // Exclusive upper bound (the hotbar strip stops at the hotbar's last cell).
            var endSlot = (typeof opts.endSlot === 'number' && opts.endSlot > 0) ? opts.endSlot : 0;
            // Parked overflow (shrink fallback) extends the visible grid — but only the host
            // that owns the tail of the inventory. A bounded host keeps its fixed length.
            var totalLive = liveSlots;
            if (!endSlot) {
                for (var it0 of (items || [])) {
                    if (it0 && it0.GridSlot >= totalLive) {
                        totalLive = (Math.floor(it0.GridSlot / cols) + 1) * cols;
                    }
                }
            }
            var lockedCells = Math.max(0, opts.lockedPreviewCells || 0);
            var totalCells = totalLive + lockedCells;
            if (endSlot) totalCells = Math.min(totalCells, endSlot);
            // Cells another host owns. Clamped to whole rows so skipping them can never
            // shift the remaining cells out of their columns.
            var startSlot = Math.max(0, Math.min(totalCells, opts.startSlot || 0));
            startSlot -= startSlot % cols;
            var rows = Math.ceil((totalCells - startSlot) / cols);

            host.innerHTML = '';
            host.style.setProperty('--grid-cols', String(cols));
            host.style.setProperty('--grid-rows', String(rows));
            host.setAttribute('data-tsic-grid-host', '');

            var pane = {
                host: host,
                ownerId: opts.ownerId || 'Player',
                panelEl: opts.panelEl || null,
                quickMove: opts.onQuickMove || null,
                onHover: opts.onHover || null,
                onLeave: opts.onLeave || null,
                onDollDrop: opts.onDollDrop || null,
                otherOwnerId: opts.otherOwnerId || null,
            };
            registerPane(host, pane, items);

            var byCell = new Map();
            for (var it of (items || [])) {
                if (it && it.GridSlot >= 0 && !byCell.has(it.GridSlot)) byCell.set(it.GridSlot, it);
            }

            var equippedIds = opts.equippedIds || null;
            // Leading cells that are the hotbar, marked in place with their number chip. Only
            // the strip host sets this; the bag grid above it starts past them.
            var hotbarSlots = (typeof opts.hotbarSlots === 'number' && opts.hotbarSlots > 0) ? opts.hotbarSlots : 0;
            // Which hotbar cell is currently in the player's hands. -1 = empty hands.
            var heldSlot = (typeof opts.heldSlot === 'number') ? opts.heldSlot : -1;

            for (var i = startSlot; i < totalCells; i++) {
                var isLocked = i >= totalLive;
                var item = isLocked ? null : byCell.get(i);
                var isHotbarCell = i < hotbarSlots;
                var cell = el('div', {
                    class: 'tsic-slot'
                        + (isLocked ? ' is-locked' : (item ? '' : ' is-empty'))
                        + (isHotbarCell ? ' is-hotbar' : '')
                        + (i === heldSlot ? ' is-held' : ''),
                });
                cell.dataset.grid = i;
                if (isHotbarCell) {
                    // The cell's position IS its hotbar number, so the chip is a label, not a
                    // badge that could ever disagree with where the item actually is.
                    cell.appendChild(el('span', { class: 'hotbar-key' }, String(i + 1)));
                }
                if (isLocked) {
                    cell.title = 'Requires backpack';
                    cell.appendChild(el('span', { class: 'lock-glyph' }, '🔒'));
                    host.appendChild(cell);
                    continue;
                }
                cell.setAttribute('data-tsic-focusable', '');
                if (opts.focusGroup) cell.setAttribute('data-tsic-focus-group', opts.focusGroup);
                cell.tabIndex = -1;
                if (item) {
                    cell.dataset.instance = item.InstanceId;
                    if (opts.filterFn && !opts.filterFn(item)) cell.classList.add('is-filtered');
                    if (item.ItemId) {
                        var img = TSIC.iconImg(TSIC.itemIconUrl(item.ItemId));
                        img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
                        cell.appendChild(img);
                    }
                    decorateCell(cell, pane.ownerId, item, equippedIds);
                    if ((item.Count || 1) > 1) {
                        cell.appendChild(el('span', { class: 'count' }, String(item.Count)));
                    }
                    var desc = cat[item.ItemId] || {};
                    cell.title = desc.Name || item.ItemId || '';
                }
                wireCell(cell, pane, item, i);
                host.appendChild(cell);
            }
            refreshHeldSourceVisual();
        },

        // Partial updates preserved from v1 (equipped badge toggling).
        updateEquippedClasses(host, equippedIds) {
            if (!host) return;
            var eq = equippedIds || new Set();
            for (var cell of host.querySelectorAll('.tsic-slot')) {
                var id = cell.dataset.instance;
                var isEq = !!(id != null && id !== '' && eq.has(String(id)));
                cell.classList.toggle('is-equipped', isEq);
                var badge = cell.querySelector('.equip-badge');
                if (isEq && !badge) {
                    cell.appendChild(el('span', { class: 'equip-badge', title: 'Equipped' }, 'E'));
                } else if (!isEq && badge) {
                    badge.remove();
                }
            }
        },
        /**
         * Item detail card. `compareDescriptor` is the catalog entry for whatever
         * is currently worn in the SAME equipment slot — when present, every
         * comparable stat gains a coloured delta so the card answers "is this an
         * upgrade?" without the player equipping it to find out. Only stats
         * authored on the definition are comparable; weapon/armour damage lives
         * in gameplay effects and is deliberately not guessed at here.
         */
        renderInfoPanel(host, itemDescriptor, itemInstance, compareDescriptor) {
            host.innerHTML = '';
            if (!itemDescriptor) return;
            // Human-readable type ("Weapon", "Crafting Material") — not the raw
            // Category bucket, which is a filter key rather than player-facing text.
            var eyebrow = el('div', { class: 'info-eyebrow' }, TSIC.itemTypeLabel(itemDescriptor) || 'Item');
            host.appendChild(eyebrow);
            host.appendChild(el('h3', { style: 'margin:2px 0 6px;' }, itemDescriptor.Name || itemDescriptor.ItemId || ''));
            if (itemDescriptor.Description) {
                host.appendChild(el('p', { style: 'font-size:13px;margin:0 0 6px;color:rgba(37,33,25,0.78);' },
                    itemDescriptor.Description));
            }

            var stat = function (label, value, delta, higherIsBetter) {
                var row = el('div', { class: 'statline' });
                row.appendChild(el('b', {}, label));
                var right = el('span', {});
                right.appendChild(document.createTextNode(value));
                if (typeof delta === 'number' && Math.abs(delta) > 0.0001) {
                    var better = higherIsBetter === false ? delta < 0 : delta > 0;
                    var sign = delta > 0 ? '+' : '';
                    // Trim a trailing ".00" so integer stats read as integers.
                    var text = sign + (Math.round(delta * 100) / 100);
                    right.appendChild(el('span', {
                        style: 'margin-left:6px;font-weight:700;color:' + (better ? '#1e8f3e' : '#c11818') + ';',
                    }, '(' + text + ')'));
                }
                row.appendChild(right);
                host.appendChild(row);
            };

            var cmp = compareDescriptor || null;
            var deltaOf = function (key) { return cmp ? ((itemDescriptor[key] || 0) - (cmp[key] || 0)) : undefined; };

            if (itemInstance && (itemInstance.Count || 1) > 1) stat('STACK', String(itemInstance.Count));
            // Lighter is better, hence higherIsBetter=false.
            stat('WEIGHT', (itemDescriptor.Weight || 0).toFixed(2) + ' kg' + ((itemInstance && itemInstance.Count > 1) ? ' ea.' : ''),
                deltaOf('Weight'), false);

            if (itemInstance && typeof itemInstance.Durability === 'number'
                && itemInstance.Durability >= 0 && itemInstance.MaxDurability > 0) {
                stat('CONDITION', Math.round((itemInstance.Durability / itemInstance.MaxDurability) * 100) + '%');
            }
            if (itemDescriptor.BonusInventorySlots > 0 || (cmp && cmp.BonusInventorySlots > 0)) {
                stat('SLOTS', String(itemDescriptor.BonusInventorySlots || 0), deltaOf('BonusInventorySlots'));
            }
            if (itemDescriptor.MaxAmmo > 0 || (cmp && cmp.MaxAmmo > 0)) {
                stat('AMMO CAP', String(itemDescriptor.MaxAmmo || 0), deltaOf('MaxAmmo'));
            }
            if (itemDescriptor.BonusEntityDamage > 0 || (cmp && cmp.BonusEntityDamage > 0)) {
                stat('VS FURNITURE', '+' + (itemDescriptor.BonusEntityDamage || 0), deltaOf('BonusEntityDamage'));
            }
            if ((itemDescriptor.EntityDamageMultiplier || 0) !== 1 || (cmp && (cmp.EntityDamageMultiplier || 0) !== 1)) {
                stat('DEMOLITION', (itemDescriptor.EntityDamageMultiplier || 0).toFixed(2) + '×',
                    deltaOf('EntityDamageMultiplier'));
            }

            if (cmp) {
                host.appendChild(el('div', {
                    style: 'margin-top:7px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(37,33,25,0.6);',
                }, 'vs equipped: ' + (cmp.Name || cmp.ItemId || '')));
            }
        },
    };

    // ---- Cell interaction wiring ------------------------------------------
    function wireCell(cell, pane, item, cellIndex) {
        cell.addEventListener('mouseenter', function () {
            hoverTarget = item ? { pane: pane, item: item, cellIndex: cellIndex, cell: cell } : null;
            // Looking at it counts as acknowledging it.
            if (item && isFresh(pane.ownerId, item.InstanceId)) {
                clearFresh(pane.ownerId, item.InstanceId);
                var badge = cell.querySelector('.new-badge');
                if (badge) badge.remove();
            }
            pane.onHover && pane.onHover(item, cellIndex);
        });
        cell.addEventListener('mouseleave', function () {
            if (hoverTarget && hoverTarget.cell === cell) hoverTarget = null;
            pane.onLeave && pane.onLeave();
        });

        cell.addEventListener('click', function (e) {
            if (clickSuppressed()) return;
            if (held) return; // commits ride the global pointerup tracker
            if (!item) return;
            if (e.shiftKey) {
                // Shift+LMB quick-move (§7.4); destination resolved by the pane.
                pane.quickMove && pane.quickMove(item, cellIndex);
                return;
            }
            pickUp(pane, item, cellIndex, item.Count || 1, e);
        });

        cell.addEventListener('dblclick', function () {
            // Double LMB: the first click picked the stack up; the second's
            // same-cell release scheduled a delayed return — rescue the hold
            // and pull every matching mergeable stack from all open panes.
            if (!held || !item || held.instanceId !== item.InstanceId) return;
            if (held.count < held.sourceCount) return; // partial holds don't collect
            clearPendingCancel();
            publish('UI.Cmd.Inventory.Collect', {
                OwnerId: pane.ownerId,
                OtherOwnerId: (pane.otherOwnerId && pane.otherOwnerId()) || '',
                ItemId: item.InstanceId, Slot: cellIndex,
            });
            sound('Inventory.Stack', 0.33);
        });

        cell.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            if (held) {
                // An RMB sweep already placed here — the release must not double.
                if (!rmbSweepTake(pane, cellIndex)) placeOneToCell(pane, cellIndex);
                return;
            }
            if (!item) return;
            // Shift+RMB opens the exact-amount dialog; plain RMB keeps the fast
            // half-pickup, which is the right default for most stacks.
            if (e.shiftKey && (item.Count || 1) > 1) {
                openSplitDialog(pane, item, cellIndex, cell);
                return;
            }
            // RMB empty cursor: pick up the LARGER half (stack of 7 -> hold 4).
            var half = Math.ceil((item.Count || 1) / 2);
            pickUp(pane, item, cellIndex, half, e);
        });

        // Press–drag–release path: dragging a stack is the same gesture as
        // click-pickup with the commit on pointerup over the target.
        if (item) {
            cell.addEventListener('pointerdown', function (e) {
                if (e.button !== 0 || held) return;
                var startX = e.clientX, startY = e.clientY;
                var dragging = false;
                function onMove(ev) {
                    if (dragging) return;
                    var dx = ev.clientX - startX, dy = ev.clientY - startY;
                    if ((dx * dx + dy * dy) < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
                    dragging = true;
                    pickUp(pane, item, cellIndex, item.Count || 1, ev);
                    // Single-gesture paint: the global pointermove sweeps cells
                    // from here on, and the release distributes across them.
                    distributeTrail = [];
                }
                function onUp(ev) {
                    document.removeEventListener('pointermove', onMove, true);
                    document.removeEventListener('pointerup', onUp, true);
                    if (!dragging) return; // plain click — the click listener handles it
                    suppressClickUntil = Date.now() + 150;
                    if (tryDistributeRelease()) return;
                    var t = cellUnder(ev.clientX, ev.clientY);
                    if (t && t.classList.contains('equip-slot')) {
                        // Grid -> doll: equip; the item keeps its cell (§7.4).
                        if (t._tsicEquipDrop && held) {
                            var payload = { instanceId: held.instanceId, ownerId: held.ownerId };
                            cancelHeld();
                            t._tsicEquipDrop(payload);
                        }
                        return;
                    }
                    var hostEl = t && t.closest('[data-tsic-grid-host]');
                    var target = hostEl && hostEl._tsicPane;
                    var targetIndex = t && t.dataset ? parseInt(t.dataset.grid, 10) : NaN;
                    if (target && !Number.isNaN(targetIndex) && !t.classList.contains('is-locked')) {
                        if (target.ownerId === pane.ownerId && targetIndex === cellIndex) {
                            cancelHeld(); // a drag that returned home cancels immediately
                            return;
                        }
                        commitHeldToCell(target, targetIndex);
                        return;
                    }
                    if (outsideEveryPane(ev)) { dropHeldAtPlayer(true); return; }
                    cancelHeld(); // released somewhere inert inside the panel
                }
                document.addEventListener('pointermove', onMove, true);
                document.addEventListener('pointerup', onUp, true);
            });
        }
    }
})();
