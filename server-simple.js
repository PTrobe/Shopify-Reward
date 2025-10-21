// Simple server for Railway deployment testing
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    port: port,
  });
});

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({
    message: "Loyco Rewards App is running",
    status: "ok",
    environment: process.env.NODE_ENV,
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Simple server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: /health`);
});