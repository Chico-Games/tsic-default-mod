// Shared tab-filter component — renders a row of tab buttons into a host
// element, tracks the active tab, and calls back on change.
//
// Usage:
//   const tf = TSIC.TabFilter.create(hostEl, [
//       { id: 'All',   label: 'All'   },
//       { id: 'Tools', label: 'Tools' },
//   ], function onTabChange(activeId) { /* re-render your list */ });
//
//   tf.getActive()   // => current tab id
//   tf.setActive(id) // switch tab programmatically (fires onChange)
//   tf.render()      // re-render buttons (e.g. after dynamic tab list change)
//   tf.setTabs(newTabs) // replace tab definitions and re-render
//
// CSS: uses .tsic-tab / .is-active from tsic-ui.css.
// Gamepad: buttons are natively focusable; host should carry
//          data-tsic-tab-bar so tsic-focus LB/RB cycling works.
(function () {
    'use strict';

    function create(hostEl, tabs, onChange) {
        var _tabs = (tabs || []).slice();
        var _active = _tabs.length > 0 ? _tabs[0].id : null;

        function render() {
            hostEl.innerHTML = '';
            for (var i = 0; i < _tabs.length; i++) {
                var t = _tabs[i];
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tsic-tab' + (t.id === _active ? ' is-active' : '');
                btn.textContent = t.label || t.id;
                btn.setAttribute('data-tsic-focus-group', 'tabs');
                (function (tabId) {
                    btn.addEventListener('click', function () {
                        if (_active === tabId) return;
                        _active = tabId;
                        render();
                        if (typeof onChange === 'function') onChange(_active);
                    });
                })(t.id);
                hostEl.appendChild(btn);
            }
        }

        function setActive(id) {
            if (_active === id) return;
            for (var i = 0; i < _tabs.length; i++) {
                if (_tabs[i].id === id) {
                    _active = id;
                    render();
                    if (typeof onChange === 'function') onChange(_active);
                    return;
                }
            }
        }

        function getActive() {
            return _active;
        }

        function setTabs(newTabs) {
            _tabs = (newTabs || []).slice();
            // If the current active tab no longer exists, fall back to first.
            var found = false;
            for (var i = 0; i < _tabs.length; i++) {
                if (_tabs[i].id === _active) { found = true; break; }
            }
            if (!found) _active = _tabs.length > 0 ? _tabs[0].id : null;
            render();
        }

        // Initial render.
        render();

        return {
            setActive: setActive,
            getActive: getActive,
            render: render,
            setTabs: setTabs,
        };
    }

    window.TSIC = window.TSIC || {};
    window.TSIC.TabFilter = { create: create };
})();
