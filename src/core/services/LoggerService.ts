import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] : ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

const isServerless =
    process.env.VERCEL === '1' ||
    process.env.NOW_REGION !== undefined ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

// Never write to disk in serverless or production to avoid ENOENT on /tmp
const enableFileLogs =
    process.env.LOG_TO_FILE === 'true' &&
    !isServerless &&
    process.env.NODE_ENV !== 'production';

const isVercelProduction =
    process.env.VERCEL === '1' &&
    process.env.NODE_ENV === 'production';

const transports: winston.transport[] = [
    new winston.transports.Console({
        silent: isVercelProduction, // Silent in Vercel Production
        format: combine(
            colorize(),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            logFormat
        )
    })
];

if (enableFileLogs) {
    transports.push(
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    );
}

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        json()
    ),
    transports
});

export class LoggerService {
    info(message: string, meta?: any) {
        logger.info(message, meta);
    }

    error(message: string, meta?: any) {
        logger.error(message, meta);
    }

    warn(message: string, meta?: any) {
        logger.warn(message, meta);
    }

    debug(message: string, meta?: any) {
        logger.debug(message, meta);
    }
}
