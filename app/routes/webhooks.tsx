import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request
  );

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    switch (topic as string) {
      case "APP_UNINSTALLED":
        await handleAppUninstalled(shop, payload);
        break;
      case "ORDERS_CREATE":
        await handleOrderCreated(shop, payload);
        break;
      case "ORDERS_UPDATED":
        await handleOrderUpdated(shop, payload);
        break;
      case "ORDERS_CANCELLED":
        await handleOrderCancelled(shop, payload);
        break;
      case "CUSTOMERS_CREATE":
        await handleCustomerCreated(shop, payload);
        break;
      case "CUSTOMERS_UPDATE":
        await handleCustomerUpdated(shop, payload);
        break;
      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }
  } catch (error) {
    console.error(`Error processing ${topic} webhook:`, error);

    // Store failed webhook for retry
    await prisma.webhookEvent.create({
      data: {
        shopId: shop,
        eventType: topic,
        eventId: payload.id?.toString() || `${Date.now()}`,
        payload: payload as any,
        processed: false,
        processingError: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }

  return new Response("OK", { status: 200 });
};

async function handleAppUninstalled(shop: string, payload: any) {
  await prisma.shop.update({
    where: { shopifyDomain: shop },
    data: { uninstalledAt: new Date() },
  });
}

async function handleOrderCreated(shop: string, payload: any) {
  console.log(`Processing order created for ${shop}:`, payload.id);

  // Store webhook event for processing
  await prisma.webhookEvent.create({
    data: {
      shopId: shop,
      eventType: "ORDERS_CREATE",
      eventId: payload.id.toString(),
      payload: payload as any,
      processed: false,
    },
  });
}

async function handleOrderUpdated(shop: string, payload: any) {
  console.log(`Processing order updated for ${shop}:`, payload.id);

  await prisma.webhookEvent.create({
    data: {
      shopId: shop,
      eventType: "ORDERS_UPDATED",
      eventId: payload.id.toString(),
      payload: payload as any,
      processed: false,
    },
  });
}

async function handleOrderCancelled(shop: string, payload: any) {
  console.log(`Processing order cancelled for ${shop}:`, payload.id);

  await prisma.webhookEvent.create({
    data: {
      shopId: shop,
      eventType: "ORDERS_CANCELLED",
      eventId: payload.id.toString(),
      payload: payload as any,
      processed: false,
    },
  });
}

async function handleCustomerCreated(shop: string, payload: any) {
  console.log(`Processing customer created for ${shop}:`, payload.id);

  await prisma.webhookEvent.create({
    data: {
      shopId: shop,
      eventType: "CUSTOMERS_CREATE",
      eventId: payload.id.toString(),
      payload: payload as any,
      processed: false,
    },
  });
}

async function handleCustomerUpdated(shop: string, payload: any) {
  console.log(`Processing customer updated for ${shop}:`, payload.id);

  await prisma.webhookEvent.create({
    data: {
      shopId: shop,
      eventType: "CUSTOMERS_UPDATE",
      eventId: payload.id.toString(),
      payload: payload as any,
      processed: false,
    },
  });
}