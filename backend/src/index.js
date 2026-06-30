require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { startWorker } = require('./worker');
const { getQueue } = require('./queue');
const { startCron } = require('./cron');
const { requestLogger } = require('./logger');

const isProd = process.env.NODE_ENV === 'production';

// Allowed origins: FRONTEND_URL in prod, all in dev
const CORS_ORIGIN = isProd
  ? (process.env.FRONTEND_URL || 'http://localhost:4032')
  : true;

async function startServer() {
  await db.init();
  startWorker();
  startCron();

  const app = express();
  const PORT = process.env.PORT || 3251;

  app.use(helmet({ contentSecurityPolicy:false, crossOriginResourcePolicy:{policy:'cross-origin'}, crossOriginEmbedderPolicy:false, crossOriginOpenerPolicy:false }));
  app.use(compression());
  if (!isProd) app.use(morgan('dev'));

  app.use(requestLogger);

  app.use(cors({ origin: CORS_ORIGIN, methods:['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization'], credentials:true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.text());

  const collectLimit = rateLimit({ windowMs:60*1000, max:500, standardHeaders:true, legacyHeaders:false });
  const apiLimit    = rateLimit({ windowMs:60*1000, max:200, standardHeaders:true, legacyHeaders:false });
  const nudgeLimit  = rateLimit({ windowMs:60*1000, max:1000, standardHeaders:true, legacyHeaders:false });

  app.use('/auth',      apiLimit,   require('./routes/auth'));
  app.use('/sites',     apiLimit,   require('./routes/sites'));
  app.use('/analytics', apiLimit,   require('./routes/analytics'));
  app.use('/',          nudgeLimit, require('./routes/nudge'));
  app.use('/',          collectLimit, require('./routes/collect'));

  app.get('/health', async (req, res) => {
    try {
      const q = getQueue();
      const [waiting, active, failed, completed] = await Promise.all([
        q.getWaitingCount(), q.getActiveCount(), q.getFailedCount(), q.getCompletedCount(),
      ]);
      res.json({
        ok: true, ts: Date.now(), port: PORT,
        queue: { waiting, active, failed, completed },
        worker: { running: true },
      });
    } catch {
      res.json({ ok: true, ts: Date.now(), port: PORT, queue: 'unavailable', worker: { running: false } });
    }
  });

  app.use((req, res) => res.status(404).json({ error:'Not found' }));
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error:'Internal server error' }); });

  app.listen(PORT, () => {
    console.log(`\n🚀 TrackFlow running on http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`🔒 CORS origin: ${CORS_ORIGIN}`);
  });
}

startServer().catch(err => { console.error('Failed to start:', err); process.exit(1); });