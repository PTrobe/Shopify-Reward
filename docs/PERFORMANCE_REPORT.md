# Performance Optimization Report

**Date:** 2025-10-30  
**Codebase:** Shopify Loyalty Rewards Application  
**Analysis Method:** Static code analysis, database schema review, query pattern analysis

## Executive Summary

This report identifies performance inefficiencies in the Shopify loyalty rewards application codebase. The analysis focused on database query patterns, missing indices, N+1 query problems, and unbounded result sets. Six key inefficiencies were identified, ranging from missing database indices to sequential processing patterns that could benefit from parallelization.

## Findings

### 1. Missing Indices on Redemption Model (HIGH PRIORITY)

**Location:** `prisma/schema.prisma:236-251`

**Issue:** The `Redemption` model has no database indices, but queries frequently filter by `customerId` and `rewardId`.

**Evidence:**
```typescript
// app/routes/api.loyalty.redeem.tsx:74-79
const customerRedemptions = await prisma.redemption.count({
  where: {
    customerId: customer.id,
    rewardId: reward.id
  }
});

// app/routes/api.admin.dashboard.tsx:86-90
prisma.redemption.count({
  where: {
    customer: { shopId: shop.id }
  }
})
```

**Current Schema:**
```prisma
model Redemption {
  id           String    @id @default(cuid())
  customerId   String
  rewardId     String
  pointsUsed   Int
  discountCode String?
  status       String    @default("pending")
  usedAt       DateTime?
  expiresAt    DateTime?
  createdAt    DateTime  @default(now())

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  reward   Reward   @relation(fields: [rewardId], references: [id], onDelete: Cascade)

  @@map("redemptions")
}
```

**Impact:**
- Every redemption count query performs a full table scan
- Per-customer redemption limit checks (line 74-79 in api.loyalty.redeem.tsx) are slow
- Dashboard analytics queries are inefficient
- Performance degrades linearly with redemption table size

**Suggested Fix:**
Add composite indices to match query patterns:
```prisma
@@index([customerId, rewardId])
@@index([customerId, createdAt])
@@index([rewardId, createdAt])
@@index([status, expiresAt])
```

**Expected Impact:** 
- 10-100x faster redemption count queries
- Improved dashboard load times
- Better scalability as redemption volume grows

---

### 2. Missing Composite Index on WebhookEvent for Shop Filtering (MEDIUM PRIORITY)

**Location:** `prisma/schema.prisma:272-290`

**Issue:** The `WebhookEvent` model has an index on `[processed, createdAt]` but queries often filter by `shopId` as well.

**Evidence:**
```typescript
// app/services/WebhookProcessor.ts:19-23
const pendingEvents = await prisma.webhookEvent.findMany({
  where: { processed: false },
  orderBy: { createdAt: 'asc' },
  take: 50,
});

// app/services/WebhookProcessor.ts:294-304
const failedEvents = await prisma.webhookEvent.findMany({
  where: {
    processed: false,
    processingError: { not: null },
    createdAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
    }
  },
  orderBy: { createdAt: 'asc' },
  take: 20,
});
```

**Current Schema:**
```prisma
model WebhookEvent {
  id     String @id @default(cuid())
  shopId String
  shop   Shop   @relation(fields: [shopId], references: [id])

  eventType       String
  eventId         String
  payload         Json
  processed       Boolean @default(false)
  processingError String?
  metadata        Json?

  createdAt   DateTime  @default(now())
  processedAt DateTime?

  @@unique([shopId, eventId])
  @@index([processed, createdAt])
  @@map("webhook_events")
}
```

**Impact:**
- Current index `[processed, createdAt]` works well for the main query
- However, if we need to filter by shop (multi-tenant isolation), the index is less effective
- The unique constraint `[shopId, eventId]` helps with deduplication but not with pending queries

**Suggested Fix:**
Add a composite index that includes shopId for multi-tenant queries:
```prisma
@@index([shopId, processed, createdAt])
```

