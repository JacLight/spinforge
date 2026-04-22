const redis = require('redis');
const logger = require('./logger');

// Same KeyDB instance + DB as hosting-api. Multi-master replicates per-DB,
// so splitting DBs across subsystems would break replication guarantees.
// Isolation is enforced by key prefixes (job:*, runner:*, queue:*, etc.).
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'spinforge-keydb',
    port: process.env.REDIS_PORT || 16378,
  },
  password: process.env.REDIS_PASSWORD || '',
  database: Number(process.env.REDIS_DB ?? 1),
});

redisClient.on('error', (err) => logger.error(`KeyDB error: ${err.message}`));
redisClient.on('connect', () => logger.info('KeyDB connected'));
redisClient.on('ready', () => logger.info('KeyDB ready'));

redisClient.connect();

module.exports = redisClient;
