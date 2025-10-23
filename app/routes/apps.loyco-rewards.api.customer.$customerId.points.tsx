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

    // Mock customer loyalty data (in real app, this would come from database)
    const mockCustomerData = {
      customerId: customerId,
      points: Math.floor(Math.random() * 1000) + 100, // Random points between 100-1100
      tier: "Bronze",
      nextTierPoints: 500,
      lifetimeEarned: Math.floor(Math.random() * 2000) + 500,
      availableRewards: [
        {
          id: "reward1",
          name: "$5 Off",
          pointsCost: 500,
          description: "$5 off your next purchase",
          available: true
        },
        {
          id: "reward2",
          name: "10% Off",
          pointsCost: 1000,
          description: "10% off your entire order",
          available: false
        },
        {
          id: "reward3",
          name: "Free Shipping",
          pointsCost: 750,
          description: "Free shipping on your next order",
          available: true
        }
      ]
    };

    // Simulate some logic based on customer ID
    if (customerId === "1") {
      mockCustomerData.points = 1250;
      mockCustomerData.tier = "Silver";
    } else if (customerId === "2") {
      mockCustomerData.points = 2500;
      mockCustomerData.tier = "Gold";
    }

    return json(mockCustomerData, { headers });

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