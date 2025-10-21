import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "../lib/prisma.server";
import { cache } from "../lib/cache.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const startTime = Date.now();

  try {
    // Test database connection
    const dbTest = await prisma.$queryRaw`SELECT 1 as test`;
    const dbTime = Date.now() - startTime;

    // Test cache connection
    const cacheStartTime = Date.now();
    await cache.set('health_check', { test: true }, 10);
    const cached = await cache.get('health_check');
    const cacheTime = Date.now() - cacheStartTime;

    // Get some basic stats
    const [shopCount, customerCount] = await Promise.all([
      prisma.shop.count(),
      prisma.customer.count()
    ]);

    return json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      services: {
        database: {
          status: 'connected',
          responseTime: `${dbTime}ms`
        },
        cache: {
          status: cached ? 'connected' : 'degraded',
          responseTime: `${cacheTime}ms`
        }
      },
      stats: {
        shops: shopCount,
        customers: customerCount
      },
      totalResponseTime: `${Date.now() - startTime}ms`
    });

  } catch (error) {
    console.error('Health check failed:', error);

    return json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${Date.now() - startTime}ms`
    }, { status: 500 });
  }
};