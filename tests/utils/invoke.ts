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
      read() {},
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
    req.headers = { ...(options.headers || {}) } as any;

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
      if (chunk) bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return originalWrite(chunk, encoding, cb);
    };
    // @ts-expect-error override
    res.end = (chunk?: any, encoding?: any, cb?: any) => {
      if (chunk) bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return originalEnd(chunk, encoding, cb);
    };

    res.assignSocket(socket as any);
    res.on('finish', () => {
      const text = Buffer.concat(bodyChunks).toString('utf8');
      const headers = res.getHeaders() as Record<string, string | number | readonly string[]>;
      const contentType = headers['content-type'];
      let json: unknown;
      if (typeof contentType === 'string' && contentType.includes('application/json')) {
        try {
          json = JSON.parse(text);
        } catch (e) {
          // ignore parse errors for non-JSON responses
        }
      }
      resolve({ status: res.statusCode, headers, text, json });
    });
    res.on('error', reject);

    if (rawBody) req.push(rawBody);
    req.push(null);

    try {
      app.handle(req as any, res as any);
    } catch (err) {
      reject(err);
    }
  });
}
