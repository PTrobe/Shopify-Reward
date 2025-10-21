import { createServer } from "http";

const port = process.env.PORT || 3000;

console.log(`🚀 Starting debug server on port ${port}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`🔗 App URL: ${process.env.SHOPIFY_APP_URL}`);

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  console.log(`📥 ${req.method} ${url.pathname}`);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (url.pathname === '/health') {
    console.log(`🏥 Health check request from ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
    res.statusCode = 200;
    const healthResponse = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      port: port,
      url: process.env.SHOPIFY_APP_URL,
      build_check: "debug_mode"
    };
    res.end(JSON.stringify(healthResponse));
    console.log(`✅ Health check response sent:`, healthResponse);
    return;
  }

  if (url.pathname === '/') {
    res.statusCode = 200;
    res.end(JSON.stringify({
      message: "Loyco Rewards App - Debug Mode",
      status: "ok",
      environment: process.env.NODE_ENV,
      shopify_api_key: process.env.SHOPIFY_API_KEY ? "configured" : "missing",
      database_url: process.env.DATABASE_URL ? "configured" : "missing",
      redis_url: process.env.REDIS_URL ? "configured" : "missing"
    }));
    return;
  }

  // Default 404
  res.statusCode = 404;
  res.end(JSON.stringify({
    error: "Not found",
    path: url.pathname,
    method: req.method
  }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`✅ Debug server is running on port ${port}`);
  console.log(`🔍 Test health: http://localhost:${port}/health`);
  console.log(`🌐 Production URL: https://shopify-reward-production.up.railway.app/health`);
});

// Handle errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  server.close();
  process.exit(0);
});