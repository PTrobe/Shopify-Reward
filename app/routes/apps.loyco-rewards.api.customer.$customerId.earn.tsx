import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { LoyaltyService } from "../services/LoyaltyService";
import { prisma } from "../lib/prisma.server";
import { validateRequestBody, earnPointsSchema } from "../lib/validation";
import { cache, CacheKeys } from "../lib/cache.server";

const loyaltyService = new LoyaltyService();

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { customerId } = params;

  if (!customerId) {
    return json({ error: "Customer ID is required" }, { status: 400 });
  }

  try {
    // Verify this is a valid Shopify App Proxy request
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const signature = url.searchParams.get("signature");
    const timestamp = url.searchParams.get("timestamp");

    if (!shop || !signature || !timestamp) {
      return json({ error: "Invalid app proxy request" }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const validatedData = validateRequestBody(earnPointsSchema, body);

    // Verify shop exists and is active
    const shopRecord = await prisma.shop.findUnique({
      where: { shopifyDomain: shop },
      include: {
        loyaltyProgram: true
      }
    });

    if (!shopRecord || !shopRecord.loyaltyProgram?.active) {
      return json({
        success: false,
        error: "Loyalty program not found or inactive"
      }, { status: 404 });
    }

    // Get customer by Shopify customer ID
    const customer = await prisma.customer.findFirst({
      where: {
        shopId: shopRecord.id,
        shopifyCustomerId: customerId
      }
    });

    if (!customer) {
      return json({
        success: false,
        error: "Customer not enrolled in loyalty program"
      }, { status: 404 });
    }

    // Process points earning
    const transaction = await loyaltyService.earnPoints({
      shopId: shopRecord.id,
      customerId: customer.id,
      points: validatedData.points,
      source: validatedData.activityType,
      description: validatedData.description,
      shopifyOrderId: validatedData.orderId,
      shopifyOrderNumber: validatedData.orderNumber,
      metadata: {
        orderValue: validatedData.orderValue
      }
    });

    // Get updated customer status
    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: {
        currentTier: true
      }
    });

    // Clear customer status cache
    const cacheKey = CacheKeys.customerStatus(customerId);
    await cache.del(cacheKey);

    // Check for tier upgrade
    const tierUpgrade = updatedCustomer?.currentTierId !== customer.currentTierId;

    return json({
      success: true,
      transaction: {
        id: transaction.id,
        points: transaction.points,
        source: transaction.source,
        description: transaction.description,
        createdAt: transaction.createdAt
      },
      customer: {
        pointsBalance: updatedCustomer?.pointsBalance || 0,
        lifetimePoints: updatedCustomer?.lifetimePoints || 0,
        currentTier: updatedCustomer?.currentTier ? {
          name: updatedCustomer.currentTier.name,
          level: updatedCustomer.currentTier.level,
          color: updatedCustomer.currentTier.color
        } : null
      },
      tierUpgrade: tierUpgrade ? {
        newTier: updatedCustomer?.currentTier ? {
          name: updatedCustomer.currentTier.name,
          level: updatedCustomer.currentTier.level,
          color: updatedCustomer.currentTier.color
        } : null
      } : null
    }, {
      headers: {
        "Access-Control-Allow-Origin": `https://${shop}`,
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });

  } catch (error) {
    console.error("Error processing points earning:", error);
    return json({
      success: false,
      error: "Failed to process points earning"
    }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
};

// Handle preflight OPTIONS requests for CORS
export const loader = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": shop ? `https://${shop}` : "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
};