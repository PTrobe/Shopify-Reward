/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  server: "./server.js",
  serverModuleFormat: "esm",
  serverPlatform: "node",
  serverMinify: process.env.NODE_ENV === "production",
  serverDependenciesToBundle: [
    "@shopify/shopify-app-remix",
    "@shopify/polaris",
  ],
};