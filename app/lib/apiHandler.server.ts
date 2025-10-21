import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { rateLimiters, withRateLimit } from "./rateLimit.server";
import { formatErrorResponse, LoyaltyAppError } from "./errors";
import { prisma } from "./prisma.server";

export interface ApiHandlerConfig {
  requireAuth?: boolean;
  rateLimit?: 'public' | 'admin' | 'webhooks' | 'redemption';
  rateLimitIdentifier?: (request: Request, session?: any) => string;
}

// Generic API handler wrapper
export function createApiHandler<T = any>(
  handler: (request: Request, session?: any, shop?: any) => Promise<T>,
  config: ApiHandlerConfig = {}
) {
  return async (args: LoaderFunctionArgs | ActionFunctionArgs) => {
    const { request } = args;

    try {
      let session = null;
      let shop = null;

      // Authentication
      if (config.requireAuth) {
        const authResult = await authenticate.admin(request);
        session = authResult.session;

        // Get shop data
        shop = await prisma.shop.findUnique({
          where: { shopifyDomain: session.shop },
          include: {
            loyaltyProgram: {
              include: {
                tiers: {
                  orderBy: { level: 'asc' }
                },
                rewards: {
                  where: { active: true }
                }
              }
            }
          }
        });

        if (!shop) {
          throw new LoyaltyAppError("Shop not found", 404, "SHOP_NOT_FOUND");
        }
      }

      // Rate limiting
      if (config.rateLimit) {
        const rateLimiter = rateLimiters[config.rateLimit];
        const identifier = config.rateLimitIdentifier
          ? config.rateLimitIdentifier(request, session)
          : session?.shop || 'anonymous';

        await rateLimiter.checkLimit(identifier);
      }

      // Execute handler
      const result = await handler(request, session, shop);

      return json({
        success: true,
        data: result,
      });

    } catch (error) {
      const errorResponse = formatErrorResponse(error as Error);
      return json(errorResponse, { status: errorResponse.statusCode });
    }
  };
}

// Specialized handlers for common patterns
export const createAdminHandler = <T = any>(
  handler: (request: Request, session: any, shop: any) => Promise<T>
) => createApiHandler(handler, {
  requireAuth: true,
  rateLimit: 'admin',
  rateLimitIdentifier: (request, session) => session.shop,
});

export const createPublicHandler = <T = any>(
  handler: (request: Request) => Promise<T>,
  rateLimitIdentifier?: (request: Request) => string
) => createApiHandler(
  (request) => handler(request),
  {
    requireAuth: false,
    rateLimit: 'public',
    rateLimitIdentifier: rateLimitIdentifier || ((request) => {
      const url = new URL(request.url);
      return url.searchParams.get('shop') || 'anonymous';
    }),
  }
);

export const createWebhookHandler = <T = any>(
  handler: (request: Request, session: any) => Promise<T>
) => createApiHandler(
  async (request) => {
    // Webhook authentication is handled differently
    const { topic, shop, session, payload } = await authenticate.webhook(request);
    return handler(request, { topic, shop, session, payload });
  },
  {
    requireAuth: false,
    rateLimit: 'webhooks',
    rateLimitIdentifier: (request) => {
      // Extract shop from webhook headers or payload
      const shopHeader = request.headers.get('x-shopify-shop-domain');
      return shopHeader || 'webhook';
    },
  }
);

// Utility functions for common operations
export async function requireShopAccess(shopId: string, session: any): Promise<void> {
  const shop = await prisma.shop.findUnique({
    where: {
      id: shopId,
      shopifyDomain: session.shop
    }
  });

  if (!shop) {
    throw new LoyaltyAppError("Access denied to shop", 403, "SHOP_ACCESS_DENIED");
  }
}

export async function requireCustomerAccess(customerId: string, shopId: string): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId,
      shopId
    }
  });

  if (!customer) {
    throw new LoyaltyAppError("Customer not found or access denied", 404, "CUSTOMER_ACCESS_DENIED");
  }
}

// Response formatters
export function successResponse<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  }
) {
  return {
    success: true,
    data,
    pagination
  };
}