**Expected Impact:**
- Better performance for shop-specific webhook processing
- Improved query planning when filtering by shop
- Minimal write overhead (one additional index)

---

### 3. Sequential Webhook Processing (MEDIUM PRIORITY)

**Location:** `app/services/WebhookProcessor.ts:27-29`

**Issue:** Webhook events are processed sequentially in a for loop, which limits throughput.

**Evidence:**
```typescript
// app/services/WebhookProcessor.ts:18-30
async processPendingWebhooks() {
  const pendingEvents = await prisma.webhookEvent.findMany({
    where: { processed: false },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  console.log(`Processing ${pendingEvents.length} pending webhook events`);

  for (const event of pendingEvents) {
    await this.processWebhookEvent(event);  // Sequential processing
  }
}
```

**Impact:**
- Processes 50 events sequentially, one at a time
- Each event involves multiple database queries (shop lookup, customer lookup, transaction creation)
- Total processing time = sum of individual event processing times
- Under high load, webhook queue can grow faster than processing rate

**Suggested Fix:**
Process events in parallel with concurrency control:
```typescript
async processPendingWebhooks() {
  const pendingEvents = await prisma.webhookEvent.findMany({
    where: { processed: false },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  console.log(`Processing ${pendingEvents.length} pending webhook events`);

  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  for (let i = 0; i < pendingEvents.length; i += CONCURRENCY) {
    const batch = pendingEvents.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(event => this.processWebhookEvent(event))
    );
  }
}
```

**Considerations:**
- Must ensure event processing is idempotent (already implemented via eventId uniqueness)
- Order of processing may not be strictly maintained (acceptable for most webhook types)
- Database connection pool must support increased concurrency
- May need to adjust based on database and API rate limits

**Expected Impact:**
- 3-5x faster webhook processing throughput
- Reduced webhook queue backlog
- Better handling of traffic spikes

---

### 4. Redundant Shop Lookups in Webhook Processing (LOW PRIORITY)

**Location:** `app/services/WebhookProcessor.ts:103-106, 233-235, 262-264`

**Issue:** Each webhook processing method performs a separate shop lookup, even though the shop is the same for all events in a batch.

**Evidence:**
```typescript
// app/services/WebhookProcessor.ts:103-106
const shop = await prisma.shop.findUnique({
  where: { shopifyDomain: event.shopId },
  include: { loyaltyProgram: true },
});

// app/services/WebhookProcessor.ts:233-235
const shop = await prisma.shop.findUnique({
  where: { shopifyDomain: event.shopId },
});

// app/services/WebhookProcessor.ts:262-264
const shop = await prisma.shop.findUnique({
  where: { shopifyDomain: event.shopId },
});
```

**Impact:**
- Redundant database queries for the same shop data
- Each batch of 50 events may query the same shop 50 times
- Wastes database connections and query time

**Suggested Fix:**
1. Cache shop data at the batch level:
```typescript
private shopCache = new Map<string, any>();

async processPendingWebhooks() {
  const pendingEvents = await prisma.webhookEvent.findMany({
    where: { processed: false },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  // Pre-fetch unique shops
  const uniqueShopIds = [...new Set(pendingEvents.map(e => e.shopId))];
  const shops = await prisma.shop.findMany({
    where: { shopifyDomain: { in: uniqueShopIds } },
    include: { loyaltyProgram: true },
  });
  
  this.shopCache.clear();
  shops.forEach(shop => this.shopCache.set(shop.shopifyDomain, shop));

  for (const event of pendingEvents) {
    await this.processWebhookEvent(event);
  }
  
  this.shopCache.clear();
}
```

2. Or use the existing Redis cache (app/lib/cache.server.ts) with CacheTTL.SHOP_PROGRAM (1 hour)

**Expected Impact:**
- Reduces shop queries from N to 1 per batch (typically 50x reduction)
- Faster webhook processing
- Reduced database load

