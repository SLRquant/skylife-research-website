/**
 * Preflight for the server-side env the metered tool cannot run without.
 *
 * WHY THIS EXISTS
 * ---------------
 * `verifyRequest()` deliberately THROWS in production when FIREBASE_SERVICE_ACCOUNT_B64 is
 * absent, rather than falling back to the dev auth stub — failing loudly beats silently shipping
 * an unauthenticated, unmetered endpoint. That guard is correct and stays.
 *
 * But an uncaught throw inside a route handler makes Next.js render its HTML error page, and the
 * browser then calls res.json() on `<!DOCTYPE html>...` — so a missing environment variable
 * reached the user as `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. That tells them
 * nothing and looks like the product is broken.
 *
 * So: check first, and fail as JSON with a message that names the actual problem.
 *
 * The response does NOT say which variables are missing — that's deployment detail a visitor has
 * no business reading. The names go to the server log, where the operator will look.
 */
import "server-only";

const REQUIRED = ["FIREBASE_SERVICE_ACCOUNT_B64", "GRAPH_STATS_API_KEY"] as const;

/** Names of the required server env vars that are unset. Empty = good to go. */
export function missingServerConfig(): string[] {
  return REQUIRED.filter((k) => !process.env[k]?.trim());
}

/** JSON body + status for a deployment that is missing its secrets. */
export function unconfiguredResponse(): { body: { error: string; message: string }; status: 503 } {
  return {
    body: {
      error: "service_unconfigured",
      message:
        "The graph service is not configured on this deployment. This is a server-side " +
        "configuration issue, not a problem with your request — please contact us.",
    },
    status: 503,
  };
}
