import * as Sentry from "@sentry/remix";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  beforeSend(event, hint) {
    // Filter out non-error events in development
    if (process.env.NODE_ENV === "development" && event.level !== "error") {
      return null;
    }
    return event;
  },
});