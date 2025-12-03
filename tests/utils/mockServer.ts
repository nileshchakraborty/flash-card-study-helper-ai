import http from 'http';
import type { Application } from 'express';

/**
 * Creates an in-memory HTTP server wrapper that satisfies supertest without binding a real port.
 * Avoids EPERM in restricted sandboxes by stubbing listen/close/address.
 */
export function createMockServer(app: Application): http.Server {
  const server = http.createServer(app);

  const address = { port: 0, address: '127.0.0.1', family: 'IPv4' };

  // No-op listen to avoid actual socket binding
  // @ts-expect-error override listen signature
  server.listen = (_port?: any, _host?: any, cb?: () => void) => {
    cb?.();
    return server;
  };

  // Return fake address info
  // @ts-expect-error override address
  server.address = () => address;

  // No-op close
  server.close = (cb?: (err?: Error) => void) => {
    cb?.();
    return server;
  };

  // Prevent supertest from trying to use real net handles
  // @ts-expect-error private field shim
  server._handle = {
    close: () => {},
  };
  // @ts-expect-error shim
  server._connectionKey = 'mock';
  // @ts-expect-error shim
  server._unref = () => server;

  return server;
}
