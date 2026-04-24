# Skylife Research — Website

Next.js 16 + React 19 + Tailwind v4. Dark "terminal precision" art direction — Inter Tight + Inter + IBM Plex Mono. Firebase client auth, Resend-powered contact + newsletter, animated force-directed hero graph, live NSE market-hours status.

Deploys to Vercel with zero config — push, connect the GitHub repo in Vercel, and it works.

## Local development

```bash
pnpm install   # or: npm install
cp .env.example .env.local   # fill in what you need (all optional to start)
pnpm dev
```

Open http://localhost:3000.

## Environment variables

All env vars are **optional** — the site runs without them. Add them in Vercel → Project → Settings → Environment Variables, then redeploy.

### Firebase (client auth)

Used by `/auth/sign-in`, `/auth/sign-up`, and the `/dashboard` guard.

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Without these, auth forms show a helpful error and `/dashboard` is accessible in demo mode.

### Resend (server email)

```
RESEND_API_KEY=          # https://resend.com/api-keys
CONTACT_INBOX=founders@skyliferesearch.com
CONTACT_FROM=Skylife Research <contact@skyliferesearch.com>
RESEND_AUDIENCE_ID=      # optional — for newsletter signups
```

Without `RESEND_API_KEY`, contact / newsletter POSTs are logged to the serverless function log and return 200 so the UX still works in development.

## Project layout

```
app/
  page.tsx                  Landing page
  layout.tsx                Root layout + font loading + AuthProvider
  globals.css               Design tokens + all component styles (Concept A)
  auth/
    sign-in/page.tsx        Email/password sign-in (Firebase)
    sign-up/page.tsx        Email/password sign-up (Firebase)
  dashboard/page.tsx        Auth-gated stub dashboard
  api/
    contact/route.ts        POST /api/contact (zod + Resend)
    newsletter/route.ts     POST /api/newsletter (zod + Resend contacts)
components/
  Navbar.tsx, Logo.tsx, MarketStatus.tsx, RunStamp.tsx
  NetworkGraph.tsx          Animated force-directed canvas
  TerminalTicker.tsx        Live terminal values
  ScrollReveal.tsx          IntersectionObserver fade-in
  ToolCursorGlow.tsx        Mouse-follow card highlight
  ProtectedRoute.tsx        Client-side auth guard
  sections/                 Hero, LiveStrip, Platform, Methodology,
                            Pricing, FAQ, Contact, Footer
lib/
  firebase/client.ts        Firebase SDK init (graceful if unset)
  firebase/AuthProvider.tsx useAuth() hook
middleware.ts               Public-route gate (auth enforced client-side)
```

## Deploy to Vercel

1. Push this directory to a GitHub repo.
2. https://vercel.com/new → Import the repo → Deploy.
3. After first deploy, add env vars in Vercel Project Settings and redeploy.

Everything else (build command, output, Node version) is auto-detected from `package.json` and `next.config.ts`.
