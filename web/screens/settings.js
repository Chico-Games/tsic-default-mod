(function boot() {
    if (!window.tsic) { setTimeout(boot, 16); return; }

    // Activate the Settings input situation while this screen is up so navigation,
    // accept and back are bound (settings is a full screen change off the pause menu,
    // so it does not inherit the pause menu's UI.Generic situation). Balanced by a
    // pagehide remove that fires whether the page is navigated away (LoadURL) or the
    // SPA unmounts it.
    tsic.publishMessage('UI.Cmd.Input.AppendModeTag', { Tag: 'InputMode.Menu.Settings' });
    window.addEventListener('pagehide', () => {
        tsic.publishMessage('UI.Cmd.Input.RemoveModeTag', { Tag: 'InputMode.Menu.Settings' });
    });

    // Shared low..epic options for the scalability dropdowns. Fresh arrays per
    // call — applyNvidiaCaps-style pruning mutates option lists in place.
    function qualityLevels() {
        return [
            { Value: 'low',    Label: 'Low' },
            { Value: 'medium', Label: 'Medium' },
            { Value: 'high',   Label: 'High' },
            { Value: 'epic',   Label: 'Epic' },
        ];
    }

    // Static catalog for Audio/Video/Gameplay. The "Keyboard & Mouse" and
    // "Controller" tabs are built dynamically from UI.Settings.ControlsState
    // (rebinds can't be captured in JS; the C++ input manager drives capture —
    // see HandleCmdSettingsBeginRebind).
    const STATIC_CATALOG = {
        Pages: [
            { Id: 'AudioCollection', Title: 'Audio', Groups: [
                { Id: 'Levels', Title: 'Levels', Settings: [
                    // Values here are only the placeholder shown before C++ echoes the real
                    // ones, so they must match ScpGameUserSettings' defaults or the sliders
                    // visibly jump on open.
                    { Key: 'audio.master', Label: 'Master volume', Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.6 },
                    { Key: 'audio.music',  Label: 'Music volume',  Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.8 },
                    { Key: 'audio.sfx',    Label: 'SFX volume',    Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 1 },
                    { Key: 'audio.menu_music', Label: 'Menu music volume', Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.8 },
                ] },
                { Id: 'Voice', Title: 'Voice chat', Settings: [
                    { Key: 'voice.enabled', Label: 'Voice chat', Type: 'bool', Value: true },
                    { Key: 'voice.mode', Label: 'Microphone mode', Type: 'enum',
                      Options: [
                          { Value: 'ptt',    Label: 'Push to talk' },
                          { Value: 'toggle', Label: 'Toggle mute' },
                      ],
                      Value: 'ptt' },
                    // Voice volume is 0..2 (1 = normal) so quiet teammates can be boosted.
                    { Key: 'voice.output_volume', Label: 'Voice volume', Type: 'range', Min: 0, Max: 2, Step: 0.05, Value: 1 },
                    // Options are replaced by the C++-enumerated device list
                    // (UI.Settings.VoiceDevices) when it arrives.
                    { Key: 'voice.input_device', Label: 'Microphone', Type: 'enum',
                      Options: [ { Value: '', Label: 'System default' } ],
                      Value: '' },
                ] },
            ] },
            { Id: 'VideoCollection', Title: 'Video', Groups: [
                { Id: 'Display', Title: 'Display', Settings: [
                    { Key: 'video.window_mode', Label: 'Window mode', Type: 'enum',
                      Options: [
                          { Value: 'fullscreen', Label: 'Fullscreen' },
                          { Value: 'borderless', Label: 'Borderless window' },
                          { Value: 'windowed',   Label: 'Windowed' },
                      ],
                      Value: 'borderless' },
                    // FALLBACK ONLY. C++ replaces these wholesale via
                    // video.resolution_options with the modes this display actually
                    // reports, filtered by the current window mode. The static list
                    // cannot know the monitor: it offers 4K on a 1440p panel, and
                    // exclusive fullscreen at a mode the display does not have is a
                    // stretched or black screen.
                    { Key: 'video.resolution', Label: 'Resolution', Type: 'enum',
                      Options: [
                          { Value: '1280x720',  Label: '1280 × 720 (HD)' },
                          { Value: '1366x768',  Label: '1366 × 768' },
                          { Value: '1600x900',  Label: '1600 × 900' },
                          { Value: '1680x1050', Label: '1680 × 1050 (16:10)' },
                          { Value: '1920x1080', Label: '1920 × 1080 (FHD)' },
                          { Value: '1920x1200', Label: '1920 × 1200 (16:10)' },
                          { Value: '2560x1080', Label: '2560 × 1080 (Ultrawide)' },
                          { Value: '2560x1440', Label: '2560 × 1440 (QHD)' },
                          { Value: '2560x1600', Label: '2560 × 1600 (16:10)' },
                          { Value: '3440x1440', Label: '3440 × 1440 (Ultrawide)' },
                          { Value: '3840x2160', Label: '3840 × 2160 (4K)' },
                      ],
                      Value: '1920x1080' },
                    // graphics.* on purpose (instant apply, no countdown): neither
                    // VSync nor an FPS cap can strand the player.
                    { Key: 'graphics.vsync', Label: 'VSync', Type: 'bool', Value: false },
                    { Key: 'graphics.fps_limit', Label: 'Frame rate limit', Type: 'enum',
                      Options: [
                          { Value: '30',  Label: '30 FPS' },
                          { Value: '60',  Label: '60 FPS' },
                          { Value: '90',  Label: '90 FPS' },
                          { Value: '120', Label: '120 FPS' },
                          { Value: '144', Label: '144 FPS' },
                          { Value: '165', Label: '165 FPS' },
                          { Value: '200', Label: '200 FPS' },
                          { Value: '240', Label: '240 FPS' },
                          { Value: '0',   Label: 'Unlimited' },
                      ],
                      Value: '200' },
                    { Key: 'graphics.brightness', Label: 'Brightness (gamma)',
                      Type: 'range', Min: 1.4, Max: 3, Step: 0.05, Value: 2.2 },
                    // Removed on displays without HDR output (video.hdr_supported).
                    // video.* on purpose: a bad HDR switch gets the countdown.
                    { Key: 'video.hdr', Label: 'HDR output', Type: 'bool', Value: false },
                ] },
                { Id: 'Graphics', Title: 'Graphics', Settings: [
                    // graphics.* (not video.*) on purpose: video.* keys open the
                    // keep/revert countdown, which is for display-mode changes
                    // that can strand the player — a GI change can't.
                    //
                    // Benchmarks the machine and rewrites the preset, the Lumen tier
                    // and the resolution scale. The game freezes for a second or two
                    // while it measures; every value it lands on is an ordinary row
                    // below, so nothing here is locked afterwards.
                    { Key: 'graphics.autodetect', Label: 'Detect optimal settings',
                      Type: 'action', ButtonText: 'Detect' },
                    //
                    // Overall preset drives the "Advanced quality" categories below.
                    // "Custom" is display-only: C++ echoes it when the categories
                    // are mixed and rejects it as an input.
                    { Key: 'graphics.quality', Label: 'Overall quality', Type: 'enum',
                      Options: [
                          { Value: 'low',    Label: 'Low' },
                          { Value: 'medium', Label: 'Medium' },
                          { Value: 'high',   Label: 'High' },
                          { Value: 'epic',   Label: 'Epic' },
                          { Value: 'custom', Label: 'Custom' },
                      ],
                      Value: 'high' },
                    { Key: 'graphics.lumen', Label: 'Lumen quality', Type: 'enum',
                      Options: [
                          { Value: 'low',    Label: 'Low (Lumen Lite)' },
                          { Value: 'medium', Label: 'Medium (Software)' },
                          { Value: 'high',   Label: 'High (Hardware Ray Tracing)' },
                      ],
                      Value: 'medium' },
                    // Upscaler options must match HandleCmdSettingsSet's allow-list
                    // exactly — it drops anything else on the floor. The dlss_*/dlaa
                    // entries are pruned on GPUs without DLSS and the fsr_* entries
                    // on machines without the FSR plugin (graphics.nvidia_caps), so
                    // TSR is the only option every machine keeps.
                    { Key: 'graphics.upscaler', Label: 'Upscaling', Type: 'enum',
                      Options: [
                          { Value: 'tsr',                   Label: 'TSR (recommended)' },
                          { Value: 'dlaa',                  Label: 'DLAA (native res, best quality)' },
                          { Value: 'dlss_quality',          Label: 'DLSS Quality' },
                          { Value: 'dlss_balanced',         Label: 'DLSS Balanced' },
                          { Value: 'dlss_performance',      Label: 'DLSS Performance' },
                          { Value: 'dlss_ultra_performance',Label: 'DLSS Ultra Performance' },
                          { Value: 'fsr_native_aa',         Label: 'FSR Native AA (native res, best quality)' },
                          { Value: 'fsr_quality',           Label: 'FSR Quality' },
                          { Value: 'fsr_balanced',          Label: 'FSR Balanced' },
                          { Value: 'fsr_performance',       Label: 'FSR Performance' },
                          { Value: 'fsr_ultra_performance', Label: 'FSR Ultra Performance' },
                      ],
                      Value: 'tsr' },
                    // TSR's internal render percentage — the old "Upscaling quality"
                    // tiers were just fixed points on this scale (performance 50 /
                    // balanced 67 / quality 77 / ultra 100). Ignored while a DLSS mode
                    // is selected: DLSS picks its own optimal percentage.
                    { Key: 'graphics.resolution_scale', Label: 'Render resolution (TSR)',
                      Type: 'range', Min: 50, Max: 100, Step: 1, Value: 100 },
                    // Frame generation and Reflex are NVIDIA-only, FSR frame gen is
                    // FSR-plugin-only; the rows are removed wholesale when
                    // graphics.nvidia_caps reports no support.
                    { Key: 'graphics.frame_gen', Label: 'Frame generation (DLSS)', Type: 'enum',
                      Options: [
                          { Value: 'off',  Label: 'Off' },
                          { Value: 'auto', Label: 'Auto' },
                          { Value: '2x',   Label: '2x' },
                          { Value: '3x',   Label: '3x' },
                          { Value: '4x',   Label: '4x' },
                      ],
                      Value: 'off' },
                    // Only takes effect while an FSR upscaling mode is selected.
                    { Key: 'graphics.fsr_frame_gen', Label: 'Frame generation (FSR)', Type: 'bool', Value: false },
                    { Key: 'graphics.reflex', Label: 'NVIDIA Reflex (low latency)', Type: 'enum',
                      Options: [
                          { Value: 'off',   Label: 'Off' },
                          { Value: 'on',    Label: 'On' },
                          { Value: 'boost', Label: 'On + Boost' },
                      ],
                      Value: 'on' },
                    { Key: 'graphics.motion_blur', Label: 'Motion blur', Type: 'bool', Value: true },
                ] },
                // Per-category scalability. GI, anti-aliasing and render resolution
                // deliberately have no rows here — they're owned by the Lumen /
                // upscaler settings above.
                { Id: 'Quality', Title: 'Advanced quality', Settings: [
                    { Key: 'graphics.view_distance',   Label: 'View distance',   Type: 'enum', Options: qualityLevels(), Value: 'high' },
                    { Key: 'graphics.shadows',         Label: 'Shadows',         Type: 'enum', Options: qualityLevels(), Value: 'high' },
                    { Key: 'graphics.textures',        Label: 'Textures',        Type: 'enum', Options: qualityLevels(), Value: 'high' },
                    { Key: 'graphics.effects',         Label: 'Effects',         Type: 'enum', Options: qualityLevels(), Value: 'high' },
                    { Key: 'graphics.post_processing', Label: 'Post-processing', Type: 'enum', Options: qualityLevels(), Value: 'high' },
                    { Key: 'graphics.foliage',         Label: 'Foliage',         Type: 'enum', Options: qualityLevels(), Value: 'high' },
                    { Key: 'graphics.shading',         Label: 'Shading',         Type: 'enum', Options: qualityLevels(), Value: 'high' },
                    { Key: 'graphics.reflections',     Label: 'Reflections',     Type: 'enum', Options: qualityLevels(), Value: 'high' },
                ] },
            ] },
            { Id: 'GameplayCollection', Title: 'Gameplay', Groups: [
                { Id: 'Interface', Title: 'Interface', Settings: [
                    { Key: 'gameplay.show_tutorial', Label: 'Show tutorial objectives', Type: 'bool', Value: true },
                    // Names floating over other players. Off leaves teammates unlabelled —
                    // findable only by voice and the map, which some players prefer.
                    { Key: 'gameplay.player_nametags', Label: 'Show player nametags', Type: 'bool', Value: true },
                    // Off (default) = north-up minimap with a spinning player arrow.
                    { Key: 'gameplay.minimap_rotate', Label: 'Rotate minimap with player', Type: 'bool', Value: false },
                ] },
                // Off stops the game publishing anything to Discord/Steam/EOS —
                // the friends list then shows only "playing", with no map or count.
                { Id: 'Social', Title: 'Social', Settings: [
                    { Key: 'social.rich_presence', Label: 'Show game activity to friends (Discord, Steam)', Type: 'bool', Value: true },
                ] },
            ] },
            // Accessibility is its own tab, not a group buried under Gameplay: a
            // player who needs these has to be able to find them, and they are the
            // difference between the game being playable and not.
            { Id: 'AccessibilityCollection', Title: 'Accessibility', Groups: [
                // Motion & Comfort. Camera and screen motion the player did not
                // ask for is the main nausea trigger, so every row here removes
                // one source of it. Defaults are the full-motion game; the preset
                // at the bottom flips all of them at once.
                { Id: 'MotionComfort', Title: 'Motion & comfort', Settings: [
                    // Percent, not a bool: the cue notifies multiply their shake
                    // scale by this, so 0 is silent and 40 keeps a hint of impact.
                    { Key: 'accessibility.shake_intensity', Label: 'Screen shake intensity',
                      Type: 'range', Min: 0, Max: 100, Step: 5, Value: 100 },
                    // The camera is welded to the animated head bone — this moves
                    // it to the capsule at the same eye height instead.
                    { Key: 'accessibility.head_bob', Label: 'Head bob', Type: 'bool', Value: true },
                    // The only dynamic FOV in the game (+6° while sprinting).
                    { Key: 'accessibility.sprint_fov', Label: 'Sprint field-of-view effect', Type: 'bool', Value: true },
                    // Mirrors graphics.motion_blur (Video → Graphics); one value,
                    // two rows, and C++ re-echoes so both always agree.
                    { Key: 'accessibility.motion_blur', Label: 'Motion blur', Type: 'bool', Value: true },
                    // Low-health heartbeat, hit flash, stealth breathing. The
                    // static art stays — only the looping stops.
                    { Key: 'accessibility.screen_pulse', Label: 'Pulsing screen effects', Type: 'bool', Value: true },
                    // Menu backdrops and UI chrome animation. Deliberately a game
                    // setting rather than prefers-reduced-motion, which CEF
                    // inherits from the host Windows session.
                    { Key: 'accessibility.reduce_motion', Label: 'Reduce interface motion', Type: 'bool', Value: false },
                    // Opt-in aid, off by default: it costs some of the view.
                    { Key: 'accessibility.sprint_vignette', Label: 'Sprint comfort vignette', Type: 'bool', Value: false },
                    { Key: 'accessibility.reduce_motion_preset', Label: 'Comfort preset',
                      Type: 'action', ButtonText: 'Apply Reduce Motion' },
                ] },
                // Camera framing. A wider view reduces the sense of speed at the
                // screen edges, so it belongs beside the comfort rows even though
                // it is a taste setting for most players.
                { Id: 'Camera', Title: 'Camera', Settings: [
                    { Key: 'gameplay.fov', Label: 'Field of view',
                      Type: 'range', Min: 60, Max: 120, Step: 1, Value: 90 },
                ] },
            ] },
        ],
        Footer: { bRestartRequired: false },
    };

    // The single ControlsState feeds two device tabs; each renders one device's
    // bind button per action so the rows fit a two-column grid.
    const KBM_PAGE_ID = 'ControlsKeyboard';
    const GAMEPAD_PAGE_ID = 'ControlsGamepad';
    function isControlsPage(id) { return id === KBM_PAGE_ID || id === GAMEPAD_PAGE_ID; }

    let activePageId = null;
    let lastCatalog = null;
    let controlsState = null;
    let activeRebind = null;   // { hotkeyId, bGamepad, btn }
    let modalScopePushed = false; // conflict prompt focus trap (tsic.focus.pushScope)
    const localState = {};

    // Instant apply: every edit publishes immediately and per-key persistence
    // happens C++-side on Set. The one carve-out is video-mode keys — a bad display
    // change can strand the player, so those get a keep/revert countdown.
    //
    // That countdown is OWNED BY C++ and only displayed here. It used to run on this
    // page, which cannot work: switching window mode recreates the Slate window, which
    // fires pagehide and pops the focus scope, and the page read both as "the player
    // rejected this" — so borderless and fullscreen reverted one frame after every
    // attempt and were unreachable from windowed (#465). A timer cannot outlive the
    // thing it is timing. The remaining seconds arrive as the video.countdown value.
    let activePopover = null;    // { el, kind: 'countdown' }
    let countdownLabel = null;   // the <b> showing seconds, while a countdown is up

    // Structural signature of the last render + per-key value updaters. A
    // Catalog whose structure is unchanged (only Values differ) is patched in
    // place instead of rebuilding the DOM — otherwise a value echo (e.g. while
    // dragging a slider) would destroy and recreate the control mid-interaction
    // and kill the drag.
    let lastStructSig = null;
    const controlUpdaters = {};

    function valueOf(s) {
        if (s.Key in localState) return localState[s.Key];
        return s.Value;
    }

    function publishSet(key, value) {
        try {
            tsic.publishMessage('UI.Cmd.Settings.Set', { Key: key, ValueJson: JSON.stringify(value) });
        } catch (e) {}
    }

    function publishAction(key) {
        tsic.publishMessage('UI.Cmd.Settings.Action', { Key: key });
    }

    // Route every control edit through here. Everything publishes immediately. A
    // video-mode key also starts the countdown, but C++ does that off the Set itself
    // and tells us via video.countdown — the page does not decide, and does not need
    // to remember a rollback value, because the engine's own confirmed-mode record is
    // the rollback target.
    function applySet(key, value) {
        if (STALLING_KEYS[key]) {
            applySetAfterPainting(key, value);
            return;
        }
        publishSet(key, value);
    }

    // ---- Settings that freeze the game while they apply --------------------
    //
    // Picking a DLSS mode stalls the game thread for as long as ~16 s, and it is not our
    // stall to fix: NVIDIA JIT-compiles the DLSS transformer cubins on first use of each
    // quality mode (measured — 11 new cubins in %APPDATA%\NVIDIA\ComputeCache across the
    // exact 16.47 s window, on a 5070/610.88). It recurs per GPU, per driver and per mode,
    // so it is not a one-time-ever cost either. Frame generation builds NGX features the
    // same way. What IS ours is that the screen said nothing, so a known compile read as a
    // hang (#152).
    //
    // The ordering below is the whole trick. A blocked game thread presents no frames at
    // all, so an "applying" state published in the same turn as the change would be
    // composited only AFTER the stall it exists to explain. Paint first, publish second.
    const STALLING_KEYS = {
        'graphics.upscaler': 'Preparing the upscaler — the first use of a mode compiles '
            + 'shaders for your GPU and can take several seconds.',
        'graphics.frame_gen': 'Preparing frame generation — the first use compiles shaders '
            + 'for your GPU and can take several seconds.',
    };

    function ensureApplyingOverlay() {
        let el = document.getElementById('settings-applying');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'settings-applying';
        el.className = 'tsic-modal-scrim tsic-modal-scrim--dim';
        el.hidden = true;
        el.innerHTML = '<div class="tsic-panel" style="min-width:360px;max-width:520px;text-align:center;">'
            + '<h2 class="tsic-title tsic-title--sm">Applying…</h2>'
            + '<p id="settings-applying-msg" style="margin:8px 0 0;"></p></div>';
        document.body.appendChild(el);
        return el;
    }

    // Resolves once the browser has had a real opportunity to composite the current DOM.
    // Two rAFs: the first lands before the frame that includes our mutation, the second
    // after it. The timeout is the belt-and-braces path for a hidden/throttled view, where
    // rAF may never fire and we must not swallow the setting change.
    function afterNextPaint() {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(finish, 0)));
            setTimeout(finish, 250);
        });
    }

    // Cleared by the next state broadcast from C++ — see onCatalog / onValue. Publishing is
    // fire-and-forget, so the overlay cannot be taken down on the publish returning: that
    // happens in the same millisecond and the player would be back to an unexplained freeze.
    // A message arriving from C++ is the one signal that means the game thread is ticking
    // again, which is exactly the condition for taking the overlay down.
    let applyingTimeout = null;

    function endApplying() {
        const el = document.getElementById('settings-applying');
        if (el) el.hidden = true;
        if (applyingTimeout) { clearTimeout(applyingTimeout); applyingTimeout = null; }
    }

    async function applySetAfterPainting(key, value) {
        const overlay = ensureApplyingOverlay();
        document.getElementById('settings-applying-msg').textContent = STALLING_KEYS[key] || '';
        overlay.hidden = false;
        if (applyingTimeout) clearTimeout(applyingTimeout);
        // Backstop for a setting that applies without echoing any state (or a host that
        // isn't wired to). 30s is past the worst measured compile; the overlay must never
        // be the thing that strands someone.
        applyingTimeout = setTimeout(endApplying, 30000);

        await afterNextPaint();
        publishSet(key, value);
    }

    // Cap displayed numbers at 2 decimal places, dropping trailing zeros
    // (e.g. 0.6900000000000001 -> "0.69", 50 -> "50", 1.5 -> "1.5").
    function fmt2(n) {
        const num = Number(n);
        if (Number.isNaN(num)) return String(n);
        return String(Number(num.toFixed(2)));
    }

    // ---- Static field rendering (Audio/Video/Gameplay) ----

    function buildField(s) {
        const row = document.createElement('div');
        row.className = 'field';
        const lbl = document.createElement('label');
        lbl.textContent = s.Label || s.Key;
        row.appendChild(lbl);

        const ctl = document.createElement('div');
        ctl.className = 'field-control';
        const type = String(s.Type || '').toLowerCase();
        const v = valueOf(s);
        const isDisabled = !!s.Disabled;

        if (type === 'range' || type === 'number') {
            const min = (typeof s.Min === 'number') ? s.Min : 0;
            const max = (typeof s.Max === 'number') ? s.Max : 1;
            const step = (typeof s.Step === 'number') ? s.Step : 0.01;
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = String(min); slider.max = String(max); slider.step = String(step);
            slider.value = String(v);
            slider.disabled = isDisabled;
            slider.dataset.key = s.Key; // stable hook for tests / debugging, as with dropdowns
            const valueLabel = document.createElement('span');
            valueLabel.className = 'value-label';
            valueLabel.textContent = s.Display !== undefined ? s.Display : fmt2(v);
            let lastTickAt = 0;
            slider.oninput = () => {
                let n = Number(slider.value);
                if (Number.isNaN(n)) return;
                n = Math.max(min, Math.min(max, n));
                slider.value = String(n);
                localState[s.Key] = n;
                valueLabel.textContent = fmt2(n);
                const now = Date.now();
                if (now - lastTickAt >= 60) {
                    lastTickAt = now;
                    try { tsic.playSound('UI.Slider.Tick', 0.3); } catch (e) {}
                }
                applySet(s.Key, n);
            };
            controlUpdaters[s.Key] = (val) => {
                const n = Number(val);
                if (Number.isNaN(n)) return;
                slider.value = String(n);
                valueLabel.textContent = fmt2(n);
            };
            ctl.appendChild(slider);
            ctl.appendChild(valueLabel);
        } else if (type === 'bool') {
            const tog = document.createElement('div');
            tog.className = 'field-toggle' + (v ? ' on' : '') + (isDisabled ? ' disabled' : '');
            tog.dataset.key = s.Key; // stable hook for tests / debugging, as with dropdowns
            if (!isDisabled) {
                tog.setAttribute('data-tsic-focusable', '');
                tog.tabIndex = 0;
            }
            if (!isDisabled) {
                tog.onclick = () => {
                    const old = localState[s.Key] !== undefined ? localState[s.Key] : v;
                    localState[s.Key] = !old;
                    tog.classList.toggle('on', localState[s.Key]);
                    try { tsic.playSound(localState[s.Key] ? 'UI.Toggle.On' : 'UI.Toggle.Off'); } catch (e) {}
                    applySet(s.Key, localState[s.Key]);
                };
            }
            controlUpdaters[s.Key] = (val) => tog.classList.toggle('on', !!val);
            ctl.appendChild(tog);
        } else if (type === 'enum' || Array.isArray(s.Options)) {
            // tsic-dropdown, NOT a native <select>: CEF renders native select popups
            // through a Slate menu that misplaces/flips under accelerated paint.
            const opts = (s.Options || []).map((opt) => ({
                value: String(opt.Value !== undefined ? opt.Value : opt),
                label: String(opt.Label !== undefined ? opt.Label : opt),
            }));
            const dd = document.createElement('button');
            dd.type = 'button';
            dd.className = 'tsic-dropdown';
            dd.dataset.key = s.Key; // stable hook for tests / debugging
            dd.disabled = isDisabled;
            dd.setAttribute('data-tsic-focusable', '');
            dd.setAttribute('data-tsic-options', JSON.stringify(opts));
            dd.setAttribute('data-tsic-value', String(v));
            const ddLabel = document.createElement('span');
            ddLabel.className = 'tsic-dropdown-label';
            const current = opts.find((o) => o.value === String(v));
            ddLabel.textContent = current ? current.label : String(v);
            const ddCaret = document.createElement('span');
            ddCaret.className = 'tsic-dropdown-caret';
            ddCaret.textContent = '▾';
            dd.appendChild(ddLabel);
            dd.appendChild(ddCaret);
            dd.addEventListener('tsic-change', () => {
                // controlUpdaters value echoes call tsic.dropdown.set, which fires
                // tsic-change too — only publish genuine changes.
                const newValue = tsic.dropdown.get(dd);
                if (localState[s.Key] === newValue) return;
                localState[s.Key] = newValue;
                try { tsic.playSound('UI.Dropdown.Select'); } catch (e) {}
                applySet(s.Key, newValue);
            });
            controlUpdaters[s.Key] = (val) => {
                localState[s.Key] = String(val);
                tsic.dropdown.set(dd, String(val));
            };
            ctl.appendChild(dd);
        } else if (type === 'action') {
            const btn = document.createElement('button');
            btn.className = 'tsic-button';
            btn.type = 'button';
            btn.textContent = s.ButtonText || s.Label;
            btn.disabled = isDisabled;
            btn.onclick = () => publishAction(s.Key);
            ctl.appendChild(btn);
        } else {
            const span = document.createElement('span');
            span.textContent = JSON.stringify(v);
            span.className = 'value-label';
            ctl.appendChild(span);
        }
        row.appendChild(ctl);
        return row;
    }

    // ---- Controls tab rendering (rebind + analog prefs) ----

    function makeGroup(title) {
        const sec = document.createElement('div');
        sec.className = 'group';
        const h = document.createElement('h3');
        h.textContent = title || '';
        sec.appendChild(h);
        return sec;
    }

    function keyCapInto(btn, keyText, isGamepad) {
        btn.innerHTML = '';
        const url = (window.TSIC && TSIC.keyIconUrl) ? TSIC.keyIconUrl(keyText, isGamepad) : '';
        if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = keyText;
            img.onerror = () => {
                img.remove();
                const span = document.createElement('span');
                span.className = 'key-text';
                span.textContent = keyText || 'Unbound';
                btn.appendChild(span);
            };
            btn.appendChild(img);
        } else {
            const span = document.createElement('span');
            span.className = 'key-text';
            span.textContent = keyText || 'Unbound';
            btn.appendChild(span);
        }
    }

    function buildRebindButton(entry, isGamepad) {
        const btn = document.createElement('button');
        btn.className = 'bind-btn';
        btn.type = 'button';
        btn.dataset.hotkeyId = entry.HotkeyId;
        btn.dataset.gamepad = isGamepad ? '1' : '0';
        const keyText = isGamepad ? entry.GamepadKeyText : entry.KeyboardKeyText;
        keyCapInto(btn, keyText, isGamepad);
        const remappable = isGamepad ? entry.bGamepadRemappable : entry.bKeyboardRemappable;
        if (remappable === false) {
            btn.classList.add('locked');
            btn.disabled = true;
        } else {
            btn.onclick = () => beginRebind(entry.HotkeyId, isGamepad, btn);
        }
        // Same key in the same context is a real conflict (red); in a different
        // context it is deliberate sharing, surfaced in the tooltip only.
        const conflicts = isGamepad ? entry.GamepadConflictsWith : entry.KeyboardConflictsWith;
        const shared = isGamepad ? entry.GamepadSharedWith : entry.KeyboardSharedWith;
        const tips = [];
        if (keyText) tips.push(keyText);
        if (conflicts) {
            btn.classList.add('conflict');
            tips.push('Also bound to ' + conflicts + ' in the same context');
        }
        if (shared) tips.push('Also used by ' + shared + ' (different context)');
        if (tips.length) btn.title = tips.join('\n');
        return btn;
    }

    // The description under an action name is its behaviour list; most hotkeys back a
    // single behaviour with the same name, which would just echo it ("Build Build") —
    // show only the parts that add information.
    function bindingNote(entry) {
        const name = entry.DisplayName || entry.HotkeyId;
        return String(entry.BehaviorsLabel || '')
            .split(',').map(s => s.trim())
            .filter(s => s && s !== name)
            .join(', ');
    }

    function buildBindingRow(entry, isGamepad) {
        const row = document.createElement('div');
        row.className = 'binding-row';
        row.dataset.hotkeyId = entry.HotkeyId;

        const name = document.createElement('label');
        name.className = 'binding-name';
        name.textContent = entry.DisplayName || entry.HotkeyId;
        const note = bindingNote(entry);
        if (note) {
            const sub = document.createElement('span');
            sub.className = 'shared-note';
            sub.textContent = note;
            name.appendChild(sub);
        }
        // Names ellipsize rather than widen the layout — full text in the tooltip.
        name.title = (entry.DisplayName || entry.HotkeyId) + (note ? ' — ' + note : '');
        row.appendChild(name);

        const leader = document.createElement('div');
        leader.className = 'binding-leader';
        row.appendChild(leader);

        // Hold/Toggle is a per-ACTION preference, so it appears on both device tabs;
        // the word next to the pill states the current mode outright.
        const mode = document.createElement('div');
        mode.className = 'mode-cell';
        if (entry.bToggleable && entry.ToggleBehaviorTagName) {
            const tog = document.createElement('div');
            tog.className = 'field-toggle' + (entry.HoldToggle === 1 ? ' on' : '');
            // Reachable by gamepad/keyboard nav; Accept fires the click handler.
            tog.setAttribute('data-tsic-focusable', '');
            tog.tabIndex = 0;
            const word = document.createElement('span');
            word.className = 'mode-word';
            word.textContent = entry.HoldToggle === 1 ? 'Toggle' : 'Hold';
            tog.onclick = () => {
                const next = !tog.classList.contains('on');
                tog.classList.toggle('on', next);
                word.textContent = next ? 'Toggle' : 'Hold';
                publishSet('hold_toggle', { behavior: entry.ToggleBehaviorTagName, toggle: next });
            };
            mode.appendChild(tog);
            mode.appendChild(word);
        }
        row.appendChild(mode);

        const bind = document.createElement('div');
        bind.className = 'bind-cell';
        bind.appendChild(buildRebindButton(entry, isGamepad));
        row.appendChild(bind);
        return row;
    }

    function sliderRow(label, key, value, min, max, step) {
        return buildField({ Key: key, Label: label, Type: 'range', Min: min, Max: max, Step: step, Value: value });
    }
    function toggleRow(label, key, value) {
        return buildField({ Key: key, Label: label, Type: 'bool', Value: value });
    }

    // Category headers render in a fixed canonical order; anything unrecognized
    // (e.g. a modded hotkey with its own category) lands after them, Other last.
    const CATEGORY_ORDER = ['Movement', 'Interaction', 'Combat', 'Building', 'Map', 'Hotbar', 'Communication', 'Interface'];

    // Search text survives re-renders — every applied rebind refreshes ControlsState,
    // which rebuilds the page, and losing the filter mid-search would be jarring.
    let bindingFilter = '';

    function applyBindingFilter(host) {
        const needle = bindingFilter.trim().toLowerCase();
        for (const group of host.querySelectorAll('.binding-group')) {
            let visible = 0;
            for (const row of group.querySelectorAll('.binding-row')) {
                const hit = !needle || (row.dataset.search || '').indexOf(needle) >= 0;
                row.hidden = !hit;
                if (hit) visible++;
            }
            group.hidden = visible === 0;
        }
    }

    // One device's view of the ControlsState: searchable, category-grouped binding
    // rows, that device's analog prefs, and a per-device reset. An entry shows on a
    // tab when it is bound or remappable on that device; bound-but-locked renders
    // the greyed cap.
    function renderControlsPage(host, isGamepad) {
        const cs = controlsState || { Entries: [] };

        const toolbar = document.createElement('div');
        toolbar.className = 'bindings-toolbar';
        const search = document.createElement('input');
        search.id = 'binding-search';
        search.type = 'text';
        search.placeholder = 'Search bindings…';
        search.value = bindingFilter;
        search.oninput = () => { bindingFilter = search.value; applyBindingFilter(host); };
        // Down from the search enters the first visible row's control — the rows'
        // focusables are right-aligned, so nothing below overlaps the search box
        // and spatial nav would otherwise skip the whole list to the footer.
        search.setAttribute('data-tsic-nav-down',
            '#page .binding-row :is([data-tsic-focusable], .bind-btn)');
        toolbar.appendChild(search);
        for (const caption of ['Mode', 'Binding']) {
            const cap = document.createElement('span');
            cap.className = 'col-caption';
            cap.textContent = caption;
            toolbar.appendChild(cap);
        }
        host.appendChild(toolbar);

        const entries = (cs.Entries || []).filter((e) => {
            const remappable = isGamepad ? e.bGamepadRemappable !== false : e.bKeyboardRemappable !== false;
            const bound = !!(isGamepad ? e.GamepadKeyText : e.KeyboardKeyText);
            return remappable || bound;
        });
        const byCat = new Map();
        for (const e of entries) {
            const cat = e.Category || 'Other';
            if (!byCat.has(cat)) byCat.set(cat, []);
            byCat.get(cat).push(e);
        }
        const extraCats = Array.from(byCat.keys())
            .filter(c => CATEGORY_ORDER.indexOf(c) < 0 && c !== 'Other').sort();
        const cats = CATEGORY_ORDER.filter(c => byCat.has(c)).concat(extraCats);
        if (byCat.has('Other')) cats.push('Other');
        for (const cat of cats) {
            const sec = makeGroup(cat);
            sec.classList.add('binding-group');
            for (const e of byCat.get(cat)) {
                const row = buildBindingRow(e, isGamepad);
                row.dataset.search = (e.DisplayName + ' ' + (e.BehaviorsLabel || '') + ' '
                    + (isGamepad ? e.GamepadKeyText : e.KeyboardKeyText)).toLowerCase();
                sec.appendChild(row);
            }
            host.appendChild(sec);
        }
        applyBindingFilter(host);

        const inp = makeGroup(isGamepad ? 'Gamepad' : 'Mouse');
        if (isGamepad) {
            inp.appendChild(sliderRow('Gamepad sensitivity', 'gamepad_sensitivity', cs.GamepadSensitivity, 0.05, 1, 0.05));
            inp.appendChild(sliderRow('Gamepad stick deadzone', 'gamepad_deadzone', cs.GamepadDeadzone, 0, 0.9, 0.01));
            inp.appendChild(toggleRow('Invert gamepad Y', 'invert_gamepad_y', cs.bInvertGamepadY));
        } else {
            inp.appendChild(sliderRow('Mouse sensitivity', 'mouse_sensitivity', cs.MouseSensitivity, 0.1, 3, 0.05));
            inp.appendChild(toggleRow('Invert mouse Y', 'invert_mouse_y', cs.bInvertMouseY));
        }
        host.appendChild(inp);

        const resetRow = document.createElement('div');
        resetRow.className = 'field';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'tsic-button';
        resetBtn.id = 'btn-reset-controls';
        resetBtn.type = 'button';
        resetBtn.textContent = isGamepad ? 'Reset controller bindings' : 'Reset keyboard bindings';
        resetBtn.onclick = () => tsic.publishMessage('UI.Cmd.Settings.ResetControls', { bGamepad: !!isGamepad });
        resetRow.appendChild(resetBtn);
        host.appendChild(resetRow);
    }

    // ---- Rebind capture flow (C++-driven) ----

    function ensureModal() {
        let modal = document.getElementById('rebind-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'rebind-modal';
        modal.className = 'settings-modal';
        modal.hidden = true;
        const panel = document.createElement('div');
        panel.className = 'panel';
        const msg = document.createElement('div');
        msg.className = 'msg';
        msg.id = 'rebind-msg';
        panel.appendChild(msg);
        const row = document.createElement('div');
        row.className = 'tsic-button-row';
        row.id = 'rebind-actions';
        panel.appendChild(row);
        modal.appendChild(panel);
        document.body.appendChild(modal);
        return modal;
    }

    // Capture has no buttons: cancel is Esc / Start (reserved keys, handled by the
    // C++ input manager; the window Esc handler below covers keyboard users whose
    // Esc reaches CEF first). Any on-screen button would be unreachable anyway —
    // every gamepad press is captured as the binding.
    function showCaptureModal() {
        const modal = ensureModal();
        const gamepad = activeRebind && activeRebind.bGamepad;
        document.getElementById('rebind-msg').textContent = gamepad
            ? 'Press a button…  (Start to cancel)'
            : 'Press a key…  (Esc to cancel)';
        document.getElementById('rebind-actions').innerHTML = '';
        modal.hidden = false;
    }

    function showConflictModal(cap) {
        const modal = ensureModal();
        document.getElementById('rebind-msg').textContent =
            `${cap.CapturedKeyText} is already bound to ${cap.ConflictHotkeyText} — replace?`;
        const actions = document.getElementById('rebind-actions');
        actions.innerHTML = '';
        const replace = document.createElement('button');
        replace.className = 'tsic-button';
        replace.id = 'rebind-replace';
        replace.textContent = 'Replace';
        replace.onclick = () => { tsic.publishMessage('UI.Cmd.Settings.ConfirmRebind', {}); hideModal(); };
        const cancel = document.createElement('button');
        cancel.className = 'tsic-button';
        cancel.textContent = 'Cancel';
        cancel.onclick = cancelRebind;
        actions.appendChild(replace);
        actions.appendChild(cancel);
        modal.hidden = false;
        // Focus-trap the prompt so controller users can pick Replace; a Back that
        // pops the scope (B) abandons the pending rebind like Esc/Start do.
        if (tsic.focus && tsic.focus.pushScope && !modalScopePushed) {
            modalScopePushed = true;
            tsic.focus.pushScope(modal.querySelector('.panel'), cancel, {
                onPop: () => { modalScopePushed = false; if (activeRebind) cancelRebind(); },
            });
        }
    }

    function hideModal() {
        const modal = document.getElementById('rebind-modal');
        if (modal) modal.hidden = true;
        if (activeRebind && activeRebind.btn) activeRebind.btn.classList.remove('waiting');
        activeRebind = null;
        if (modalScopePushed) {
            modalScopePushed = false;
            if (tsic.focus && tsic.focus.popScope) tsic.focus.popScope();
        }
    }

    function beginRebind(hotkeyId, bGamepad, btn) {
        if (activeRebind && activeRebind.btn) activeRebind.btn.classList.remove('waiting');
        activeRebind = { hotkeyId, bGamepad, btn };
        if (btn) btn.classList.add('waiting');
        tsic.publishMessage('UI.Cmd.Settings.BeginRebind', { HotkeyId: hotkeyId, bGamepad: !!bGamepad });
        showCaptureModal();
    }

    function cancelRebind() {
        tsic.publishMessage('UI.Cmd.Settings.CancelRebind', {});
        hideModal();
    }

    function onRebindCapture(cap) {
        if (!cap) return;
        if (cap.bCapturing) { showCaptureModal(); return; }
        if (cap.bConflict) { showConflictModal(cap); return; }
        // No conflict (applied) or cancelled — close. ControlsState refresh re-renders.
        hideModal();
    }

    // ---- Video keep/revert countdown ----

    // One popover at a time. `action`: 'keep' | 'revert'.
    // `viaScopePop` is true when the focus scope was already popped (gamepad/
    // Esc Back handled by tsic-focus), so we must not pop it again.
    function resolvePopover(action, viaScopePop) {
        const p = activePopover;
        if (!p) return;
        activePopover = null;
        p.el.remove();
        if (!viaScopePop && tsic.focus && tsic.focus.popScope) tsic.focus.popScope();
        countdownLabel = null;
        if (p.kind !== 'countdown') return;

        // Only an explicit press reports a decision. Keep and Revert are different
        // messages -- an earlier version sent video.confirm on both, which made Revert
        // confirm the very change it was rejecting.
        //
        // Anything else ('cancel', a popped focus scope) closes the panel and says
        // nothing: C++ still holds the deadline and will revert on its own. Treating
        // those as a rejection is what made window-mode changes impossible, because
        // the window recreation pops the scope every time.
        if (action === 'keep') publishAction('video.confirm');
        else if (action === 'revert') publishAction('video.revert');
    }

    function popoverButton(id, label, variant, action) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = 'tsic-button' + (variant ? ' ' + variant : '');
        btn.type = 'button';
        btn.textContent = label;
        btn.onclick = () => resolvePopover(action, false);
        return btn;
    }

    function openPopover(kind, titleText, subNodes, buttons, initialBtn) {
        resolvePopover('cancel', false); // never stack popovers
        const modal = document.createElement('div');
        modal.id = 'settings-popover';
        modal.className = 'settings-modal';
        const panel = document.createElement('div');
        panel.className = 'panel';
        const msg = document.createElement('div');
        msg.className = 'msg';
        msg.appendChild(document.createTextNode(titleText));
        if (subNodes && subNodes.length) {
            const sub = document.createElement('div');
            sub.className = 'sub';
            for (const n of subNodes) sub.appendChild(n);
            msg.appendChild(sub);
        }
        panel.appendChild(msg);
        const row = document.createElement('div');
        row.className = 'tsic-button-row';
        for (const b of buttons) row.appendChild(b);
        panel.appendChild(row);
        modal.appendChild(panel);
        document.body.appendChild(modal);
        activePopover = { el: modal, kind };
        // Modal focus scope: gamepad focus stays inside, and a Back press pops
        // the popover (router skips its screen-close via backHandled()). Back
        // resolves to the popover's safe action.
        if (tsic.focus && tsic.focus.pushScope) {
            tsic.focus.pushScope(modal, initialBtn, { onPop: () => {
                if (!activePopover) return; // popped by resolvePopover itself
                // 'closed', not 'revert': the scope pops whenever focus leaves the
                // modal, and recreating the window for a new display mode does that
                // every time. C++ still holds the deadline.
                resolvePopover(activePopover.kind === 'countdown' ? 'closed' : 'cancel', true);
            } });
        }
    }

    // Mirrors C++'s countdown: `seconds` is whatever video.countdown last said.
    // 0 means nothing is pending, which is also how C++ reports that it resolved the
    // countdown itself -- on the timeout, or because some other page confirmed it.
    //
    // No timer here on purpose. The page cannot time a change that destroys its own
    // context, and a page that reloads mid-countdown is handed the remaining seconds by
    // the sticky value replay, so the panel comes straight back.
    function showKeepCountdown(seconds) {
        if (seconds <= 0) {
            if (activePopover && activePopover.kind === 'countdown') resolvePopover('closed', false);
            return;
        }
        if (activePopover && activePopover.kind === 'countdown') {
            if (countdownLabel) countdownLabel.textContent = String(seconds);
            return;
        }
        if (activePopover) return; // some other panel owns the screen; don't stack
        countdownLabel = document.createElement('b');
        countdownLabel.id = 'popover-countdown';
        countdownLabel.textContent = String(seconds);
        const sub = [document.createTextNode('Reverting in '), countdownLabel, document.createTextNode('s')];
        const keepBtn = popoverButton('popover-keep', 'Keep changes', '', 'keep');
        const revertBtn = popoverButton('popover-revert', 'Revert', 'secondary', 'revert');
        openPopover('countdown', 'Keep these settings?', sub, [revertBtn, keepBtn], keepBtn);
    }

    // ---- Page / tab plumbing ----

    function allPages() {
        const pages = ((lastCatalog && lastCatalog.Pages) || []).slice();
        if (controlsState) {
            pages.push({ Id: KBM_PAGE_ID, Title: 'Keyboard & Mouse' });
            pages.push({ Id: GAMEPAD_PAGE_ID, Title: 'Controller' });
        }
        return pages;
    }

    function renderTabs() {
        const host = document.getElementById('tabs');
        if (!host) return;
        host.innerHTML = '';
        const pages = allPages();
        if (!pages.length) return;
        if (!activePageId || !pages.find(p => p.Id === activePageId)) {
            activePageId = pages[0].Id;
        }
        for (const p of pages) {
            const btn = document.createElement('button');
            btn.className = 'tsic-tab' + (p.Id === activePageId ? ' is-active' : '');
            btn.type = 'button';
            btn.dataset.pageId = p.Id;
            btn.textContent = p.Title || p.Id;
            btn.onclick = () => {
                activePageId = p.Id;
                renderTabs();
                renderPage();
                // Land on the new page's top setting (skipping the search box).
                // Bumper tab-cycling routes through this click too; without an
                // explicit target the rebuild orphans focus and the next press
                // fell back to the footer's Back button.
                const first = document.querySelector(
                    '#page :is(button, select, textarea, [data-tsic-focusable], input:not(#binding-search))');
                if (first && window.tsic && tsic.focus && tsic.focus.focus) tsic.focus.focus(first);
            };
            // Down from any tab enters the page content. Spatial nav can't infer
            // this: the page's focusables sit left (search) or right (bind
            // buttons) of most tabs, so the only rect-overlapping candidate
            // below would be the full-width footer buttons.
            btn.setAttribute('data-tsic-nav-down',
                '#page :is(button, input, select, textarea, [data-tsic-focusable])');
            host.appendChild(btn);
        }
    }

    function renderPage() {
        const host = document.getElementById('page');
        if (!host) return;
        host.innerHTML = '';
        // DOM was just wiped — drop the now-stale value-patch updaters before we
        // rebuild (or hand off to a device bindings page, which registers none).
        for (const k in controlUpdaters) delete controlUpdaters[k];
        if (isControlsPage(activePageId)) {
            renderControlsPage(host, activePageId === GAMEPAD_PAGE_ID);
            return;
        }
        const page = lastCatalog && (lastCatalog.Pages || []).find(p => p.Id === activePageId);
        if (!page) {
            host.textContent = '(no settings yet)';
            lastStructSig = null;
            return;
        }
        for (const g of (page.Groups || [])) {
            const sec = makeGroup(g.Title || g.Id || '');
            for (const s of (g.Settings || [])) sec.appendChild(buildField(s));
            host.appendChild(sec);
        }
        lastStructSig = structSig(lastCatalog);
    }

    // Signature of the rendered structure (everything except live Values) +
    // the active page. Two Catalogs with the same signature are interchangeable
    // by value-patching; a different signature requires a full rebuild.
    function structSig(catalog) {
        try {
            const pages = (catalog && catalog.Pages) || [];
            return activePageId + '::' + JSON.stringify(pages.map(p => ({
                i: p.Id,
                g: (p.Groups || []).map(g => ({
                    i: g.Id, t: g.Title,
                    s: (g.Settings || []).map(s => ({
                        k: s.Key, t: s.Type, l: s.Label, d: !!s.Disabled,
                        o: (s.Options || []).map(o => (o && o.Value !== undefined) ? o.Value : o),
                    })),
                })),
            })));
        } catch (e) { return null; }
    }

    // Patch the active page's control values from a structurally-identical
    // Catalog without touching the DOM tree — never destroys a control the user
    // is interacting with (e.g. a slider being dragged).
    function applyValues(catalog) {
        const page = (catalog.Pages || []).find(p => p.Id === activePageId);
        if (!page) return;
        for (const g of (page.Groups || [])) {
            for (const s of (g.Settings || [])) {
                if (!s.Key || !controlUpdaters[s.Key]) continue;
                // An echoed value is the applied truth — move the control.
                localState[s.Key] = s.Value;
                controlUpdaters[s.Key](s.Value);
            }
        }
    }

    function renderFooter(footer) {
        // Tolerate both spellings: the C++ bridge's authored-name serialization
        // drops the leading 'b' (RestartRequired), the static catalog keeps it.
        const restart = document.getElementById('restart-required');
        if (restart) restart.hidden = !(footer && (footer.bRestartRequired || footer.RestartRequired));
    }

    function onCatalog(payload) {
        if (!payload) return;
        // A message from C++ means the game thread is ticking again — the only reliable
        // signal that a stalling setting has finished applying (see STALLING_KEYS).
        endApplying();
        let parsed = null;
        try { parsed = JSON.parse(payload.Json || '{}'); } catch (e) {}
        lastCatalog = parsed || {};
        renderFooter(lastCatalog.Footer);
        // Structure unchanged (only Values differ, e.g. a value echo while
        // dragging a slider): patch values in place so we never destroy the
        // control mid-interaction. Otherwise do a full rebuild.
        if (lastStructSig !== null && structSig(lastCatalog) === lastStructSig
            && Object.keys(controlUpdaters).length) {
            applyValues(lastCatalog);
            return;
        }
        // A structurally new catalog is a new source of truth — drop edits from
        // the previous one so buildField re-seeds from it.
        for (const k of Object.keys(localState)) delete localState[k];
        renderTabs(lastCatalog);
        renderPage();
    }

    // Every applied edit echoes a fresh ControlsState, and the rebuild destroys
    // whatever control the player had focused (toggling Hold/Toggle with A would
    // dump focus to <body>, and the next stick press fell back to the footer).
    // Capture a stable identity before the rebuild and re-focus its equivalent.
    function focusIdentity() {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        if (el.id === 'binding-search') return { search: true };
        if (el.classList && el.classList.contains('tsic-tab')) return { tabId: el.dataset.pageId };
        const row = el.closest && el.closest('.binding-row');
        if (row) return { hotkeyId: row.dataset.hotkeyId, pill: el.classList.contains('field-toggle') };
        return null;
    }

    function restoreFocus(identity) {
        if (!identity) return;
        let el = null;
        if (identity.search) {
            el = document.getElementById('binding-search');
        } else if (identity.tabId) {
            el = document.querySelector('.tsic-tab[data-page-id="' + identity.tabId + '"]');
        } else if (identity.hotkeyId) {
            const row = document.querySelector('.binding-row[data-hotkey-id="' + identity.hotkeyId + '"]');
            if (row) el = identity.pill ? row.querySelector('.field-toggle') : row.querySelector('.bind-btn');
        }
        if (!el) return;
        if (window.tsic && tsic.focus && tsic.focus.focus) tsic.focus.focus(el);
        else el.focus();
    }

    function onControlsState(payload) {
        if (!payload) return;
        // The stalling keys echo nothing of their own: HandleCmdSettingsSet applies the
        // upscaler and then broadcasts ControlsState, not a Value or a Catalog. This is
        // therefore the message that proves the game thread ticks again for exactly the
        // settings the overlay exists for — without it the overlay only ever came down
        // on its 30 s backstop.
        endApplying();
        const focused = focusIdentity();
        controlsState = payload;
        renderTabs();
        if (isControlsPage(activePageId)) renderPage();
        restoreFocus(focused);
    }

    // Rebuild from STATIC_CATALOG after its structure changed, carrying the echoed
    // saved values across — a structural rebuild wipes localState, and the sticky
    // UI.Settings.Value replays may already have arrived.
    function rebuildPreservingValues() {
        const saved = Object.assign({}, localState);
        onCatalog({ Json: JSON.stringify(STATIC_CATALOG) });
        for (const k of Object.keys(saved)) {
            localState[k] = saved[k];
            if (controlUpdaters[k]) controlUpdaters[k](saved[k]);
        }
    }

    // graphics.nvidia_caps is a capability report, not a setting: strip the options
    // and rows this GPU can't drive so the menu never offers a control that the C++
    // handler would silently reject. Mutating STATIC_CATALOG makes this idempotent,
    // which matters because the message replays stickily. Despite the legacy key
    // name it covers AMD FSR too (caps.fsr).
    function applyNvidiaCaps(caps) {
        if (!caps || typeof caps !== 'object') return false;
        let changed = false;
        const upscalerOk = (v) => v === 'tsr'
            || (caps.dlss && (v === 'dlaa' || v.indexOf('dlss_') === 0))
            || (caps.fsr && v.indexOf('fsr_') === 0);
        for (const page of STATIC_CATALOG.Pages) {
            for (const g of (page.Groups || [])) {
                if (!g.Settings) continue;
                for (const s of g.Settings) {
                    if (s.Key !== 'graphics.upscaler' || !s.Options) continue;
                    const kept = s.Options.filter((o) => upscalerOk(o.Value));
                    if (kept.length !== s.Options.length) { s.Options = kept; changed = true; }
                }
                const dropKeys = [];
                if (!caps.frame_gen) dropKeys.push('graphics.frame_gen');
                if (!caps.fsr)       dropKeys.push('graphics.fsr_frame_gen');
                if (!caps.reflex)    dropKeys.push('graphics.reflex');
                if (dropKeys.length) {
                    const kept = g.Settings.filter((s) => dropKeys.indexOf(s.Key) === -1);
                    if (kept.length !== g.Settings.length) { g.Settings = kept; changed = true; }
                }
            }
        }
        return changed;
    }

    // video.hdr_supported is a capability report like nvidia_caps: drop the HDR
    // row on displays that can't output HDR. Idempotent for sticky replays.
    function dropHdrRow() {
        let changed = false;
        for (const page of STATIC_CATALOG.Pages) {
            for (const g of (page.Groups || [])) {
                if (!g.Settings) continue;
                const kept = g.Settings.filter((s) => s.Key !== 'video.hdr');
                if (kept.length !== g.Settings.length) { g.Settings = kept; changed = true; }
            }
        }
        return changed;
    }

    // Finds the video.resolution row wherever it sits, so these two helpers do not
    // have to know the catalog's shape.
    function resolutionRow() {
        for (const page of STATIC_CATALOG.Pages) {
            for (const g of (page.Groups || [])) {
                for (const s of (g.Settings || [])) {
                    if (s.Key === 'video.resolution') return s;
                }
            }
        }
        return null;
    }

    function resolutionLabel(value) {
        const parts = String(value).split('x');
        if (parts.length !== 2) return String(value);
        const w = parseInt(parts[0], 10), h = parseInt(parts[1], 10);
        const NAMES = { '1280x720': 'HD', '1920x1080': 'FHD', '2560x1440': 'QHD', '3840x2160': '4K' };
        const suffix = NAMES[value] ? ' (' + NAMES[value] + ')' : '';
        return w + ' × ' + h + suffix;
    }

    // video.resolution_options is a capability report like nvidia_caps: the modes this
    // display can present in the CURRENT window mode. Republished whenever anything
    // changes, because switching to borderless collapses it to the desktop size alone.
    // Idempotent -- the message replays stickily.
    function applyResolutionOptions(list) {
        if (!Array.isArray(list) || list.length === 0) return false;
        const row = resolutionRow();
        if (!row) return false;
        const next = list.map((v) => ({ Value: String(v), Label: resolutionLabel(v) }));
        const same = row.Options && row.Options.length === next.length
            && row.Options.every((o, i) => o.Value === next[i].Value);
        if (same) return false;
        row.Options = next;
        return true;
    }

    // Borderless pins the backbuffer to the desktop, so no value in this row can do
    // anything. Shown disabled rather than removed: the player still sees what they
    // are running at instead of hunting for a control that vanished.
    function applyResolutionLocked(locked) {
        const row = resolutionRow();
        if (!row) return false;
        const next = !!locked;
        if (!!row.Disabled === next) return false;
        row.Disabled = next;
        return true;
    }

    function onValue(payload) {
        if (!payload || !payload.Key) return;
        endApplying();
        let v;
        try { v = JSON.parse(payload.ValueJson || 'null'); } catch (e) { return; }
        if (payload.Key === 'graphics.nvidia_caps') {
            if (applyNvidiaCaps(v)) rebuildPreservingValues();
            return;
        }
        if (payload.Key === 'video.hdr_supported') {
            if (v === false && dropHdrRow()) rebuildPreservingValues();
            return;
        }
        if (payload.Key === 'video.resolution_options') {
            if (applyResolutionOptions(v)) rebuildPreservingValues();
            return;
        }
        if (payload.Key === 'video.resolution_locked') {
            if (applyResolutionLocked(v)) rebuildPreservingValues();
            return;
        }
        // The countdown's remaining seconds, owned by C++. Sticky, so a page that opens
        // or reloads while one is running gets it immediately -- which is what makes the
        // panel survive the window recreation that a mode change causes.
        if (payload.Key === 'video.countdown') {
            showKeepCountdown(Number(v) || 0);
            return;
        }
        // Authoritative saved value (per-key sticky replay when the screen
        // opens, or a later C++ echo): it moves the control.
        localState[payload.Key] = v;
        if (controlUpdaters[payload.Key]) controlUpdaters[payload.Key](v);
    }

    function onFooter(payload) { renderFooter(payload); }

    function goBack() { tsic.publishMessage('UI.Cmd.Settings.Back', {}); }
    function doReset() {
        if (isControlsPage(activePageId)) {
            tsic.publishMessage('UI.Cmd.Settings.ResetControls', { bGamepad: activePageId === GAMEPAD_PAGE_ID });
            return;
        }
        tsic.publishMessage('UI.Cmd.Settings.ResetDefaults', { PageId: activePageId || '' });
    }

    function onGlobalKey(e) {
        if (activePopover) {
            // Esc is a deliberate press, so it reports Revert — unlike the Back-pop
            // path in openPopover, which only means focus left the panel.
            if (e.key === 'Escape') {
                e.preventDefault(); e.stopPropagation();
                resolvePopover('revert', false);
            }
            return;
        }
        if (activeRebind) {
            // Capture is owned by C++; here we only let Esc dismiss the dialog for
            // keyboard users whose Esc reaches CEF (e.g. focused dialog).
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelRebind(); }
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault(); e.stopPropagation();
            goBack();
        }
    }

    // Build the static structure BEFORE subscribing: tsic.on replays sticky
    // messages synchronously, so the per-key UI.Settings.Value replays (the
    // real saved values) land on an already-built page and move its controls —
    // subscribing first would let the placeholder build wipe them.
    onCatalog({ Json: JSON.stringify(STATIC_CATALOG) });
    tsic.on('tsic.msg.UI.Settings.Catalog', onCatalog);
    // Microphone list is enumerated by C++ (sticky). Swap the placeholder
    // Options into the static catalog and rebuild; structSig treats an
    // unchanged list as a no-op value patch, so this is safe to re-run.
    tsic.on('tsic.msg.UI.Settings.VoiceDevices', (p) => {
        const devices = (p && p.Devices) || [];
        if (!devices.length) return;
        for (const page of STATIC_CATALOG.Pages) {
            for (const g of (page.Groups || [])) {
                for (const s of (g.Settings || [])) {
                    if (s.Key === 'voice.input_device') {
                        s.Options = devices.map(d => ({ Value: d.Value || '', Label: d.Label || d.Value || 'Unknown device' }));
                    }
                }
            }
        }
        // A changed Options list forces a full rebuild, which wipes localState
        // (the echoed saved values). This message can arrive after the sticky
        // Value replays, so carry the values across the rebuild.
        rebuildPreservingValues();
    });
    tsic.on('tsic.msg.UI.Settings.ControlsState', onControlsState);
    tsic.on('tsic.msg.UI.Settings.RebindCapture', onRebindCapture);
    tsic.on('tsic.msg.UI.Settings.Value', onValue);
    tsic.on('tsic.msg.UI.Settings.Footer', onFooter);
    window.addEventListener('keydown', onGlobalKey, true);
    const backBtn = document.getElementById('btn-back');     if (backBtn)  backBtn.onclick  = goBack;
    const resetBtn = document.getElementById('btn-reset');   if (resetBtn) resetBtn.onclick = doReset;
})();
