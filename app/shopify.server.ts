import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prisma } from "./lib/prisma.server";

// Environment validation and defaults
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || "development_key";
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "development_secret";
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL ||
  process.env.RAILWAY_STATIC_URL ||
  process.env.RAILWAY_PUBLIC_DOMAIN ||
  "https://localhost:3000";

// Ensure the URL has proper protocol
const normalizedAppUrl = SHOPIFY_APP_URL.startsWith('http') ?
  SHOPIFY_APP_URL :
  `https://${SHOPIFY_APP_URL}`;

console.log("Shopify App Configuration:");
console.log("- API Key:", SHOPIFY_API_KEY.substring(0, 8) + "...");
console.log("- App URL:", normalizedAppUrl);

const shopify = shopifyApp({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.January24,
  scopes: process.env.SHOPIFY_SCOPES?.split(",") || [
    "read_products",
    "write_products",
    "read_customers",
    "write_customers",
    "read_orders",
    "write_orders"
  ],
  appUrl: normalizedAppUrl,
  authPathPrefix: "/auth",
  sessionStorage: new MemorySessionStorage(),
  distribution: AppDistribution.AppStore,
  restResources,
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks",
    },
    ORDERS_CREATE: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks",
    },
    ORDERS_UPDATED: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks",
    },
    ORDERS_CANCELLED: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks",
    },
    CUSTOMERS_CREATE: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks",
    },
    CUSTOMERS_UPDATE: {
      deliveryMethod: "http",
      callbackUrl: "/webhooks",
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      // Create or update shop record after successful authentication
      await prisma.shop.upsert({
        where: { shopifyDomain: session.shop },
        update: {
          accessToken: session.accessToken || "",
          email: "", // Will be populated from Shop API
          ownerName: "", // Will be populated from Shop API
        },
        create: {
          shopifyDomain: session.shop,
          accessToken: session.accessToken || "",
          email: "",
          ownerName: "",
        },
      });
    },
  },
});

export default shopify;
export const apiVersion = ApiVersion.January24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;