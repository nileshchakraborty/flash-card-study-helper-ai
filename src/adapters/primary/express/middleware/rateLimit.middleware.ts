import rateLimit from 'express-rate-limit';

export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: 'Too many requests from this IP, please try again after 15 minutes'
    },
    validate: { trustProxy: false },
    keyGenerator: (_req) => 'client'
});

export const authRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 login attempts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many login attempts from this IP, please try again after an hour'
    },
    validate: { trustProxy: false }
});
