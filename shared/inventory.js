// Renderers + drag-drop + modal helpers for the inventory page. Reads from
// tsic.itemCatalog for display data. The page itself stays declarative.
(function(){
    function el(tag, props = {}, children = []) {
        const e = document.createElement(tag);
        Object.assign(e, props);
        if (props.style) e.style.cssText = props.style;
        for (const c of children) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        return e;
    }
    window.TSICInventory = {
        el,
        // Vertical scrollable item list. Renders one .tsic-list-row per stack
        // (not per slot — empty slots aren't shown). Each row is icon | name |
        // right-aligned count and weight. Drag-drop is per-stack on the visible
        // slot index. Used by inventory + storage.
        renderList(host, items, opts) {
            const cat = (opts && opts.catalog) || (window.tsic && window.tsic.itemCatalog) || {};
            host.innerHTML = '';
            const list = items || [];
            if (list.length === 0) {
                const empty = el('div', { className: 'tsic-empty', textContent: opts.emptyLabel || 'Empty' });
                host.appendChild(empty);
                return;
            }
            for (const it of list) {
                const desc = cat[it.ItemId] || {};
                const row = el('div', { className: 'tsic-list-row' });
                row.dataset.slot = it.SlotIndex;
                // Opt the row into the spatial-nav focus engine. The engine
                // only renders a focus ring under Gamepad mode, so mouse/KBM
                // users see no visual change.
                row.setAttribute('data-tsic-focusable', '');
                if (opts.selectedIdx === it.SlotIndex) row.classList.add('is-selected');

                const iconWrap = el('div', { className: 'icon' });
                if (it.ItemId) {
                    const img = el('img', { src: `tex://item-icon/${encodeURIComponent(it.ItemId)}` });
                    iconWrap.appendChild(img);
                }
                row.appendChild(iconWrap);

                const name = el('div', { className: 'name', textContent: desc.Name || it.ItemId || 'Unknown' });
                row.appendChild(name);

                const right = el('div', { className: 'right' });
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
                    e.dataTransfer.setData('application/tsic-item', JSON.stringify({ slot: it.SlotIndex, itemId: it.ItemId }));
                    row.classList.add('is-dragging');
                });
                row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
                row.addEventListener('dragover', (e) => e.preventDefault());
                row.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const raw = e.dataTransfer.getData('application/tsic-item');
                    if (!raw) return;
                    try { opts.onDrop && opts.onDrop(JSON.parse(raw), it.SlotIndex); } catch {}
                });
                host.appendChild(row);
            }
        },
        renderGrid(host, items, opts) {
            const totalSlots = opts.maxSlots > 0 ? opts.maxSlots : 32;
            host.innerHTML = '';
            const indexed = new Map();
            for (const it of (items || [])) indexed.set(it.SlotIndex, it);
            for (let i = 0; i < totalSlots; i++) {
                const it = indexed.get(i);
                const slot = el('div', { className: 'tsic-slot' + (opts.selectedIdx === i ? ' selected' : '') });
                slot.dataset.slot = i;
                if (it) {
                    if (it.ItemId) {
                        const img = el('img', { src: `tex://item-icon/${encodeURIComponent(it.ItemId)}`,
                            style: 'width:100%;height:100%;object-fit:contain;pointer-events:none;' });
                        slot.appendChild(img);
                    }
                    if (it.Count > 1) {
                        slot.appendChild(el('span', { className: 'count', textContent: String(it.Count) }));
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
            host.appendChild(el('img', { src: `tex://item-icon/${encodeURIComponent(itemDescriptor.ItemId)}`,
                style: 'width:96px;height:96px;object-fit:contain;display:block;margin:0 auto 8px;' }));
            host.appendChild(el('h3', { textContent: itemDescriptor.Name, style: 'margin:0 0 4px;' }));
            host.appendChild(el('p', { textContent: itemDescriptor.Description || '', style: 'font-size:12px;opacity:0.75;' }));
            const meta = el('div', { style: 'margin-top:8px;font-size:11px;opacity:0.65;' });
            meta.innerHTML = `<div>Category: ${itemDescriptor.Category || 'Other'}</div>`
                + `<div>Weight: ${(itemDescriptor.Weight || 0).toFixed(2)}</div>`
                + (itemInstance && itemInstance.Count > 1 ? `<div>Stack: ${itemInstance.Count}</div>` : '');
            host.appendChild(meta);
        },
        openQuantityModal(maxCount, onConfirm, opts) {
            const title = (opts && opts.title) || 'Drop how many?';
            const confirmLabel = (opts && opts.confirmLabel) || 'Drop';
            const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;' });
            const panel = el('div', { className: 'tsic-panel', style: 'width:300px;padding:16px;' });
            panel.appendChild(el('h3', { textContent: title, style: 'margin:0 0 12px;' }));
            const slider = el('input', { type: 'range', min: 1, max: maxCount, value: maxCount, style: 'width:100%;' });
            const num = el('div', { textContent: String(maxCount), style: 'text-align:center;font-size:18px;margin:8px 0;' });
            slider.addEventListener('input', () => num.textContent = slider.value);
            const buttons = el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;' });
            const cancel = el('button', { className: 'tsic-button', textContent: 'Cancel' });
            const ok = el('button', { className: 'tsic-button', textContent: confirmLabel });
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
        buildItemContextMenu({ it, desc, storageOpen = false, fromOwnerId = 'Player', toOwnerId = null, onAssignedHotbar }) {
            const publish = (tag, payload) => {
                if (window.tsic && window.tsic.publishMessage) window.tsic.publishMessage(tag, payload);
            };
            const entries = [];
            const cat = desc && desc.Category;
            if (cat === 'Equipment') {
                entries.push({ label: 'Equip', onClick: () => {
                    publish('UI.Cmd.Equipment.Equip', { ItemId: String(it.SlotIndex), SlotTag: '' });
                }});
            } else if (cat === 'Consumable') {
                entries.push({ label: 'Use', onClick: () => {
                    publish('UI.Cmd.Inventory.Use', { OwnerId: fromOwnerId, SlotIndex: it.SlotIndex });
                }});
            }
            entries.push({ label: 'Assign to Hotbar…', onClick: () => {
                window.TSICInventory.openHotbarSlotModal(it.ItemId, (slotIndex) => {
                    publish('UI.Cmd.Hotbar.Assign', { SlotIndex: slotIndex, ItemId: String(it.SlotIndex) });
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
                        publish('UI.Cmd.Sound.Play', { SoundKey: 'Inventory.Transfer', VolumeScale: 1.0 });
                        return;
                    }
                    window.TSICInventory.openQuantityModal(max, (count) => {
                        publish('UI.Cmd.Inventory.Transfer', {
                            FromOwnerId: fromOwnerId, ToOwnerId: toOwnerId,
                            FromSlot: it.SlotIndex, ToSlot: -1, Count: count
                        });
                        publish('UI.Cmd.Sound.Play', { SoundKey: 'Inventory.Transfer', VolumeScale: 1.0 });
                    }, { title: 'Transfer how many?', confirmLabel: 'Transfer' });
                }});
            }
            entries.push({ label: 'Drop…', onClick: () => {
                const max = it.Count || 1;
                if (max <= 1) {
                    publish('UI.Cmd.Inventory.Drop', { OwnerId: fromOwnerId, SlotIndex: it.SlotIndex, Count: 1 });
                    publish('UI.Cmd.Sound.Play', { SoundKey: 'Inventory.Drop', VolumeScale: 1.0 });
                    return;
                }
                window.TSICInventory.openQuantityModal(max, (count) => {
                    publish('UI.Cmd.Inventory.Drop', { OwnerId: fromOwnerId, SlotIndex: it.SlotIndex, Count: count });
                    publish('UI.Cmd.Sound.Play', { SoundKey: 'Inventory.Drop', VolumeScale: 1.0 });
                });
            }});
            return entries;
        },
        openHotbarSlotModal(itemId, onPick) {
            // C++ NumHotbarSlots == 10. Slot index space is 0..9; the modal's
            // visible labels follow the keyboard convention (1..9, 0).
            const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;' });
            const panel = el('div', { className: 'tsic-panel', style: 'padding:16px;' });
            panel.appendChild(el('h3', { textContent: 'Pick hotbar slot (1-9 or 0)', style: 'margin:0 0 12px;' }));
            const row = el('div', { style: 'display:flex;gap:6px;' });
            const buttons = [];
            const finish = (slotIndex) => { overlay.remove(); window.removeEventListener('keydown', onKey, true); onPick(slotIndex); };
            for (let i = 0; i < 10; i++) {
                const label = i === 9 ? '0' : String(i + 1);
                const btn = el('button', { className: 'tsic-button', textContent: label, style: 'width:48px;height:48px;' });
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
