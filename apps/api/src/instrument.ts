import * as Sentry from "@sentry/node";

// Imported first by server.ts so Sentry is initialised before any other
// module loads and its instrumentation sees all of them.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1,
    sendDefaultPii: true,
  });
}
