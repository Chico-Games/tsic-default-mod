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

    // Hotbar slot 0 is the reserved FISTS slot — selecting it stows whatever is
    // out and leaves the player bare-handed. It holds no item and never can:
    // C++ (UEquipmentControllerComponent) refuses assignments to it, and every
    // UI assign path checks here first so a rejected drop never round-trips.
    var FISTS_HOTBAR_SLOT = 0;

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
            // Sits just under a grid slot. The ghost lives on <body>, outside
            // any screen, so the storage rule below re-scopes it to that
            // screen's smaller slot while its panel is mounted.
            '.tsic-drag-ghost {',
            '  position:fixed; z-index:2000;',
            '  width:calc(var(--tsic-slot) - 4px); height:calc(var(--tsic-slot) - 4px);',
            '  pointer-events:none; opacity:0.92; padding:4px;',
            '  background: rgba(241,229,207,0.92); border:2px solid rgba(10,10,10,0.85);',
            '  box-shadow: 3px 3px 0 rgba(10,10,10,0.85);',
            '}',
            'body:has(#ss-panel) .tsic-drag-ghost { --tsic-slot:54px; }',
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
            // Locked (favourited): a padlock in the bottom-left, plus a warm rim so
            // a locked stack is identifiable at a glance while scanning the grid.
            '.tsic-slot.is-locked-item { box-shadow: inset 0 0 0 2px rgba(224,168,42,0.85); }',
            '.tsic-slot .lock-badge {',
            '  position:absolute; bottom:1px; left:2px; font-size:9px; line-height:1;',
            '  pointer-events:none; text-shadow:0 1px 2px rgba(0,0,0,0.6);',
            '}',
            // "New since you last looked" — cleared when the stack is hovered.
            '.tsic-slot .new-badge {',
            '  position:absolute; top:1px; left:2px; padding:1px 3px; line-height:1;',
            '  font-size:8px; font-weight:700; letter-spacing:0.06em; color:#1a1612;',
            '  background:#7fd4a2; border:1px solid rgba(10,10,10,0.85); pointer-events:none;',
            '}',

            // ---- Split dialog ----
            '.tsic-split {',
            '  position:fixed; z-index:2100; min-width:190px; padding:9px 11px;',
            '  background:#fffdf3; border:2px solid rgba(10,10,10,0.85);',
            '  box-shadow:4px 4px 0 rgba(10,10,10,0.85); font-size:12px; color:#1a1612;',
            '}',
            '.tsic-split .row { display:flex; align-items:center; gap:6px; margin-top:6px; }',
            '.tsic-split .lab { font-size:10px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.7; }',
            '.tsic-split input[type=range] { flex:1; min-width:0; accent-color:#e60000; }',
            '.tsic-split input[type=number] {',
            '  width:58px; font:inherit; padding:1px 4px; text-align:center;',
            '  background:#fffdf3; border:2px solid rgba(10,10,10,0.85); color:inherit;',
            '}',
            '.tsic-split button {',
            '  font:inherit; font-size:11px; letter-spacing:0.08em; cursor:pointer; padding:2px 9px;',
            '  background:#fffdf3; border:2px solid rgba(10,10,10,0.85); color:inherit;',
            '}',
            '.tsic-split button.go { background:var(--mag-red,#e60000); color:#fff; }',
            '.tsic-split button:hover { filter:brightness(1.08); }',
        ].join('\n');
        document.head.appendChild(s);
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
        var overCell = !!cellUnder(ev.clientX, ev.clientY) || !!hotbarSlotUnder(ev.clientX, ev.clientY);
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

    // Hotbar drop targets: the inventory screen's mirror (.inv-hotbar .hslot,
    // indexed by data-hotbar) and the HUD row (#hotbar-row .tsic-slot, indexed
    // by data-slot).
    function hotbarSlotUnder(x, y) {
        var target = document.elementFromPoint(x, y);
        var slotEl = target ? target.closest('.inv-hotbar .hslot, #hotbar-row .tsic-slot') : null;
        if (!slotEl) return null;
        var raw = slotEl.dataset.hotbar != null ? slotEl.dataset.hotbar : slotEl.dataset.slot;
        var index = parseInt(raw, 10);
        return Number.isNaN(index) ? null : { el: slotEl, index: index };
    }

    // Release over a hotbar slot: assign the held stack's instance to that
    // slot (id-based — the stack never leaves its grid cell). Non-assignable
    // categories just return home; a hotbar release never falls through to
    // the drop-in-world path.
    function tryCommitHeldToHotbar(x, y) {
        if (!held) return false;
        var slot = hotbarSlotUnder(x, y);
        if (!slot) return false;
        // The fists slot still swallows the release (the stack returns home
        // rather than dropping into the world) — it just never takes the item.
        if (slot.index !== FISTS_HOTBAR_SLOT && window.TSICInventory.canAssignToHotbar(held.itemId)) {
            publish('UI.Cmd.Hotbar.Assign', { SlotIndex: slot.index, ItemId: String(held.instanceId) });
            sound('Inventory.Transfer', 0.33);
        }
        distributeTrail = null;
        suppressClickUntil = Date.now() + 200;
        cancelHeld();
        return true;
    }

    function refreshHeldSourceVisual() {
        for (var pane of panes) {
            if (!pane.host || !pane.host.isConnected) continue;
            for (var cell of pane.host.querySelectorAll('.tsic-slot')) {
                var isSource = !!(held && pane.ownerId === held.ownerId &&
                    Number(cell.dataset.grid) === held.fromSlot);
                cell.classList.toggle('is-held-source', isSource);
                var badge = cell.querySelector('.count');
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
        sound('Inventory.Transfer', 0.2);
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
                cancelHeld();
            }, 300);
            return;
        }
        publish('UI.Cmd.Inventory.Move', {
            FromOwnerId: held.ownerId, ToOwnerId: targetPane.ownerId,
            ItemId: held.instanceId, FromSlot: held.fromSlot,
            ToSlot: cellIndex, Count: heldCountArg(),
        });
        sound('Inventory.Transfer', 0.33);
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
        // A hotbar release wins over drag-distribute: releasing on a slot
        // means "assign", even when the drag swept valid cells on the way.
        if (tryCommitHeldToHotbar(e.clientX, e.clientY)) return;
        if (tryDistributeRelease()) return;
        var t = cellUnder(e.clientX, e.clientY);
        if (t && t.classList.contains('equip-slot')) {
            if (t._tsicEquipDrop) {
                var payload = { instanceId: held.instanceId, ownerId: held.ownerId };
                cancelHeld();
                suppressClickUntil = Date.now() + 200;
                t._tsicEquipDrop(payload);
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

    window.TSICInventory = {
        beginPointerDrag: beginPointerDrag,
        clickSuppressed: clickSuppressed,
        cancelHeld: cancelHeld,
        reconcileHeld: reconcileHeld,
        getHeld() { return held; },
        /** Subscribe to held-stack changes (hint rows re-render off this). */
        onHeldChanged(cb) { if (typeof cb === 'function') heldChangedCallbacks.push(cb); },
        /** Reserved fists slot index — nothing can be assigned to it. */
        FISTS_HOTBAR_SLOT: FISTS_HOTBAR_SLOT,
        /** False for the fists slot, which permanently holds no item. */
        isHotbarSlotAssignable(slotIndex) { return slotIndex !== FISTS_HOTBAR_SLOT; },
        /** Only equipment and consumables belong on the hotbar. */
        canAssignToHotbar(itemDefId) {
            var cat = (window.tsic && window.tsic.itemCatalog) || {};
            var desc = cat[itemDefId];
            var category = desc && desc.Category;
            return category === 'Equipment' || category === 'Consumable';
        },

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
         * Slot grid v2. Cells 0..slotCount-1 laid out gridWidth wide; items
         * land at their persistent GridSlot. Items parked past the cap (load
         * overflow fallback) extend the grid by whole rows so nothing is ever
         * hidden. opts.lockedPreviewCells greyed cells render after the live
         * ones ("Requires backpack" — UI-only, never a target).
         *
         * paneCtx: { ownerId, panelEl, publish?, quickMove(item), otherOwnerId(),
         *            onHover(it, cell), onLeave(),
         *            onDollDrop(payload, cell) }
         */
        renderGrid(host, items, opts) {
            var cat = (opts && opts.catalog) || (window.tsic && window.tsic.itemCatalog) || {};
            var cols = opts.gridWidth > 0 ? opts.gridWidth : 8;
            var liveSlots = opts.slotCount > 0 ? opts.slotCount
                : (opts.gridHeight > 0 ? cols * opts.gridHeight : cols * 4);

            // Parked overflow (shrink fallback) extends the visible grid.
            var totalLive = liveSlots;
            for (var it0 of (items || [])) {
                if (it0 && it0.GridSlot >= totalLive) {
                    totalLive = (Math.floor(it0.GridSlot / cols) + 1) * cols;
                }
            }
            var lockedCells = Math.max(0, opts.lockedPreviewCells || 0);
            var totalCells = totalLive + lockedCells;
            var rows = Math.ceil(totalCells / cols);

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
            host._tsicPane = pane;
            // Re-registering on re-render: drop stale entries for this host.
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

            var equippedIds = opts.equippedIds || null;
            var hotbarNumbers = opts.hotbarNumbersByInstance || null;

            for (var i = 0; i < totalCells; i++) {
                var isLocked = i >= totalLive;
                var item = isLocked ? null : byCell.get(i);
                var cell = el('div', { class: 'tsic-slot' + (isLocked ? ' is-locked' : (item ? '' : ' is-empty')) });
                cell.dataset.grid = i;
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
                    var isEquipped = !!(equippedIds && item.InstanceId != null && equippedIds.has(String(item.InstanceId)));
                    if (isEquipped) cell.classList.add('is-equipped');
                    if (opts.filterFn && !opts.filterFn(item)) cell.classList.add('is-filtered');
                    if (item.ItemId) {
                        var img = TSIC.iconImg(TSIC.itemIconUrl(item.ItemId));
                        img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
                        cell.appendChild(img);
                    }
                    if (isEquipped) {
                        cell.appendChild(el('span', { class: 'equip-badge', title: 'Equipped' }, 'E'));
                    }
                    var hotbarNum = hotbarNumbers && item.InstanceId != null
                        ? hotbarNumbers.get(String(item.InstanceId)) : null;
                    if (hotbarNum != null) {
                        cell.appendChild(el('span', { class: 'hotbar-badge' }, String(hotbarNum)));
                    }
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
        renderInfoPanel(host, itemDescriptor, itemInstance) {
            host.innerHTML = '';
            if (!itemDescriptor) return;
            var eyebrow = el('div', { class: 'info-eyebrow' }, itemDescriptor.Category || 'Item');
            host.appendChild(eyebrow);
            host.appendChild(el('h3', { style: 'margin:2px 0 6px;' }, itemDescriptor.Name || itemDescriptor.ItemId || ''));
            if (itemDescriptor.Description) {
                host.appendChild(el('p', { style: 'font-size:13px;margin:0 0 6px;color:rgba(37,33,25,0.78);' },
                    itemDescriptor.Description));
            }
            var stat = function (label, value) {
                var row = el('div', { class: 'statline' });
                row.appendChild(el('b', {}, label));
                row.appendChild(el('span', {}, value));
                host.appendChild(row);
            };
            if (itemInstance && (itemInstance.Count || 1) > 1) stat('STACK', String(itemInstance.Count));
            stat('WEIGHT', (itemDescriptor.Weight || 0).toFixed(2) + ' kg' + ((itemInstance && itemInstance.Count > 1) ? ' ea.' : ''));
        },
    };

    // ---- Cell interaction wiring ------------------------------------------
    function wireCell(cell, pane, item, cellIndex) {
        cell.addEventListener('mouseenter', function () { pane.onHover && pane.onHover(item, cellIndex); });
        cell.addEventListener('mouseleave', function () { pane.onLeave && pane.onLeave(); });

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
            sound('Inventory.Transfer', 0.33);
        });

        cell.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            if (held) {
                // An RMB sweep already placed here — the release must not double.
                if (!rmbSweepTake(pane, cellIndex)) placeOneToCell(pane, cellIndex);
                return;
            }
            if (!item) return;
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
                    // A hotbar release wins over drag-distribute: releasing on
                    // a slot means "assign", even when the drag swept cells.
                    if (tryCommitHeldToHotbar(ev.clientX, ev.clientY)) return;
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
