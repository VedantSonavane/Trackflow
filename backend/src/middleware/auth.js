const jwt = require('jsonwebtoken');
const isProd = process.env.NODE_ENV === 'production';

// Strict header-only auth — use on all normal REST routes.
// Query-string tokens are never accepted here (prevents JWT leaking via
// access logs / referrer headers / browser history on non-SSE routes).
function auth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    if (!isProd) console.log(`[auth] ❌ No header token: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (!isProd) console.log(`[auth] ❌ Invalid token: ${err.name}`);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// SSE-only auth — EventSource cannot set Authorization headers, so these
// routes (/nudge-stream, /realtime/stream) accept ?token= as a narrow,
// explicit exception. Never use this on non-SSE routes.
function sseAuth(req, res, next) {
  const header = req.headers.authorization;
  let token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token && req.query.token) token = req.query.token;

  if (!token) {
    if (!isProd) console.log(`[sseAuth] ❌ No token: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (!isProd) console.log(`[sseAuth] ❌ Invalid token: ${err.name}`);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = auth;
module.exports.auth = auth;
module.exports.sseAuth = sseAuth;
