import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "../lib/prisma.server";
import { authenticate } from "../shopify.server";

/**
 * App Proxy endpoint for updating customer profile information
 * Called from Customer Account UI Extension to update customer metafields
 * 
 * Expected POST body:
 * {
 *   customerId: string (Shopify customer ID),
 *   birthDate?: string (ISO date format),
 *   phone?: string,
 *   marketingOptIn?: boolean
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
    const { birthDate, phone, marketingOptIn } = body;

    const shopRecord = await prisma.shop.findUnique({
      where: { shopifyDomain: shop },
    });

    if (!shopRecord) {
      return json({
        error: "Shop not found",
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

    const { admin } = await authenticate.public.appProxy(request);

    const metafields = [];

    if (birthDate) {
      metafields.push({
        namespace: "loyco",
        key: "birth_date",
        value: birthDate,
        type: "date"
      });
    }

    if (phone !== undefined) {
      metafields.push({
        namespace: "loyco",
        key: "phone",
        value: phone,
        type: "single_line_text_field"
      });
    }

    if (marketingOptIn !== undefined) {
      metafields.push({
        namespace: "loyco",
        key: "marketing_opt_in",
        value: marketingOptIn.toString(),
        type: "boolean"
      });
    }

    if (metafields.length > 0) {
      const mutation = `
        mutation customerUpdate($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer {
              id
              metafields(first: 10, namespace: "loyco") {
                edges {
                  node {
                    key
                    value
                    type
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

      const response = await admin.graphql(mutation, {
        variables: {
          input: {
            id: `gid://shopify/Customer/${customerId}`,
            metafields: metafields
          }
        }
      });

      const result = await response.json();

      if (result.data?.customerUpdate?.userErrors?.length > 0) {
        return json({
          error: "Failed to update customer profile",
          details: result.data.customerUpdate.userErrors
        }, {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": `https://${shop}`,
            "Cache-Control": "no-store",
          }
        });
      }

      const updatedMetafields = result.data?.customerUpdate?.customer?.metafields?.edges?.reduce(
        (acc: Record<string, string>, edge: any) => {
          acc[edge.node.key] = edge.node.value;
          return acc;
        },
        {}
      ) || {};

      return json({
        success: true,
        message: "Profile updated successfully",
        updatedFields: {
          birthDate: updatedMetafields.birth_date || null,
          phone: updatedMetafields.phone || null,
          marketingOptIn: updatedMetafields.marketing_opt_in === "true",
        }
      }, {
        headers: {
          "Access-Control-Allow-Origin": `https://${shop}`,
          "Cache-Control": "no-store",
        }
      });
    }

    return json({
      success: true,
      message: "No fields to update"
    }, {
      headers: {
        "Access-Control-Allow-Origin": `https://${shop}`,
        "Cache-Control": "no-store",
      }
    });

  } catch (error) {
    console.error("Error updating customer profile:", error);
    return json({
      error: "Failed to update profile",
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
