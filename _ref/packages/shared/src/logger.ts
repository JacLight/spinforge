import winston from 'winston';

const { combine, timestamp, json, colorize, printf } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create logger instance
export const createLogger = (service: string) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service },
    format: combine(
      timestamp(),
      isDevelopment ? combine(colorize(), devFormat) : json()
    ),
    transports: [
      new winston.transports.Console(),
      // Add file transport in production
      ...(isDevelopment ? [] : [
        new winston.transports.File({ 
          filename: 'error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'combined.log' 
        })
      ])
    ]
  });
};

// Default logger
export const logger = createLogger('spinforge');