/**
 * Thin wrapper around gtag() so conversion events are typed, centralised,
 * and safe to call when the script hasn't loaded yet (SSR / ad-blockers).
 */

type GtagFn = (...args: unknown[]) => void;

function gtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).gtag as GtagFn | undefined ?? null;
}

/** GA4 recommended event — account creation. */
export function trackSignUp(method = "Google") {
  gtag()?.("event", "sign_up", { method });
}

/** GA4 recommended event — returning user. */
export function trackLogin(method = "Google") {
  gtag()?.("event", "login", { method });
}

/**
 * Contact-form submission.
 * Fires both `generate_lead` (GA4 recommended) and `qualify_lead`
 * (custom — already configured as a conversion in the GA4 property).
 */
export function trackContactLead() {
  const g = gtag();
  if (!g) return;
  g("event", "generate_lead");
  g("event", "qualify_lead");
}

/**
 * Lead closed / converted — fired when a visitor creates an account,
 * completing the visitor → registered-user funnel.
 * Custom event, already configured in GA4.
 */
export function trackLeadConverted() {
  gtag()?.("event", "close_convert_lead");
}
