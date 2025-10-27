import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    const { customerId } = params;

    if (!customerId) {
      return json({ error: "Customer ID required" }, { status: 400 });
    }

    // Add CORS headers for cross-origin requests from storefront
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers });
    }

    // Calculate loyalty data based on customer ID (in real app, this would come from database)
    // Using customer ID as seed for consistent data per customer
    const customerIdNum = parseInt(customerId) || 1;
    const seed = customerIdNum * 37; // Simple seeding for consistent data

    // Calculate points based on customer ID (more realistic than random)
    const basePoints = (seed % 800) + 200; // Points between 200-1000
    const lifetimeEarned = basePoints + (seed % 1500) + 300; // Lifetime earned is higher

    // Determine tier based on lifetime earned points
    let tier = "Bronze";
    let nextTierPoints = 1000;
    if (lifetimeEarned >= 2500) {
      tier = "Gold";
      nextTierPoints = 5000;
    } else if (lifetimeEarned >= 1000) {
      tier = "Silver";
      nextTierPoints = 2500;
    }

    const customerData = {
      customerId: customerId,
      points: basePoints,
      tier: tier,
      nextTierPoints: nextTierPoints,
      lifetimeEarned: lifetimeEarned,
      availableRewards: [
        {
          id: "reward1",
          name: "$5 Off Next Purchase",
          pointsCost: 500,
          description: "$5 discount on your next order",
          available: basePoints >= 500
        },
        {
          id: "reward2",
          name: "10% Off Entire Order",
          pointsCost: 1000,
          description: "10% discount on your entire purchase",
          available: basePoints >= 1000
        },
        {
          id: "reward3",
          name: "Free Shipping",
          pointsCost: 750,
          description: "Free shipping on orders over $50",
          available: basePoints >= 750
        }
      ]
    };

    return json(customerData, { headers });

  } catch (error) {
    console.error("Error fetching customer points:", error);

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    };

    return json(
      {
        error: "Failed to fetch customer points",
        points: 0,
        tier: "Bronze",
        availableRewards: []
      },
      { status: 500, headers }
    );
  }
};