#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Checks that all required services and configurations are working
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = (color, symbol, message) => {
  console.log(`${color}${symbol} ${message}${colors.reset}`);
};

const success = (message) => log(colors.green, '✅', message);
const error = (message) => log(colors.red, '❌', message);
const warning = (message) => log(colors.yellow, '⚠️ ', message);
const info = (message) => log(colors.blue, 'ℹ️ ', message);

async function verifyEnvironment() {
  console.log('\n🔍 Verifying Environment Configuration...\n');

  const required = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL',
    'DATABASE_URL',
    'SESSION_SECRET'
  ];

  const optional = [
    'REDIS_URL',
    'SENTRY_DSN',
    'SHOPIFY_SCOPES'
  ];

  // Check required variables
  let missingRequired = [];
  required.forEach(variable => {
    if (process.env[variable]) {
      success(`${variable} is set`);
    } else {
      error(`${variable} is missing`);
      missingRequired.push(variable);
    }
  });

  // Check optional variables
  optional.forEach(variable => {
    if (process.env[variable]) {
      success(`${variable} is set`);
    } else {
      warning(`${variable} is not set (optional)`);
    }
  });

  return missingRequired.length === 0;
}

async function verifyDatabase() {
  console.log('\n🗄️  Verifying Database Connection...\n');

  if (!process.env.DATABASE_URL) {
    error('DATABASE_URL not set, skipping database verification');
    return false;
  }

  try {
    const prisma = new PrismaClient();

    // Test basic connection
    await prisma.$connect();
    success('Database connection established');

    // Test if tables exist
    try {
      const shops = await prisma.shop.findMany({ take: 1 });
      success('Database tables accessible');
    } catch (err) {
      warning('Database tables not found - run migrations: npx prisma migrate deploy');
    }

    await prisma.$disconnect();
    return true;
  } catch (err) {
    error(`Database connection failed: ${err.message}`);
    return false;
  }
}

async function verifyRedis() {
  console.log('\n🔴 Verifying Redis Connection...\n');

  if (!process.env.REDIS_URL) {
    warning('REDIS_URL not set, skipping Redis verification');
    return false;
  }

  try {
    const redis = new Redis(process.env.REDIS_URL);

    // Test connection
    await redis.set('test:deployment', 'verification');
    const result = await redis.get('test:deployment');

    if (result === 'verification') {
      success('Redis connection and read/write working');
    } else {
      error('Redis read/write test failed');
      return false;
    }

    // Cleanup
    await redis.del('test:deployment');
    await redis.disconnect();

    return true;
  } catch (err) {
    error(`Redis connection failed: ${err.message}`);
    return false;
  }
}

async function verifyShopifyConfig() {
  console.log('\n🛍️  Verifying Shopify Configuration...\n');

  const appUrl = process.env.SHOPIFY_APP_URL;

  if (!appUrl) {
    error('SHOPIFY_APP_URL not set');
    return false;
  }

  try {
    // Validate URL format
    const url = new URL(appUrl);

    if (url.protocol !== 'https:') {
      error('SHOPIFY_APP_URL must use HTTPS');
      return false;
    }

    success(`App URL format valid: ${appUrl}`);

    // Test health endpoint
    try {
      const response = await fetch(`${appUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        success(`Health endpoint responding: ${data.status}`);
      } else {
        warning(`Health endpoint returned status: ${response.status}`);
      }
    } catch (err) {
      warning('Could not test health endpoint (app may not be deployed yet)');
    }

    return true;
  } catch (err) {
    error(`Invalid SHOPIFY_APP_URL: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Loyco Loyalty System - Deployment Verification\n');
  console.log('================================================\n');

  const results = await Promise.allSettled([
    verifyEnvironment(),
    verifyDatabase(),
    verifyRedis(),
    verifyShopifyConfig()
  ]);

  const [envResult, dbResult, redisResult, shopifyResult] = results;

  console.log('\n📊 Verification Summary\n');
  console.log('=====================\n');

  if (envResult.status === 'fulfilled' && envResult.value) {
    success('Environment variables');
  } else {
    error('Environment variables');
  }

  if (dbResult.status === 'fulfilled' && dbResult.value) {
    success('Database connection');
  } else {
    error('Database connection');
  }

  if (redisResult.status === 'fulfilled' && redisResult.value) {
    success('Redis connection');
  } else {
    warning('Redis connection (optional but recommended)');
  }

  if (shopifyResult.status === 'fulfilled' && shopifyResult.value) {
    success('Shopify configuration');
  } else {
    error('Shopify configuration');
  }

  const allPassed = results.every(result =>
    result.status === 'fulfilled' && result.value !== false
  );

  console.log('\n' + '='.repeat(50));

  if (allPassed) {
    success('All verifications passed! 🎉');
    console.log('\n✅ Ready to proceed with Shopify app creation and extension deployment!');
  } else {
    error('Some verifications failed');
    console.log('\n❌ Please fix the issues above before proceeding.');
    console.log('\nFor help, see:');
    console.log('- RAILWAY_SETUP.md for Railway configuration');
    console.log('- SHOPIFY_APP_SETUP.md for Shopify app creation');
  }

  process.exit(allPassed ? 0 : 1);
}

// Handle errors
process.on('unhandledRejection', (err) => {
  error(`Unhandled error: ${err.message}`);
  process.exit(1);
});

main().catch(err => {
  error(`Verification failed: ${err.message}`);
  process.exit(1);
});