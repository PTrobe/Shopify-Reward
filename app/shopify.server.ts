import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";
import { prisma } from "./lib/prisma.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January24,
  scopes: process.env.SHOPIFY_SCOPES?.split(",") || [
    "read_products",
    "write_products",
    "read_customers",
    "write_customers",
    "read_orders",
    "write_orders"
  ],
  appUrl: process.env.SHOPIFY_APP_URL || "",
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