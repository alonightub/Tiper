import * as winston from 'winston';

export const CONFIG = {
    OPEN_BROWSER: false,
    CONCURRENT_BROWSERS_NUM: 4,
    VIDEOS_TO_FETCH: 10,
    MAX_SCROLLS: 200,
    DATA_DIR: './data',
    SECRETS_DIR: './secrets',
    COOKIES_STORAGE_STATE: 'florin',
    S3_BUCKET_NAME: 'testiper',
};

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' })
    ]
});

export enum Environment {
    LOCAL = 'local',
    DEV = 'dev',    
    PROD = 'prod',
}

export interface Proxy {
    server: string;
    username: string;
    password: string;
}