# Railway Production Setup

## 🚀 Complete Railway Configuration for Loyco Loyalty System

### Step 1: Verify Services in Railway Dashboard

Go to your Railway project: `Shopify-reward`

**Required Services:**
1. ✅ **Postgres** (already created)
2. ⏳ **Redis** (need to add)
3. ⏳ **Main App** (deploying)

### Step 2: Add Redis Service

In Railway Dashboard:
1. Click "Add Service"
2. Select "Database" → "Redis"
3. Name it "Redis"
4. Deploy

### Step 3: Get Service URLs

**After deployment, note these URLs:**

1. **Main App URL:** `https://[app-name]-production-[id].up.railway.app`
2. **Postgres URL:** Already available in environment variables
3. **Redis URL:** Will be available after Redis service deployment

### Step 4: Configure Environment Variables

In Railway Dashboard → Main App Service → Variables:

```bash
# Shopify App Configuration (GET FROM PARTNERS DASHBOARD)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-main-app-url.railway.app
SHOPIFY_SCOPES=write_products,write_customers,write_orders,write_checkouts,write_price_rules,write_discounts,write_themes,write_draft_orders

# Database URLs (AUTO-SET BY RAILWAY)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Security & Session
SESSION_SECRET=generate-a-secure-random-string-here
NODE_ENV=production

# Optional: Monitoring
SENTRY_DSN=your_sentry_dsn_if_using
```

### Step 5: Link Services

Make sure the main app can access other services:
1. Go to Main App → Settings → Service Variables
2. Add references to Postgres and Redis
3. Use Railway's service linking: `${{Postgres.DATABASE_URL}}`

### Step 6: Deploy and Test

1. **Redeploy Main App** after setting variables
2. **Check Health:** `https://your-app-url.railway.app/health`
3. **Verify Logs** in Railway dashboard

### Step 7: Run Database Migrations

Once DATABASE_URL is working:

```bash
# Connect to Railway and run migrations
railway shell
npx prisma migrate deploy
npx prisma db seed  # Optional: add sample data
```

## 🔍 Verification Steps

### 1. Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2025-10-21T...",
  "version": "1.0.0",
  "environment": "production",
  "url": "https://your-app-url.railway.app"
}
```

### 2. Database Connection
```bash
railway connect Postgres
# Should connect to PostgreSQL
```

### 3. Redis Connection
```bash
railway connect Redis
# Should connect to Redis
```

### 4. App Proxy Test
```bash
curl "https://your-app-url.railway.app/apps/loyco-rewards/api/program?shop=test"
# Should return program data or error (not 404)
```

## 🚨 Troubleshooting

### App Won't Start
- Check Railway logs for specific errors
- Verify SHOPIFY_APP_URL is set correctly
- Ensure DATABASE_URL and REDIS_URL are accessible

### Database Connection Issues
- Verify Postgres service is running
- Check DATABASE_URL format
- Ensure migration ran successfully

### Redis Connection Issues
- Verify Redis service is running
- Check REDIS_URL format
- Test connection with Railway CLI

### Environment Variable Issues
- Use Railway service references: `${{ServiceName.VARIABLE}}`
- Don't hardcode URLs, let Railway auto-populate
- Check variable names match exactly

## 📋 Quick Commands

```bash
# Check project status
railway status

# View environment variables
railway variables

# Check logs
railway logs

# Connect to database
railway connect Postgres

# Run migrations
railway run npx prisma migrate deploy

# Restart service
railway redeploy
```

## 🎯 Success Criteria

- [ ] All 3 services running (App, Postgres, Redis)
- [ ] Environment variables properly set
- [ ] Database migrations completed
- [ ] Health endpoint responding
- [ ] App Proxy routes accessible
- [ ] No errors in Railway logs
- [ ] Ready for Shopify app creation

## 🔄 Next Steps

Once Railway is fully configured:
1. **Create Shopify App** in Partners Dashboard
2. **Update environment variables** with real API keys
3. **Deploy extensions** with Shopify CLI
4. **Test full integration**

---

**The Railway infrastructure should be solid before proceeding to Shopify app creation!**