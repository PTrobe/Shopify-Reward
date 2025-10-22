import {
  createReadableStreamFromReadable,
  createRequestHandler,
  installGlobals,
  writeReadableStreamToWritable,
} from "@remix-run/node";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";

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

// Remix's Node adapter expects the build manifest as the first argument.
// Passing an object here (like { build, mode }) causes the manifest lookup to fail
// at runtime, resulting in a 502 due to an unhandled TypeError. We explicitly
// pass the build and mode as separate arguments to match the expected signature.
const handleRequest = createRequestHandler(build, process.env.NODE_ENV);

installGlobals();

// Start the server
const port = process.env.PORT || 3000;
console.log(`Starting server on port ${port}`);

const server = createServer(async (request, response) => {
  try {
    // Handle static files from build directory
    if (request.url?.startsWith('/build/')) {
      const filePath = join(process.cwd(), 'public', request.url);
      if (existsSync(filePath)) {
        const ext = extname(filePath);
        const mimeTypes = {
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.map': 'application/json',
          '.txt': 'text/plain',
        };

        response.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        response.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

        const fileContent = readFileSync(filePath);
        response.end(fileContent);
        return;
      } else {
        response.statusCode = 404;
        response.end('File not found');
        return;
      }
    }

    const remixRequest = createRemixRequest(request, port);
    const remixResponse = await handleRequest(remixRequest);
    await sendRemixResponse(response, remixResponse);
  } catch (error) {
    console.error("Error handling request:", error);
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "text/plain");
    }
    response.end("Internal Server Error");
  }
});

function createRemixRequest(nodeRequest, fallbackPort) {
  const controller = new AbortController();

  const protocolHeader = nodeRequest.headers["x-forwarded-proto"];
  const hostHeader = nodeRequest.headers["x-forwarded-host"] || nodeRequest.headers.host;

  const protocol = Array.isArray(protocolHeader)
    ? protocolHeader[0]
    : protocolHeader?.split(",")[0] || "http";

  const host = Array.isArray(hostHeader)
    ? hostHeader[0]
    : hostHeader || `localhost:${fallbackPort}`;

  const url = new URL(nodeRequest.url || "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeRequest.headers)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const init = {
    method: nodeRequest.method,
    headers,
    signal: controller.signal,
  };

  if (nodeRequest.method !== "GET" && nodeRequest.method !== "HEAD") {
    init.body = createReadableStreamFromReadable(nodeRequest);
    init.duplex = "half";
  }

  nodeRequest.on("close", () => controller.abort());

  return new Request(url.toString(), init);
}

async function sendRemixResponse(nodeResponse, remixResponse) {
  nodeResponse.statusMessage = remixResponse.statusText;
  nodeResponse.statusCode = remixResponse.status;

  for (const [key, value] of remixResponse.headers.entries()) {
    nodeResponse.setHeader(key, value);
  }

  if (remixResponse.headers.get("Content-Type")?.includes("text/event-stream")) {
    nodeResponse.flushHeaders?.();
  }

  if (!remixResponse.body) {
    nodeResponse.end();
    return;
  }

  await writeReadableStreamToWritable(remixResponse.body, nodeResponse);
}

server.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server is running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 App URL: ${process.env.SHOPIFY_APP_URL}`);
});
