// /screens/main-menu.html — no incoming subscriptions; pure buttons that
// publish UI.Cmd.Menu.Navigate / UI.Cmd.Menu.Exit. The interesting state is
// the random showroom feature tile. Scenarios postMessage to the iframe so
// the page can re-render with a chosen showroom (or roll a new random one).
//
// expect.visualChange:false is set because the projected state here is
// empty — visual changes happen via postMessage, outside the project/inject
// loop that the sweep runner watches.
(function () {
    function postShowroom(id) {
        const iframe = document.getElementById('pg-iframe');
        const win = iframe && iframe.contentWindow;
        if (!win) return;
        // If pickShowroom is already on the iframe's window, prefer the direct
        // call — it's same-origin so this is allowed and avoids a tick.
        if (typeof win.pickShowroom === 'function') {
            win.pickShowroom(id);
            return;
        }
        win.postMessage({ type: 'tsic.showroom', id }, '*');
    }

    TSICPlayground.register({
        id: 'main-menu',
        label: 'Main Menu',
        screen: '/screens/main-menu.html',
        initialState() { return {}; },
        project() { return []; },
        scenarios: [
            // Showroom switcher.
            { label: 'Showroom · Living Room', apply() { postShowroom('living-room'); }, expect: { visualChange: false, injects: 0 } },
            { label: 'Showroom · Kitchen',     apply() { postShowroom('kitchen');     }, expect: { visualChange: false, injects: 0 } },
            { label: 'Showroom · Bedroom',     apply() { postShowroom('bedroom');     }, expect: { visualChange: false, injects: 0 } },
            { label: 'Showroom · Dining Room', apply() { postShowroom('dining-room'); }, expect: { visualChange: false, injects: 0 } },
            { label: 'Showroom · Kids Room',   apply() { postShowroom('kids-room');   }, expect: { visualChange: false, injects: 0 } },
            { label: 'Showroom · Hallway',     apply() { postShowroom('hallway');     }, expect: { visualChange: false, injects: 0 } },
            { label: 'Showroom · Random',      apply() { postShowroom();              }, expect: { visualChange: false, injects: 0 } },
        ],
    });
})();
