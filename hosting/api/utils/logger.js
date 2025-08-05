/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */

const winston = require('winston');

// Create logger with console and file transports
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'spinforge-api' },
  transports: [
    // Console transport with colorized output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport if not in production
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.File({ 
    filename: '/tmp/spinforge-error.log', 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: '/tmp/spinforge-combined.log' 
  }));
}

// Create a stream object with a 'write' function that will be used by morgan
logger.stream = {
  write: function(message, encoding) {
    // Remove the newline character at the end
    logger.info(message.trim());
  }
};

module.exports = logger;