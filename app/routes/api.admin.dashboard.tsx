import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { CustomerService } from "../services/CustomerService";
import { prisma } from "../lib/prisma.server";

const customerService = new CustomerService();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
    include: {
      loyaltyProgram: {
        include: {
          tiers: true,
          rewards: true,
        }
      }
    },
  });

  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  try {
    // Get analytics data in parallel
    const [
      customerAnalytics,
      recentTransactions,
      topRewards,
      programStats
    ] = await Promise.all([
      // Customer analytics
      customerService.getCustomerAnalytics(shop.id),

      // Recent transactions
      prisma.transaction.findMany({
        where: { shopId: shop.id },
        include: {
          customer: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Top rewards by redemptions
      prisma.reward.findMany({
        where: {
          programId: shop.loyaltyProgram?.id,
          active: true
        },
        orderBy: { totalRedemptions: 'desc' },
        take: 5,
      }),

      // Program statistics
      shop.loyaltyProgram ? Promise.all([
        // Total points issued
        prisma.transaction.aggregate({
          where: {
            shopId: shop.id,
            type: { in: ["EARNED", "BONUS"] }
          },
          _sum: { points: true }
        }),

        // Total points redeemed
        prisma.transaction.aggregate({
          where: {
            shopId: shop.id,
            type: "REDEEMED"
          },
          _sum: { points: true }
        }),

        // Total redemptions
        prisma.redemption.count({
          where: {
            customer: { shopId: shop.id }
          }
        }),

        // Active program stats
        prisma.customer.aggregate({
          where: { shopId: shop.id },
          _sum: {
            pointsBalance: true,
            lifetimePoints: true,
            lifetimeSpent: true
          }
        })
      ]) : [null, null, null, null]
    ]);

    const [totalPointsIssued, totalPointsRedeemed, totalRedemptions, customerTotals] = programStats;

    const dashboardData = {
      shop: {
        domain: shop.shopifyDomain,
        plan: shop.billingPlan,
        status: shop.billingStatus,
      },
      loyaltyProgram: shop.loyaltyProgram,
      analytics: {
        customers: customerAnalytics,
        program: {
          totalPointsIssued: totalPointsIssued?._sum.points || 0,
          totalPointsRedeemed: Math.abs(totalPointsRedeemed?._sum.points || 0),
          totalRedemptions: totalRedemptions || 0,
          totalPointsBalance: customerTotals?._sum.pointsBalance || 0,
          totalLifetimePoints: customerTotals?._sum.lifetimePoints || 0,
          totalLifetimeSpent: customerTotals?._sum.lifetimeSpent || 0,
        }
      },
      recentActivity: {
        transactions: recentTransactions,
        topRewards,
      }
    };

    return json(dashboardData);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
};