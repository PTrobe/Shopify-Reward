import { prisma } from "../lib/prisma.server";
import { LoyaltyService } from "./LoyaltyService";
import { CustomerService } from "./CustomerService";
import type { WebhookEvent } from "@prisma/client";

export class WebhookProcessor {
  private loyaltyService: LoyaltyService;
  private customerService: CustomerService;

  constructor() {
    this.loyaltyService = new LoyaltyService();
    this.customerService = new CustomerService();
  }

  /**
   * Process pending webhook events
   */
  async processPendingWebhooks() {
    const pendingEvents = await prisma.webhookEvent.findMany({
      where: { processed: false },
      orderBy: { createdAt: 'asc' },
      take: 50, // Process in batches
    });

    console.log(`Processing ${pendingEvents.length} pending webhook events`);

    for (const event of pendingEvents) {
      await this.processWebhookEvent(event);
    }
  }

  /**
   * Process a single webhook event
   */
  async processWebhookEvent(event: WebhookEvent) {
    try {
      console.log(`Processing ${event.eventType} for shop ${event.shopId}`);

      switch (event.eventType) {
        case "ORDERS_CREATE":
          await this.processOrderCreated(event);
          break;
        case "ORDERS_UPDATED":
          await this.processOrderUpdated(event);
          break;
        case "ORDERS_CANCELLED":
          await this.processOrderCancelled(event);
          break;
        case "CUSTOMERS_CREATE":
          await this.processCustomerCreated(event);
          break;
        case "CUSTOMERS_UPDATE":
          await this.processCustomerUpdated(event);
          break;
        default:
          console.log(`Unhandled webhook type: ${event.eventType}`);
      }

      // Mark as processed
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processedAt: new Date(),
          processingError: null,
        },
      });

      console.log(`Successfully processed webhook ${event.id}`);
    } catch (error) {
      console.error(`Error processing webhook ${event.id}:`, error);

      // Update error information
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processingError: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Process order created webhook
   */
  private async processOrderCreated(event: WebhookEvent) {
    const orderData = event.payload as any;

    // Skip if order is not paid
    if (!orderData.financial_status || orderData.financial_status !== 'paid') {
      console.log(`Skipping unpaid order ${orderData.id}`);
      return;
    }

    // Skip if no customer
    if (!orderData.customer?.id) {
      console.log(`Skipping order ${orderData.id} - no customer`);
      return;
    }

    const shop = await prisma.shop.findUnique({
      where: { shopifyDomain: event.shopId },
      include: { loyaltyProgram: true },
    });

    if (!shop?.loyaltyProgram?.active) {
      console.log(`Skipping order ${orderData.id} - loyalty program not active`);
      return;
    }

    // Find or create customer
    let customer = await this.customerService.findByShopifyId(
      shop.id,
      orderData.customer.id.toString()
    );

    if (!customer) {
      customer = await this.customerService.upsertCustomer({
        shopId: shop.id,
        shopifyCustomerId: orderData.customer.id.toString(),
        email: orderData.customer.email || '',
        firstName: orderData.customer.first_name,
        lastName: orderData.customer.last_name,
        phone: orderData.customer.phone,
      });
    }

    // Calculate points
    const orderTotal = parseFloat(orderData.total_price || '0');
    const tierMultiplier = customer.currentTier?.pointsMultiplier || 1.0;
    const points = this.loyaltyService.calculateOrderPoints(
      orderTotal,
      shop.loyaltyProgram,
      tierMultiplier
    );

    if (points > 0) {
      // Award points
      await this.loyaltyService.earnPoints({
        shopId: shop.id,
        customerId: customer.id,
        points,
        source: "ORDER",
        description: `Order #${orderData.order_number}`,
        shopifyOrderId: orderData.id.toString(),
        shopifyOrderNumber: orderData.order_number?.toString(),
        metadata: {
          orderTotal,
          tierMultiplier,
          orderId: orderData.id,
        },
      });

      // Update customer order count and lifetime spent
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalOrders: { increment: 1 },
          lifetimeSpent: { increment: orderTotal },
        },
      });

      console.log(`Awarded ${points} points to customer ${customer.email} for order ${orderData.order_number}`);
    }
  }

  /**
   * Process order updated webhook
   */
  private async processOrderUpdated(event: WebhookEvent) {
    const orderData = event.payload as any;

    // Handle refunds or order modifications
    if (orderData.cancelled_at) {
      await this.processOrderCancelled(event);
      return;
    }

    // If order was previously unpaid and now paid, process as new order
    if (orderData.financial_status === 'paid') {
      // Check if we already processed this order
      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          shopifyOrderId: orderData.id.toString(),
          type: "EARNED",
        },
      });

      if (!existingTransaction) {
        await this.processOrderCreated(event);
      }
    }
  }

  /**
   * Process order cancelled webhook
   */
  private async processOrderCancelled(event: WebhookEvent) {
    const orderData = event.payload as any;

    // Find the original transaction
    const originalTransaction = await prisma.transaction.findFirst({
      where: {
        shopifyOrderId: orderData.id.toString(),
        type: "EARNED",
      },
      include: { customer: true },
    });

    if (!originalTransaction) {
      console.log(`No transaction found for cancelled order ${orderData.id}`);
      return;
    }

    // Deduct the points that were awarded
    await this.loyaltyService.adjustPoints(
      originalTransaction.customerId,
      -originalTransaction.points,
      `Order #${orderData.order_number} cancelled`,
    );

    console.log(`Deducted ${originalTransaction.points} points from customer for cancelled order ${orderData.order_number}`);
  }

  /**
   * Process customer created webhook
   */
  private async processCustomerCreated(event: WebhookEvent) {
    const customerData = event.payload as any;

    const shop = await prisma.shop.findUnique({
      where: { shopifyDomain: event.shopId },
    });

    if (!shop) {
      console.log(`Shop not found: ${event.shopId}`);
      return;
    }

    // Create customer record
    await this.customerService.upsertCustomer({
      shopId: shop.id,
      shopifyCustomerId: customerData.id.toString(),
      email: customerData.email || '',
      firstName: customerData.first_name,
      lastName: customerData.last_name,
      phone: customerData.phone,
      birthday: customerData.birthday ? new Date(customerData.birthday) : undefined,
    });

    console.log(`Created customer record for ${customerData.email}`);
  }

  /**
   * Process customer updated webhook
   */
  private async processCustomerUpdated(event: WebhookEvent) {
    const customerData = event.payload as any;

    const shop = await prisma.shop.findUnique({
      where: { shopifyDomain: event.shopId },
    });

    if (!shop) {
      console.log(`Shop not found: ${event.shopId}`);
      return;
    }

    const customer = await this.customerService.findByShopifyId(
      shop.id,
      customerData.id.toString()
    );

    if (customer) {
      // Update customer record
      await this.customerService.updateCustomer(customer.id, {
        email: customerData.email,
        firstName: customerData.first_name,
        lastName: customerData.last_name,
        phone: customerData.phone,
        birthday: customerData.birthday ? new Date(customerData.birthday) : undefined,
      });

      console.log(`Updated customer record for ${customerData.email}`);
    }
  }

  /**
   * Retry failed webhook events
   */
  async retryFailedWebhooks(maxRetries: number = 3) {
    const failedEvents = await prisma.webhookEvent.findMany({
      where: {
        processed: false,
        processingError: { not: null },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Only retry events from last 24 hours
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    console.log(`Retrying ${failedEvents.length} failed webhook events`);

    for (const event of failedEvents) {
      // Simple retry logic - could be enhanced with exponential backoff
      const retryCount = (event.metadata as any)?.retryCount || 0;

      if (retryCount < maxRetries) {
        // Clear error and increment retry count
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            processingError: null,
            metadata: { ...event.metadata as any, retryCount: retryCount + 1 },
          },
        });

        await this.processWebhookEvent(event);
      } else {
        console.log(`Max retries exceeded for webhook ${event.id}`);
      }
    }
  }
}