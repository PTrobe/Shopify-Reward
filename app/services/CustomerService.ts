import { prisma } from "../lib/prisma.server";
import type { Customer, LoyaltyProgram } from "@prisma/client";
import { nanoid } from "nanoid";

export interface CreateCustomerParams {
  shopId: string;
  shopifyCustomerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthday?: Date;
}

export interface UpdateCustomerParams {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthday?: Date;
}

export class CustomerService {
  /**
   * Create or update customer from Shopify data
   */
  async upsertCustomer(params: CreateCustomerParams): Promise<Customer> {
    const {
      shopId,
      shopifyCustomerId,
      email,
      firstName,
      lastName,
      phone,
      birthday
    } = params;

    // Generate unique referral code
    const referralCode = nanoid(8).toUpperCase();

    const customer = await prisma.customer.upsert({
      where: {
        shopId_shopifyCustomerId: {
          shopId,
          shopifyCustomerId
        }
      },
      update: {
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        birthday: birthday || undefined,
        lastActivityAt: new Date(),
      },
      create: {
        shopId,
        shopifyCustomerId,
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        birthday: birthday || undefined,
        referralCode,
        enrolledAt: new Date(),
        lastActivityAt: new Date(),
      },
      include: {
        currentTier: true,
        shop: {
          include: {
            loyaltyProgram: true
          }
        }
      }
    });

    // Award welcome bonus if this is a new customer
    if (customer.enrolledAt.getTime() === customer.lastActivityAt.getTime()) {
      await this.awardWelcomeBonus(customer);
    }

    return customer;
  }

  /**
   * Find customer by Shopify customer ID
   */
  async findByShopifyId(
    shopId: string,
    shopifyCustomerId: string
  ): Promise<Customer | null> {
    return await prisma.customer.findFirst({
      where: {
        shopId,
        shopifyCustomerId
      },
      include: {
        currentTier: true,
        shop: {
          include: {
            loyaltyProgram: true
          }
        }
      }
    });
  }

  /**
   * Find customer by referral code
   */
  async findByReferralCode(referralCode: string): Promise<Customer | null> {
    return await prisma.customer.findUnique({
      where: { referralCode },
      include: {
        currentTier: true,
        shop: {
          include: {
            loyaltyProgram: true
          }
        }
      }
    });
  }

