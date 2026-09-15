// ── NICHT VERDRAHTET (Stand 15.09.) ─────────────────────────────────────────
//
// Diese Datei wird von NIEMANDEM geladen. Nachgemessen, nicht vermutet: die
// Reichweiten-Rechnung ueber alle 610 Frontend-Dateien listet sie zweimal
// (07.09. und 15.09.) als von keinem Einstiegspunkt erreichbar, und
// `@sentry/nextjs` wird ausser hier nirgends importiert.
//
// GRUND: Next.js 16 laedt `sentry.server.config.ts` nicht von selbst. Frueher
// zog der Webpack-Zusatz aus `withSentryConfig` sie herein — `next.config.ts`
// enthaelt keinen solchen Aufruf. Der heutige Weg waere laut mitgelieferter
// Doku (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// instrumentation.md bzw. instrumentation-client.md):
//   - serverseitig: aus `register()` in `instrumentation.ts` importieren
//   - clientseitig: eine Datei `instrumentation-client.ts` anlegen
//
// BEWUSST NICHT GETAN: `instrumentation.ts` ist eine Datei mit erhoehtem
// Risiko (alle Schleifen, Killswitch-Sperren) und wird laut CLAUDE.md nicht
// ohne ausdrueckliche Zustimmung angefasst. Ohne gesetzten DSN braechte die
// Verdrahtung ausserdem keinerlei Nutzen: `enabled: !!process.env.SENTRY_DSN`
// unten macht die Initialisierung dann zu einem Leerlauf.
//
// Die Datei ist also KEIN Fehler und KEIN Rest — sie ist fertiges Geruest,
// dem die letzte Verbindung fehlt. Entweder verdrahten (dann DSN setzen) oder
// mitsamt der Abhaengigkeit entfernen. Das ist eine Entscheidung, kein Bug.
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
