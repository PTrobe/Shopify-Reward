import { z } from "zod";

// Customer validation schemas
export const createCustomerSchema = z.object({
  shopId: z.string().cuid(),
  shopifyCustomerId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  birthday: z.string().datetime().optional(),
});

export const updateCustomerSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  birthday: z.string().datetime().optional(),
});

// Loyalty service validation schemas
export const earnPointsSchema = z.object({
  shopId: z.string().cuid(),
  customerId: z.string().cuid(),
  points: z.number().int().positive(),
  source: z.string().min(1),
  description: z.string().min(1),
  activityType: z.string().min(1),
  shopifyOrderId: z.string().optional(),
  shopifyOrderNumber: z.string().optional(),
  orderId: z.string().optional(),
  orderNumber: z.string().optional(),
  orderValue: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export const redeemPointsSchema = z.object({
  customerId: z.string().cuid(),
  points: z.number().int().positive(),
  description: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export const adjustPointsSchema = z.object({
  customerId: z.string().cuid(),
  points: z.number().int(),
  reason: z.string().min(1),
  adminId: z.string().optional(),
});

// API validation schemas
export const loyaltyStatusParamsSchema = z.object({
  customerId: z.string().min(1),
  shop: z.string().min(1),
});

export const redeemRewardSchema = z.object({
  customerId: z.string().min(1),
  rewardId: z.string().cuid(),
  shopDomain: z.string().min(1),
  quantity: z.number().int().positive().optional().default(1),
});

export const enrollCustomerSchema = z.object({
  shopifyCustomerId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  birthday: z.string().datetime().optional(),
  referralCode: z.string().optional(),
});

export const customerQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().optional(),
  tierId: z.string().cuid().optional(),
  orderBy: z.enum(['pointsBalance', 'lifetimePoints', 'enrolledAt', 'lastActivityAt']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

// Shop domain validation
export const shopDomainSchema = z.string().regex(
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.myshopify\.com$/,
  "Invalid Shopify domain format"
);

// Webhook validation schemas
export const webhookEventSchema = z.object({
  eventType: z.string(),
  eventId: z.string(),
  payload: z.record(z.any()),
  shopId: z.string(),
});

// Utility functions
export function validateRequestBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.issues.map(i => i.message).join(', ')}`);
  }
  return result.data;
}

export function validateQueryParams<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams): T {
  const data = Object.fromEntries(searchParams.entries());
  return validateRequestBody(schema, data);
}