# Loyco Loyalty System - Deployment Guide

## 🚀 Complete Deployment Checklist

This guide covers deploying the entire Loyco Loyalty system, including the Remix backend, Theme App Extensions, and UI Extensions.

## Prerequisites

- [ ] Shopify Partners account
- [ ] Railway account (for hosting)
- [ ] PostgreSQL database
- [ ] Redis instance
- [ ] Domain name (optional but recommended)
- [ ] Shopify CLI installed (`npm install -g @shopify/cli`)

## Phase 1: Backend Deployment

### 1.1 Environment Setup

Create production environment variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"
REDIS_URL="redis://username:password@host:port"

# Shopify App Credentials
SHOPIFY_API_KEY="your_api_key"
SHOPIFY_API_SECRET="your_api_secret"
SHOPIFY_SCOPES="write_products,write_customers,write_orders,write_checkouts,write_price_rules,write_discounts,write_themes,write_draft_orders"

# App URLs
SHOPIFY_APP_URL="https://your-app.railway.app"
SHOPIFY_WEBHOOK_SECRET="your_webhook_secret"

# Security
SESSION_SECRET="generate_a_strong_secret"
ENCRYPTION_KEY="generate_32_byte_encryption_key"

# Optional: Error tracking
SENTRY_DSN="your_sentry_dsn"
```

### 1.2 Database Setup

1. **Run Prisma migrations:**
   ```bash
   npm run db:migrate
   npm run db:seed  # Optional: seed with sample data
   ```

2. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

### 1.3 Railway Deployment

1. **Connect to Railway:**
   ```bash
   railway login
   railway link [project-id]
   ```

2. **Set environment variables:**
   ```bash
   railway variables:set DATABASE_URL="..."
   railway variables:set REDIS_URL="..."
   # ... add all environment variables
   ```

3. **Deploy:**
   ```bash
   railway up
   ```

4. **Verify deployment:**
   - Visit your Railway URL
   - Check logs: `railway logs`
   - Test health endpoint: `GET /health`

## Phase 2: Shopify App Setup

### 2.1 Create Shopify App

1. **In Shopify Partners Dashboard:**
   - Create new app
   - Set App URL: `https://your-app.railway.app`
   - Set Allowed redirection URLs:
     - `https://your-app.railway.app/auth/callback`
     - `https://your-app.railway.app/auth/shopify/callback`

2. **Configure App Proxy:**
   - Subpath prefix: `apps`
   - Subpath: `loyco-rewards`
   - URL: `https://your-app.railway.app`

3. **Set up webhooks:**
   - Orders create: `https://your-app.railway.app/webhooks`
   - Orders update: `https://your-app.railway.app/webhooks`
   - Orders cancelled: `https://your-app.railway.app/webhooks`
   - Customers create: `https://your-app.railway.app/webhooks`
   - Customers update: `https://your-app.railway.app/webhooks`
   - App uninstalled: `https://your-app.railway.app/webhooks`

### 2.2 Update App Configuration

Update `shopify.app.toml` with your production values:

```toml
name = "loyco-rewards"
client_id = "your_actual_client_id"
application_url = "https://your-app.railway.app"

[auth]
redirect_urls = [
  "https://your-app.railway.app/auth/callback",
  "https://your-app.railway.app/auth/shopify/callback",
]

[app_proxy]
url = "https://your-app.railway.app"
subpath = "apps/loyco-rewards"
prefix = "apps"
```

## Phase 3: Extensions Deployment

### 3.1 Theme App Extensions

1. **Build and deploy Theme App Extensions:**
   ```bash
   shopify app build
   shopify app deploy
   ```

2. **After deployment:**
   - Extensions will be available in store theme editor
   - Merchants can add loyalty blocks to their themes
   - Configure settings in theme customizer

### 3.2 Checkout UI Extension

1. **Deploy Checkout Extension:**
   ```bash
   cd extensions/loyco-checkout-extension
   shopify app deploy
   ```

2. **Configure in Partners Dashboard:**
   - Set extension as active
   - Configure display rules
   - Test in checkout

### 3.3 Customer Account UI Extension

1. **Deploy Customer Account Extension:**
   ```bash
   cd extensions/loyco-customer-account
   shopify app deploy
   ```

2. **Enable in new customer accounts:**
   - Available in Shopify's new customer account experience
   - Automatically appears for logged-in customers

## Phase 4: Testing & Verification

### 4.1 Backend Testing

```bash
# Run test suite
npm test

# Test API endpoints
curl -X GET "https://your-app.railway.app/health"
curl -X GET "https://your-app.railway.app/apps/loyco-rewards/api/program?shop=test-store.myshopify.com"
```

### 4.2 Extension Testing

