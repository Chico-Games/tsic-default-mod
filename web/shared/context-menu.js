// Lightweight context-menu primitive. Reusable by inventory / storage / hotbar
// pages. Single menu at a time; closing handlers are wired on open and torn down
// on close. Built with the Catalogue tsic-panel chrome so styling matches the
// rest of the SPA.
(function () {
    let openMenu = null;

    function teardown() {
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('mousedown', onOutside, true);
        window.removeEventListener('blur', closeMenu);
        window.removeEventListener('scroll', closeMenu, true);
    }

    function closeMenu() {
        if (!openMenu) return;
        // Null the handle BEFORE popping the focus scope: popScope fires our
        // onPop, which re-enters closeMenu — the null handle makes that a no-op.
        const panel = openMenu;
        openMenu = null;
        teardown();
        if (panel._tsicScope && window.tsic && window.tsic.focus && window.tsic.focus.popScope) {
            panel._tsicScope = null;
            try { window.tsic.focus.popScope(); } catch (_) { /* already popped */ }
        }
        panel.remove();
    }

    function onKey(e) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closeMenu();
        }
    }

    function onOutside(e) {
        if (!openMenu) return;
        if (!openMenu.contains(e.target)) closeMenu();
    }

    function clampToViewport(panel, x, y) {
        // Place tentatively, then nudge inside viewport.
        panel.style.left = `${x}px`;
        panel.style.top  = `${y}px`;
        const rect = panel.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (rect.right > vw) panel.style.left = `${Math.max(0, vw - rect.width - 4)}px`;
        if (rect.bottom > vh) panel.style.top = `${Math.max(0, vh - rect.height - 4)}px`;
    }

    function open(opts) {
        closeMenu();
        const entries = (opts && opts.entries) || [];
        if (entries.length === 0) return;
        const panel = document.createElement('div');
        panel.className = 'tsic-panel tsic-context-menu';
        let firstItem = null;
        for (const e of entries) {
            // Real buttons + data-tsic-focusable so the focus engine can walk
            // the menu on gamepad (Confirm activates via click()).
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'tsic-context-item' + (e.disabled ? ' is-disabled' : '');
            item.textContent = e.label;
            item.setAttribute('data-tsic-focusable', '');
            if (!e.disabled) {
                if (!firstItem) firstItem = item;
                item.addEventListener('click', () => {
                    closeMenu();
                    try { e.onClick && e.onClick(); } catch (err) { console.warn('[context-menu] entry threw:', err); }
                });
            } else {
                item.disabled = true;
            }
            panel.appendChild(item);
        }
        document.body.appendChild(panel);
        openMenu = panel;
        clampToViewport(panel, opts.x || 0, opts.y || 0);
        // Modal focus scope: gamepad nav stays inside the menu and Back closes
        // it (screen-manager checks backHandled before closing the screen).
        if (window.tsic && window.tsic.focus && window.tsic.focus.pushScope) {
            try {
                window.tsic.focus.pushScope(panel, firstItem, { onPop: () => {
                    // Back consumed the scope directly — close without re-popping.
                    panel._tsicScope = null;
                    if (openMenu === panel) closeMenu();
                } });
                panel._tsicScope = true;
            } catch (_) { /* focus engine dormant (mouse mode) */ }
        }
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('mousedown', onOutside, true);
        window.addEventListener('blur', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
    }

    window.TSICContextMenu = { open, close: closeMenu };
})();
