// Renderers + drag-drop + modal helpers for the inventory page. Reads from
// tsic.itemCatalog for display data. The page itself stays declarative.
//
// Depends on: shared/dom.js (TSIC.el), shared/icons.js (TSIC.itemIconUrl, TSIC.iconImg)
(function(){
    var el = TSIC.el;

    window.TSICInventory = {
        // Vertical scrollable item list. Renders one .tsic-list-row per stack
        // (RE-style — no slot grid, no reorder; SlotIndex is just an identity).
        // Each row is a real <button> so gamepad Confirm + mouse click both
        // trigger opts.onClick. Drag is one-way: rows can be dragstart sources
        // (used by inventory.html to drag onto equipment slots) but rows are
        // not drop targets — there's no in-list reorder.
        renderList(host, items, opts) {
            const cat = (opts && opts.catalog) || (window.tsic && window.tsic.itemCatalog) || {};
            host.innerHTML = '';
            const list = items || [];
            if (list.length === 0) {
                const empty = el('div', { class: 'tsic-empty' }, opts.emptyLabel || 'Empty');
                host.appendChild(empty);
                return;
            }
            // Set of equipped instance ids (as strings), so rows currently worn get a
            // distinct outline + badge. Correlates the row's stable InstanceId against
            // the equipment snapshot's per-slot ItemId (both = InternalInventoryId).
            const equippedIds = (opts && opts.equippedIds) || null;
            for (const it of list) {
                const desc = cat[it.ItemId] || {};
                const isEquipped = !!(equippedIds && it.InstanceId != null && equippedIds.has(String(it.InstanceId)));
                const row = el('button', { class: 'tsic-list-row', type: 'button' });
                row.dataset.slot = it.SlotIndex;
                if (it.InstanceId != null) row.dataset.instance = it.InstanceId;
                if (opts.selectedIdx === it.SlotIndex) row.classList.add('is-selected');
                if (isEquipped) row.classList.add('is-equipped');

                const iconWrap = el('div', { class: 'icon' });
                if (it.ItemId) {
                    iconWrap.appendChild(TSIC.iconImg(TSIC.itemIconUrl(it.ItemId)));
                }
                if (isEquipped) {
                    // Corner badge marking the item as worn (✦). The outline comes from .is-equipped.
                    iconWrap.appendChild(el('span', { class: 'equip-badge', title: 'Equipped' }, '✦'));
                }
                row.appendChild(iconWrap);

                const name = el('div', { class: 'name' }, desc.Name || it.ItemId || 'Unknown');
                row.appendChild(name);

                const right = el('div', { class: 'right' });
                const stackText = it.Count > 1 ? `×${it.Count}` : '';
                const weightText = (desc.Weight && it.Count)
                    ? `${((desc.Weight || 0) * (it.Count || 1)).toFixed(2)} kg`
                    : '';
                right.innerHTML = (stackText ? `<div>${stackText}</div>` : '')
                    + (weightText ? `<div>${weightText}</div>` : '');
                row.appendChild(right);

                row.addEventListener('mouseenter', () => opts.onHover && opts.onHover(it));
                row.addEventListener('mouseleave', () => opts.onLeave && opts.onLeave());
                row.addEventListener('click',      () => opts.onClick && opts.onClick(it));
                row.addEventListener('dblclick',   () => opts.onDblClick && opts.onDblClick(it));
                row.addEventListener('contextmenu', (e) => { e.preventDefault(); opts.onRMB && opts.onRMB(it, e); });
                row.draggable = true;
                row.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/tsic-item', JSON.stringify({ slot: it.SlotIndex, instanceId: it.InstanceId, itemId: it.ItemId }));
                    row.classList.add('is-dragging');
                });
                row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
                host.appendChild(row);
            }
        },
        // Partial-update path for the selection marker: walks the existing
        // rows and toggles .is-selected based on `row.dataset.slot` against
        // selectedIdx. Avoids the full renderList rebuild that the click/RMB
        // paths used to fire just to move the selection ring.
        updateSelectedSlot(host, selectedIdx) {
            if (!host) return;
            const target = (selectedIdx == null) ? '' : String(selectedIdx);
            for (const row of host.querySelectorAll('.tsic-list-row')) {
                row.classList.toggle('is-selected', row.dataset.slot === target);
            }
        },
        // Partial-update path for the equipped outline + corner badge: walks
        // the existing rows already rendered by renderList() and toggles the
        // .is-equipped class + ✦ badge based on the equippedIds set. Avoids
        // a full list rebuild (icons, drag handlers, click listeners) on every
        // UI.Equipment.Updated, which fires whenever the player equips,
        // unequips, or swaps a worn item.
        updateEquippedClasses(host, equippedIds) {
            if (!host) return;
            const eq = equippedIds || new Set();
            const rows = host.querySelectorAll('.tsic-list-row');
            for (const row of rows) {
                const id = row.dataset.instance;
                const isEq = !!(id != null && id !== '' && eq.has(String(id)));
                row.classList.toggle('is-equipped', isEq);
                const iconWrap = row.querySelector('.icon');
                if (!iconWrap) continue;
                const badge = iconWrap.querySelector('.equip-badge');
                if (isEq && !badge) {
                    iconWrap.appendChild(el('span', { class: 'equip-badge', title: 'Equipped' }, '✦'));
                } else if (!isEq && badge) {
                    badge.remove();
                }
            }
        },
        renderGrid(host, items, opts) {
            const totalSlots = opts.maxSlots > 0 ? opts.maxSlots : 32;
            host.innerHTML = '';
            const indexed = new Map();
            for (const it of (items || [])) indexed.set(it.SlotIndex, it);
            for (let i = 0; i < totalSlots; i++) {
                const it = indexed.get(i);
                const slot = el('div', { class: 'tsic-slot' + (opts.selectedIdx === i ? ' selected' : '') });
                slot.dataset.slot = i;
                if (it) {
                    if (it.ItemId) {
                        const img = TSIC.iconImg(TSIC.itemIconUrl(it.ItemId));
                        img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
                        slot.appendChild(img);
                    }
                    if (it.Count > 1) {
                        slot.appendChild(el('span', { class: 'count' }, String(it.Count)));
                    }
                }
                slot.addEventListener('mouseenter', () => opts.onHover && opts.onHover(it, i));
                slot.addEventListener('mouseleave', () => opts.onLeave && opts.onLeave());
                slot.addEventListener('click', () => opts.onClick && opts.onClick(it, i));
                slot.addEventListener('dblclick', () => opts.onDblClick && opts.onDblClick(it, i));
                slot.addEventListener('contextmenu', (e) => { e.preventDefault(); opts.onRMB && opts.onRMB(it, i, e); });
                slot.draggable = !!it;
                slot.addEventListener('dragstart', (e) => {
                    if (!it) return;
                    e.dataTransfer.setData('application/tsic-item', JSON.stringify({ slot: i, itemId: it.ItemId }));
                    slot.classList.add('is-dragging');
                });
                slot.addEventListener('dragend', () => slot.classList.remove('is-dragging'));
                slot.addEventListener('dragover', (e) => e.preventDefault());
                slot.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const raw = e.dataTransfer.getData('application/tsic-item');
                    if (!raw) return;
                    try { opts.onDrop && opts.onDrop(JSON.parse(raw), i); } catch {}
                });
                host.appendChild(slot);
            }
        },
        renderInfoPanel(host, itemDescriptor, itemInstance) {
            host.innerHTML = '';
            if (!itemDescriptor) return;
            const infoImg = TSIC.iconImg(TSIC.itemIconUrl(itemDescriptor.ItemId));
            infoImg.style.cssText = 'width:96px;height:96px;object-fit:contain;display:block;margin:0 auto 8px;';
            host.appendChild(infoImg);
            host.appendChild(el('h3', { style: 'margin:0 0 4px;' }, itemDescriptor.Name));
            host.appendChild(el('p', { style: 'font-size:12px;color:rgba(37,33,25,0.75);' }, itemDescriptor.Description || ''));
            const meta = el('div', { style: 'margin-top:8px;font-size:11px;color:rgba(37,33,25,0.65);' });
            meta.innerHTML = `<div>Category: ${itemDescriptor.Category || 'Other'}</div>`
                + `<div>Weight: ${(itemDescriptor.Weight || 0).toFixed(2)}</div>`
                + (itemInstance && itemInstance.Count > 1 ? `<div>Stack: ${itemInstance.Count}</div>` : '');
            host.appendChild(meta);
        },
        openQuantityModal(maxCount, onConfirm, opts) {
            const title = (opts && opts.title) || 'Drop how many?';
            const confirmLabel = (opts && opts.confirmLabel) || 'Drop';
            const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;' });
            const panel = el('div', { class: 'tsic-panel', style: 'width:300px;padding:16px;' });
            panel.appendChild(el('h3', { style: 'margin:0 0 12px;' }, title));
            const slider = el('input', { type: 'range', min: '1', max: String(maxCount), value: String(maxCount), style: 'width:100%;' });
            const num = el('div', { style: 'text-align:center;font-size:18px;margin:8px 0;' }, String(maxCount));
            slider.addEventListener('input', () => num.textContent = slider.value);
            const buttons = el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;' });
            const cancel = el('button', { class: 'tsic-button' }, 'Cancel');
            const ok = el('button', { class: 'tsic-button' }, confirmLabel);
            cancel.addEventListener('click', () => overlay.remove());
            ok.addEventListener('click', () => { overlay.remove(); onConfirm(parseInt(slider.value, 10)); });
            buttons.appendChild(cancel); buttons.appendChild(ok);
            panel.appendChild(slider); panel.appendChild(num); panel.appendChild(buttons);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);
        },
        // Build the entries array for a right-click context menu on an inventory
        // row. Pages pass the item, its descriptor, and (for storage) the owner
        // ids needed for Transfer entries. Callers feed the result into
        // window.TSICContextMenu.open({ x, y, entries }).
        buildItemContextMenu({ it, desc, storageOpen = false, fromOwnerId = 'Player', toOwnerId = null, equippedSlotTag = null, onAssignedHotbar }) {
            const publish = (tag, payload) => {
                if (window.tsic && window.tsic.publishMessage) window.tsic.publishMessage(tag, payload);
            };
            const entries = [];
            const cat = desc && desc.Category;
            if (cat === 'Equipment') {
                if (equippedSlotTag) {
                    // Already worn — unequip by the slot tag it occupies (C++ resolves via SlotTag).
                    entries.push({ label: 'Unequip', onClick: () => {
                        publish('UI.Cmd.Equipment.Unequip', { ItemId: '', SlotTag: equippedSlotTag });
                    }});
                } else {
                    entries.push({ label: 'Equip', onClick: () => {
                        publish('UI.Cmd.Equipment.Equip', { ItemId: String(it.InstanceId), SlotTag: '' });
                    }});
                }
            } else if (cat === 'Consumable') {
                entries.push({ label: 'Use', onClick: () => {
                    publish('UI.Cmd.Inventory.Use', { OwnerId: fromOwnerId, SlotIndex: it.SlotIndex });
                }});
            }
            entries.push({ label: 'Assign to Hotbar…', onClick: () => {
                window.TSICInventory.openHotbarSlotModal(it.ItemId, (slotIndex) => {
                    publish('UI.Cmd.Hotbar.Assign', { SlotIndex: slotIndex, ItemId: String(it.InstanceId) });
                    if (onAssignedHotbar) onAssignedHotbar(slotIndex);
                });
            }});
            if (storageOpen && toOwnerId) {
                entries.push({ label: 'Transfer…', onClick: () => {
                    const max = it.Count || 1;
                    if (max <= 1) {
                        publish('UI.Cmd.Inventory.Transfer', {
                            FromOwnerId: fromOwnerId, ToOwnerId: toOwnerId,
                            FromSlot: it.SlotIndex, ToSlot: -1, Count: 1
                        });
                        tsic.playSound('Inventory.Transfer');
                        return;
                    }
                    window.TSICInventory.openQuantityModal(max, (count) => {
                        publish('UI.Cmd.Inventory.Transfer', {
                            FromOwnerId: fromOwnerId, ToOwnerId: toOwnerId,
                            FromSlot: it.SlotIndex, ToSlot: -1, Count: count
                        });
                        tsic.playSound('Inventory.Transfer');
                    }, { title: 'Transfer how many?', confirmLabel: 'Transfer' });
                }});
            }
            entries.push({ label: 'Drop…', onClick: () => {
                const max = it.Count || 1;
                if (max <= 1) {
                    publish('UI.Cmd.Inventory.Drop', { OwnerId: fromOwnerId, SlotIndex: it.SlotIndex, Count: 1 });
                    tsic.playSound('Inventory.Drop');
                    return;
                }
                window.TSICInventory.openQuantityModal(max, (count) => {
                    publish('UI.Cmd.Inventory.Drop', { OwnerId: fromOwnerId, SlotIndex: it.SlotIndex, Count: count });
                    tsic.playSound('Inventory.Drop');
                });
            }});
            return entries;
        },
        openHotbarSlotModal(itemId, onPick) {
            // C++ NumHotbarSlots == 10. Slot index space is 0..9; the modal's
            // visible labels follow the keyboard convention (1..9, 0).
            const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;' });
            const panel = el('div', { class: 'tsic-panel', style: 'padding:16px;' });
            panel.appendChild(el('h3', { style: 'margin:0 0 12px;' }, 'Pick hotbar slot (1-9 or 0)'));
            const row = el('div', { style: 'display:flex;gap:6px;' });
            const buttons = [];
            const finish = (slotIndex) => { overlay.remove(); window.removeEventListener('keydown', onKey, true); onPick(slotIndex); };
            for (let i = 0; i < 10; i++) {
                const label = i === 9 ? '0' : String(i + 1);
                const btn = el('button', { class: 'tsic-button', style: 'width:48px;height:48px;' }, label);
                btn.addEventListener('click', () => finish(i));
                buttons.push(btn);
                row.appendChild(btn);
            }
            const onKey = (e) => {
                if (e.key === 'Escape') { overlay.remove(); window.removeEventListener('keydown', onKey, true); return; }
                if (/^[0-9]$/.test(e.key)) {
                    const slotIndex = e.key === '0' ? 9 : (parseInt(e.key, 10) - 1);
                    e.stopPropagation();
                    finish(slotIndex);
                }
            };
            window.addEventListener('keydown', onKey, true);
            panel.appendChild(row);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);
        }
    };
})();
