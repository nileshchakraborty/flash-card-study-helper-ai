declare module 'opossum' {
    import { EventEmitter } from 'events';

    namespace CircuitBreaker {
        interface Options {
            timeout?: number;
            errorThresholdPercentage?: number;
            resetTimeout?: number;
            [key: string]: any;
        }
    }

    class CircuitBreaker extends EventEmitter {
        constructor(action: any, options?: CircuitBreaker.Options);
        fire(...args: any[]): Promise<any>;
        fallback(callback: Function): this;
    }

    export = CircuitBreaker;
}
