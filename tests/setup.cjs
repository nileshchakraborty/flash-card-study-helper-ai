// Polyfill TextEncoder/TextDecoder for Node.js environment
const { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder } = require('util');
const { ReadableStream } = require('stream/web');

if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream;
}

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder extends NodeTextEncoder {
    encode(input) {
      const result = super.encode(input);
      // Convert to the global Uint8Array to ensure instanceof checks pass
      return new Uint8Array(result);
    }
  };
  global.TextDecoder = NodeTextDecoder;
}

// Also set on globalThis for compatibility
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = global.TextEncoder;
  globalThis.TextDecoder = global.TextDecoder;
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

// Polyfill structuredClone if undefined (needed for jose library in tests)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

// Polyfill Web Crypto API if undefined or if subtle is missing (needed for jose library)
const { webcrypto } = require('crypto');
if (typeof global.crypto === 'undefined' || typeof global.crypto.subtle === 'undefined') {
  // If JSDOM provides crypto but not subtle, we might need to replace the whole thing or just extend it
  // Replacing it is safer for jose compatibility
  Object.defineProperty(global, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true
  });
}

// Polyfill File for undici/fetch when running in node test env
if (typeof global.File === 'undefined') {
  class FilePolyfill extends global.Blob {
    constructor(parts, filename, options = {}) {
      super(parts, options);
      this.name = filename;
      this.lastModified = options.lastModified || Date.now();
    }
  }
  global.File = FilePolyfill;
}
// Mock IndexedDB for JSDOM
if (typeof global.indexedDB === 'undefined') {
  global.indexedDB = {
    open: () => ({
      result: {
        createObjectStore: () => { },
        transaction: () => ({
          objectStore: () => ({
            get: () => ({ result: null }),
            put: () => { },
            getAllKeys: () => ({ result: [] }),
            delete: () => { }
          })
        })
      },
      onupgradeneeded: null,
      onsuccess: null,
    }),
  };
}
