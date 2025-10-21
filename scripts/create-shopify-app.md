# Create Shopify App in Partners Dashboard

## Step 1: Access Partners Dashboard
1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Login with your Shopify Partners account
3. Navigate to "Apps" section

## Step 2: Create New App
1. Click "Create app"
2. Choose "Create app manually"
3. Fill in app details:
   - **App name**: "Loyco Loyalty Rewards"
   - **App URL**: `https://your-railway-app-url.up.railway.app` (get from Railway)
   - **Allowed redirection URL(s)**:
     - `https://your-railway-app-url.up.railway.app/auth/callback`
     - `https://your-railway-app-url.up.railway.app/auth/shopify/callback`

## Step 3: Configure App Settings
1. **App setup** tab:
   - **App URL**: Your Railway app URL
   - **Allowed redirection URL(s)**: Same as above
   - **Webhooks**: `https://your-railway-app-url.up.railway.app/webhooks`

2. **App distribution** tab:
   - Select "Private app" for testing
   - Can change to public later

## Step 4: Get API Credentials
1. In the app dashboard, go to "App setup"
2. Copy the **Client ID** (this is your `SHOPIFY_API_KEY`)
3. Copy the **Client secret** (this is your `SHOPIFY_API_SECRET`)

## Step 5: Generate Session Secret
Run this command to generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 6: Set Railway Environment Variables
Use these commands or Railway dashboard:
```bash
railway variables set SHOPIFY_API_KEY="your_client_id_here"
railway variables set SHOPIFY_API_SECRET="your_client_secret_here"
railway variables set SHOPIFY_APP_URL="https://your-railway-app-url.up.railway.app"
railway variables set SESSION_SECRET="your_generated_session_secret"
```

## Step 7: Configure App Proxy (for theme integration)
1. In Shopify Partners app dashboard, go to "App setup"
2. Scroll to "App proxy" section
3. Configure:
   - **Subpath prefix**: `apps`
   - **Subpath**: `loyco-loyalty`
   - **URL**: `https://your-railway-app-url.up.railway.app/app_proxy`

This allows themes to call: `https://yourstore.com/apps/loyco-loyalty/*`

## Next Steps After App Creation
1. Install app on development store
2. Test OAuth flow
3. Deploy theme extensions
4. Test end-to-end functionality