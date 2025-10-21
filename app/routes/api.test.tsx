import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "../lib/prisma.server";
import { LoyaltyService } from "../services/LoyaltyService";
import { CustomerService } from "../services/CustomerService";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    switch (action) {
      case "db-connection":
        // Test database connection
        const shopCount = await prisma.shop.count();
        return json({
          success: true,
          message: "Database connected successfully",
          shopCount
        });

      case "create-test-data":
        // Create minimal test data
        const testShop = await prisma.shop.upsert({
          where: { shopifyDomain: "test-shop.myshopify.com" },
          update: {},
          create: {
            shopifyDomain: "test-shop.myshopify.com",
            accessToken: "test-token",
            email: "test@example.com",
            ownerName: "Test Owner",
          }
        });

        // Create loyalty program
        const loyaltyProgram = await prisma.loyaltyProgram.upsert({
          where: { shopId: testShop.id },
          update: {},
          create: {
            shopId: testShop.id,
            name: "Test Loyalty Program",
            active: true,
            pointsPerDollar: 1,
            welcomeBonus: 100,
          }
        });

        // Create test customer
        const customerService = new CustomerService();
        const testCustomer = await customerService.upsertCustomer({
          shopId: testShop.id,
          shopifyCustomerId: "12345",
          email: "customer@example.com",
          firstName: "Test",
          lastName: "Customer",
        });

        return json({
          success: true,
          message: "Test data created successfully",
          data: {
            shop: testShop,
            program: loyaltyProgram,
            customer: testCustomer,
          }
        });

      case "test-points":
        // Test point earning
        const loyaltyService = new LoyaltyService();

        // Find test customer
        const customer = await prisma.customer.findFirst({
          where: { email: "customer@example.com" }
        });

        if (!customer) {
          return json({ error: "Test customer not found. Run create-test-data first." }, { status: 404 });
        }

        // Award test points
        const transaction = await loyaltyService.earnPoints({
          shopId: customer.shopId,
          customerId: customer.id,
          points: 50,
          source: "TEST",
          description: "Test point award",
        });

        // Get updated customer status
        const status = await loyaltyService.getCustomerStatus(customer.id);

        return json({
          success: true,
          message: "Points awarded successfully",
          transaction,
          customerStatus: status,
        });

      case "health":
        return json({
          success: true,
          message: "API is healthy",
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        });

      default:
        return json({
          error: "Invalid action",
          availableActions: [
            "db-connection",
            "create-test-data",
            "test-points",
            "health"
          ]
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Test API error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
};