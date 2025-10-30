import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "../lib/prisma.server";
import { authenticate } from "../shopify.server";
import { LoyaltyService } from "../services/LoyaltyService";

const loyaltyService = new LoyaltyService();

/**
 * App Proxy endpoint for redeeming benefits/rewards
 * Called from Customer Account UI Extension to redeem a benefit
 * 
 * Expected POST body:
 * {
 *   benefitId: string (reward ID),
 * }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
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

    const body = await request.json();
    const { benefitId } = body;

    if (!benefitId) {
      return json({ error: "Benefit ID is required" }, { 
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": `https://${shop}`,
          "Cache-Control": "no-store",
        }
      });
    }

    const shopRecord = await prisma.shop.findUnique({
      where: { shopifyDomain: shop },
      include: {
        loyaltyProgram: {
          include: {
            rewards: true
          }
        }
      }
    });

    if (!shopRecord || !shopRecord.loyaltyProgram?.active) {
      return json({
        error: "Loyalty program not found or inactive",
      }, {
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": `https://${shop}`,
          "Cache-Control": "no-store",
        }
      });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        shopId: shopRecord.id,
        shopifyCustomerId: customerId
      }
    });

    if (!customer) {
      return json({
        error: "Customer not found in loyalty program",
      }, {
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": `https://${shop}`,
          "Cache-Control": "no-store",
        }
      });
    }

    const reward = await prisma.reward.findUnique({
      where: { id: benefitId }
    });

    if (!reward || !reward.active) {
      return json({
        error: "Benefit not found or inactive",
      }, {
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": `https://${shop}`,
          "Cache-Control": "no-store",
        }
      });
    }

    // Check if customer has enough points
    if (customer.pointsBalance < reward.pointsCost) {
      return json({
        error: "Insufficient points",
        required: reward.pointsCost,
        available: customer.pointsBalance,
      }, {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": `https://${shop}`,
          "Cache-Control": "no-store",
        }
      });
    }

    const { admin } = await authenticate.public.appProxy(request);

    let discountCode = null;
    if (reward.type === 'discount' || reward.type === 'shipping') {
      const codePrefix = reward.type === 'shipping' ? 'FREESHIP' : 'LOYALTY';
      const uniqueCode = `${codePrefix}${Date.now()}`;
      
      const mutation = `
        mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
            codeDiscountNode {
              id
              codeDiscount {
                ... on DiscountCodeBasic {
                  codes(first: 1) {
                    edges {
                      node {
                        code
                      }
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const discountInput: any = {
        title: `${reward.name} - ${customer.email}`,
        code: uniqueCode,
        startsAt: new Date().toISOString(),
        endsAt: reward.expiresAt ? reward.expiresAt.toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        customerSelection: {
          customers: {
            add: [`gid://shopify/Customer/${customerId}`]
          }
        },
        usageLimit: 1,
      };

      if (reward.type === 'discount') {
        discountInput.customerGets = {
          value: {
            percentage: reward.discountValue / 100
          },
          items: {
            all: true
          }
        };
      } else if (reward.type === 'shipping') {
        discountInput.customerGets = {
          value: {
            percentage: 1.0
          },
          items: {
            all: true
          }
        };
        discountInput.appliesOncePerCustomer = true;
      }

      const response = await admin.graphql(mutation, {
        variables: {
          basicCodeDiscount: discountInput
        }
      });

      const result = await response.json();

      if (result.data?.discountCodeBasicCreate?.userErrors?.length > 0) {
        return json({
          error: "Failed to create discount code",
          details: result.data.discountCodeBasicCreate.userErrors
        }, {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": `https://${shop}`,
            "Cache-Control": "no-store",
          }
        });
      }

      discountCode = result.data?.discountCodeBasicCreate?.codeDiscountNode?.codeDiscount?.codes?.edges?.[0]?.node?.code || uniqueCode;
    }

    // Create redemption record
    const redemption = await prisma.redemption.create({
      data: {
        customerId: customer.id,
        rewardId: reward.id,
        pointsSpent: reward.pointsCost,
        status: 'completed',
        discountCode: discountCode,
        expiresAt: reward.expiresAt,
      }
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        pointsBalance: {
          decrement: reward.pointsCost
        }
      }
    });

    await prisma.transaction.create({
      data: {
        customerId: customer.id,
        type: 'redemption',
        pointsEarned: -reward.pointsCost,
        description: `Redeemed: ${reward.name}`,
      }
    });

    return json({
      success: true,
      message: "Benefit redeemed successfully",
      redemption: {
        id: redemption.id,
        discountCode: discountCode,
        pointsSpent: reward.pointsCost,
        expiresAt: redemption.expiresAt?.toISOString() || null,
      },
      newPointsBalance: customer.pointsBalance - reward.pointsCost,
    }, {
      headers: {
        "Access-Control-Allow-Origin": `https://${shop}`,
        "Cache-Control": "no-store",
      }
    });

  } catch (error) {
    console.error("Error redeeming benefit:", error);
    return json({
      error: "Failed to redeem benefit",
      details: error instanceof Error ? error.message : "Unknown error"
    }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      }
    });
  }
};

export const OPTIONS = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": shop ? `https://${shop}` : "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    }
  });
};
