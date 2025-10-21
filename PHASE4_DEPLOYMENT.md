# 🚀 Phase 4: Complete Production Deployment Guide

## Overview

This guide will take you through the complete production deployment of the Loyco Loyalty System, from Railway setup to Shopify app store readiness.

## 📋 Pre-Deployment Checklist

- [ ] Railway account active
- [ ] Shopify Partners account created
- [ ] Domain name ready (optional)
- [ ] Database and Redis needs identified

---

## Part 1: Railway Infrastructure Setup

### Step 1: Access Your Railway Project

1. Go to [Railway Dashboard](https://railway.app)
2. Find your "Shopify-reward" project
3. You should see a Postgres service already running

### Step 2: Add Redis Service

1. In Railway Dashboard → "Shopify-reward" project
2. Click "Add Service"
3. Select "Database" → "Redis"
4. Name: "Redis"
5. Click "Deploy"

### Step 3: Verify Main App Service

Your main application should be deploying. If not:
1. Click "Add Service"
2. Select "GitHub Repo"
3. Connect your `Shopify-Reward` repository
4. Deploy

### Step 4: Get Service URLs

After deployment, note these URLs from each service:

**Main App Service:**
- Go to Settings → Networking
- Note the Railway-provided domain (e.g., `https://web-production-xxxx.up.railway.app`)

**Important:** This URL will be used for Shopify app configuration.

---

## Part 2: Railway Environment Configuration

### Step 5: Configure Main App Environment Variables

In Railway Dashboard → Main App Service → Variables, add:

```bash
# Shopify Configuration (will be filled after creating Shopify app)
SHOPIFY_API_KEY=temp_key
SHOPIFY_API_SECRET=temp_secret
SHOPIFY_APP_URL=https://your-railway-app-url.railway.app
SHOPIFY_SCOPES=write_products,write_customers,write_orders,write_checkouts,write_price_rules,write_discounts,write_themes,write_draft_orders

# Database Connection (link to Postgres service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis Connection (link to Redis service)
REDIS_URL=${{Redis.REDIS_URL}}

# Security
SESSION_SECRET=create-a-strong-random-string-here-at-least-32-characters
NODE_ENV=production

# Optional: Error Tracking
SENTRY_DSN=your_sentry_dsn_if_using
```

### Step 6: Test Railway Deployment

```bash
# In your local project directory
npm run verify
```

This will test:
- Environment variables
- Database connection
- Redis connection
- Health endpoint

---

## Part 3: Shopify App Creation

### Step 7: Create Shopify App in Partners Dashboard

1. Go to [Shopify Partners](https://partners.shopify.com)
2. Navigate to "Apps"
3. Click "Create app"

**App Configuration:**
- **App name:** "Loyco Loyalty Rewards"
- **App type:** "Public app" (for App Store distribution)

### Step 8: Configure App URLs

In App Setup → App setup:

```
App URL: https://your-railway-app-url.railway.app
Allowed redirection URLs:
  https://your-railway-app-url.railway.app/auth/callback
  https://your-railway-app-url.railway.app/auth/shopify/callback
```

### Step 9: Configure App Proxy

In App Setup → App proxy:

```
Status: ✅ Enabled
Subpath prefix: apps
Subpath: loyco-rewards
URL: https://your-railway-app-url.railway.app
```

### Step 10: Set App Permissions

In App Setup → App permissions, enable:

```
✅ read_products, write_products
✅ read_customers, write_customers
✅ read_orders, write_orders
✅ write_checkouts
✅ write_price_rules, write_discounts
✅ write_themes
✅ write_draft_orders
```

### Step 11: Configure Webhooks

In App Setup → Webhooks:

**Webhook URL:** `https://your-railway-app-url.railway.app/webhooks`

**Subscribe to:**
- `orders/create`
- `orders/updated`
- `orders/cancelled`
- `customers/create`
- `customers/update`
- `app/uninstalled`

### Step 12: Get API Credentials

After saving app configuration:
1. Go to App Setup → Overview
2. Copy your **API key** and **API secret key**

---

## Part 4: Update Railway Configuration

### Step 13: Update Environment Variables

Return to Railway → Main App Service → Variables:

Update these values with your real Shopify credentials:

```bash
SHOPIFY_API_KEY=your_real_api_key_from_step_12
SHOPIFY_API_SECRET=your_real_api_secret_from_step_12
```

### Step 14: Deploy Database Schema

```bash
# Connect to Railway and run migrations
railway shell
npm run db:migrate

# Optional: Add sample data
npm run db:seed
```

### Step 15: Verify Production Setup

```bash
npm run verify
```

All checks should now pass! ✅

---

## Part 5: Extension Deployment

### Step 16: Update Shopify App Configuration

Update your local `shopify.app.toml`:

```toml
client_id = "your_real_api_key"
application_url = "https://your-railway-app-url.railway.app"

[auth]
redirect_urls = [
  "https://your-railway-app-url.railway.app/auth/callback",
  "https://your-railway-app-url.railway.app/auth/shopify/callback"
]

[app_proxy]
url = "https://your-railway-app-url.railway.app"
subpath = "apps/loyco-rewards"
prefix = "apps"
```

### Step 17: Deploy Theme App Extensions

```bash
# Build and deploy all extensions
shopify app build
shopify app deploy

# Follow prompts to deploy:
# - Theme App Extensions
# - Checkout UI Extensions
# - Customer Account UI Extensions
```

### Step 18: Test App Installation

1. In Partners Dashboard → Your app
2. Click "Test on development store"
3. Select a development store
4. Install the app
5. Test basic functionality

---

## Part 6: Production Testing

### Step 19: Test Theme Integration

1. In your development store admin
2. Go to Online Store → Themes → Customize
3. Add loyalty blocks to your theme:
   - Add "Customer Loyalty Status" to appropriate pages
   - Add "Product Points Indicator" to product pages
   - Add "Available Rewards" to customer account
   - Add "Cart Summary" to cart page
   - Add "Header Widget" to header

### Step 20: Test App Proxy Routes

```bash
# Test program endpoint
curl "https://your-store.myshopify.com/apps/loyco-rewards/api/program"

# Test customer status (need real customer ID)
curl "https://your-store.myshopify.com/apps/loyco-rewards/api/customer/12345/status"
```

### Step 21: End-to-End Testing

1. **Customer Enrollment:** Register new customer → should auto-enroll
2. **Points Earning:** Place test order → should award points
3. **Tier Progress:** Check tier advancement
4. **Reward Redemption:** Redeem a test reward
5. **Theme Integration:** Verify all blocks display correctly
6. **Mobile Testing:** Test on mobile devices

---

## Part 7: Production Readiness

### Step 22: Performance Optimization

```bash
# Monitor app performance
railway logs --tail

# Check database query performance
# Optimize slow queries if needed
```

### Step 23: Security Review

- [ ] All environment variables secured
- [ ] Database access restricted
- [ ] App Proxy signatures validated
- [ ] Rate limiting working
- [ ] Error handling secure

### Step 24: Monitoring Setup

- [ ] Error tracking configured (Sentry)
- [ ] Performance monitoring active
- [ ] Database backup strategy
- [ ] Uptime monitoring

---

## 🎯 Success Criteria

### Technical Validation
- [ ] Railway services all running
- [ ] Database migrations completed
- [ ] App starts without errors
- [ ] Health endpoint responding
- [ ] All environment variables set

### Shopify Integration
- [ ] App installs successfully
- [ ] App Proxy routes working
- [ ] Theme blocks display correctly
- [ ] Checkout extension showing
- [ ] Customer account integration working
- [ ] Webhooks receiving events

### Business Logic
- [ ] Customer enrollment working
- [ ] Points earning on orders
- [ ] Tier progression functioning
- [ ] Reward redemption working
- [ ] Referral system operational
- [ ] Admin dashboard accessible

---

## 🚨 Troubleshooting

### Common Issues

**App won't start:**
```bash
railway logs
# Check for missing environment variables
# Verify database connectivity
```

**Extensions not loading:**
```bash
shopify app list
# Verify deployment status
```

**App Proxy not working:**
- Check subpath configuration
- Verify CORS headers
- Test signature validation

### Quick Fixes

```bash
# Restart all services
railway redeploy

# Rebuild and redeploy extensions
shopify app build && shopify app deploy

# Reset database (⚠️ DESTRUCTIVE)
railway run npx prisma migrate reset
```

---

## 🎉 Deployment Complete!

Once all steps are completed, you have:

✅ **Production Shopify App** ready for stores
✅ **Scalable Railway Infrastructure**
✅ **Native Theme Integration** with 5 blocks
✅ **Checkout & Account Extensions**
✅ **Complete Backend API** with all features
✅ **Admin Dashboard** for merchants
✅ **Monitoring & Error Tracking**

**Your Loyco Loyalty System is now live and ready to compete with Smile.io!** 🚀

### Next Steps
1. **App Store Submission** (if going public)
2. **Marketing & Documentation**
3. **Customer Onboarding**
4. **Feature Iteration based on feedback**

---

**Need help?** Refer to:
- `RAILWAY_SETUP.md` - Railway configuration details
- `SHOPIFY_APP_SETUP.md` - Shopify app details
- `DEPLOYMENT.md` - Complete deployment reference
- `TESTING.md` - Testing strategies