---

### 5. Missing Pagination on Customer Transactions (LOW PRIORITY)

**Location:** `app/routes/api.admin.dashboard.tsx:40-53`

**Issue:** Dashboard queries are properly paginated, but there's no explicit limit on transaction history queries in other parts of the codebase.

**Evidence:**
```typescript
// app/routes/api.admin.dashboard.tsx:40-53
prisma.transaction.findMany({
  where: { shopId: shop.id },
  include: {
    customer: {
      select: {
        email: true,
        firstName: true,
        lastName: true,
      }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 10,  // Good: has limit
}),
```

**Current State:**
- Dashboard queries have proper `take` limits
- Customer service methods have proper pagination
- No unbounded queries found in current codebase

**Suggested Fix:**
No immediate fix needed. This is a preventive recommendation:
- Add ESLint rule to warn on `findMany` without `take`
- Document pagination requirements in development guidelines
- Add default `take` limit in Prisma middleware as a safety net

**Expected Impact:**
- Prevents future performance issues
- Ensures consistent pagination patterns

---

### 6. Potential N+1 Query in Order Processing (LOW PRIORITY)

**Location:** `app/services/WebhookProcessor.ts:184-189`

**Issue:** When checking for existing transactions, the query could be optimized if processing multiple orders.

**Evidence:**
```typescript
// app/services/WebhookProcessor.ts:184-189
const existingTransaction = await prisma.transaction.findFirst({
  where: {
    shopifyOrderId: orderData.id.toString(),
    type: "EARNED",
  },
});
```

**Current State:**
- Query has an index on `shopifyOrderId` (schema.prisma:166)
- Only called once per order update webhook
- Not a true N+1 problem since it's not in a loop

**Impact:**
- Minimal impact with current implementation
- Could become an issue if batch processing orders in the future

**Suggested Fix:**
No immediate fix needed. If batch processing is added later:
```typescript
// Batch check for existing transactions
const orderIds = orders.map(o => o.id.toString());
const existingTransactions = await prisma.transaction.findMany({
  where: {
    shopifyOrderId: { in: orderIds },
    type: "EARNED",
  },
});
const existingOrderIds = new Set(existingTransactions.map(t => t.shopifyOrderId));
```

**Expected Impact:**
- Future-proofing for batch processing scenarios

---

## Priority Recommendations

### Immediate (High Priority)
1. **Add indices to Redemption model** - Critical for redemption performance and dashboard analytics

### Short-term (Medium Priority)
2. **Add composite index to WebhookEvent for shop filtering** - Improves multi-tenant query performance
3. **Implement parallel webhook processing** - Increases throughput and reduces queue backlog

### Long-term (Low Priority)
4. **Cache shop data in webhook processing** - Reduces redundant queries
5. **Add pagination safeguards** - Prevents future issues
6. **Monitor for N+1 patterns** - Preventive measure

## Implementation Plan

For the immediate fix (Redemption indices), the implementation steps are:

1. Update `prisma/schema.prisma` to add indices
2. Run `npx prisma generate` to update Prisma client
3. Create migration: `npx prisma migrate dev --name add-redemption-indices`
4. Test locally with redemption queries
5. Deploy migration to production
6. Monitor query performance improvements

## Testing Recommendations

1. **Load Testing:** Test redemption queries with 10k+ records to verify index effectiveness
2. **Query Analysis:** Use `EXPLAIN ANALYZE` on PostgreSQL to verify index usage
3. **Monitoring:** Track query execution times before and after index additions
4. **Regression Testing:** Ensure existing functionality works correctly after changes

## Conclusion

The codebase is generally well-structured with good pagination practices and proper use of transactions. The main performance improvements can be achieved by adding strategic database indices, particularly on the Redemption model. The webhook processing system could benefit from parallelization to improve throughput under load.

All identified issues have clear, low-risk solutions that can be implemented incrementally without disrupting existing functionality.
