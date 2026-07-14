import type { NextConfig } from "next";

/**
 * Content-Security-Policy.
 *
 * 'unsafe-inline'/'unsafe-eval' in script-src are required by Next's runtime (and by the dev
 * overlay). Everything else is locked to the origins we actually use:
 *   - Firebase Auth  -> identitytoolkit / securetoken / *.firebaseapp.com
 *   - Firestore      -> firestore.googleapis.com
 *   - Google sign-in -> accounts.google.com (popup) + gstatic (avatars)
 * The graph-stats API is NOT listed: the browser never calls it directly — our server does.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com",
  "font-src 'self' data:",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.googleapis.com",
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
