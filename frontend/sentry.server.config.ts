import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "",
  environment: process.env.NODE_ENV ?? "production",
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
  ignoreErrors: [
    "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT",
    "AbortError", "fetch failed",
  ],
});