  /**
   * Get customers with pagination and filtering
   */
  async getCustomers(params: {
    shopId: string;
    page?: number;
    limit?: number;
    search?: string;
    tierId?: string;
    orderBy?: 'pointsBalance' | 'lifetimePoints' | 'enrolledAt' | 'lastActivityAt';
    orderDirection?: 'asc' | 'desc';
  }) {
    const {
      shopId,
      page = 1,
      limit = 50,
      search,
      tierId,
      orderBy = 'enrolledAt',
      orderDirection = 'desc'
    } = params;

    const skip = (page - 1) * limit;

    const where: any = { shopId };

    // Add search filter
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Add tier filter
    if (tierId) {
      where.currentTierId = tierId;
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          currentTier: true,
          _count: {
            select: {
              transactions: true,
              redemptions: true,
              referrals: true
            }
          }
        },
        orderBy: { [orderBy]: orderDirection },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where })
    ]);

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update customer information
   */
  async updateCustomer(
    customerId: string,
    params: UpdateCustomerParams
  ): Promise<Customer> {
    return await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...params,
        lastActivityAt: new Date(),
      },
      include: {
        currentTier: true,
        shop: {
          include: {
            loyaltyProgram: true
          }
        }
      }
    });
  }

  /**
   * Process referral and award bonus points
   */
  async processReferral(
    referralCode: string,
    newCustomerId: string
  ): Promise<{ success: boolean; message: string }> {
    const referrer = await this.findByReferralCode(referralCode);

    if (!referrer) {
      return { success: false, message: "Invalid referral code" };
    }

    const newCustomer = await prisma.customer.findUnique({
      where: { id: newCustomerId },
      include: {
        shop: {
          include: {
            loyaltyProgram: true
          }
        }
      }
    });

    if (!newCustomer) {
      return { success: false, message: "Customer not found" };
    }

    // Check if referral is valid (same shop, not self-referral)
    if (referrer.shopId !== newCustomer.shopId) {
      return { success: false, message: "Invalid referral - different shops" };
    }

    if (referrer.id === newCustomer.id) {
      return { success: false, message: "Cannot refer yourself" };
    }

    // Check if customer already has a referrer
    if (newCustomer.referredById) {
      return { success: false, message: "Customer already has a referrer" };
    }

    const loyaltyProgram = newCustomer.shop.loyaltyProgram;
    if (!loyaltyProgram || !loyaltyProgram.referralsEnabled) {
      return { success: false, message: "Referral program not enabled" };
    }

    // Process referral in transaction
    await prisma.$transaction(async (tx) => {
      // Update new customer with referrer
      await tx.customer.update({
        where: { id: newCustomerId },
        data: { referredById: referrer.id }
      });

      // Award bonus to referrer
      if (loyaltyProgram.referralBonus > 0) {
        const referrerBalanceBefore = referrer.pointsBalance;
        const referrerBalanceAfter = referrerBalanceBefore + loyaltyProgram.referralBonus;

        await tx.transaction.create({
          data: {
            shopId: referrer.shopId,
            customerId: referrer.id,
            type: "BONUS",
            points: loyaltyProgram.referralBonus,
            balanceBefore: referrerBalanceBefore,
            balanceAfter: referrerBalanceAfter,
            description: `Referral bonus for referring ${newCustomer.email}`,
            source: "REFERRAL",
          }
        });

        await tx.customer.update({
          where: { id: referrer.id },
          data: {
            pointsBalance: referrerBalanceAfter,
            lifetimePoints: { increment: loyaltyProgram.referralBonus },
            lastActivityAt: new Date(),
          }
        });
      }
    });

    return { success: true, message: "Referral processed successfully" };
  }

  /**
   * Award welcome bonus to new customers
   */
  private async awardWelcomeBonus(customer: Customer & {
    shop: { loyaltyProgram: LoyaltyProgram | null }
  }) {
    const loyaltyProgram = customer.shop.loyaltyProgram;

    if (!loyaltyProgram || loyaltyProgram.welcomeBonus <= 0) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      const balanceBefore = customer.pointsBalance;
      const balanceAfter = balanceBefore + loyaltyProgram.welcomeBonus;

      // Create welcome bonus transaction
      await tx.transaction.create({
        data: {
          shopId: customer.shopId,
          customerId: customer.id,
          type: "BONUS",
          points: loyaltyProgram.welcomeBonus,
          balanceBefore,
          balanceAfter,
          description: "Welcome bonus for joining loyalty program",
          source: "WELCOME_BONUS",
        }
      });

      // Update customer balance
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          pointsBalance: balanceAfter,
          lifetimePoints: { increment: loyaltyProgram.welcomeBonus },
        }
      });
    });
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(shopId: string) {
    const [
      totalCustomers,
      activeCustomers,
      newThisMonth,
      topCustomers,
      tierDistribution
    ] = await Promise.all([
      // Total customers
      prisma.customer.count({ where: { shopId } }),

      // Active customers (activity in last 30 days)
      prisma.customer.count({
        where: {
          shopId,
          lastActivityAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // New customers this month
      prisma.customer.count({
        where: {
          shopId,
          enrolledAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),

      // Top customers by lifetime points
      prisma.customer.findMany({
        where: { shopId },
        include: { currentTier: true },
        orderBy: { lifetimePoints: 'desc' },
        take: 10
      }),

      // Tier distribution
      prisma.customer.groupBy({
        by: ['currentTierId'],
        where: { shopId },
        _count: true
      })
    ]);

    return {
      totalCustomers,
      activeCustomers,
      newThisMonth,
      topCustomers,
      tierDistribution
    };
  }
}