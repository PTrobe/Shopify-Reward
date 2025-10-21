import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "../lib/prisma.server";
import { cache, CacheKeys, CacheTTL } from "../lib/cache.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Verify this is a valid Shopify App Proxy request
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const signature = url.searchParams.get("signature");
    const timestamp = url.searchParams.get("timestamp");

    if (!shop || !signature || !timestamp) {
      return json({ error: "Invalid app proxy request" }, { status: 400 });
    }

    // Use cache for program info
    const cacheKey = CacheKeys.shopProgram(shop);
    const programInfo = await cache.cached(
      cacheKey,
      async () => {
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

        if (!shopRecord?.loyaltyProgram) {
          return {
            active: false,
            message: "Loyalty program not found"
          };
        }

        const program = shopRecord.loyaltyProgram;

        return {
          active: program.active,
          program: {
            name: program.name,
            pointsName: program.pointsName,
            currency: program.currency,
            pointsPerDollar: program.pointsPerDollar,
            welcomeBonus: program.welcomeBonus,
            referralBonus: program.referralBonus,
            birthdayBonus: program.birthdayBonus,
            tiersEnabled: program.tiersEnabled,
            referralsEnabled: program.referralsEnabled,
            primaryColor: program.primaryColor,
            secondaryColor: program.secondaryColor,
            logoUrl: program.logoUrl,
          },
          tiers: program.tiers.map(tier => ({
            id: tier.id,
            name: tier.name,
            level: tier.level,
            requiredPoints: tier.requiredPoints,
            pointsMultiplier: tier.pointsMultiplier,
            perks: tier.perks,
            color: tier.color,
            icon: tier.icon,
          })),
          rewards: program.rewards.map(reward => ({
            id: reward.id,
            name: reward.name,
            description: reward.description,
            pointsCost: reward.pointsCost,
            rewardType: reward.rewardType,
            imageUrl: reward.imageUrl,
            minimumPurchase: reward.minimumPurchase,
          })),
        };
      },
      CacheTTL.SHOP_PROGRAM
    );

    return json(programInfo, {
      headers: {
        "Access-Control-Allow-Origin": `https://${shop}`,
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=3600", // 1 hour
      }
    });

  } catch (error) {
    console.error("Error fetching program info:", error);
    return json({
      active: false,
      error: "Failed to fetch program info"
    }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
};