import { createRequestHandler } from "@remix-run/node";

// Import the server build
const build = await import("./build/index.js");

const requestHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});

// Start the server
const port = process.env.PORT || 3000;

import { createServer } from "http";

const server = createServer(requestHandler);

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});