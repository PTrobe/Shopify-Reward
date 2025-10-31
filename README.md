# Shopify-Reward

A Shopify embedded app for creating and managing customer loyalty programs. Merchants can reward customers with points for purchases, enable tiered memberships, and offer redeemable rewards.

## 📚 Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)** - Comprehensive architecture documentation for new engineers
- [Testing Guide](TESTING.md) - Testing documentation and guidelines
- [Deployment Guide](DEPLOYMENT.md) - Deployment instructions and configuration
- [Shopify App Setup](SHOPIFY_APP_SETUP.md) - Initial Shopify app configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 20.0.0 or higher
- PostgreSQL database
- Redis (optional, recommended for caching)
- Shopify Partner account

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data

## 🏗️ Tech Stack

- **Framework**: Remix v2 (React-based full-stack framework)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **UI**: Shopify Polaris (admin), Shopify UI Extensions (storefront)
- **Validation**: Zod
- **Monitoring**: Sentry

## 📖 Learn More

For a comprehensive understanding of the codebase architecture, request flows, data models, and development workflows, see the **[Architecture Guide](docs/ARCHITECTURE.md)**.
