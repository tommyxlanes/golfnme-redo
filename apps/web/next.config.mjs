import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

// Monorepo: one .env at the repo root is shared by the web app and the API.
// Variables already set in the environment (Docker, CI) win over the file.
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const rootEnvFile = path.join(repoRoot, ".env");
if (fs.existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the multi-stage Dockerfile. Tracing from the repo root puts
  // the bundle at .next/standalone/apps/web/server.js together with the
  // workspace packages it needs.
  output: "standalone",
  outputFileTracingRoot: repoRoot,

  // The shared workspace package ships TypeScript source.
  transpilePackages: ["@golfnme/shared"],

  reactStrictMode: true,
  allowedDevOrigins: ["10.0.0.11"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google OAuth avatars
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com", // GitHub OAuth avatars (if added later)
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "tommy-x",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
