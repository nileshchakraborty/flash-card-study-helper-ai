import http from 'http';
import type { Application } from 'express';
import { jest } from '@jest/globals';

/**
 * Creates an in-memory HTTP server wrapper that satisfies supertest without binding a real port.
 * Avoids EPERM in restricted sandboxes by stubbing listen/close/address and providing minimal _handle.
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
  // supertest checks this when reusing agents
  // @ts-expect-error shim
  server.keepAliveTimeout = 0;

  return server;
}

/**
 * Globally stub http.Server.listen/address for tests to avoid real socket binding.
 */
export function stubServerListen() {
  jest.spyOn(http.Server.prototype, 'listen').mockImplementation(function (_port?: any, _host?: any, cb?: () => void) {
    cb?.();
    return this as unknown as http.Server;
  });
  jest.spyOn(http.Server.prototype, 'address').mockImplementation(function () {
    return { port: 0, address: '127.0.0.1', family: 'IPv4' };
  });
}
