import CircuitBreaker from 'opossum';
import { LoggerService } from './LoggerService.js';

const logger = new LoggerService();

export class ResilienceService {
    private breakers: Map<string, CircuitBreaker>;

    constructor() {
        this.breakers = new Map();
    }

    getBreaker(name: string, action: any, options?: CircuitBreaker.Options): CircuitBreaker {
        if (!this.breakers.has(name)) {
            const breaker = new CircuitBreaker(action, {
                timeout: 10000, // If function takes longer than 10 seconds, trigger failure
                errorThresholdPercentage: 50, // When 50% of requests fail, trip breaker
                resetTimeout: 30000, // After 30 seconds, try again
                ...options
            });

            breaker.fallback(() => {
                logger.warn(`Circuit breaker '${name}' fallback triggered`);
                return { error: 'Service unavailable, please try again later.' };
            });

            breaker.on('open', () => logger.warn(`Circuit breaker '${name}' OPENED`));
            breaker.on('close', () => logger.info(`Circuit breaker '${name}' CLOSED`));
            breaker.on('halfOpen', () => logger.info(`Circuit breaker '${name}' HALF-OPEN`));

            this.breakers.set(name, breaker);
        }
        return this.breakers.get(name)!;
    }

    async execute<T>(name: string, action: () => Promise<T>, options?: CircuitBreaker.Options): Promise<T> {
        const breaker = this.getBreaker(name, action, options);
        return breaker.fire() as Promise<T>;
    }
}
