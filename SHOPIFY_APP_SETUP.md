# Shopify App Setup Guide

## 🚀 Phase 4: Create Production Shopify App

Follow these steps to create the Shopify app in the Partners Dashboard and configure it with Railway.

## Step 1: Get Railway App URL

First, you need to get your Railway app URL. In your Railway dashboard:

1. Go to your "Shopify-reward" project
2. Select the main app service (not Postgres)
3. Go to "Settings" → "Domains"
4. Generate a Railway domain or note the existing one

**Expected URL format:** `https://shopify-reward-production-xxxx.up.railway.app`

## Step 2: Create Shopify App

### In Shopify Partners Dashboard:

1. **Go to Apps section** and click "Create app"

2. **Basic Information:**
   - App name: `Loyco Loyalty Rewards`
   - App type: `Public app` (for App Store) or `Custom app` (for specific stores)

3. **App URLs:**
   - App URL: `https://your-railway-url.railway.app`
   - Allowed redirection URLs:
     ```
     https://your-railway-url.railway.app/auth/callback
     https://your-railway-url.railway.app/auth/shopify/callback
     ```

4. **App Setup → Configuration:**
   - Embedded app: `Yes`
   - App bridge version: `Latest`

## Step 3: Configure App Proxy

### In App Setup → App proxy:

```
Status: Enabled
Subpath prefix: apps
Subpath: loyco-rewards
URL: https://your-railway-url.railway.app
```

This enables the URL pattern:
`https://store.myshopify.com/apps/loyco-rewards/api/*`

## Step 4: Set App Permissions

### In App Setup → App permissions:

**Required scopes:**
- `write_products` - Manage products for points calculation
- `write_customers` - Manage customer loyalty data
- `write_orders` - Process orders for points
- `write_checkouts` - Access checkout for extensions
- `write_price_rules` - Create discount codes
- `write_discounts` - Manage loyalty discounts
- `write_themes` - Theme app extensions
- `write_draft_orders` - Create draft orders for rewards

## Step 5: Configure Webhooks

### In App Setup → Webhooks:

**Webhook URL:** `https://your-railway-url.railway.app/webhooks`

**Required webhooks:**
- `orders/create` - Award points on purchase
- `orders/updated` - Update points on order changes
- `orders/cancelled` - Reverse points on cancellation
- `customers/create` - Auto-enroll new customers
- `customers/update` - Sync customer data
- `app/uninstalled` - Clean up on uninstall

## Step 6: Get API Credentials

After creating the app:

1. **Note down your credentials:**
   - API key: `Found in App Setup → Overview`
   - API secret: `Found in App Setup → Overview`

2. **Keep these secure** - you'll need them for Railway environment variables

## Step 7: Set Railway Environment Variables

In your Railway project, go to the main app service and add these variables:

```bash
# Shopify App Configuration
SHOPIFY_API_KEY=your_api_key_from_step_6
SHOPIFY_API_SECRET=your_api_secret_from_step_6
SHOPIFY_APP_URL=https://your-railway-url.railway.app
SHOPIFY_SCOPES=write_products,write_customers,write_orders,write_checkouts,write_price_rules,write_discounts,write_themes,write_draft_orders

# Database (should already be set)
DATABASE_URL=postgresql://... (from Postgres service)

# Session Security
SESSION_SECRET=generate_a_strong_random_string_here

# Optional: Error Tracking
SENTRY_DSN=your_sentry_dsn_if_using

# Production Environment
NODE_ENV=production
```

## Step 8: Add Redis Service

In Railway:
1. Click "Add Service"
2. Select "Redis"
3. Deploy Redis service
4. Copy the `REDIS_URL` to your main app service variables

## Step 9: Run Database Migrations

Once DATABASE_URL is set, run:

```bash
railway run npx prisma migrate deploy
```

## Step 10: Test the App

1. **Health Check:** Visit `https://your-railway-url.railway.app/health`
2. **Install App:** Use the installation URL from Partners Dashboard
3. **Test App Proxy:** Visit `https://test-store.myshopify.com/apps/loyco-rewards/api/program`

## 🎯 Verification Checklist

- [ ] Shopify app created in Partners Dashboard
- [ ] App URLs configured correctly
- [ ] App Proxy enabled and configured
- [ ] Required scopes granted
- [ ] Webhooks configured
- [ ] API credentials obtained
- [ ] Railway environment variables set
- [ ] Redis service added
- [ ] Database migrations run
- [ ] App installation tested
- [ ] Health check responds
- [ ] App Proxy routes working

## 🚀 Next Steps

Once this setup is complete:
1. Deploy Shopify extensions (`shopify app deploy`)
2. Test theme integration
3. Test checkout extensions
4. End-to-end functionality testing

## 📞 Troubleshooting

**App won't start:**
- Check Railway logs for specific errors
- Verify all environment variables are set
- Ensure DATABASE_URL and REDIS_URL are correct

**App Proxy not working:**
- Verify subpath configuration
- Check CORS headers in responses
- Ensure signature validation is working

**Extensions not loading:**
- Confirm extensions are deployed
- Check Shopify CLI deployment status
- Verify app has required permissions