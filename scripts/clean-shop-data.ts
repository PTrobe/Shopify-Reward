#!/usr/bin/env tsx

/**
 * Clean Shop Data Script
 *
 * Safely removes all data for a specific shop to enable clean reinstallation.
 * Usage: npm run clean-shop -- your-store.myshopify.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanShopData(shopifyDomain: string) {
  console.log(`🧹 Starting cleanup for shop: ${shopifyDomain}`);

  try {
    // Find the shop
    const shop = await prisma.shop.findUnique({
      where: { shopifyDomain },
      include: {
        _count: {
          select: {
            customers: true,
            transactions: true,
            webhookEvents: true,
          }
        },
        loyaltyProgram: true
      }
    });

    if (!shop) {
      console.log(`❌ Shop not found: ${shopifyDomain}`);
      return;
    }

    console.log(`📊 Found shop with:
- ${shop._count.customers} customers
- ${shop.loyaltyProgram ? '1' : '0'} loyalty program
- ${shop._count.transactions} transactions
- ${shop._count.webhookEvents} webhook events`);

    // Confirm deletion
    console.log(`⚠️  This will permanently delete ALL data for ${shopifyDomain}`);

    // Delete in correct order to avoid foreign key constraints
    console.log('🗑️  Deleting transactions...');
    const deletedTransactions = await prisma.transaction.deleteMany({
      where: { shopId: shop.id }
    });
    console.log(`✅ Deleted ${deletedTransactions.count} transactions`);

    console.log('🗑️  Deleting redemptions...');
    const deletedRedemptions = await prisma.redemption.deleteMany({
      where: {
        customer: { shopId: shop.id }
      }
    });
    console.log(`✅ Deleted ${deletedRedemptions.count} redemptions`);

    console.log('🗑️  Deleting customers...');
    const deletedCustomers = await prisma.customer.deleteMany({
      where: { shopId: shop.id }
    });
    console.log(`✅ Deleted ${deletedCustomers.count} customers`);

    console.log('🗑️  Deleting rewards...');
    const deletedRewards = await prisma.reward.deleteMany({
      where: {
        program: { shopId: shop.id }
      }
    });
    console.log(`✅ Deleted ${deletedRewards.count} rewards`);

    console.log('🗑️  Deleting loyalty programs...');
    const deletedPrograms = await prisma.loyaltyProgram.deleteMany({
      where: { shopId: shop.id }
    });
    console.log(`✅ Deleted ${deletedPrograms.count} loyalty programs`);

    console.log('🗑️  Deleting webhook events...');
    const deletedWebhooks = await prisma.webhookEvent.deleteMany({
      where: { shopId: shop.id }
    });
    console.log(`✅ Deleted ${deletedWebhooks.count} webhook events`);

    console.log('🗑️  Deleting sessions...');
    const deletedSessions = await prisma.session.deleteMany({
      where: { shop: shopifyDomain }
    });
    console.log(`✅ Deleted ${deletedSessions.count} sessions`);

    console.log('🗑️  Deleting shop...');
    await prisma.shop.delete({
      where: { id: shop.id }
    });
    console.log(`✅ Deleted shop: ${shopifyDomain}`);

    console.log(`🎉 Cleanup completed for ${shopifyDomain}`);
    console.log(`📝 You can now reinstall the app for a completely fresh start.`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get shop domain from command line args
const shopDomain = process.argv[2];
if (!shopDomain) {
  console.error('❌ Usage: npm run clean-shop -- your-store.myshopify.com');
  process.exit(1);
}

cleanShopData(shopDomain).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});