1. **Theme App Extensions:**
   - Install on development store
   - Add blocks to theme in theme editor
   - Test all block types and settings
   - Verify App Proxy communication

2. **Checkout Extension:**
   - Create test orders
   - Verify points calculation
   - Test with different customer states

3. **Customer Account Extension:**
   - Log in as test customer
   - Verify loyalty data display
   - Test reward redemption flow

### 4.3 End-to-End Testing

```bash
# Test customer enrollment
curl -X POST "https://your-app.railway.app/apps/loyco-rewards/api/customer/enroll" \
  -H "Content-Type: application/json" \
  -d '{"shopifyCustomerId":"123","email":"test@example.com"}'

# Test points earning
curl -X POST "https://your-app.railway.app/apps/loyco-rewards/api/customer/123/earn" \
  -H "Content-Type: application/json" \
  -d '{"points":100,"activityType":"PURCHASE","description":"Test order"}'

# Test reward redemption
curl -X POST "https://your-app.railway.app/apps/loyco-rewards/api/customer/123/redeem" \
  -H "Content-Type: application/json" \
  -d '{"rewardId":"reward_123","quantity":1}'
```

## Phase 5: Store Installation

### 5.1 Install on Development Store

1. **Install app:**
   ```bash
   shopify app install
   ```

2. **Configure loyalty program:**
   - Set up tiers and rewards
   - Configure points earning rules
   - Enable features (referrals, welcome bonus)

3. **Add theme blocks:**
   - Open theme editor
   - Add loyalty blocks to desired pages
   - Configure block settings

### 5.2 Production Installation

1. **Submit for review (if public app):**
   - Complete app store listing
   - Provide documentation
   - Submit for Shopify review

2. **Direct installation (private app):**
   - Share installation URL with merchants
   - Provide setup documentation
   - Offer onboarding support

## Phase 6: Monitoring & Maintenance

### 6.1 Monitoring Setup

1. **Application monitoring:**
   - Railway logs: `railway logs --tail`
   - Database performance monitoring
   - Redis monitoring

2. **Error tracking:**
   - Configure Sentry for error reporting
   - Set up alerting for critical errors
   - Monitor API response times

3. **Business metrics:**
   - Track customer enrollments
   - Monitor reward redemptions
   - Analyze points earning patterns

### 6.2 Regular Maintenance

1. **Database maintenance:**
   - Regular backups
   - Performance optimization
   - Clean up old data

2. **Security updates:**
   - Keep dependencies updated
   - Monitor security advisories
   - Regular security audits

3. **Feature updates:**
   - Deploy new features
   - Update extensions
   - Monitor compatibility

## Troubleshooting

### Common Issues

1. **App Proxy not working:**
   - Check URL configuration
   - Verify signature validation
   - Check CORS headers

2. **Extensions not loading:**
   - Verify deployment status
   - Check API connectivity
   - Validate extension configuration

3. **Database connection issues:**
   - Check connection string
   - Verify network connectivity
   - Monitor connection pooling

4. **Authentication problems:**
   - Verify Shopify credentials
   - Check OAuth flow
   - Validate session handling

### Support Resources

- [Shopify App Development Documentation](https://shopify.dev/docs/apps)
- [Theme App Extensions Guide](https://shopify.dev/docs/apps/app-extensions/theme-app-extensions)
- [Checkout UI Extensions](https://shopify.dev/docs/apps/app-extensions/checkout-ui-extensions)
- [Railway Documentation](https://docs.railway.app/)

## Security Checklist

- [ ] Environment variables secured
- [ ] Database access restricted
- [ ] HTTPS enforced
- [ ] App Proxy signatures validated
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] Error handling secure
- [ ] Logging configured (without sensitive data)

## Performance Checklist

- [ ] Database queries optimized
- [ ] Caching strategy implemented
- [ ] API response times monitored
- [ ] Extension load times optimized
- [ ] Asset compression enabled
- [ ] CDN configured (if applicable)

## Compliance Checklist

- [ ] GDPR compliance implemented
- [ ] Privacy policy updated
- [ ] Data retention policies set
- [ ] Customer data export functionality
- [ ] Data deletion capabilities
- [ ] Terms of service reviewed

---

## 🎉 Deployment Complete!

Your Loyco Loyalty system is now deployed and ready for production use. The system includes:

✅ **Backend API** - Robust Remix application with database and caching
✅ **Theme Extensions** - Native storefront integration blocks
✅ **Checkout Extension** - Loyalty information in checkout
✅ **Customer Account Extension** - Account dashboard integration
✅ **App Proxy Routes** - Secure theme-to-backend communication
✅ **Admin Dashboard** - Merchant management interface

For ongoing support and feature requests, refer to the project documentation and support channels.