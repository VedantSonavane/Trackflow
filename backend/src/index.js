require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const db = require('./db');

async function startServer() {
  // Init DB before accepting any requests
  await db.init();

  const app = express();
  const PORT = process.env.PORT || 3251;

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  }));
  app.use(compression());
  app.use(morgan('dev'));

  // Request logging middleware
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${timestamp}] 📥 ${req.method} ${req.originalUrl || req.url} - IP: ${ip}`);
    
    // Log headers for debugging auth issues
    const authHeader = req.headers.authorization;
    if (authHeader) {
      console.log(`  🔑 Auth header present: ${authHeader.substring(0, 20)}...`);
    } else if (req.originalUrl?.includes('/sites') || req.originalUrl?.includes('/analytics')) {
      console.log(`  ⚠️  No auth header for protected route!`);
    }
    
    // Log response status when finished
    res.on('finish', () => {
      const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
      console.log(`[${timestamp}] ${statusEmoji} ${req.method} ${req.originalUrl} - ${res.statusCode}`);
    });
    
    next();
  });

  app.use(cors({
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.text());

  const collectLimit = rateLimit({ windowMs: 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
  const apiLimit = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
  const nudgeLimit = rateLimit({ windowMs: 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });

  app.use('/auth', apiLimit, require('./routes/auth'));
  app.use('/sites', apiLimit, require('./routes/sites'));
  app.use('/analytics', apiLimit, require('./routes/analytics'));
  app.use('/', nudgeLimit, require('./routes/nudge'));
  app.use('/', collectLimit, require('./routes/collect'));

  app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now(), port: PORT }));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 TrackFlow backend running on http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`📡 Collect: http://localhost:${PORT}/collect\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});