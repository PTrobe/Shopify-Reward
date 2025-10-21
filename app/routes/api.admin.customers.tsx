import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { CustomerService } from "../services/CustomerService";
import { LoyaltyService } from "../services/LoyaltyService";
import { prisma } from "../lib/prisma.server";

const customerService = new CustomerService();
const loyaltyService = new LoyaltyService();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
  });

  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const search = url.searchParams.get("search") || undefined;
  const tierId = url.searchParams.get("tierId") || undefined;
  const orderBy = url.searchParams.get("orderBy") as any || "enrolledAt";
  const orderDirection = url.searchParams.get("orderDirection") as any || "desc";

  try {
    const result = await customerService.getCustomers({
      shopId: shop.id,
      page,
      limit,
      search,
      tierId,
      orderBy,
      orderDirection,
    });

    return json(result);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return json({ error: "Failed to fetch customers" }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
  });

  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const action = formData.get("action");
  const customerId = formData.get("customerId") as string;

  try {
    switch (action) {
      case "adjustPoints": {
        const points = parseInt(formData.get("points") as string);
        const reason = formData.get("reason") as string;

        if (!points || !reason) {
          return json({ error: "Points and reason are required" }, { status: 400 });
        }

        const transaction = await loyaltyService.adjustPoints(
          customerId,
          points,
          reason,
          session.id // admin ID
        );

        return json({ success: true, transaction });
      }

      case "updateCustomer": {
        const firstName = formData.get("firstName") as string || undefined;
        const lastName = formData.get("lastName") as string || undefined;
        const email = formData.get("email") as string || undefined;
        const phone = formData.get("phone") as string || undefined;

        const updatedCustomer = await customerService.updateCustomer(customerId, {
          firstName,
          lastName,
          email,
          phone,
        });

        return json({ success: true, customer: updatedCustomer });
      }

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error(`Error performing action ${action}:`, error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
};