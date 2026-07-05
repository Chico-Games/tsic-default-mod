// shared/terminal/runtime.js
//
// Loads a program into a sandbox="allow-scripts" iframe (no allow-same-origin
// => unique opaque origin) and brokers a capability-gated postMessage API.
// The program source + shim are inlined into srcdoc because an opaque-origin
// frame cannot fetch same-scheme scripts. Pure helpers are unit-tested; the
// live round-trip is verified in the playground.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};

  // Runs INSIDE the sandboxed iframe. Talks to the host (parent) only via
  // postMessage. Every host message is tagged __tsicHost; every program
  // message is tagged __tsicProgram.
  const PROGRAM_SHIM = [
    '(function(){',
    '  var pending = new Map(); var seq = 0; var apiResolve;',
    '  function send(type, payload){ var id = ++seq; return new Promise(function(res){ pending.set(id, res); parent.postMessage({__tsicProgram:true, id:id, type:type, payload:payload}, "*"); }); }',
    '  function makeApi(caps){ return {',
    '    caps: caps,',
    '    print: function(t, opts){ parent.postMessage({__tsicProgram:true, type:"print", payload:{text:String(t), opts:opts||null}}, "*"); },',
    '    clear: function(){ parent.postMessage({__tsicProgram:true, type:"clear"}, "*"); },',
    '    reboot: function(){ parent.postMessage({__tsicProgram:true, type:"reboot"}, "*"); },',
    '    readLine: function(prompt){ return send("readLine", {prompt: prompt||""}).then(function(r){ return (r && r.line) || ""; }); },',
    '    storage: { get: function(k){ return send("storage.get", {key:k}); }, set: function(k,v){ return send("storage.set", {key:k, value:v}); } },',
    '    catalog: { list: function(){ return send("catalog.list", {}); } },',
    '    world: { read: function(k){ return send("world.read", {key:k}); }, mutate: function(op,args){ return send("world.mutate", {op:op, args:args}); } },',
    '    theme: function(name){ parent.postMessage({__tsicProgram:true, type:"theme", payload:{name:name}}, "*"); },',
    '    exit: function(){ parent.postMessage({__tsicProgram:true, type:"exit"}, "*"); },',
    '  }; }',
    '  window.addEventListener("message", function(e){',
    '    var m = e.data; if(!m || !m.__tsicHost) return;',
    '    if(m.type === "handshake"){ if(apiResolve){ apiResolve(makeApi(m.caps||[])); apiResolve=null; } return; }',
    '    if(m.id && pending.has(m.id)){ var r = pending.get(m.id); pending.delete(m.id); r(m.result); }',
    '  });',
    '  window.TSICProgram = { connect: function(){ return new Promise(function(res){ apiResolve = res; parent.postMessage({__tsicProgram:true, type:"hello"}, "*"); }); } };',
    '})();',
  ].join('\n');

  function buildProgramDoc(programSrc) {
    return [
      '<!doctype html><html><head><meta charset="utf-8"></head><body>',
      '<script>', PROGRAM_SHIM, '<\/script>',
      '<script>', programSrc, '<\/script>',
      '</body></html>',
    ].join('');
  }

  function validateRequest(op, grantedCaps) {
    const cap = NS.capabilities.capForOp(op);
    if (!cap) return { ok: false, code: NS.ERR.CAP_DENIED };
    if ((grantedCaps || []).indexOf(cap) === -1) return { ok: false, code: NS.ERR.CAP_DENIED };
    return { ok: true };
  }

  function launch(opts) {
    const container = opts.container;
    const granted = opts.granted || [];
    const handlers = opts.handlers;
    const onPrint = opts.onPrint || function () {};
    const onExit = opts.onExit || function () {};
    const onTheme = opts.onTheme || function () {};
    const onClear = opts.onClear || function () {};
    const onReboot = opts.onReboot || function () {};
    const requestInput = opts.requestInput || function () { return Promise.resolve(''); };

    const iframe = document.createElement('iframe');
    iframe.className = 'tsic-term-program';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.srcdoc = buildProgramDoc(opts.entrySrc);

    function reply(id, result) {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage({ __tsicHost: true, id: id, type: 'reply', result: result }, '*');
    }

    function onMessage(e) {
      if (iframe.contentWindow && e.source !== iframe.contentWindow) return;
      const m = e.data;
      if (!m || !m.__tsicProgram) return;
      if (m.type === 'hello') {
        iframe.contentWindow.postMessage({ __tsicHost: true, type: 'handshake', caps: granted }, '*');
        return;
      }
      // print/theme/clear/reboot/exit reach nothing outside this iframe (they
      // drive the terminal's own scrollback, colour, and lifecycle); ungated.
      if (m.type === 'print') { onPrint(String((m.payload && m.payload.text) || ''), m.payload && m.payload.opts); return; }
      if (m.type === 'theme') { onTheme(m.payload && m.payload.name); return; }
      if (m.type === 'clear') { onClear(); return; }
      if (m.type === 'reboot') { kill(); onReboot(); return; }
      if (m.type === 'exit') { kill(); onExit(); return; }
      if (m.type === 'readLine') {
        if (granted.indexOf('term.input') === -1) { reply(m.id, { error: NS.ERR.CAP_DENIED }); return; }
        requestInput((m.payload && m.payload.prompt) || '').then(function (line) { reply(m.id, { line: line }); });
        return;
      }
      // Host-handled ops: gate then dispatch.
      const v = validateRequest(m.type, granted);
      if (!v.ok) { reply(m.id, { error: v.code }); return; }
      // A rejecting host handler (e.g. a future C++-backed op) surfaces as an error rather than hanging the program.
      handlers.dispatch(m.type, m.payload).then(
        function (result) { reply(m.id, result); },
        function () { reply(m.id, { error: NS.ERR.NOT_IMPLEMENTED }); }
      );
    }

    window.addEventListener('message', onMessage);
    container.appendChild(iframe);

    let killed = false;
    function kill() {
      if (killed) return;
      killed = true;
      window.removeEventListener('message', onMessage);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }

    return { kill: kill };
  }

  NS.runtime = { PROGRAM_SHIM: PROGRAM_SHIM, buildProgramDoc: buildProgramDoc, validateRequest: validateRequest, launch: launch };
})(window);
