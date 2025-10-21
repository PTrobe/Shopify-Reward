import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Basic health check that doesn't require database
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    url: process.env.SHOPIFY_APP_URL || "not-configured",
  };

  return json(health, {
    headers: {
      "Cache-Control": "no-cache",
    },
  });
};