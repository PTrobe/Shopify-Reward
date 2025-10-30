# Shopify Loyalty Rewards App - Architecture Documentation

> **For New Engineers**: This document provides a comprehensive overview of the Loyco Rewards application architecture, designed to help you understand the system and start contributing quickly.

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [System Context and Components](#system-context-and-components)
3. [Request Lifecycle and Routing](#request-lifecycle-and-routing)
4. [Data Model](#data-model)
5. [Domain Services](#domain-services)
6. [Cross-Cutting Concerns](#cross-cutting-concerns)
7. [Shopify Integration](#shopify-integration)
8. [Development Environment](#development-environment)
9. [Deployment and Operations](#deployment-and-operations)
10. [Common Workflows](#common-workflows)
11. [Glossary](#glossary)

---

## High-Level Overview

### What is Loyco Rewards?

Loyco Rewards is a Shopify embedded app that enables merchants to create and manage loyalty programs for their customers. The app allows customers to:
- **Earn points** on purchases and other activities
- **Redeem points** for rewards (discounts, free products, free shipping)
- **Track their status** through tiered membership levels
- **Participate in campaigns** and special promotions

### Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     Shopify Ecosystem                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Checkout   │  │   Customer   │  │    Theme     │      │
│  │  Extension   │  │   Account    │  │    Blocks    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Remix Application (Node.js ESM)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Admin UI (Polaris) + Public API + Webhooks         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services: Loyalty, Customer, Webhook Processing    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Libs: Validation, Cache, Rate Limit, Security      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data & Cache Layer                        │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   PostgreSQL     │         │      Redis       │          │
│  │   (via Prisma)   │         │   (Caching)      │          │
│  └──────────────────┘         └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

**Core Technologies:**
- **Runtime**: Node.js 20+ with ES Modules
- **Framework**: Remix v2 (React-based full-stack framework)
- **Database**: PostgreSQL with Prisma ORM v5.22
- **Cache**: Redis (ioredis v5.3)
- **UI**: Shopify Polaris v12 (admin), Shopify UI Extensions (storefront)
- **Validation**: Zod v3.22
- **Authentication**: Shopify App Bridge + OAuth
- **Monitoring**: Sentry v7

### Code Organization

```
shopify-reward/
├── app/                      # Remix application code
│   ├── routes/              # Route handlers (24 files)
│   │   ├── app.*.tsx        # Admin UI routes (embedded in Shopify)
│   │   ├── api.*.tsx        # Public/admin API endpoints
│   │   ├── apps.loyco-*.tsx # Storefront API endpoints
│   │   └── webhooks.tsx     # Webhook receiver
│   ├── services/            # Business logic layer
│   │   ├── LoyaltyService.ts
│   │   ├── CustomerService.ts
│   │   ├── WebhookProcessor.ts
│   │   └── theme.server.ts
│   ├── lib/                 # Shared utilities
│   │   ├── validation.ts    # Zod schemas
│   │   ├── errors.ts        # Custom error types
│   │   ├── cache.server.ts  # Redis caching
│   │   ├── rateLimit.server.ts
│   │   ├── security.server.ts
│   │   ├── monitoring.server.ts
│   │   ├── apiHandler.server.ts
│   │   └── prisma.server.ts
│   ├── components/          # React components
│   ├── contexts/            # React contexts
│   ├── types/               # TypeScript type definitions
│   ├── shopify.server.ts    # Shopify app configuration
│   └── root.tsx             # Root component
├── extensions/              # Shopify UI extensions
│   ├── loyco-checkout-extension/
│   ├── loyco-customer-account/
│   └── loyco-loyalty-blocks/
├── prisma/
│   └── schema.prisma        # Database schema (10 models)
├── scripts/                 # Utility scripts
├── server.js                # Node.js HTTP server
└── remix.config.js          # Remix configuration
```

---

## System Context and Components

### Main Components

#### 1. Remix Server (`server.js`)
- **Purpose**: HTTP server that handles all incoming requests
- **Location**: `server.js:41-79`
- **Key Features**:
  - Serves static files from `/build/` with 1-year cache
  - Handles protocol/host forwarding for Railway/production
  - Converts Node.js requests to Web API Request/Response
  - Error handling with proper status codes

#### 2. Shopify App Integration (`app/shopify.server.ts`)
- **Purpose**: Configures Shopify app authentication and webhooks
- **Location**: `app/shopify.server.ts:45-110`
- **Configuration**:
  - API Version: January 2024
  - Scopes: `read_products`, `write_products`, `read_customers`, `write_customers`, `read_orders`, `write_orders`
  - Session Storage: Prisma-backed with 5 retries, 2s retry interval
  - Auth Strategy: Embedded app with new auth strategy
  - Distribution: App Store
- **Webhooks Registered** (all via HTTP to `/webhooks`):
  - `APP_UNINSTALLED`
  - `ORDERS_CREATE`, `ORDERS_UPDATED`, `ORDERS_CANCELLED`
  - `CUSTOMERS_CREATE`, `CUSTOMERS_UPDATE`
- **afterAuth Hook**: Creates/updates Shop record in database (`app/shopify.server.ts:92-108`)

#### 3. Domain Services (`app/services/`)

**LoyaltyService** (`app/services/LoyaltyService.ts`)
- Core business logic for points operations
- Methods:
  - `earnPoints()`: Award points with tier upgrade checks (lines 36-102)
  - `redeemPoints()`: Deduct points with validation (lines 107-156)
  - `calculateOrderPoints()`: Calculate points from order total (lines 161-168)
  - `getCustomerStatus()`: Get customer loyalty status with tier progress (lines 173-224)
  - `redeemReward()`: Process reward redemption with discount code generation (lines 286-354)
  - `adjustPoints()`: Manual point adjustments (admin function, lines 359-405)
- Uses Prisma transactions for atomicity
- Implements tier upgrade logic automatically on point earning

**CustomerService** (`app/services/CustomerService.ts`)
- Customer management operations
- Handles customer creation, updates, and queries
- Integrates with Shopify customer data

**WebhookProcessor** (`app/services/WebhookProcessor.ts`)
- Asynchronous webhook event processing
- Key methods:
  - `processPendingWebhooks()`: Batch process up to 50 events (lines 18-30)
  - `processOrderCreated()`: Award points for paid orders (lines 88-167)
  - `processOrderCancelled()`: Deduct points for cancelled orders (lines 200-225)
  - `processCustomerCreated/Updated()`: Sync customer data (lines 230-288)
  - `retryFailedWebhooks()`: Retry failed events with max 3 attempts (lines 293-327)
- Implements idempotency via `WebhookEvent.eventId` unique constraint
- Stores all events in database for audit and retry

#### 4. Cross-Cutting Libraries (`app/lib/`)

**Validation** (`app/lib/validation.ts`)
- Zod schemas for all API inputs
- Schemas: `earnPointsSchema`, `redeemPointsSchema`, `adjustPointsSchema`, `customerQuerySchema`, `loyaltyStatusParamsSchema`, `shopDomainSchema`
- `validateRequestBody()` utility for consistent validation

**Caching** (`app/lib/cache.server.ts`)
- Redis-backed caching with graceful fallback
- **TTLs** (verified from code, lines 121-127):
  - Customer Status: 300s (5 minutes)
  - Shop Program: 3600s (1 hour)
  - Dashboard Analytics: 600s (10 minutes)
  - Rewards: 1800s (30 minutes)
  - Tiers: 3600s (1 hour)
- Cache keys generated via `CacheKeys` object (lines 111-118)
- Handles Redis unavailability gracefully (returns null)

**Rate Limiting** (`app/lib/rateLimit.server.ts`)
- Redis-backed sliding window rate limiting
- **Limits** (verified from code, lines 34-62):
  - Public API: 100 req/min per shop
  - Admin API: 1000 req/min per shop
  - Webhooks: 100 req/sec per shop
  - Redemptions: 10 req/min per customer
- `withRateLimit()` helper for easy integration

**Security** (`app/lib/security.server.ts`)
- Webhook HMAC validation: `validateWebhookSignature()` (lines 48-64)
- App proxy signature validation: `validateAppProxySignature()` (lines 15-43)
- Input sanitization: `sanitizeInput()` (lines 69-93)
- Security headers: CSP, HSTS, X-Frame-Options, etc. (lines 98-132)
- Token bucket rate limiter implementation (lines 137-168)
- Validators for email, Shopify domain, customer ID, points, amounts (lines 173-195)

**Errors** (`app/lib/errors.ts`)
- Custom error hierarchy:
  - `LoyaltyAppError` (base)
  - `ValidationError`
  - `InsufficientPointsError`
  - `NotFoundError`
  - `RateLimitError`
- Structured error responses with status codes

#### 5. UI Extensions (`extensions/`)

**Checkout Extension** (`extensions/loyco-checkout-extension/`)
- Type: `ui_extension`
- Target: `purchase.checkout.block.render`
- Module: `./src/Checkout.jsx`
- Capabilities: Storefront API access
- Purpose: Display loyalty points earned/available during checkout

**Customer Account Extension** (`extensions/loyco-customer-account/`)
- Type: `ui_extension`
- Target: `customer-account.order-status.block.render`
- Module: `./src/OrderStatusBlock.jsx`
- Capabilities: Storefront API access
- Purpose: Show points earned on order status page

**Theme Blocks** (`extensions/loyco-loyalty-blocks/`)
- Type: `theme`
- Purpose: Liquid theme blocks for displaying loyalty widgets
- Customizable via theme editor

---

## Request Lifecycle and Routing

### Routing Conventions

Remix uses file-based routing with specific naming conventions:

1. **Admin Routes** (`app.*`): Embedded Shopify admin UI
   - Example: `app/routes/app.dashboard.tsx`
   - Rendered inside Shopify admin with Polaris components
   - Requires Shopify admin authentication

2. **Public API Routes** (`api.*`): External-facing APIs
   - Example: `app/routes/api.loyalty.status.$customerId.tsx`
   - Used by storefront extensions and external integrations
   - May require custom authentication

3. **Storefront API Routes** (`apps.loyco-rewards.api.*`): Storefront-specific APIs
   - Example: `app/routes/apps.loyco-rewards.api.customer.$customerId.earn.tsx`
   - Called from UI extensions
   - Shop-scoped authentication

4. **Webhook Route** (`webhooks.tsx`): Shopify webhook receiver
   - Single route handling all webhook topics
   - Shopify HMAC authentication via `authenticate.webhook()`

### Request Flow Examples

#### Example 1: Earn Points (Order Created Webhook)

```
1. Shopify sends webhook → POST /webhooks
   ↓
2. app/routes/webhooks.tsx:6-8
   - authenticate.webhook(request) validates HMAC
   - Extracts topic, shop, payload
   ↓
3. app/routes/webhooks.tsx:17-18
   - Calls handleOrderCreated(shop, payload)
   ↓
4. app/routes/webhooks.tsx:67-75
   - Creates WebhookEvent record (processed: false)
   - Returns 200 OK immediately
   ↓
5. Background: WebhookProcessor.processPendingWebhooks()
   ↓
6. app/services/WebhookProcessor.ts:88-167
   - Validates order is paid
   - Finds/creates customer
   - Calculates points via LoyaltyService.calculateOrderPoints()
   - Calls LoyaltyService.earnPoints()
   ↓
7. app/services/LoyaltyService.ts:36-102
   - Validates input with Zod
   - Uses Prisma transaction:
     - Creates Transaction record
     - Updates Customer balance and lifetimePoints
     - Checks for tier upgrade
   - Returns Transaction
   ↓
8. WebhookEvent marked as processed
```

#### Example 2: Redeem Points (API Call)

```
1. Storefront extension → POST /api/loyalty/redeem
   ↓
2. app/routes/api.loyalty.redeem.tsx:9-21
   - Validates request body (customerId, rewardId, shopDomain)
   ↓
3. app/routes/api.loyalty.redeem.tsx:24-43
   - Fetches Shop with LoyaltyProgram and Rewards
   - Validates shop and program are active
   - Finds reward and validates it's active
   ↓
4. app/routes/api.loyalty.redeem.tsx:46-64
   - Finds Customer by shopifyCustomerId
   - Validates sufficient points balance
   ↓
5. app/routes/api.loyalty.redeem.tsx:66-94
   - Validates reward usage limits (total and per-customer)
   - Validates date restrictions (startDate, endDate)
   ↓
6. app/routes/api.loyalty.redeem.tsx:98-145
   - Prisma transaction:
     - Calls LoyaltyService.redeemPoints()
     - Generates discount code (if applicable)
     - Creates Redemption record
     - Updates Reward.totalRedemptions
   ↓
7. app/routes/api.loyalty.redeem.tsx:166-178
   - Returns success response with:
     - Redemption details
     - Discount code
     - Instructions
     - New points balance
```

#### Example 3: Admin Dashboard Load

```
1. Merchant opens dashboard → GET /app/dashboard
   ↓
2. app/routes/app.dashboard.tsx (loader function)
   - authenticate.admin(request) validates session
   - Extracts shop from session
   ↓
3. Queries with caching:
   - cache.cached('dashboard:{shopId}', fetchFn, 600)
   - Fetches:
     - Total customers
     - Total points issued
     - Total redemptions
     - Recent transactions
   ↓
4. Returns data to React component
   ↓
5. Renders Polaris UI with charts and stats
```

### Authentication Patterns

**Admin Routes** (`app.*`):
```typescript
const { admin, session } = await authenticate.admin(request);
// session.shop contains the shop domain
// admin is the Shopify Admin API client
```

**Public API Routes** (custom):
```typescript
// Validate shop domain from request
const { shopDomain } = await request.json();
const shop = await prisma.shop.findUnique({
  where: { shopifyDomain: shopDomain }
});
// Verify customer belongs to shop
```

**Webhook Routes**:
```typescript
const { topic, shop, payload } = await authenticate.webhook(request);
// Shopify validates HMAC automatically
```

---

## Data Model

### Entity Relationship Diagram

```
┌─────────────────┐
│      Shop       │
│─────────────────│
│ id (PK)         │
│ shopifyDomain   │◄─────┐
│ accessToken     │      │
│ email           │      │
│ billingPlan     │      │
└─────────────────┘      │
        │                │
        │ 1:1            │ N:1
        ▼                │
┌─────────────────┐      │
│ LoyaltyProgram  │      │
│─────────────────│      │
│ id (PK)         │      │
│ shopId (FK)     │──────┘
│ name            │
│ pointsPerDollar │
│ welcomeBonus    │
│ tiersEnabled    │
│ primaryColor    │
└─────────────────┘
        │
        │ 1:N
        ├────────────────┬────────────────┐
        ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    Tier     │  │   Reward    │  │  Campaign   │
│─────────────│  │─────────────│  │─────────────│
│ id (PK)     │  │ id (PK)     │  │ id (PK)     │
│ programId   │  │ programId   │  │ programId   │
│ level       │  │ pointsCost  │  │ type        │
│ required... │  │ rewardType  │  │ startDate   │
└─────────────┘  └─────────────┘  └─────────────┘
        ▲                │
        │                │
        │ N:1            │ 1:N
        │                ▼
┌─────────────────┐  ┌─────────────┐
│    Customer     │  │ Redemption  │
│─────────────────│  │─────────────│
│ id (PK)         │  │ id (PK)     │
│ shopId (FK)     │──┤ customerId  │
│ shopifyCustomer │  │ rewardId    │
│ pointsBalance   │  │ pointsUsed  │
│ lifetimePoints  │  │ discountCode│
│ currentTierId   │──┘ status      │
│ referralCode    │  └─────────────┘
└─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐
│  Transaction    │
│─────────────────│
│ id (PK)         │
│ customerId (FK) │
│ type            │  ← EARNED, REDEEMED, EXPIRED, ADJUSTED, BONUS
│ points          │
│ balanceBefore   │
│ balanceAfter    │
│ description     │
│ source          │  ← ORDER, REFERRAL, BIRTHDAY, MANUAL, etc.
│ shopifyOrderId  │
└─────────────────┘
```

### Key Models

#### Shop (`prisma/schema.prisma:31-51`)
- **Purpose**: Represents a Shopify store using the app
- **Key Fields**:
  - `shopifyDomain`: Unique Shopify domain (e.g., `store.myshopify.com`)
  - `accessToken`: Encrypted Shopify API access token
  - `billingPlan`: Subscription tier (default: "free")
  - `installedAt`, `uninstalledAt`: Lifecycle tracking
- **Indices**: `shopifyDomain`, `billingStatus`

#### LoyaltyProgram (`prisma/schema.prisma:53-93`)
- **Purpose**: Configuration for a shop's loyalty program
- **Key Fields**:
  - `pointsPerDollar`: Base earning rate (default: 1)
  - `welcomeBonus`, `referralBonus`, `birthdayBonus`: Bonus points
  - `tiersEnabled`, `referralsEnabled`, `expirationEnabled`: Feature flags
  - `primaryColor`, `secondaryColor`, `logoUrl`: Branding
  - `widgetPosition`: Where to display loyalty widget
- **Relations**: One-to-one with Shop, one-to-many with Tiers, Rewards, Campaigns

#### Customer (`prisma/schema.prisma:95-138`)
- **Purpose**: Loyalty program member
- **Key Fields**:
  - `shopifyCustomerId`: Shopify's customer ID (for sync)
  - `pointsBalance`: Current available points
  - `lifetimePoints`: Total points ever earned (for tier qualification)
  - `lifetimeSpent`: Total money spent (Decimal)
  - `currentTierId`: Current tier level (nullable)
  - `referralCode`: Unique code for referrals (auto-generated)
  - `referredById`: Self-referential for referral tracking
- **Indices**: 
  - `[shopId, shopifyCustomerId]` (unique)
  - `email`, `referralCode`
  - `[shopId, pointsBalance]`, `[shopId, lifetimePoints]` (for leaderboards)
  - `[shopId, lastActivityAt]` (for engagement queries)

#### Transaction (`prisma/schema.prisma:140-171`)
- **Purpose**: Immutable audit log of all point changes
- **Key Fields**:
  - `type`: EARNED, REDEEMED, EXPIRED, ADJUSTED, BONUS
  - `points`: Amount (positive for earning, negative for redemption)
  - `balanceBefore`, `balanceAfter`: Snapshot for audit
  - `source`: ORDER, REFERRAL, BIRTHDAY, MANUAL, TIER_UPGRADE, etc.
  - `shopifyOrderId`, `shopifyOrderNumber`: Link to Shopify order
  - `metadata`: JSON for additional context
  - `expiresAt`: For point expiration (if enabled)
- **Indices**: 
  - `[customerId, createdAt]` (customer history)
  - `[shopId, type, createdAt]` (analytics)
  - `shopifyOrderId` (order lookup)

#### Reward (`prisma/schema.prisma:174-206`)
- **Purpose**: Redeemable items in the loyalty catalog
- **Key Fields**:
  - `pointsCost`: Points required to redeem
  - `rewardType`: FIXED_DISCOUNT, PERCENT_DISCOUNT, FREE_PRODUCT, FREE_SHIPPING, CUSTOM
  - `rewardValue`: JSON with type-specific data (e.g., `{amount: 10}` or `{percent: 20}`)
  - `usageLimit`: Total redemptions allowed (nullable)
  - `perCustomerLimit`: Per-customer redemptions allowed (nullable)
  - `minimumPurchase`: Minimum order value required (Decimal, nullable)
  - `totalRedemptions`: Usage counter
- **Indices**: `[programId, active]`

#### Tier (`prisma/schema.prisma:208-234`)
- **Purpose**: Membership levels with benefits
- **Key Fields**:
  - `level`: Numeric level (1, 2, 3, etc.)
  - `requiredPoints`: Lifetime points needed to qualify
  - `pointsMultiplier`: Earning rate multiplier (e.g., 1.5x)
  - `perks`: Array of perk descriptions
  - `freeShipping`, `birthdayMultiplier`: Specific benefits
- **Indices**: `[programId, level]` (unique), `[programId, requiredPoints]`

#### WebhookEvent (`prisma/schema.prisma:272-290`)
- **Purpose**: Queue and audit log for Shopify webhooks
- **Key Fields**:
  - `eventType`: ORDERS_CREATE, CUSTOMERS_UPDATE, etc.
  - `eventId`: Shopify event ID (for deduplication)
  - `payload`: Full webhook payload (JSON)
  - `processed`: Boolean flag
  - `processingError`: Error message if failed (nullable)
  - `metadata`: Retry count and other metadata (JSON)
- **Unique Constraint**: `[shopId, eventId]` (prevents duplicate processing)
- **Indices**: `[processed, createdAt]` (for batch processing)

### Database Optimization

**Performance Indices** (from `prisma/schema.prisma`):
- Customer queries: `[shopId, lifetimePoints]`, `[shopId, lastActivityAt]` for dashboard analytics
- Transaction queries: `[shopId, type, createdAt]` for reporting
- Webhook processing: `[processed, createdAt]` for batch jobs
- Composite indices for complex filters

**Data Integrity**:
- Unique constraints on `[shopId, eventId]` for webhook idempotency
- Unique constraints on `[shopId, shopifyCustomerId]` for customer sync
- Cascade deletes on Tier → Customer, Reward → Redemption relationships

---

## Domain Services

### LoyaltyService

**Purpose**: Core business logic for loyalty points operations

**Key Operations**:

1. **earnPoints** (`app/services/LoyaltyService.ts:36-102`)
   - Validates input with `earnPointsSchema`
   - Uses Prisma transaction for atomicity:
     - Locks customer record (prevents race conditions)
     - Creates Transaction record with balances
     - Updates Customer.pointsBalance and lifetimePoints
     - Calls `checkTierUpgrade()` automatically
   - Returns Transaction record

2. **redeemPoints** (`app/services/LoyaltyService.ts:107-156`)
   - Validates sufficient balance
   - Uses Prisma transaction:
     - Creates Transaction with negative points
     - Updates Customer.pointsBalance
   - Returns Transaction record

3. **calculateOrderPoints** (`app/services/LoyaltyService.ts:161-168`)
   - Formula: `Math.floor(orderTotal * pointsPerDollar * tierMultiplier)`
   - Pure function (no side effects)

4. **getCustomerStatus** (`app/services/LoyaltyService.ts:173-224`)
   - Fetches customer with tier, shop, program, recent transactions
   - Calculates progress to next tier
   - Returns comprehensive status object

5. **redeemReward** (`app/services/LoyaltyService.ts:286-354`)
   - Validates customer has sufficient points
   - Validates reward is active
   - Uses Prisma transaction:
     - Creates Redemption with discount code
     - Creates Transaction (REDEEMED type)
     - Updates Customer.pointsBalance
   - Generates unique discount code: `RED-{timestamp}-{nanoid(9)}`

6. **adjustPoints** (`app/services/LoyaltyService.ts:359-405`)
   - Admin function for manual adjustments
   - Prevents negative balance (clamps to 0)
   - Only increments lifetimePoints on positive adjustments
   - Records adminId in metadata

**Transaction Safety**:
- All point operations use `prisma.$transaction()` for ACID guarantees
- Customer records locked during updates to prevent race conditions
- Balance snapshots (balanceBefore, balanceAfter) for audit trail

### CustomerService

**Purpose**: Customer management and queries

**Key Operations**:
- `findByShopifyId()`: Find customer by Shopify customer ID
- `upsertCustomer()`: Create or update customer from Shopify data
- `updateCustomer()`: Update customer details
- Customer list queries with filtering and pagination

### WebhookProcessor

**Purpose**: Asynchronous processing of Shopify webhook events

**Processing Model**:
1. Webhook received → Store in `WebhookEvent` table (processed: false)
2. Return 200 OK immediately (fast response to Shopify)
3. Background job processes pending events in batches of 50
4. Mark as processed or store error for retry

**Key Operations**:

1. **processOrderCreated** (`app/services/WebhookProcessor.ts:88-167`)
   - Validates order is paid (`financial_status === 'paid'`)
   - Skips if no customer or program inactive
   - Finds or creates customer record
   - Calculates points with tier multiplier
   - Calls `LoyaltyService.earnPoints()`
   - Updates customer order count and lifetime spent

2. **processOrderCancelled** (`app/services/WebhookProcessor.ts:200-225`)
   - Finds original EARNED transaction by `shopifyOrderId`
   - Deducts points via `LoyaltyService.adjustPoints()`
   - Creates ADJUSTED transaction with negative points

3. **processCustomerCreated/Updated** (`app/services/WebhookProcessor.ts:230-288`)
   - Syncs customer data from Shopify
   - Upserts customer record with email, name, phone, birthday

4. **retryFailedWebhooks** (`app/services/WebhookProcessor.ts:293-327`)
   - Finds failed events from last 24 hours
   - Retries up to 3 times (stored in metadata.retryCount)
   - Simple retry logic (could be enhanced with exponential backoff)

**Idempotency**:
- `WebhookEvent` has unique constraint on `[shopId, eventId]`
- Duplicate webhooks from Shopify are rejected at database level
- Order processing checks for existing Transaction by `shopifyOrderId`

---

## Cross-Cutting Concerns

### Validation (Zod)

**Location**: `app/lib/validation.ts`

**Schemas**:
- `earnPointsSchema`: Validates shopId, customerId, points (1-1000000), source, description
- `redeemPointsSchema`: Validates customerId, points (positive), description
- `adjustPointsSchema`: Validates customerId, points, reason
- `customerQuerySchema`: Validates pagination, filters, sorting
- `loyaltyStatusParamsSchema`: Validates customerId parameter
- `shopDomainSchema`: Validates Shopify domain format

**Usage Pattern**:
```typescript
import { validateRequestBody, earnPointsSchema } from "../lib/validation";

const validatedData = validateRequestBody(earnPointsSchema, requestBody);
// Throws ValidationError if invalid
```

### Caching (Redis)

**Location**: `app/lib/cache.server.ts`

**Implementation**:
- Graceful degradation: Returns null if Redis unavailable
- Lazy connection with retry logic (3 retries per request)
- JSON serialization for all cached values

**Cache Keys** (`CacheKeys` object, lines 111-118):
```typescript
CacheKeys.customerStatus(customerId)      // "customer_status:{id}"
CacheKeys.shopProgram(shopId)             // "shop_program:{id}"
CacheKeys.customersByShop(shopId, filters)// "customers:{id}:{filters}"
CacheKeys.dashboardAnalytics(shopId)      // "dashboard:{id}"
CacheKeys.rewardsByProgram(programId)     // "rewards:{id}"
CacheKeys.tiersByProgram(programId)       // "tiers:{id}"
```

**TTLs** (verified from code, lines 121-127):
- `CUSTOMER_STATUS`: 300s (5 minutes)
- `SHOP_PROGRAM`: 3600s (1 hour)
- `DASHBOARD_ANALYTICS`: 600s (10 minutes)
- `REWARDS`: 1800s (30 minutes)
- `TIERS`: 3600s (1 hour)

**Invalidation Patterns**:
- `cache.del(key)`: Delete single key
- `cache.invalidatePattern(pattern)`: Delete all keys matching pattern (e.g., `customer_status:*`)
- Invalidate on mutations (e.g., after earning/redeeming points, invalidate customer status)

**Usage Pattern**:
```typescript
import { cache, CacheKeys, CacheTTL } from "../lib/cache.server";

// Manual caching
const status = await cache.get(CacheKeys.customerStatus(customerId));
if (!status) {
  const freshStatus = await fetchStatus();
  await cache.set(CacheKeys.customerStatus(customerId), freshStatus, CacheTTL.CUSTOMER_STATUS);
}

// Wrapper function
const status = await cache.cached(
  CacheKeys.customerStatus(customerId),
  () => fetchStatus(),
  CacheTTL.CUSTOMER_STATUS
);
```

### Rate Limiting

**Location**: `app/lib/rateLimit.server.ts`

**Implementation**:
- Sliding window algorithm using Redis
- Window key includes timestamp: `{key}:{windowStart}`
- TTL set to window duration

**Rate Limiters** (verified from code, lines 34-62):

| Limiter | Window | Max Requests | Key Pattern |
|---------|--------|--------------|-------------|
| `rateLimiters.public` | 60s | 100 | `rate_limit:public:{shopDomain}` |
| `rateLimiters.admin` | 60s | 1000 | `rate_limit:admin:{shopDomain}` |
| `rateLimiters.webhooks` | 1s | 100 | `rate_limit:webhook:{shopDomain}` |
| `rateLimiters.redemption` | 60s | 10 | `rate_limit:redemption:{customerId}` |

**Usage Pattern**:
```typescript
import { rateLimiters, withRateLimit } from "../lib/rateLimit.server";

// In route loader/action
export const action = async ({ request }) => {
  const { shop } = await authenticate.admin(request);
  
  return withRateLimit(
    rateLimiters.admin,
    shop,
    async () => {
      // Your logic here
      return json({ success: true });
    }
  );
};

// Or manual check
await rateLimiters.public.checkLimit(shopDomain);
// Throws RateLimitError if exceeded
```

### Error Handling

**Location**: `app/lib/errors.ts`

**Error Hierarchy**:
```typescript
LoyaltyAppError (base)
├── ValidationError (400)
├── InsufficientPointsError (400)
├── NotFoundError (404)
└── RateLimitError (429)
```

**Usage Pattern**:
```typescript
import { InsufficientPointsError } from "../lib/errors";

if (customer.pointsBalance < pointsCost) {
  throw new InsufficientPointsError(pointsCost, customer.pointsBalance);
}

// In route handler
try {
  await service.operation();
} catch (error) {
  if (error instanceof ValidationError) {
    return json({ error: error.message }, { status: 400 });
  }
  if (error instanceof InsufficientPointsError) {
    return json({ 
      error: error.message,
      required: error.required,
      available: error.available
    }, { status: 400 });
  }
  throw error; // Re-throw unexpected errors
}
```

### Security

**Location**: `app/lib/security.server.ts`

**Key Features**:

1. **Webhook Signature Validation** (lines 48-64)
   ```typescript
   validateWebhookSignature(body, signature, secret)
   // HMAC-SHA256 validation with base64 encoding
   ```
   - **Note**: Shopify SDK (`authenticate.webhook()`) handles this automatically
   - Manual validation available for custom webhook endpoints

2. **App Proxy Signature Validation** (lines 15-43)
   ```typescript
   validateAppProxySignature(queryString, signature, secret)
   // HMAC-SHA256 validation with sorted parameters
   ```

3. **Input Sanitization** (lines 69-93)
   - Removes `<script>` tags
   - Removes `javascript:` protocol
   - Removes inline event handlers (`onclick=`, etc.)
   - Recursively sanitizes objects and arrays

4. **Security Headers** (lines 98-132)
   - Content Security Policy (CSP) for Shopify embedded apps
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Strict-Transport-Security (HSTS)
   - CORS headers (when origin provided)

5. **Validators** (lines 173-195)
   - Email: RFC-compliant regex, max 254 chars
   - Shopify domain: `*.myshopify.com` format
   - Customer ID: Numeric, max 20 chars
   - Points: Integer, 0-1000000
   - Amount: Finite number, 0-1000000

6. **Token Generation** (lines 233-235)
   - Cryptographically secure random tokens
   - Uses `crypto.randomBytes()`

7. **Sensitive Data Hashing** (lines 240-257)
   - PBKDF2 with SHA-512
   - 10,000 iterations
   - Random salt per hash
   - Format: `{salt}:{hash}`

### Monitoring

**Location**: `app/lib/monitoring.server.ts`

**Features**:
- Sentry integration for error tracking
- Performance monitoring
- Custom event tracking
- Request context capture

---

## Shopify Integration

### Authentication & Sessions

**Configuration**: `app/shopify.server.ts:45-110`

**OAuth Flow**:
1. Merchant installs app from Shopify App Store
2. Shopify redirects to `/auth` with shop parameter
3. App initiates OAuth flow (handled by Shopify SDK)
4. Merchant grants permissions (scopes)
5. App receives access token
6. `afterAuth` hook creates/updates Shop record (lines 92-108)
7. Session stored in database via PrismaSessionStorage

**Session Storage**:
- Backend: PostgreSQL via Prisma
- Model: `Session` (prisma/schema.prisma:13-29)
- Configuration: 5 connection retries, 2s retry interval
- Singleton pattern in development (globalThis cache)

**Scopes Required**:
- `read_products`, `write_products`: For reward product management
- `read_customers`, `write_customers`: For customer sync
- `read_orders`, `write_orders`: For point earning on orders

### Webhooks

**Registration**: `app/shopify.server.ts:65-90`

All webhooks use `DeliveryMethod.Http` with callback URL `/webhooks`:

| Topic | Purpose |
|-------|---------|
| `APP_UNINSTALLED` | Mark shop as uninstalled |
| `ORDERS_CREATE` | Award points for new orders |
| `ORDERS_UPDATED` | Handle payment status changes |
| `ORDERS_CANCELLED` | Deduct points for cancelled orders |
| `CUSTOMERS_CREATE` | Sync new customers |
| `CUSTOMERS_UPDATE` | Sync customer data changes |

**Webhook Handler**: `app/routes/webhooks.tsx`

**Processing Flow**:
1. Shopify sends webhook with HMAC signature
2. `authenticate.webhook(request)` validates signature (automatic)
3. Handler creates `WebhookEvent` record (processed: false)
4. Returns 200 OK immediately (< 5s response time required by Shopify)
5. Background job (`WebhookProcessor`) processes events asynchronously
6. Failed events stored with error message for retry

**Security**:
- HMAC-SHA256 signature validation (automatic via Shopify SDK)
- Signature in `X-Shopify-Hmac-Sha256` header
- Secret from `SHOPIFY_API_SECRET` environment variable

### UI Extensions

#### 1. Checkout Extension

**Location**: `extensions/loyco-checkout-extension/`

**Configuration** (`shopify.extension.toml`):
- API Version: 2025-10
- Type: `ui_extension`
- Target: `purchase.checkout.block.render`
- Module: `./src/Checkout.jsx`
- Capabilities: Storefront API access

**Purpose**:
- Display points that will be earned on current order
- Show current points balance
- Promote loyalty program enrollment

**API Calls**:
- Fetches customer status from storefront API
- Calculates points based on cart total

#### 2. Customer Account Extension

**Location**: `extensions/loyco-customer-account/`

**Configuration** (`shopify.extension.toml`):
- API Version: 2025-10
- Type: `ui_extension`
- Target: `customer-account.order-status.block.render`
- Module: `./src/OrderStatusBlock.jsx`
- Capabilities: Storefront API access

**Purpose**:
- Show points earned on completed order
- Display updated points balance
- Link to loyalty program dashboard

**API Calls**:
- Fetches order-specific transaction data
- Shows points earned for that order

#### 3. Theme Blocks

**Location**: `extensions/loyco-loyalty-blocks/`

**Configuration** (`shopify.extension.toml`):
- Type: `theme`
- Contains Liquid theme blocks

**Purpose**:
- Loyalty widget for theme integration
- Points display on product pages
- Rewards catalog display
- Customizable via theme editor

**Integration**:
- Merchants add blocks via theme customizer
- Blocks call app APIs for data
- Rendered server-side by Shopify

### App Embed

**Admin UI**: Embedded in Shopify admin using App Bridge

**Routes**:
- `/app` - Main app dashboard
- `/app/dashboard` - Analytics and overview
- `/app/setup` - Initial program configuration
- `/app/theme` - Theme integration settings

**UI Framework**: Shopify Polaris v12
- Consistent with Shopify admin design
- Accessible components
- Mobile-responsive

---

## Development Environment

### Prerequisites

- **Node.js**: 20.0.0 or higher (specified in `package.json:70-72`)
- **PostgreSQL**: Any recent version (Prisma compatible)
- **Redis**: Optional but recommended (graceful fallback if unavailable)
- **Shopify Partner Account**: For app credentials

### Environment Variables

**Required** (from `.env.example`):
```bash
# Shopify App Credentials
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app-url.com
SHOPIFY_SCOPES=read_products,write_products,read_customers,write_customers,read_orders,write_orders

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/loyco_rewards

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Node Environment
NODE_ENV=development
```

### Local Setup

1. **Clone and Install**:
   ```bash
   cd /home/ubuntu/repos/shopify-reward
   npm install
   ```

2. **Database Setup**:
   ```bash
   # Run migrations
   npm run db:migrate
   
   # Seed database (optional)
   npm run db:seed
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   # Runs on http://localhost:3000
   ```

4. **Run Tests**:
   ```bash
   npm test
   # Note: Tests currently fail due to Jest TypeScript config issue
   # This is a known issue on main branch
   ```

5. **Type Checking**:
   ```bash
   npm run typecheck
   ```

6. **Linting**:
   ```bash
   npm run lint
   ```

### Development Workflow

**Hot Reload**: Remix dev server watches for file changes and reloads automatically

**Database Changes**:
1. Edit `prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name your_migration_name`
3. Prisma generates TypeScript types automatically

**Adding a New Route**:
1. Create file in `app/routes/` following naming convention
2. Export `loader` (GET) or `action` (POST/PUT/DELETE) function
3. Add authentication if needed
4. Add validation with Zod schema
5. Call service layer for business logic
6. Return JSON or React component

**Testing Webhooks Locally**:
- Use Shopify CLI: `shopify app dev`
- Or use ngrok/cloudflare tunnel to expose localhost
- Configure webhook URLs in Shopify Partner Dashboard

### Known Issues

**Jest Test Failure** (as of 2025-10-30):
- Tests fail with: `SyntaxError: Unexpected token, expected "from"`
- Issue: Jest not handling TypeScript `import type` syntax
- Location: `app/routes/api.test.tsx:1`
- Status: Pre-existing on main branch
- Workaround: Configure Jest with proper TypeScript transform

**Redis Graceful Fallback**:
- App works without Redis but with degraded performance
- Cache operations return null if Redis unavailable
- Rate limiting may not work correctly without Redis

---

## Deployment and Operations

### Build Process

**Build Command**: `npm run build`
- Compiles Remix app to `build/` directory
- Generates server and client bundles
- Optimizes assets for production

**Build Output**:
- `build/index.js`: Server entry point
- `public/build/`: Client assets (JS, CSS)

### Server Runtime

**Entry Point**: `server.js`

**Server Configuration** (lines 38-79):
- Port: `process.env.PORT || 3000`
- Host: `0.0.0.0` (binds to all interfaces)
- Protocol handling: Respects `X-Forwarded-Proto` and `X-Forwarded-Host` headers
- Static file serving: `/build/` with 1-year cache
- Error handling: 500 responses with logging

**Environment Detection**:
- `NODE_ENV=production`: Production mode
- `NODE_ENV=development`: Development mode with hot reload

### Deployment Platforms

**Railway** (primary, based on `railway.toml`):
- Automatic deployments from Git
- Environment variables configured in Railway dashboard
- PostgreSQL and Redis add-ons available
- Health check endpoint: `/api/health`

**Configuration** (`railway.toml`):
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### CI/CD

**GitHub Actions** (`.github/workflows/`):
- **test**: Runs `npm test` (currently failing)
- **lint**: Runs `npm run lint`
- **typecheck**: Runs `npm run typecheck`
- **deploy**: Skipped if tests fail

**CI Checks**:
1. Install dependencies
2. Run tests (Jest)
3. Run linting (ESLint)
4. Run type checking (TypeScript)

### Monitoring

**Sentry Integration** (`sentry.config.js`):
- Error tracking in production
- Performance monitoring
- Release tracking
- Source maps for stack traces

**Health Check** (`app/routes/api.health.tsx`):
- Endpoint: `GET /api/health`
- Checks:
  - Database connectivity (Prisma)
  - Redis availability (optional)
- Returns: `{ status: "ok", timestamp, checks: {...} }`

### Database Migrations

**Production Migrations**:
```bash
npm run db:migrate
# Runs: npx prisma migrate deploy
```

**Migration Strategy**:
1. Test migrations in staging environment
2. Backup production database
3. Run migrations during low-traffic window
4. Verify data integrity
5. Monitor for errors

**Rollback Strategy**:
- Keep database backups before migrations
- Write reversible migrations when possible
- Test rollback procedures in staging

### Scaling Considerations

**Horizontal Scaling**:
- Stateless application (sessions in database)
- Redis shared across instances
- No in-memory state

**Database Optimization**:
- Connection pooling via Prisma
- Indices on frequently queried columns
- Caching for read-heavy operations

**Rate Limiting**:
- Redis-backed (shared across instances)
- Protects against traffic spikes
- Per-shop and per-customer limits

---

## Common Workflows

### 1. Add a New API Endpoint

**Example**: Add endpoint to get customer's referral stats

**Steps**:

1. **Create route file**: `app/routes/api.customer.$customerId.referrals.tsx`
   ```typescript
   import type { LoaderFunctionArgs } from "@remix-run/node";
   import { json } from "@remix-run/node";
   import { prisma } from "../lib/prisma.server";
   import { z } from "zod";
   
   const paramsSchema = z.object({
     customerId: z.string().min(1),
   });
   
   export const loader = async ({ params }: LoaderFunctionArgs) => {
     const { customerId } = paramsSchema.parse(params);
     
     const customer = await prisma.customer.findUnique({
       where: { id: customerId },
       include: {
         referrals: {
           select: {
             id: true,
             email: true,
             enrolledAt: true,
           },
         },
       },
     });
     
     if (!customer) {
       return json({ error: "Customer not found" }, { status: 404 });
     }
     
     return json({
       referralCode: customer.referralCode,
       totalReferrals: customer.referrals.length,
       referrals: customer.referrals,
     });
   };
   ```

2. **Add validation schema** (if complex): `app/lib/validation.ts`

3. **Add caching** (if needed):
   ```typescript
   import { cache, CacheKeys, CacheTTL } from "../lib/cache.server";
   
   const cacheKey = `customer_referrals:${customerId}`;
   const data = await cache.cached(
     cacheKey,
     () => fetchReferralData(),
     CacheTTL.CUSTOMER_STATUS
   );
   ```

4. **Add rate limiting** (if public):
   ```typescript
   import { rateLimiters } from "../lib/rateLimit.server";
   
   await rateLimiters.public.checkLimit(shopDomain);
   ```

5. **Test endpoint**:
   ```bash
   curl http://localhost:3000/api/customer/cust_123/referrals
   ```

### 2. Add a New Service Method

**Example**: Add method to award birthday bonus

**Steps**:

1. **Add method to service**: `app/services/LoyaltyService.ts`
   ```typescript
   async awardBirthdayBonus(customerId: string): Promise<Transaction> {
     const customer = await prisma.customer.findUnique({
       where: { id: customerId },
       include: { shop: { include: { loyaltyProgram: true } } },
     });
     
     if (!customer || !customer.shop.loyaltyProgram) {
       throw new NotFoundError("Customer or program not found");
     }
     
     const bonusPoints = customer.shop.loyaltyProgram.birthdayBonus;
     if (bonusPoints <= 0) {
       throw new Error("Birthday bonus not configured");
     }
     
     return this.earnPoints({
       shopId: customer.shopId,
       customerId: customer.id,
       points: bonusPoints,
       source: "BIRTHDAY",
       description: "Birthday bonus",
       metadata: { birthday: customer.birthday },
     });
   }
   ```

2. **Add validation** (if needed): Create Zod schema in `app/lib/validation.ts`

3. **Add tests**: `app/services/LoyaltyService.test.ts`

4. **Use in route or webhook handler**

### 3. Add a Database Field

**Example**: Add `lastPurchaseDate` to Customer model

**Steps**:

1. **Edit schema**: `prisma/schema.prisma`
   ```prisma
   model Customer {
     // ... existing fields
     lastPurchaseDate DateTime?
     // ... rest of model
   }
   ```

2. **Create migration**:
   ```bash
   npx prisma migrate dev --name add_last_purchase_date
   ```

3. **Update TypeScript types** (automatic after migration)

4. **Update service logic** to populate field:
   ```typescript
   // In WebhookProcessor.processOrderCreated()
   await prisma.customer.update({
     where: { id: customer.id },
     data: {
       lastPurchaseDate: new Date(),
       // ... other updates
     },
   });
   ```

5. **Add index** (if querying by this field):
   ```prisma
   model Customer {
     // ...
     @@index([shopId, lastPurchaseDate])
   }
   ```

6. **Create another migration** for index:
   ```bash
   npx prisma migrate dev --name add_last_purchase_date_index
   ```

### 4. Add a New Webhook Handler

**Example**: Handle product updates

**Steps**:

1. **Register webhook**: `app/shopify.server.ts`
   ```typescript
   webhooks: {
     // ... existing webhooks
     PRODUCTS_UPDATE: {
       deliveryMethod: DeliveryMethod.Http,
       callbackUrl: "/webhooks",
     },
   }
   ```

2. **Add handler**: `app/routes/webhooks.tsx`
   ```typescript
   switch (topic as string) {
     // ... existing cases
     case "PRODUCTS_UPDATE":
       await handleProductUpdated(shop, payload);
       break;
   }
   
   async function handleProductUpdated(shop: string, payload: any) {
     await prisma.webhookEvent.create({
       data: {
         shopId: shop,
         eventType: "PRODUCTS_UPDATE",
         eventId: payload.id.toString(),
         payload: payload as any,
         processed: false,
       },
     });
   }
   ```

3. **Add processor**: `app/services/WebhookProcessor.ts`
   ```typescript
   switch (event.eventType) {
     // ... existing cases
     case "PRODUCTS_UPDATE":
       await this.processProductUpdated(event);
       break;
   }
   
   private async processProductUpdated(event: WebhookEvent) {
     const productData = event.payload as any;
     // Your logic here
   }
   ```

4. **Test with Shopify CLI**:
   ```bash
   shopify webhook trigger PRODUCTS_UPDATE
   ```

### 5. Add a UI Extension Component

**Example**: Add points display to product page

**Steps**:

1. **Create extension** (if not exists):
   ```bash
   shopify app generate extension
   # Select "Theme app extension"
   ```

2. **Add block**: `extensions/loyco-loyalty-blocks/blocks/product-points.liquid`
   ```liquid
   {% schema %}
   {
     "name": "Product Points Display",
     "target": "section",
     "settings": [
       {
         "type": "text",
         "id": "heading",
         "label": "Heading",
         "default": "Earn Points"
       }
     ]
   }
   {% endschema %}
   
   <div class="loyco-product-points">
     <h3>{{ block.settings.heading }}</h3>
     <p>Earn <span class="points">{{ product.price | times: 1 }}</span> points</p>
   </div>
   ```

3. **Add JavaScript** (if needed): `extensions/loyco-loyalty-blocks/assets/product-points.js`

4. **Test in theme editor**:
   - Open theme customizer
   - Add block to product page
   - Configure settings

---

## Glossary

### Domain Terms

- **Points**: Virtual currency earned by customers for purchases and activities
- **Earn**: Action of receiving points (e.g., from a purchase)
- **Redeem**: Action of spending points for rewards
- **Redemption**: Record of a reward being redeemed
- **Reward**: Item in the loyalty catalog that can be redeemed for points
- **Tier**: Membership level with benefits (e.g., Bronze, Silver, Gold)
- **Tier Upgrade**: Automatic promotion to higher tier when reaching required lifetime points
- **Lifetime Points**: Total points ever earned (never decreases, used for tier qualification)
- **Points Balance**: Current available points (increases on earn, decreases on redeem)
- **Transaction**: Immutable record of a point change (EARNED, REDEEMED, ADJUSTED, etc.)
- **Campaign**: Time-limited promotion (e.g., double points weekend)
- **Referral**: Customer inviting another customer to join the program
- **Referral Code**: Unique code for tracking referrals

### Technical Terms

- **Remix**: Full-stack React framework with server-side rendering
- **Loader**: Remix function that runs on server for GET requests
- **Action**: Remix function that runs on server for POST/PUT/DELETE requests
- **Prisma**: TypeScript ORM for database access
- **Zod**: TypeScript-first schema validation library
- **Polaris**: Shopify's React component library for admin UI
- **App Bridge**: Shopify's library for embedded app communication
- **UI Extension**: Shopify extension that renders in storefront (checkout, customer account, theme)
- **Webhook**: HTTP callback from Shopify when events occur
- **HMAC**: Hash-based message authentication code (for webhook verification)
- **Session Storage**: Where Shopify stores OAuth tokens and session data
- **Embedded App**: App that runs inside Shopify admin iframe

### Shopify-Specific Terms

- **Shop**: A Shopify store
- **Shopify Domain**: Store's domain (e.g., `store.myshopify.com`)
- **Shopify Customer ID**: Shopify's internal customer identifier
- **Shopify Order ID**: Shopify's internal order identifier
- **Scopes**: OAuth permissions requested by app
- **App Proxy**: Shopify feature to proxy requests to app from storefront
- **Theme App Extension**: Extension that adds blocks to Shopify themes
- **Checkout Extension**: Extension that renders during checkout process
- **Customer Account Extension**: Extension in new customer account pages

---

## Key Files Reference

### Configuration
- `server.js` - Node.js HTTP server entry point
- `remix.config.js` - Remix framework configuration
- `tsconfig.json` - TypeScript compiler configuration
- `prisma/schema.prisma` - Database schema and models
- `.env.example` - Environment variables template

### Core Application
- `app/shopify.server.ts:45-110` - Shopify app configuration
- `app/root.tsx` - Root React component
- `app/routes/` - All route handlers (24 files)

### Business Logic
- `app/services/LoyaltyService.ts` - Points operations
- `app/services/CustomerService.ts` - Customer management
- `app/services/WebhookProcessor.ts` - Webhook processing

### Utilities
- `app/lib/validation.ts` - Zod schemas
- `app/lib/cache.server.ts:121-127` - Cache TTLs
- `app/lib/rateLimit.server.ts:34-62` - Rate limits
- `app/lib/security.server.ts:48-64` - Security utilities
- `app/lib/errors.ts` - Custom error types

### Extensions
- `extensions/loyco-checkout-extension/shopify.extension.toml` - Checkout config
- `extensions/loyco-customer-account/shopify.extension.toml` - Customer account config
- `extensions/loyco-loyalty-blocks/shopify.extension.toml` - Theme blocks config

### Documentation
- `ARCHITECTURE_IMPROVEMENTS.md` - Architecture improvements summary
- `TESTING.md` - Testing documentation
- `DEPLOYMENT.md` - Deployment guide
- `SHOPIFY_APP_SETUP.md` - Shopify app setup guide

---

## Additional Resources

- [Remix Documentation](https://remix.run/docs)
- [Shopify App Development](https://shopify.dev/docs/apps)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Shopify Polaris](https://polaris.shopify.com/)
- [Shopify UI Extensions](https://shopify.dev/docs/api/checkout-ui-extensions)

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-30  
**Maintained By**: Engineering Team

For questions or updates to this document, please open an issue or PR in the repository.
