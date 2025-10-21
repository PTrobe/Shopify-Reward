import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { LoyaltyService } from "../services/LoyaltyService";
import { prisma } from "../lib/prisma.server";
import { nanoid } from "nanoid";

const loyaltyService = new LoyaltyService();

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { customerId, rewardId, shopDomain } = body;

  if (!customerId || !rewardId || !shopDomain) {
    return json({
      error: "Customer ID, reward ID, and shop domain are required"
    }, { status: 400 });
  }

  // Verify shop exists
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopDomain },
    include: {
      loyaltyProgram: {
        include: {
          rewards: true
        }
      }
    }
  });

  if (!shop || !shop.loyaltyProgram?.active) {
    return json({ error: "Shop or loyalty program not found" }, { status: 404 });
  }

  // Find reward
  const reward = shop.loyaltyProgram.rewards.find(r => r.id === rewardId);
  if (!reward || !reward.active) {
    return json({ error: "Reward not found or inactive" }, { status: 404 });
  }

  // Find customer
  const customer = await prisma.customer.findFirst({
    where: {
      shopId: shop.id,
      shopifyCustomerId: customerId
    }
  });

  if (!customer) {
    return json({ error: "Customer not found" }, { status: 404 });
  }

  // Check if customer has enough points
  if (customer.pointsBalance < reward.pointsCost) {
    return json({
      error: "Insufficient points",
      required: reward.pointsCost,
      available: customer.pointsBalance
    }, { status: 400 });
  }

  // Check reward usage limits
  if (reward.usageLimit) {
    if (reward.totalRedemptions >= reward.usageLimit) {
      return json({ error: "Reward usage limit reached" }, { status: 400 });
    }
  }

  if (reward.perCustomerLimit) {
    const customerRedemptions = await prisma.redemption.count({
      where: {
        customerId: customer.id,
        rewardId: reward.id
      }
    });

    if (customerRedemptions >= reward.perCustomerLimit) {
      return json({ error: "Per-customer usage limit reached" }, { status: 400 });
    }
  }

  // Check date restrictions
  const now = new Date();
  if (reward.startDate && now < reward.startDate) {
    return json({ error: "Reward not yet available" }, { status: 400 });
  }

  if (reward.endDate && now > reward.endDate) {
    return json({ error: "Reward has expired" }, { status: 400 });
  }

  try {
    // Process redemption in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct points
      const transaction = await loyaltyService.redeemPoints({
        customerId: customer.id,
        points: reward.pointsCost,
        description: `Redeemed: ${reward.name}`,
        metadata: {
          rewardId: reward.id,
          rewardName: reward.name,
          rewardType: reward.rewardType,
          rewardValue: reward.rewardValue,
        }
      });

      // Generate discount code or handle other reward types
      let discountCode = null;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      if (reward.rewardType === "FIXED_DISCOUNT" || reward.rewardType === "PERCENT_DISCOUNT") {
        // Generate unique discount code
        discountCode = `LOYALTY-${nanoid(8).toUpperCase()}`;
      }

      // Create redemption record
      const redemption = await tx.redemption.create({
        data: {
          customerId: customer.id,
          rewardId: reward.id,
          pointsUsed: reward.pointsCost,
          discountCode,
          status: "pending",
          expiresAt,
        },
        include: {
          reward: true
        }
      });

      // Update reward usage count
      await tx.reward.update({
        where: { id: reward.id },
        data: {
          totalRedemptions: { increment: 1 }
        }
      });

      return { transaction, redemption };
    });

    // Format response based on reward type
    let instructions = "";
    switch (reward.rewardType) {
      case "FIXED_DISCOUNT":
        instructions = `Use code ${result.redemption.discountCode} at checkout for $${(reward.rewardValue as any).amount} off`;
        break;
      case "PERCENT_DISCOUNT":
        instructions = `Use code ${result.redemption.discountCode} at checkout for ${(reward.rewardValue as any).percent}% off`;
        break;
      case "FREE_SHIPPING":
        instructions = `Use code ${result.redemption.discountCode} at checkout for free shipping`;
        break;
      case "FREE_PRODUCT":
        instructions = "Add the free product to your cart and use the discount code at checkout";
        break;
      default:
        instructions = "Your reward has been activated";
    }

    return json({
      success: true,
      redemption: {
        id: result.redemption.id,
        rewardName: reward.name,
        pointsUsed: reward.pointsCost,
        discountCode: result.redemption.discountCode,
        instructions,
        expiresAt: result.redemption.expiresAt,
        status: result.redemption.status,
      },
      newPointsBalance: customer.pointsBalance - reward.pointsCost,
    });

  } catch (error) {
    console.error("Error processing redemption:", error);
    return json({
      error: error instanceof Error ? error.message : "Failed to process redemption"
    }, { status: 500 });
  }
};