// Polyfill TextEncoder/TextDecoder for Node.js environment
const { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder } = require('util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = NodeTextEncoder;
  global.TextDecoder = NodeTextDecoder;
}

// Also set on globalThis for compatibility
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = NodeTextEncoder;
  globalThis.TextDecoder = NodeTextDecoder;
}

// Polyfill setImmediate for jsdom
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => {
    return setTimeout(fn, 0, ...args);
  };
  global.clearImmediate = (id) => {
    return clearTimeout(id);
  };
}
