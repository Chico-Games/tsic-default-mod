// shared/hud-notifications.js — typed notification cards (Tip / Warning /
// Error / Inventory / Event / Alarm / PlayerJoined / PlayerDied / Progression).
// Works on every screen, like hud-toast.js. Subscribes to UI.Notification.Show
// (FScpUINotification: { Type, Title, Text, IconUrl }).
// DOM: #notif-stack (created by hud.js before this loads). Styles: hud.css.
(function () {
  var MAX_VISIBLE = 5;
  var LIFETIME_MS = 8000;
  var EXIT_OFFSET_MS = 1000;
  var stack = [];

  function dropOldest() {
    var old = stack.shift();
    if (!old) return;
    clearTimeout(old.exitTimer);
    clearTimeout(old.killTimer);
    if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
  }

  // A store alarm and a crafting tip should not sound identical. Types with no
  // entry fall back to the generic card sound.
  var TYPE_SOUNDS = {
    Alarm: 'UI.Error',
    Error: 'UI.Error',
    Warning: 'UI.Error',
    Progression: 'Notification.Objective',
    PlayerDied: 'Notification.Objective',
  };
  function soundForType(type) {
    return TYPE_SOUNDS[String(type || '')] || 'Notification.Show';
  }

  function spawn(payload) {
    var host = document.getElementById('notif-stack');
    if (!host || !payload) return;
    var div = document.createElement('div');
    div.className = 'notif notif--' + String(payload.Type || 'Tip');

    if (payload.IconUrl) {
      var img = document.createElement('img');
      img.className = 'notif-icon';
      img.src = payload.IconUrl;
      img.onerror = function () { img.style.display = 'none'; };
      div.appendChild(img);
    }
    var body = document.createElement('div');
    body.className = 'notif-body';
    if (payload.Title) {
      var t = document.createElement('div');
      t.className = 'notif-title';
      t.textContent = String(payload.Title);
      body.appendChild(t);
    }
    if (payload.Text) {
      var x = document.createElement('div');
      x.className = 'notif-text';
      x.textContent = String(payload.Text);
      body.appendChild(x);
    }
    div.appendChild(body);
    host.appendChild(div);
    try { tsic.playSound(soundForType(payload.Type), 0.35); } catch (e) {}

    var entry = { el: div };
    stack.push(entry);
    while (stack.length > MAX_VISIBLE) dropOldest();

    requestAnimationFrame(function () { div.classList.add('visible'); });

    entry.exitTimer = setTimeout(function () {
      div.classList.remove('visible');
      div.classList.add('exiting');
    }, LIFETIME_MS - EXIT_OFFSET_MS);

    entry.killTimer = setTimeout(function () {
      var i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (div.parentNode) div.parentNode.removeChild(div);
    }, LIFETIME_MS);
  }

  tsic.on('tsic.msg.UI.Notification.Show', spawn);
})();
