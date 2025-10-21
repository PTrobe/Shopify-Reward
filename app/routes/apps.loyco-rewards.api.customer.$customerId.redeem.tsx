import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { LoyaltyService } from "../services/LoyaltyService";
import { prisma } from "../lib/prisma.server";
import { validateRequestBody, redeemRewardSchema } from "../lib/validation";
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
    const validatedData = validateRequestBody(redeemRewardSchema, body);

    // Verify shop exists and is active
    const shopRecord = await prisma.shop.findUnique({
      where: { shopifyDomain: shop },
      include: {
        loyaltyProgram: {
          include: {
            rewards: {
              where: {
                id: validatedData.rewardId,
                active: true
              }
            }
          }
        }
      }
    });

    if (!shopRecord || !shopRecord.loyaltyProgram?.active) {
      return json({
        success: false,
        error: "Loyalty program not found or inactive"
      }, { status: 404 });
    }

    const reward = shopRecord.loyaltyProgram.rewards[0];
    if (!reward) {
      return json({
        success: false,
        error: "Reward not found or inactive"
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

    // Check if customer has enough points
    if (customer.pointsBalance < reward.pointsCost) {
      return json({
        success: false,
        error: "Insufficient points for this reward",
        pointsNeeded: reward.pointsCost - customer.pointsBalance
      }, { status: 400 });
    }

    // Process redemption
    const redemption = await loyaltyService.redeemReward({
      customerId: customer.id,
      rewardId: reward.id,
      quantity: validatedData.quantity || 1
    });

    // Clear customer status cache
    const cacheKey = CacheKeys.customerStatus(customerId);
    await cache.del(cacheKey);

    return json({
      success: true,
      redemption: {
        id: redemption.id,
        rewardName: reward.name,
        pointsUsed: redemption.pointsUsed,
        status: redemption.status,
        redeemedAt: redemption.createdAt,
        code: redemption.discountCode
      },
      newPointsBalance: customer.pointsBalance - redemption.pointsUsed
    }, {
      headers: {
        "Access-Control-Allow-Origin": `https://${shop}`,
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });

  } catch (error) {
    console.error("Error processing reward redemption:", error);
    return json({
      success: false,
      error: "Failed to process reward redemption"
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