// Shared rendering logic for the three lore-screen pages
// (paper.html / screen.html / tablet.html). Each page declares its own kind
// via the data-kind attribute on the script tag below; the helper subscribes
// only when the published ScreenKind matches.
//
//   <script src="/shared/lore.js" data-kind="Paper" defer></script>
//
// The page is expected to contain:
//   #lore-title, #lore-group, #lore-heading, #lore-body, #lore-prev, #lore-next, #lore-close, #lore-index-list
(function(){
    function $(id){ return document.getElementById(id); }

    const me = document.currentScript;
    const kind = me ? me.getAttribute('data-kind') : '';

    let texts = [];
    let index = 0;

    function clamp(i) { return Math.max(0, Math.min((texts.length || 1) - 1, i)); }

    // ── Per-series handwriting (Paper only) ──────────────────────────────────
    // Each note series (keyed by GroupTitle) always reads in the same hand;
    // different series vary across the set. Pin a specific series to a specific
    // hand in SERIES_FONTS; anything unlisted is assigned deterministically by
    // hashing its key, so the same series is always consistent across pages.
    const HAND_FONTS = [
        "'Shadows Into Light', cursive",
        "'Gloria Hallelujah', cursive",
        "'Reenie Beanie', cursive",
    ];
    const SERIES_FONTS = {
        // "Journal": "'Reenie Beanie', cursive",
    };
    function hashIdx(s, n) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return n ? h % n : 0; }
    function handFor(t) {
        // Key off the series (GroupTitle); fall back to the note's first heading
        // so an untitled note still gets one stable hand across its pages.
        const key = (t && t.GroupTitle) || (texts[0] && texts[0].Heading) || 'note';
        return SERIES_FONTS[key] || HAND_FONTS[hashIdx(key, HAND_FONTS.length)];
    }
    function applyHand(t) {
        if (kind !== 'Paper') return;
        const sheet = $('paper-sheet');
        if (sheet) sheet.style.setProperty('--note-hand', handFor(t));
    }

    function render() {
        const t = texts[index] || {};
        applyHand(t);
        if ($('lore-group'))   $('lore-group').textContent   = t.GroupTitle || '';
        if ($('lore-heading')) $('lore-heading').textContent = t.Heading    || '';
        if ($('lore-body'))    $('lore-body').textContent    = t.Body       || '';
        const list = $('lore-index-list');
        if (list) {
            list.innerHTML = '';
            for (let i = 0; i < texts.length; i++) {
                const li = document.createElement('div');
                li.className = 'lore-index' + (i === index ? ' current' : '');
                li.textContent = (texts[i] && texts[i].Heading) || `(${i + 1})`;
                li.setAttribute('data-tsic-focusable', '');
                li.tabIndex = -1;
                li.onclick = () => { index = clamp(i); render(); publishSelect(); };
                list.appendChild(li);
            }
        }
        if ($('lore-pageinfo')) $('lore-pageinfo').textContent = `${index + 1} / ${texts.length || 0}`;
        const prev = $('lore-prev'); if (prev) prev.disabled = (index <= 0);
        const next = $('lore-next'); if (next) next.disabled = (index >= texts.length - 1);
    }

    function publishSelect() {
        try { tsic.publishMessage('UI.Cmd.LoreScreen.Select', { Index: index }); } catch (e) {}
    }

    function publishClose() {
        try { tsic.publishMessage('UI.Cmd.LoreScreen.Close', {}); } catch (e) {}
        tsic.publishMessage('UI.Cmd.Pause.Resume', {});
    }

    (function boot() {
        if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
        tsic.whenReady(function () {
            tsic.on('tsic.msg.UI.LoreScreen.Opened', (p) => {
                if (!p || (kind && p.ScreenKind && p.ScreenKind !== kind)) return;
                texts = Array.isArray(p.Texts) ? p.Texts : [];
                index = clamp(p.InitialIndex || 0);
                render();
            });
            const prev = $('lore-prev'); if (prev) prev.onclick = () => { index = clamp(index - 1); render(); publishSelect(); };
            const next = $('lore-next'); if (next) next.onclick = () => { index = clamp(index + 1); render(); publishSelect(); };
            const close= $('lore-close');if (close) close.onclick = publishClose;
            window.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft')  { index = clamp(index - 1); render(); publishSelect(); }
                if (e.key === 'ArrowRight') { index = clamp(index + 1); render(); publishSelect(); }
                if (e.key === 'Escape')     publishClose();
            });
            render();
        });
    })();
})();
