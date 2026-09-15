// NICHT VERDRAHTET (Stand 15.09.) — vollstaendige Begruendung in
// `sentry.server.config.ts`. Kurz: Next.js 16 laedt diese Datei nicht von
// selbst, `next.config.ts` hat keinen `withSentryConfig`, und der heutige Weg
// waere eine Datei `instrumentation-client.ts`. Ohne gesetzten DSN ist die
// Initialisierung unten ohnehin ein Leerlauf (`enabled: !!…`).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  environment: process.env.NODE_ENV ?? "production",
  tracesSampleRate: 0.05,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
});
