// Helper API for menu pages that publish a dynamic behavior-bar context.
// Static-context pages don't need this file — router.js handles them via the
// <meta name="tsic-action-bar-context"> tag.
//
// Usage:
//   tsic.setMenuActionContext([
//     { ActionName: 'IA_UI_ConfirmAccept', Label: 'Equip', Priority: 10 },
//     { ActionName: 'IA_UI_DropItem',      Label: 'Drop',  Priority: 30 },
//   ]);
//   tsic.clearMenuActionContext();  // before leaving / on focus loss
//
// router.js automatically injects an [IA_UI_CancelBack] Back row unless the
// page provided its own entry for IA_UI_CancelBack.
(function () {
    function bind() {
        if (!window.tsic || !window.tsic.publishMessage) {
            setTimeout(bind, 16);
            return;
        }
        const sender = (window.__tsicPublishMenuActionContext)
            // Use router.js's helper when present (handles auto-Back + de-dupe).
            ? window.__tsicPublishMenuActionContext
            // Fallback: send raw if router.js hasn't loaded yet.
            : function (entries) {
                window.tsic.publishMessage('UI.Cmd.BehaviorBar.SetMenuContext', { Entries: entries });
            };

        window.tsic.setMenuActionContext = function (entries) {
            const safe = (Array.isArray(entries) ? entries : []).map((e) => ({
                ActionName: String((e && e.ActionName) || ''),
                Label:      String((e && e.Label) || ''),
                Priority:   Number.isFinite(e && e.Priority) ? e.Priority : 100,
            })).filter((e) => e.ActionName);
            sender(safe);
        };
        window.tsic.clearMenuActionContext = function () {
            sender([]);
        };
    }
    bind();
})();
