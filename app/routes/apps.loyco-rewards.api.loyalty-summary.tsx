import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { LoyaltyService } from "../services/LoyaltyService";
import { prisma } from "../lib/prisma.server";
import { cache, CacheKeys, CacheTTL } from "../lib/cache.server";

const loyaltyService = new LoyaltyService();

/**
 * App Proxy endpoint for Customer Account UI Extension
 * Returns loyalty summary data for the logged-in customer
 * 
 * Expected to be called from Customer Account UI extensions with:
 * - shop parameter (from Shopify)
 * - logged_in_customer_id parameter (from Shopify Customer Account)
 * - signature and timestamp for HMAC validation
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const customerId = url.searchParams.get("logged_in_customer_id");
    const signature = url.searchParams.get("signature");
    const timestamp = url.searchParams.get("timestamp");

    if (!shop || !signature || !timestamp) {
      return json({ error: "Invalid app proxy request - missing required parameters" }, { 
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        }
      });
    }

    if (!customerId) {
      return json({ error: "Customer not logged in" }, { 
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        }
      });
    }


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
        error: "Loyalty program not found or inactive",
        enrolled: false,
      }, {
        headers: {
          "Access-Control-Allow-Origin": `https://${shop}`,
          "Cache-Control": "no-store",
        }
      });
    }

    const cacheKey = CacheKeys.customerStatus(customerId);
    const loyaltySummary = await cache.cached(
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
              take: 10
            },
            redemptions: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              include: {
                reward: true
              }
            }
          }
        });

        if (!customer) {
          return {
            enrolled: false,
            customerId: customerId,
            pointsBalance: 0,
            tier: null,
            benefits: [],
            recentActivity: [],
          };
        }

        const status = await loyaltyService.getCustomerStatus(customer.id);
        const program = shopRecord.loyaltyProgram;

        if (!program) {
          return {
            enrolled: false,
            customerId: customerId,
            pointsBalance: 0,
            tier: null,
            benefits: [],
            recentActivity: [],
          };
        }

        const currentTier = status.currentTier;
        const nextTier = status.nextTier;
        let tierProgress = 100;
        let pointsToNextTier = 0;

        if (nextTier && currentTier) {
          const pointsInCurrentTier = customer.pointsBalance - currentTier.requiredPoints;
          const pointsNeededForNextTier = nextTier.requiredPoints - currentTier.requiredPoints;
          tierProgress = Math.min(100, Math.round((pointsInCurrentTier / pointsNeededForNextTier) * 100));
          pointsToNextTier = nextTier.requiredPoints - customer.pointsBalance;
        }

        const benefits = program.rewards.map(reward => ({
          id: reward.id,
          title: reward.name,
          description: reward.description,
          minPoints: reward.pointsCost,
          eligible: customer.pointsBalance >= reward.pointsCost,
          type: reward.type,
          value: reward.discountValue,
          expiresAt: reward.expiresAt?.toISOString() || null,
        }));

        const earnTransactions = customer.transactions.map(tx => ({
          type: 'earned' as const,
          points: tx.pointsEarned,
          description: tx.description || `Order #${tx.orderId?.slice(-4) || 'N/A'}`,
          createdAt: tx.createdAt.toISOString(),
        }));

        const redeemTransactions = customer.redemptions.map(redemption => ({
          type: 'redeemed' as const,
          points: -redemption.pointsSpent,
          description: redemption.reward?.name || 'Reward redeemed',
          createdAt: redemption.createdAt.toISOString(),
        }));

        const recentActivity = [...earnTransactions, ...redeemTransactions]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);

        return {
          enrolled: true,
          customerId: customer.shopifyCustomerId,
          pointsBalance: customer.pointsBalance,
          lifetimePoints: customer.lifetimePoints,
          tier: currentTier ? {
            name: currentTier.name,
            icon: currentTier.icon || '⭐',
            level: currentTier.level,
            color: currentTier.color,
            progressPercent: tierProgress,
            nextTier: nextTier?.name || null,
            pointsToNext: pointsToNextTier,
          } : null,
          benefits,
          recentActivity,
        };
      },
      CacheTTL.CUSTOMER_STATUS
    );

    return json(loyaltySummary, {
      headers: {
        "Access-Control-Allow-Origin": `https://${shop}`,
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "private, max-age=30", // 30 seconds cache
      }
    });

  } catch (error) {
    console.error("Error fetching loyalty summary:", error);
    return json({
      error: "Failed to fetch loyalty summary",
      enrolled: false,
    }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      }
    });
  }
};

export const OPTIONS = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": shop ? `https://${shop}` : "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    }
  });
};
