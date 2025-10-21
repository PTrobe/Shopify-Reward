import * as Sentry from "@sentry/remix";

/**
 * Comprehensive monitoring and logging system
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface LogContext {
  userId?: string;
  shopId?: string;
  customerId?: string;
  orderId?: string;
  transactionId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  timestamp?: Date;
  tags?: Record<string, string>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log a message with context
   */
  log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    // Console output in development
    if (this.isDevelopment) {
      const colorMap = {
        [LogLevel.DEBUG]: '\x1b[36m', // Cyan
        [LogLevel.INFO]: '\x1b[32m',  // Green
        [LogLevel.WARN]: '\x1b[33m',  // Yellow
        [LogLevel.ERROR]: '\x1b[31m', // Red
        [LogLevel.CRITICAL]: '\x1b[35m', // Magenta
      };

      console.log(
        `${colorMap[level]}[${level.toUpperCase()}] ${timestamp}\x1b[0m`,
        message,
        context ? JSON.stringify(context, null, 2) : '',
        error || ''
      );
    } else {
      // Structured JSON logging in production
      console.log(JSON.stringify(logEntry));
    }

    // Send to Sentry for errors and critical issues
    if (level === LogLevel.ERROR || level === LogLevel.CRITICAL) {
      Sentry.captureException(error || new Error(message), {
        level: level === LogLevel.CRITICAL ? 'fatal' : 'error',
        contexts: {
          loyaltyApp: context || {},
        },
      });
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext, error?: Error) {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  critical(message: string, context?: LogContext, error?: Error) {
    this.log(LogLevel.CRITICAL, message, context, error);
  }
}

class MetricsCollector {
  private metrics: MetricData[] = [];
  private batchSize = 100;
  private flushInterval = 60000; // 1 minute

  constructor() {
    // Flush metrics periodically
    if (typeof window === 'undefined') {
      setInterval(() => this.flush(), this.flushInterval);
    }
  }

  /**
   * Record a metric
   */
  record(metric: MetricData) {
    this.metrics.push({
      ...metric,
      timestamp: metric.timestamp || new Date(),
    });

    // Flush if batch size reached
    if (this.metrics.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Record a counter metric
   */
  counter(name: string, value: number = 1, tags?: Record<string, string>) {
    this.record({ name, value, unit: 'count', tags });
  }

  /**
   * Record a timing metric
   */
  timing(name: string, duration: number, tags?: Record<string, string>) {
    this.record({ name, value: duration, unit: 'ms', tags });
  }

  /**
   * Record a gauge metric
   */
  gauge(name: string, value: number, tags?: Record<string, string>) {
    this.record({ name, value, unit: 'gauge', tags });
  }

  /**
   * Flush metrics to external service
   */
  private flush() {
    if (this.metrics.length === 0) return;

    const metricsToFlush = [...this.metrics];
    this.metrics = [];

    // In a real implementation, send to metrics service
    // For now, just log aggregate data
    const summary = metricsToFlush.reduce((acc, metric) => {
      const key = `${metric.name}:${metric.unit}`;
      if (!acc[key]) {
        acc[key] = { count: 0, sum: 0, min: Infinity, max: -Infinity };
      }
      acc[key].count++;
      acc[key].sum += metric.value;
      acc[key].min = Math.min(acc[key].min, metric.value);
      acc[key].max = Math.max(acc[key].max, metric.value);
      return acc;
    }, {} as Record<string, any>);

    logger.debug('Metrics summary', { metrics: summary, count: metricsToFlush.length });
  }
}

class PerformanceMonitor {
  private readonly startTimes = new Map<string, number>();

  /**
   * Start timing an operation
   */
  startTimer(operation: string): string {
    const timerId = `${operation}:${Date.now()}:${Math.random()}`;
    this.startTimes.set(timerId, Date.now());
    return timerId;
  }

