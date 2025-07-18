"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.createLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const { combine, timestamp, json, colorize, printf } = winston_1.default.format;
// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});
// Create logger instance
const createLogger = (service) => {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    return winston_1.default.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        defaultMeta: { service },
        format: combine(timestamp(), isDevelopment ? combine(colorize(), devFormat) : json()),
        transports: [
            new winston_1.default.transports.Console(),
            // Add file transport in production
            ...(isDevelopment ? [] : [
                new winston_1.default.transports.File({
                    filename: 'error.log',
                    level: 'error'
                }),
                new winston_1.default.transports.File({
                    filename: 'combined.log'
                })
            ])
        ]
    });
};
exports.createLogger = createLogger;
// Default logger
exports.logger = (0, exports.createLogger)('spinforge');
//# sourceMappingURL=logger.js.map