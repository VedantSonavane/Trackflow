// logger.js — structured JSON request logging, prod-safe.
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const siteId = req.params?.siteId || req.params?.id || null;
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      method: req.method,
      route: req.originalUrl,
      siteId,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    }));
  });
  next();
}

module.exports = { requestLogger };