  /**
   * End timing and record metric
   */
  endTimer(timerId: string, tags?: Record<string, string>): number {
    const startTime = this.startTimes.get(timerId);
    if (!startTime) {
      logger.warn('Timer not found', { timerId });
      return 0;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(timerId);

    const operation = timerId.split(':')[0];
    metrics.timing(`operation.${operation}`, duration, tags);

    return duration;
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const timerId = this.startTimer(operation);

    try {
      const result = await fn();
      const duration = this.endTimer(timerId, tags);

      logger.debug(`Operation ${operation} completed`, {
        duration,
        tags,
      });

      return result;
    } catch (error) {
      this.endTimer(timerId, { ...tags, status: 'error' });
      throw error;
    }
  }

  /**
   * Monitor database query performance
   */
  async measureQuery<T>(
    queryName: string,
    query: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    return this.measure(
      `db.${queryName}`,
      query,
      {
        shopId: context?.shopId,
        customerId: context?.customerId,
      }
    );
  }

  /**
   * Monitor API call performance
   */
  async measureApiCall<T>(
    endpoint: string,
    apiCall: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    return this.measure(
      `api.${endpoint}`,
      apiCall,
      {
        shopId: context?.shopId,
        endpoint,
      }
    );
  }
}

class HealthChecker {
  private checks = new Map<string, () => Promise<boolean>>();

  /**
   * Register a health check
   */
  register(name: string, check: () => Promise<boolean>) {
    this.checks.set(name, check);
  }

  /**
   * Run all health checks
   */
  async runChecks(): Promise<{ status: 'healthy' | 'unhealthy'; checks: Record<string, boolean> }> {
    const results: Record<string, boolean> = {};
    let allHealthy = true;

    for (const [name, check] of this.checks) {
      try {
        const result = await Promise.race([
          check(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);

        results[name] = result;
        if (!result) allHealthy = false;

        metrics.gauge(`health.${name}`, result ? 1 : 0);
      } catch (error) {
        results[name] = false;
        allHealthy = false;

        logger.error(`Health check failed: ${name}`, {}, error as Error);
        metrics.gauge(`health.${name}`, 0);
      }
    }

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks: results,
    };
  }
}

// Global instances
export const logger = new Logger();
export const metrics = new MetricsCollector();
export const performance = new PerformanceMonitor();
export const healthChecker = new HealthChecker();

// Pre-configured health checks
healthChecker.register('database', async () => {
  try {
    const prismaModule = await import('./prisma.server');
    await prismaModule.prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
});

healthChecker.register('redis', async () => {
  try {
    const cacheModule = await import('./cache.server');
    await cacheModule.cache.set('health-check', 'ok', 10);
    const result = await cacheModule.cache.get('health-check');
    return result === 'ok';
  } catch {
    return false;
  }
});

// Error tracking utilities
export function trackError(error: Error, context?: LogContext) {
  logger.error(error.message, context, error);
  metrics.counter('errors.total', 1, {
    error_type: error.name,
    shopId: context?.shopId || '',
  });
}

export function trackUserAction(action: string, context: LogContext) {
  logger.info(`User action: ${action}`, context);
  metrics.counter('user_actions.total', 1, {
    action,
    shopId: context.shopId || '',
  });
}

export function trackBusinessMetric(metric: string, value: number, context?: LogContext) {
  metrics.gauge(`business.${metric}`, value, {
    shopId: context?.shopId || '',
  });

  logger.info(`Business metric: ${metric} = ${value}`, context);
}

// Request middleware helper
export function createRequestContext(request: Request): LogContext {
  const url = new URL(request.url);
  return {
    requestId: crypto.randomUUID(),
    method: request.method,
    url: url.pathname + url.search,
    userAgent: request.headers.get('user-agent') || '',
    ip: request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        '',
  };
}

// Performance monitoring decorators
export function monitor(operation: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return performance.measure(
        `${target.constructor.name}.${propertyKey}`,
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}