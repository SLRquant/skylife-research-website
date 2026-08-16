import type { NextConfig } from "next";

/**
 * Content-Security-Policy.
 *
 * 'unsafe-inline'/'unsafe-eval' in script-src are required by Next's runtime (and by the dev
 * overlay). Everything else is locked to the origins we actually use:
 *   - Firebase Auth  -> identitytoolkit / securetoken / *.firebaseapp.com
 *   - Firestore      -> firestore.googleapis.com
 *   - Google sign-in -> accounts.google.com (popup) + gstatic (avatars)
 *   - Google Analytics -> googletagmanager.com (gtag.js) + google-analytics.com (beacons)
 *   - Vercel Analytics -> va.vercel-scripts.com (script) + vitals.vercel-insights.com (beacons)
 * The graph-stats API is NOT listed: the browser never calls it directly — our server does.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://www.googletagmanager.com https://www.google-analytics.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://www.google-analytics.com",
  "font-src 'self' data:",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.googleapis.com https://www.google-analytics.com https://www.googletagmanager.com https://vitals.vercel-insights.com",
  "frame-src 'self' https://accounts.google.com https://skyliferesearch.firebaseapp.com",
  "frame-ancestors 'none'", // clickjacking
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // HSTS — force HTTPS for a year (Vercel already redirects, this makes browsers enforce it)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  /**
   * firebase-admin must NOT be bundled — it has to be require()d from node_modules at runtime.
   *
   * It resolves gRPC / protobufjs / farmhash through dynamic requires that no bundler can trace
   * statically. `next start` on a dev box hides this, because the whole node_modules tree is on
   * disk either way. A Vercel serverless function only ships the files the tracer FOUND — so the
   * import throws at module load, which Next renders as an HTML error page. The browser then
   * JSON.parse()s "<!DOCTYPE html>" and the user is told
   * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
   *
   * That failure happens *before* any handler code, which is why the config preflight inside the
   * route could never catch it. This line is the actual fix; the preflight is the safety net.
   */
  serverExternalPackages: ["firebase-admin"],

  // Don't advertise the framework version to attackers.
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses must never be cached by a CDN or shared proxy — they're per-user.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
