#!/usr/bin/env node

console.log("=== Build Debug Script ===");
console.log("Current working directory:", process.cwd());
console.log("NODE_ENV:", process.env.NODE_ENV);

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

// Check if directories exist
const directories = [
  './build',
  './public',
  './public/build',
];

console.log("\n=== Directory Check ===");
directories.forEach(dir => {
  const exists = existsSync(dir);
  console.log(`${dir}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);

  if (exists) {
    try {
      const files = readdirSync(dir);
      console.log(`  Files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''} (${files.length} total)`);
    } catch (e) {
      console.log(`  Error reading: ${e.message}`);
    }
  }
});

// Look for specific client files
console.log("\n=== Client File Search ===");
const clientFiles = [
  './public/build/entry.client-EJODECXJ.js',
  './public/build/manifest-1426EB2E.js',
  './public/build/root-Y7PZHMLI.js',
];

clientFiles.forEach(file => {
  const exists = existsSync(file);
  console.log(`${file}: ${exists ? '✅ FOUND' : '❌ MISSING'}`);
});

console.log("\n=== Build Debug Complete ===");