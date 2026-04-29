const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const path = req.originalUrl || req.url;
  
  console.log(`[${timestamp}] 🔐 Auth check for ${req.method} ${path}`);
  
  // Check Authorization header first, then fall back to query parameter (for SSE)
  let auth = req.headers.authorization;
  let token = null;
  
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
    console.log(`  🔑 Auth header present: Bearer ${token.substring(0, 15)}...`);
  } else if (req.query.token) {
    token = req.query.token;
    console.log(`  🔑 Token from query parameter: ${token.substring(0, 15)}...`);
  }
  
  if (!token) {
    console.log(`  ❌ No Authorization header or token query parameter provided`);
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }
  
  console.log(`  📝 Token received: ${token.substring(0, 15)}...${token.substring(token.length - 10)}`);
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`  ✅ Token valid - User ID: ${payload.userId || payload.id || 'unknown'}`);
    req.user = payload;
    next();
  } catch (err) {
    console.log(`  ❌ Token verification failed: ${err.name} - ${err.message}`);
    return res.status(401).json({ error: `Invalid token - ${err.name}` });
  }
};
