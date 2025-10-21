import { createRequestHandler } from "@remix-run/node";

export default createRequestHandler({
  build: () => import("./build/index.js"),
  mode: process.env.NODE_ENV,
});