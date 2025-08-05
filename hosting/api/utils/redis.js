/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const redis = require('redis');
const { metrics } = require('./prometheus');
const logger = require('./logger');

// Redis client
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'keydb',
    port: process.env.REDIS_PORT || 16378
  },
  password: process.env.REDIS_PASSWORD || '',
  database: process.env.REDIS_DB || 1
});

// Track Redis metrics
redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err);
  metrics.keydbConnections.set(0);
});

redisClient.on('connect', () => {
  logger.info('Connected to KeyDB');
  metrics.keydbConnections.set(1);
});

redisClient.on('ready', () => {
  logger.info('KeyDB client ready');
});

// Wrap Redis commands to track metrics
const originalSendCommand = redisClient.sendCommand;
redisClient.sendCommand = function(commandName, ...args) {
  metrics.keydbCommands.inc({ command: commandName });
  return originalSendCommand.apply(this, [commandName, ...args]);
};

redisClient.connect();

module.exports = redisClient;