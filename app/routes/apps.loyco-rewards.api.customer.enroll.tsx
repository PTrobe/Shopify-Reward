import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { CustomerService } from "../services/CustomerService";
import { prisma } from "../lib/prisma.server";
import { validateRequestBody, enrollCustomerSchema } from "../lib/validation";
import { cache, CacheKeys } from "../lib/cache.server";

const customerService = new CustomerService();

export const action = async ({ request }: ActionFunctionArgs) => {
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
    const validatedData = validateRequestBody(enrollCustomerSchema, body);

    // Verify shop exists and is active
    const shopRecord = await prisma.shop.findUnique({
      where: { shopifyDomain: shop },
      include: {
        loyaltyProgram: {
          include: {
            tiers: {
              orderBy: { requiredPoints: 'asc' },
              take: 1 // Get the first tier (starter tier)
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

    // Check if customer is already enrolled
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        shopId: shopRecord.id,
        shopifyCustomerId: validatedData.shopifyCustomerId
      }
    });

    if (existingCustomer) {
      return json({
        success: false,
        error: "Customer is already enrolled in the loyalty program"
      }, { status: 409 });
    }

    // Enroll the customer
    const customer = await customerService.enrollCustomer({
      shopId: shopRecord.id,
      shopifyCustomerId: validatedData.shopifyCustomerId,
      email: validatedData.email,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      phone: validatedData.phone,
      birthday: validatedData.birthday,
      referralCode: validatedData.referralCode
    });

    // Award welcome bonus if configured
    let welcomeTransaction = null;
    if (shopRecord.loyaltyProgram.welcomeBonus > 0) {
      welcomeTransaction = await prisma.transaction.create({
        data: {
          shopId: customer.shopId,
          customerId: customer.id,
          points: shopRecord.loyaltyProgram.welcomeBonus,
          type: 'EARNED',
          source: 'WELCOME_BONUS',
          balanceBefore: 0,
          balanceAfter: shopRecord.loyaltyProgram.welcomeBonus,
          description: 'Welcome bonus for joining the loyalty program'
        }
      });

      // Update customer points balance
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          pointsBalance: shopRecord.loyaltyProgram.welcomeBonus,
          lifetimePoints: shopRecord.loyaltyProgram.welcomeBonus
        }
      });
    }

    // Clear any cached data for this customer
    const cacheKey = CacheKeys.customerStatus(validatedData.shopifyCustomerId);
    await cache.del(cacheKey);

    return json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        pointsBalance: customer.pointsBalance + (shopRecord.loyaltyProgram.welcomeBonus || 0),
        lifetimePoints: customer.lifetimePoints + (shopRecord.loyaltyProgram.welcomeBonus || 0),
        referralCode: customer.referralCode,
        enrolledAt: customer.enrolledAt
      },
      welcomeBonus: welcomeTransaction ? {
        points: welcomeTransaction.points,
        description: welcomeTransaction.description
      } : null,
      program: {
        name: shopRecord.loyaltyProgram.name,
        pointsName: shopRecord.loyaltyProgram.pointsName,
        currency: shopRecord.loyaltyProgram.currency
      }
    }, {
      headers: {
        "Access-Control-Allow-Origin": `https://${shop}`,
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });

  } catch (error) {
    console.error("Error enrolling customer:", error);
    return json({
      success: false,
      error: "Failed to enroll customer in loyalty program"
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