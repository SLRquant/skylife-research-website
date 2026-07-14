"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithGoogle } from "@/lib/firebase/client";
import { Navbar } from "@/components/Navbar";
import { Plate } from "@/components/Plate";
import { GoogleButton } from "@/components/GoogleButton";

/**
 * Google only. Email/password sign-in is gone, matching sign-up.
 *
 * The tools are metered per email address, and email/password registration is free and unlimited —
 * so the quota was a speed bump, not a limit. The server has always enforced this: `checkToolAccess`
 * rejects any provider that isn't google.com. Keeping a password form on the front door only let
 * someone sign in to an account that could not use the product, which is a worse experience than
 * not offering it.
 */
export default function SignInPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Plate />
      <Navbar />
      <main className="auth-wrap">
        <div className="auth-card">
          <h1>Sign in</h1>
          <p className="sub">Welcome back. Pull up your cluster dashboard.</p>

          <GoogleButton
            label={busy ? "Opening Google…" : "Sign in with Google"}
            onClick={async () => {
              setErr(null);
              setBusy(true);
              try {
                await signInWithGoogle();
                router.replace("/dashboard");
              } finally {
                setBusy(false);
              }
            }}
            onError={(m) => {
              setBusy(false);
              setErr(m);
            }}
          />

          {err && <div className="form-err" style={{ marginTop: "var(--space-3)" }}>{err}</div>}

          <p className="auth-foot" style={{ marginTop: "var(--space-4)" }}>
            We use Google sign-in only. The tools are metered per account, and a Google account is
            what keeps that meter honest.
          </p>

          <p className="auth-foot">
            New here? <Link href="/auth/sign-up">Create an account</Link>
          </p>
        </div>
      </main>
    </>
  );
}
