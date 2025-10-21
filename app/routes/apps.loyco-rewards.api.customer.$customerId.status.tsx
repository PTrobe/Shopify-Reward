import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { LoyaltyService } from "../services/LoyaltyService";
import { prisma } from "../lib/prisma.server";
import { validateQueryParams, loyaltyStatusParamsSchema } from "../lib/validation";
import { cache, CacheKeys, CacheTTL } from "../lib/cache.server";

const loyaltyService = new LoyaltyService();

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
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

    // Verify shop exists and is active
    const shopRecord = await prisma.shop.findUnique({
      where: { shopifyDomain: shop },
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

    if (!shopRecord || !shopRecord.loyaltyProgram?.active) {
      return json({
        enrolled: false,
        program: null,
        error: "Loyalty program not found or inactive"
      });
    }

    // Use cache for customer status
    const cacheKey = CacheKeys.customerStatus(customerId);
    const customerStatus = await cache.cached(
      cacheKey,
      async () => {
        // Get customer by Shopify customer ID
        const customer = await prisma.customer.findFirst({
          where: {
            shopId: shopRecord.id,
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
          const program = shopRecord.loyaltyProgram;
          if (!program) {
            return {
              enrolled: false,
              program: null,
              error: "Loyalty program not found"
            };
          }

          return {
            enrolled: false,
            program: {
              name: program.name,
              pointsName: program.pointsName,
              currency: program.currency,
              welcomeBonus: program.welcomeBonus,
            },
            availableRewards: program.rewards.slice(0, 3),
          };
        }

        // Get full customer status
        const status = await loyaltyService.getCustomerStatus(customer.id);

        // Filter rewards customer can afford
        const program = shopRecord.loyaltyProgram;
        if (!program) {
          return {
            enrolled: false,
            program: null,
            error: "Loyalty program not found"
          };
        }

        const affordableRewards = program.rewards.filter(
          reward => reward.pointsCost <= customer.pointsBalance
        );

        return {
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
          tier: status.currentTier ? {
            id: status.currentTier.id,
            name: status.currentTier.name,
            level: status.currentTier.level,
            color: status.currentTier.color,
            icon: status.currentTier.icon,
            pointsMultiplier: status.currentTier.pointsMultiplier,
            perks: status.currentTier.perks,
          } : null,
          nextTier: status.nextTier ? {
            id: status.nextTier.id,
            name: status.nextTier.name,
            level: status.nextTier.level,
            requiredPoints: status.nextTier.requiredPoints,
            pointsNeeded: status.progressToNextTier,
          } : null,
          program: {
            name: program.name,
            pointsName: program.pointsName,
            currency: program.currency,
            primaryColor: program.primaryColor,
            secondaryColor: program.secondaryColor,
            logoUrl: program.logoUrl,
          },
          availableRewards: affordableRewards,
          allRewards: program.rewards,
          recentTransactions: status.recentTransactions,
        };
      },
      CacheTTL.CUSTOMER_STATUS
    );

    // Add CORS headers for theme integration
    return json(customerStatus, {
      headers: {
        "Access-Control-Allow-Origin": `https://${shop}`,
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=300", // 5 minutes
      }
    });

  } catch (error) {
    console.error("Error fetching customer loyalty status:", error);
    return json({
      enrolled: false,
      error: "Failed to fetch loyalty status"
    }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
};