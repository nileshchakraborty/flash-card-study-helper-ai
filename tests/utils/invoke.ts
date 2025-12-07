import http from 'http';
import stream from 'stream';
import type { Application } from 'express';

export interface InvokeOptions {
  headers?: Record<string, string>;
  body?: unknown;
}

export interface InvokeResult {
  status: number;
  headers: Record<string, string | number | readonly string[]>;
  text: string;
  json?: unknown;
}

/**
 * Invoke an Express app entirely in-memory (no sockets) and capture the response.
 * Useful for sandboxes where listen()/net bindings are blocked.
 */
export async function invoke(app: Application, method: string, path: string, options: InvokeOptions = {}): Promise<InvokeResult> {
  return new Promise((resolve, reject) => {
    const bodyChunks: Buffer[] = [];
    const socket = new stream.Duplex({
      read() { },
      write(_chunk, _enc, cb) {
        // Ignore writes to the socket; we collect body via patched res.write
        cb();
      },
    });
    // Provide a predictable IP for middleware like rate-limit
    // @ts-expect-error Node socket shape
    socket.remoteAddress = '127.0.0.1';

    const req = new http.IncomingMessage(socket as any);
    req.method = method.toUpperCase();
    req.url = path;
    req.headers = {
      'x-forwarded-for': '127.0.0.1',
    } as any;

    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        req.headers[key.toLowerCase()] = value as any;
      }
    }

    let rawBody: string | Buffer | undefined;
    if (options.body !== undefined) {
      if (typeof options.body === 'string' || Buffer.isBuffer(options.body)) {
        rawBody = options.body;
      } else {
        rawBody = JSON.stringify(options.body);
        if (!req.headers['content-type']) req.headers['content-type'] = 'application/json';
      }
      req.headers['content-length'] = Buffer.byteLength(rawBody).toString();
    }

    const res = new http.ServerResponse(req);

    // Capture body by patching write/end
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    // @ts-expect-error override
    res.write = (chunk: any, encoding?: any, cb?: any) => {
      // console.log('Invoke: res.write called with chunk length', chunk ? chunk.length : 0);
      if (chunk) bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return originalWrite(chunk, encoding, cb);
    };
    // Common resolution logic
    const tryResolve = () => {
      if (bodyChunks.length > 0 || res.statusCode) { // verify we have something
        const text = Buffer.concat(bodyChunks).toString('utf8');
        const headers = res.getHeaders() as Record<string, string | number | readonly string[]>;
        const contentType = headers['content-type'] as string | undefined;
        let json: unknown;
        if (contentType && contentType.includes('application/json')) {
          try { json = JSON.parse(text); } catch (e) { }
        }
        resolve({ status: res.statusCode, headers, text, json });
      }
    };

    res.on('finish', () => {
      // console.log('Invoke: res finish event fired');
      tryResolve();
    });

    // @ts-expect-error override
    res.end = (chunk?: any, encoding?: any, cb?: any) => {
      // console.log('Invoke: res.end called');
      if (chunk) bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      const result = originalEnd(chunk, encoding, cb);
      // Force resolve on next tick in case finish event doesn't fire
      process.nextTick(tryResolve);
      return result;
    };
    res.on('error', (err) => {
      // console.error('Invoke: res error', err);
      reject(err);
    });

    // res.assignSocket(socket as any); // Moved/Duplicated handle
    // We can rely on res created with req which has socket?
    // Actually http.ServerResponse(req) extracts socket from req on Node > 12?
    // But explicit assignment is safer for older mocks.
    res.assignSocket(socket as any);

    if (rawBody) req.push(rawBody);
    req.push(null);

    // console.log('Invoke: handling request', method, path);
    try {
      app.handle(req as any, res as any);
    } catch (err) {
      // console.error('Invoke: app.handle threw', err);
      reject(err);
    }
  });
}
