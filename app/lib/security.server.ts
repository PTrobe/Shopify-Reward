import crypto from "crypto";
import { json } from "@remix-run/node";

/**
 * Security utilities for the Shopify app
 */

// Request size limits
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_JSON_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Validate Shopify app proxy request signature
 */
export function validateAppProxySignature(
  queryString: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Remove signature from query string
    const params = new URLSearchParams(queryString);
    params.delete('signature');
    params.delete('hmac');

    // Sort parameters and create query string
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // Generate HMAC
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(sortedParams)
      .digest('hex');

    return computedSignature === signature;
  } catch (error) {
    console.error('Error validating app proxy signature:', error);
    return false;
  }
}

/**
 * Validate Shopify webhook signature
 */
export function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');

    return computedSignature === signature;
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}

/**
 * Sanitize and validate input data
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potential XSS content
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      const sanitizedKey = sanitizeInput(key);
      sanitized[sanitizedKey] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}

/**
 * Security headers middleware
 */
export function getSecurityHeaders(origin?: string) {
  const headers: Record<string, string> = {
    // Basic security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://cdn.shopify.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.shopify.com wss://*.shopify.com",
      "frame-src 'self' https://*.shopify.com",
      "form-action 'self'",
      "base-uri 'self'"
    ].join('; '),

    // HSTS for HTTPS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };

  // CORS headers if origin is provided
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Shopify-Topic, X-Shopify-Hmac-Sha256';
    headers['Access-Control-Max-Age'] = '86400';
  }

  return headers;
}

/**
 * Rate limiting with token bucket algorithm
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  tryConsume(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  private refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Input validation utilities
 */
export const validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  },

  shopifyDomain: (domain: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.myshopify\.com$/;
    return domainRegex.test(domain) && domain.length <= 100;
  },

  customerId: (id: string): boolean => {
    return /^\d+$/.test(id) && id.length <= 20;
  },

  points: (points: number): boolean => {
    return Number.isInteger(points) && points >= 0 && points <= 1000000;
  },

  amount: (amount: number): boolean => {
    return Number.isFinite(amount) && amount >= 0 && amount <= 1000000;
  }
};

/**
 * Error response with security headers
 */
export function securityErrorResponse(
  message: string,
  status: number = 400,
  origin?: string
) {
  return json(
    {
      success: false,
      error: {
        message,
        code: 'SECURITY_ERROR'
      }
    },
    {
      status,
      headers: getSecurityHeaders(origin)
    }
  );
}

/**
 * Middleware to check request size
 */
export function validateRequestSize(contentLength?: string): boolean {
  if (!contentLength) return true;

  const size = parseInt(contentLength, 10);
  return !isNaN(size) && size <= MAX_REQUEST_SIZE;
}

/**
 * Generate secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data
 */
export function hashSensitiveData(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512');
  return `${actualSalt}:${hash.toString('hex')}`;
}

/**
 * Verify hashed data
 */
export function verifySensitiveData(data: string, hash: string): boolean {
  try {
    const [salt, originalHash] = hash.split(':');
    const newHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
    return originalHash === newHash.toString('hex');
  } catch (error) {
    return false;
  }
}

/**
 * Safe JSON parsing with size limit
 */
export function safeJsonParse<T>(jsonString: string): T | null {
  try {
    if (jsonString.length > MAX_JSON_SIZE) {
      throw new Error('JSON payload too large');
    }

    const parsed = JSON.parse(jsonString);
    return sanitizeInput(parsed);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return null;
  }
}