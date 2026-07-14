"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithGoogle } from "@/lib/firebase/client";
import { Navbar } from "@/components/Navbar";
import { Plate } from "@/components/Plate";
import { GoogleButton } from "@/components/GoogleButton";

/**
 * Google only. Email/password sign-up is gone.
 *
 * The tool is metered per email address, and email/password registration is free and unlimited —
 * so anyone could mint a new address and farm runs forever. The quota was a speed bump, not a
 * limit. Google accounts are materially harder to mass-create, which is what makes the meter mean
 * something. The server already enforced this (`checkToolAccess` rejects any provider that isn't
 * google.com); leaving the form up only let people create an account that could not use the
 * product — which is a worse experience than not offering it.
 */
export default function SignUpPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Plate />
      <Navbar />
      <main className="auth-wrap">
        <div className="auth-card">
          <h1>Create account</h1>
          {/* The old copy promised a "seven-day trial" that does not exist. What actually exists
              is a free tier with a run limit — so that is what it says now. */}
          <p className="sub">Free to start. No credit card.</p>

          <GoogleButton
            label={busy ? "Opening Google…" : "Sign up with Google"}
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
            Already have an account? <Link href="/auth/sign-in">Sign in</Link>
          </p>
        </div>
      </main>
    </>
  );
}
