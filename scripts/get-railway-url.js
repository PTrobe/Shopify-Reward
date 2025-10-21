#!/usr/bin/env node

/**
 * Helper script to get Railway application URL
 * Run this after deploying the main web service
 */

import { execSync } from 'child_process';

console.log('🚀 Getting Railway Application URL...\n');

try {
  // Try to get the current service domain
  const result = execSync('railway domain', { encoding: 'utf8' });

  if (result.includes('https://')) {
    const url = result.match(/https:\/\/[^\s]+/)?.[0];
    if (url && !url.includes('postgres')) {
      console.log('✅ Main Application URL found:');
      console.log(`   ${url}`);
      console.log('\n📋 Use this URL for:');
      console.log('   - SHOPIFY_APP_URL environment variable');
      console.log('   - Shopify App setup in Partners Dashboard');
    } else {
      console.log('⚠️  Found Postgres URL, need to switch to main web service');
      console.log('   Run: railway service [web-service-name]');
    }
  } else {
    console.log('❌ No domain found. Make sure your web service is deployed.');
  }
} catch (error) {
  console.log('❌ Error getting Railway domain:');
  console.log('   Make sure you\'re linked to the web service, not Postgres');
  console.log('   Run: railway service [web-service-name]');
}

console.log('\n📝 Next steps:');
console.log('1. Use this URL to create Shopify app in Partners Dashboard');
console.log('2. Get SHOPIFY_API_KEY and SHOPIFY_API_SECRET from Partners');
console.log('3. Set environment variables in Railway');