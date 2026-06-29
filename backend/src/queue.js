const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,  // BullMQ requirement
});

redisConnection.on('connect', () => console.log('✅ Redis connected'));
redisConnection.on('ready',   () => console.log('✅ Redis ready'));
redisConnection.on('error',   err => console.error('❌ Redis error:', err.message));

const QUEUE_NAME = 'tf-events';
let queue;

function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: redisConnection });
    console.log("QUEUE READY", queue.name);
  }
  return queue;
}

module.exports = { getQueue, redisConnection, QUEUE_NAME };