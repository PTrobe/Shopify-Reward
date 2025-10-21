import { createRequestHandler } from "@remix-run/node";
import { createServer } from "http";

// Import the server build with error handling
let build;
try {
  build = await import("./build/index.js");
  console.log("Build loaded successfully");
} catch (error) {
  console.error("Failed to load build:", error);
  process.exit(1);
}

// Validate build manifest
if (!build?.assets || !build?.routes) {
  console.error("Invalid build manifest - missing assets or routes");
  process.exit(1);
}

console.log("Build manifest validated successfully");

const requestHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});

// Start the server
const port = process.env.PORT || 3000;
console.log(`Starting server on port ${port}`);

const server = createServer(requestHandler);

server.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server is running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 App URL: ${process.env.SHOPIFY_APP_URL}`);
});