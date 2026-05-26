// shared/hud-toast.js — Toast notifications.
// Works on every screen. Subscribes to UI.Toast.Show.
// DOM: #toast-container (created by hud.js before this loads).
(function () {
  function severityClass(tag) {
    if (!tag) return '';
    var parts = String(tag).split('.');
    var leaf = parts[parts.length - 1].toLowerCase();
    if (leaf === 'error' || leaf === 'danger') return 'toast--error';
    if (leaf === 'warning' || leaf === 'warn') return 'toast--warning';
    if (leaf === 'info') return 'toast--info';
    return '';
  }

  function extractSeverityTag(sev) {
    if (!sev) return '';
    if (typeof sev === 'string') return sev;
    if (typeof sev === 'object' && typeof sev.TagName === 'string') return sev.TagName;
    return '';
  }

  function showToast(payload) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var text = (payload && (payload.Text || payload.text)) || '';
    if (!text) return;
    var div = document.createElement('div');
    div.className = 'toast ' + severityClass(extractSeverityTag(payload && payload.Severity));
    div.textContent = String(text);
    container.appendChild(div);
    setTimeout(function () {
      if (!div.parentNode) return;
      div.classList.add('toast--leaving');
      setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, 200);
    }, 3000);
  }

  tsic.on('tsic.msg.UI.Toast.Show', showToast);
})();
