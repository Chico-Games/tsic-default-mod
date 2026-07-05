// shared/terminal/capabilities.js
//
// The single chokepoint where a program touches the host. Maps program ops to
// capability tokens (gating is enforced by runtime.validateRequest BEFORE
// dispatch), and implements the host side: program-private storage, catalog
// read, and stubbed world read/mutate (deferred to a future C++ pass).
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};

  const OP_CAP = {
    'storage.get':  'storage.local',
    'storage.set':  'storage.local',
    'catalog.list': 'catalog.read',
    'world.read':   'world.read',
    'world.mutate': 'world.mutate',
  };

  function capForOp(op) {
    return Object.prototype.hasOwnProperty.call(OP_CAP, op) ? OP_CAP[op] : null;
  }

  function createHostHandlers(env) {
    const storage = env.storage;
    const catalogSnapshot = env.catalogSnapshot || function () { return []; };

    function dispatch(op, args) {
      args = args || {};
      switch (op) {
        case 'storage.set':
          storage.set(args.key, args.value);
          return Promise.resolve({ ok: true });
        case 'storage.get': {
          const v = storage.has(args.key) ? storage.get(args.key) : null;
          return Promise.resolve({ value: v });
        }
        case 'catalog.list':
          return Promise.resolve({ programs: catalogSnapshot() });
        case 'world.read':
          return Promise.resolve({ error: NS.ERR.NOT_IMPLEMENTED });
        case 'world.mutate':
          // Reserved: a future server-authoritative C++ handler will receive
          // CHANNELS.WorldMutate. No publish yet — nothing consumes it.
          return Promise.resolve({ error: NS.ERR.NOT_IMPLEMENTED });
        default:
          return Promise.resolve({ error: NS.ERR.NOT_FOUND });
      }
    }

    return { dispatch: dispatch };
  }

  NS.capabilities = { OP_CAP: OP_CAP, capForOp: capForOp, createHostHandlers: createHostHandlers };
})(window);
