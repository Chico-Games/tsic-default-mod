// shared/hud-chat.js — multiplayer text chat overlay (bottom-left, above the
// health/stamina vials).
//
// Closed (default): only the message log shows, and it fully fades out after a
// quiet period — or shortly after the input closes. New messages reveal it
// again. Open (Enter / Input.Behavior.OpenChat): the input row appears, the
// field takes keyboard focus (tsic-runtime hands the keyboard to CEF while a
// text field is focused), and a "ChatInput" overlay is pushed so the engine
// frees the mouse — that's what makes the log text mouse-selectable.
//
// Send path: UI.Cmd.Chat.Send -> director -> TextChatControllerComponent ->
// server RPC -> TextChatGameStateComponent multicast -> UI.Chat.History.
(function () {
  var IDLE_FADE_MS = 10000; // no new messages for this long -> fade out
  var CLOSE_FADE_MS = 2500; // linger after closing the input, then fade

  var STYLE = [
    '#hud-chat { position:fixed; left:24px; bottom:260px; width:380px; display:flex; flex-direction:column; gap:6px; pointer-events:none; color:var(--cat-ink-dark); font-size:13px; line-height:1.35; z-index:20; opacity:1; transition:opacity 600ms ease; }',
    '#hud-chat.faded { opacity:0; }',
    '#hud-chat.open { opacity:1; }',
    '#hud-chat-log { display:flex; flex-direction:column-reverse; gap:4px; max-height:240px; overflow:hidden; padding:6px 8px; background:rgba(241,229,207,0.78); border-left:2px solid var(--tsic-border); border-radius:2px; }',
    '#hud-chat.open #hud-chat-log { overflow-y:auto; pointer-events:auto; }',
    // Selection is opt-in (base.css disables it globally) and only useful while
    // the mouse is free, i.e. while the chat overlay is open.
    '#hud-chat.open #hud-chat-log .hc-sender, #hud-chat.open #hud-chat-log .hc-text { user-select:text; -webkit-user-select:text; cursor:text; }',
    '.hc-row { display:flex; gap:6px; align-items:baseline; }',
    '.hc-sender { color:var(--tsic-accent); font-weight:600; flex:0 0 auto; }',
    '.hc-text { flex:1 1 auto; word-break:break-word; }',
    '#hud-chat-input-row { display:none; align-items:center; gap:6px; padding:6px 8px; background:rgba(241,229,207,0.92); border:1px solid var(--tsic-border); border-radius:2px; }',
    '#hud-chat.open #hud-chat-input-row { display:flex; pointer-events:auto; }',
    '#hud-chat-input { flex:1 1 auto; background:transparent; border:0; outline:none; color:var(--cat-ink-dark); font:inherit; }',
    '#hud-chat-input::placeholder { color:rgba(0,0,0,0.35); }',
    '#hud-chat-prompt { color:rgba(0,0,0,0.5); }',
    'body.hud-hidden #hud-chat { display:none !important; }',
    'body.hud-hide-chat #hud-chat { display:none !important; }',
  ].join('\n');

  function el(tag, attrs) {
    if (window.TSIC && window.TSIC.el) return TSIC.el.apply(null, arguments);
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function mount() {
    var root = document.getElementById('hud-chat');
    if (!root) return;

    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    root.classList.add('faded'); // nothing to show until history arrives

    var log = el('div', { id: 'hud-chat-log' });
    var row = el('div', { id: 'hud-chat-input-row' });
    var prompt = el('span', { id: 'hud-chat-prompt' });
    prompt.textContent = '>';
    var input = el('input', {
      id: 'hud-chat-input', type: 'text', autocomplete: 'off',
      spellcheck: 'false', maxlength: '200', placeholder: 'Send a message…',
    });
    row.appendChild(prompt);
    row.appendChild(input);
    root.appendChild(log);
    root.appendChild(row);

    var isOpen = false;
    var fadeTimer = 0;
    var lastCount = -1;
    var justSentAt = 0; // suppresses the receive sound for our own just-sent message

    function scheduleFade(ms) {
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(function () { root.classList.add('faded'); }, ms);
    }

    function reveal(ms) {
      root.classList.remove('faded');
      if (!isOpen) scheduleFade(ms);
    }

    function rectOf(node) {
      var r = node.getBoundingClientRect();
      var pad = 2;
      return {
        x: Math.max(0, Math.floor(r.left - pad)),
        y: Math.max(0, Math.floor(r.top - pad)),
        w: Math.ceil(r.width + pad * 2),
        h: Math.ceil(r.height + pad * 2),
      };
    }

    // While open, only the log + input row are CEF-interactive; everything
    // else clicks through to the game. Closed restores the whole-view rect
    // tsic-focus.js maintains for mouse mode.
    function publishRects() {
      tsic.setInteractiveRects([rectOf(row), rectOf(log)]);
    }

    function restoreRects() {
      tsic.setInteractiveRects([{ x: 0, y: 0, w: 99999, h: 99999 }]);
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      clearTimeout(fadeTimer);
      root.classList.add('open');
      root.classList.remove('faded');
      tsic.publishMessage('UI.Cmd.Overlay.Push', { Name: 'ChatInput' });
      try { tsic.playSound('Chat.Open', 0.5); } catch (e) {}
      publishRects();
      input.focus();
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      root.classList.remove('open');
      input.value = '';
      try { tsic.playSound('Chat.Close', 0.5); } catch (e) {}
      tsic.publishMessage('UI.Cmd.Overlay.Pop', { Name: 'ChatInput' });
      restoreRects();
      scheduleFade(CLOSE_FADE_MS);
      if (document.activeElement === input) input.blur();
    }

    function render(history) {
      log.innerHTML = '';
      var msgs = (history && history.Messages) || [];
      // Newest first — the log is column-reverse.
      for (var i = msgs.length - 1; i >= 0; --i) {
        var m = msgs[i];
        var line = el('div', { class: 'hc-row' });
        var sender = el('span', { class: 'hc-sender' });
        sender.textContent = (m.SenderName || 'Unknown') + ':';
        var text = el('span', { class: 'hc-text' });
        text.textContent = m.Text || '';
        line.appendChild(sender);
        line.appendChild(text);
        log.appendChild(line);
      }
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var text = (input.value || '').trim();
        if (text) {
          tsic.publishMessage('UI.Cmd.Chat.Send', { Channel: '', Text: text });
          justSentAt = Date.now();
          try { tsic.playSound('Chat.Send', 0.3); } catch (e2) {}
        }
        close();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    // Text selection in the log: the drag blurs the input (which normally
    // hands the keyboard back to the game), so on release we auto-copy the
    // selection to the clipboard (Ctrl+C can't reach CEF while the field is
    // blurred) and refocus the input to keep typing seamless.
    var pointerInChat = false;
    root.addEventListener('mousedown', function () { pointerInChat = true; });
    window.addEventListener('mouseup', function () {
      if (!pointerInChat) return;
      pointerInChat = false;
      if (!isOpen) return;
      var sel = window.getSelection();
      var text = sel ? String(sel) : '';
      if (text && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
      }
      if (document.activeElement !== input) input.focus();
    });

    input.addEventListener('blur', function () {
      // Deferred: a blur from a selection drag in the log must not close —
      // the mouseup handler above refocuses the input when the drag ends.
      setTimeout(function () {
        if (!isOpen || pointerInChat) return;
        if (document.activeElement !== input) close();
      }, 0);
    });

    window.addEventListener('resize', function () {
      if (isOpen) publishRects();
    });

    tsic.on('tsic.msg.UI.Behavior.OpenChat', function (e) {
      if (!e || e.Phase !== 'Started') return;
      open();
    });

    tsic.on('tsic.msg.UI.Chat.History', function (p) {
      var msgs = (p && p.Messages) || [];
      render(p);
      if (msgs.length > 0 && msgs.length !== lastCount) {
        reveal(IDLE_FADE_MS);
        // Own just-sent message already played Chat.Send above — don't double up.
        if (Date.now() - justSentAt > 400) {
          try { tsic.playSound('Chat.Receive', 0.3); } catch (e) {}
        }
      }
      lastCount = msgs.length;
    });
  }

  if (window.tsic && document.getElementById('hud-chat')) {
    mount();
  } else {
    var tries = 0;
    (function wait() {
      if (window.tsic && document.getElementById('hud-chat')) { mount(); return; }
      if (++tries < 200) setTimeout(wait, 16);
    })();
  }
})();
