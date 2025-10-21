import { prisma } from "../lib/prisma.server";
import type {
  Customer,
  Transaction,
  LoyaltyProgram,
  TransactionType,
  Prisma
} from "@prisma/client";

export interface EarnPointsParams {
  shopId: string;
  customerId: string;
  points: number;
  source: string;
  description: string;
  shopifyOrderId?: string;
  shopifyOrderNumber?: string;
  metadata?: any;
}

export interface RedeemPointsParams {
  customerId: string;
  points: number;
  description: string;
  metadata?: any;
}

export class LoyaltyService {
  /**
   * Award points to a customer
   */
  async earnPoints(params: EarnPointsParams): Promise<Transaction> {
    const {
      shopId,
      customerId,
      points,
      source,
      description,
      shopifyOrderId,
      shopifyOrderNumber,
      metadata
    } = params;

    if (points <= 0) {
      throw new Error("Points must be positive");
    }

    // Use transaction to ensure consistency
    return await prisma.$transaction(async (tx) => {
      // Get customer with lock to prevent race conditions
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        include: { currentTier: true },
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      if (customer.shopId !== shopId) {
        throw new Error("Customer does not belong to this shop");
      }

      const balanceBefore = customer.pointsBalance;
      const balanceAfter = balanceBefore + points;

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          shopId,
          customerId,
          type: "EARNED" as TransactionType,
          points,
          balanceBefore,
          balanceAfter,
          description,
          source,
          shopifyOrderId,
          shopifyOrderNumber,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
      });

      // Update customer balance and lifetime points
      await tx.customer.update({
        where: { id: customerId },
        data: {
          pointsBalance: balanceAfter,
          lifetimePoints: { increment: points },
          lastActivityAt: new Date(),
        },
      });

      // Check for tier upgrades
      await this.checkTierUpgrade(tx, customerId, shopId);

      return transaction;
    });
  }

  /**
   * Redeem points for a customer
   */
  async redeemPoints(params: RedeemPointsParams): Promise<Transaction> {
    const { customerId, points, description, metadata } = params;

    if (points <= 0) {
      throw new Error("Points must be positive");
    }

    return await prisma.$transaction(async (tx) => {
      // Get customer with lock
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      if (customer.pointsBalance < points) {
        throw new Error("Insufficient points balance");
      }

      const balanceBefore = customer.pointsBalance;
      const balanceAfter = balanceBefore - points;

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          shopId: customer.shopId,
          customerId,
          type: "REDEEMED" as TransactionType,
          points: -points, // Negative for redemption
          balanceBefore,
          balanceAfter,
          description,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
      });

      // Update customer balance
      await tx.customer.update({
        where: { id: customerId },
        data: {
          pointsBalance: balanceAfter,
          lastActivityAt: new Date(),
        },
      });

      return transaction;
    });
  }

  /**
   * Calculate points for an order
   */
  calculateOrderPoints(
    orderTotal: number,
    loyaltyProgram: LoyaltyProgram,
    tierMultiplier: number = 1.0
  ): number {
    const basePoints = Math.floor(orderTotal * loyaltyProgram.pointsPerDollar);
    return Math.floor(basePoints * tierMultiplier);
  }

  /**
   * Get customer loyalty status
   */
  async getCustomerStatus(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        currentTier: true,
        shop: {
          include: {
            loyaltyProgram: {
              include: {
                tiers: {
                  orderBy: { requiredPoints: 'asc' }
                }
              }
            }
          }
        },
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    // Calculate progress to next tier
    let nextTier = null;
    let progressToNextTier = 0;

    const tiers = customer.shop.loyaltyProgram?.tiers || [];
    if (tiers.length > 0) {
      const currentTierLevel = customer.currentTier?.level || 0;
      nextTier = tiers.find(tier => tier.level > currentTierLevel);

      if (nextTier) {
        const pointsNeeded = nextTier.requiredPoints - customer.lifetimePoints;
        progressToNextTier = pointsNeeded > 0 ? pointsNeeded : 0;
      }
    }

    return {
      customer,
      pointsBalance: customer.pointsBalance,
      lifetimePoints: customer.lifetimePoints,
      currentTier: customer.currentTier,
      nextTier,
      progressToNextTier,
      recentTransactions: customer.transactions,
    };
  }

  /**
   * Check and apply tier upgrades
   */
  private async checkTierUpgrade(
    tx: Prisma.TransactionClient,
    customerId: string,
    shopId: string
  ) {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      include: { currentTier: true }
    });

    if (!customer) return;

    // Get loyalty program with tiers
    const loyaltyProgram = await tx.loyaltyProgram.findUnique({
      where: { shopId },
      include: {
        tiers: {
          orderBy: { requiredPoints: 'desc' }
        }
      }
    });

    if (!loyaltyProgram || !loyaltyProgram.tiersEnabled) return;

    // Find the highest tier the customer qualifies for
    const qualifyingTier = loyaltyProgram.tiers.find(
      tier => customer.lifetimePoints >= tier.requiredPoints
    );

    // Only upgrade if there's a tier to upgrade to and it's different from current
    if (qualifyingTier && qualifyingTier.id !== customer.currentTierId) {
      await tx.customer.update({
        where: { id: customerId },
        data: { currentTierId: qualifyingTier.id }
      });

      // Create a bonus transaction for tier upgrade
      await tx.transaction.create({
        data: {
          shopId,
          customerId,
          type: "BONUS" as TransactionType,
          points: 0, // No points for tier upgrade itself
          balanceBefore: customer.pointsBalance,
          balanceAfter: customer.pointsBalance,
          description: `Upgraded to ${qualifyingTier.name} tier`,
          source: "TIER_UPGRADE",
        },
      });

      console.log(`Customer ${customerId} upgraded to tier ${qualifyingTier.name}`);
    }
  }

  /**
   * Manually adjust customer points (admin function)
   */
  async adjustPoints(
    customerId: string,
    points: number,
    reason: string,
    adminId?: string
  ): Promise<Transaction> {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      const balanceBefore = customer.pointsBalance;
      const balanceAfter = Math.max(0, balanceBefore + points); // Prevent negative balance

      // Create adjustment transaction
      const transaction = await tx.transaction.create({
        data: {
          shopId: customer.shopId,
          customerId,
          type: "ADJUSTED" as TransactionType,
          points,
          balanceBefore,
          balanceAfter,
          description: reason,
          source: "MANUAL_ADJUSTMENT",
          metadata: { adminId },
        },
      });

      // Update customer balance
      await tx.customer.update({
        where: { id: customerId },
        data: {
          pointsBalance: balanceAfter,
          // Only increment lifetime points if it's a positive adjustment
          ...(points > 0 && { lifetimePoints: { increment: points } }),
          lastActivityAt: new Date(),
        },
      });

      return transaction;
    });
  }
}