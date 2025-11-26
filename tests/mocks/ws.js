// Mock WebSocketServer for Jest tests
export class WebSocketServer {
    constructor(options) {
        this.options = options;
    }

    on(event, handler) {
        // No-op for tests
    }

    close() {
        // No-op for tests
    }
}

export class WebSocket {
    constructor(url) {
        this.url = url;
    }

    on(event, handler) {
        // No-op for tests
    }

    send(data) {
        // No-op for tests
    }

    close() {
        // No-op for tests
    }
}

export default { WebSocketServer, WebSocket };
