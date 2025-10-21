import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { LoyaltyService } from "../services/LoyaltyService";
import { prisma } from "../lib/prisma.server";

const loyaltyService = new LoyaltyService();

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { customerId } = params;

  if (!customerId) {
    return json({ error: "Customer ID is required" }, { status: 400 });
  }

  // Get shop domain from headers or query params for security
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");

  if (!shopDomain) {
    return json({ error: "Shop domain is required" }, { status: 400 });
  }

  // Verify shop exists and is active
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopDomain },
    include: {
      loyaltyProgram: {
        include: {
          tiers: {
            orderBy: { requiredPoints: 'asc' }
          },
          rewards: {
            where: { active: true },
            orderBy: { displayOrder: 'asc' }
          }
        }
      }
    }
  });

  if (!shop || !shop.loyaltyProgram?.active) {
    return json({ error: "Loyalty program not found or inactive" }, { status: 404 });
  }

  try {
    // Get customer by Shopify customer ID
    const customer = await prisma.customer.findFirst({
      where: {
        shopId: shop.id,
        shopifyCustomerId: customerId
      },
      include: {
        currentTier: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!customer) {
      // Return empty state for non-enrolled customers
      return json({
        enrolled: false,
        program: {
          name: shop.loyaltyProgram.name,
          pointsName: shop.loyaltyProgram.pointsName,
          currency: shop.loyaltyProgram.currency,
          welcomeBonus: shop.loyaltyProgram.welcomeBonus,
        },
        availableRewards: shop.loyaltyProgram.rewards.slice(0, 3), // Show some rewards to entice enrollment
      });
    }

    // Get full customer status
    const customerStatus = await loyaltyService.getCustomerStatus(customer.id);

    // Filter rewards customer can afford
    const affordableRewards = shop.loyaltyProgram.rewards.filter(
      reward => reward.pointsCost <= customer.pointsBalance
    );

    const response = {
      enrolled: true,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        pointsBalance: customer.pointsBalance,
        lifetimePoints: customer.lifetimePoints,
        referralCode: customer.referralCode,
        enrolledAt: customer.enrolledAt,
      },
      tier: customerStatus.currentTier ? {
        id: customerStatus.currentTier.id,
        name: customerStatus.currentTier.name,
        level: customerStatus.currentTier.level,
        color: customerStatus.currentTier.color,
        icon: customerStatus.currentTier.icon,
        pointsMultiplier: customerStatus.currentTier.pointsMultiplier,
        perks: customerStatus.currentTier.perks,
      } : null,
      nextTier: customerStatus.nextTier ? {
        id: customerStatus.nextTier.id,
        name: customerStatus.nextTier.name,
        level: customerStatus.nextTier.level,
        requiredPoints: customerStatus.nextTier.requiredPoints,
        pointsNeeded: customerStatus.progressToNextTier,
      } : null,
      program: {
        name: shop.loyaltyProgram.name,
        pointsName: shop.loyaltyProgram.pointsName,
        currency: shop.loyaltyProgram.currency,
        primaryColor: shop.loyaltyProgram.primaryColor,
        secondaryColor: shop.loyaltyProgram.secondaryColor,
        logoUrl: shop.loyaltyProgram.logoUrl,
      },
      availableRewards: affordableRewards,
      allRewards: shop.loyaltyProgram.rewards,
      recentTransactions: customerStatus.recentTransactions,
    };

    return json(response);
  } catch (error) {
    console.error("Error fetching customer loyalty status:", error);
    return json({ error: "Failed to fetch loyalty status" }, { status: 500 });
  }
};