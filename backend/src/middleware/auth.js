const jwt = require('jsonwebtoken');
const isProd = process.env.NODE_ENV === 'production';

module.exports = (req, res, next) => {
  let token = null;
  const auth = req.headers.authorization;

  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    if (!isProd) console.log(`[auth] ❌ No token: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (!isProd) console.log(`[auth] ❌ Invalid token: ${err.name}`);
    return res.status(401).json({ error: 'Invalid token' });
  }
};