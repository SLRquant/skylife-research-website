"use client";

import { useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/client";

/** Google sign-in button. Reports failures into the auth pages' existing error slot. */
export function GoogleButton({
  label,
  onClick,
  onError,
}: {
  label: string;
  onClick: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    onError(null);
    if (!isFirebaseConfigured()) {
      onError("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* env vars.");
      return;
    }
    setBusy(true);
    try {
      await onClick();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        onError(null); // the user just closed the popup — not worth shouting about
      } else if (code === "auth/unauthorized-domain") {
        onError("This domain isn't authorized in Firebase → Authentication → Settings.");
      } else if (code === "auth/operation-not-allowed") {
        onError("Google sign-in isn't enabled in the Firebase console.");
      } else {
        onError(e instanceof Error ? e.message : "Google sign-in failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="btn btn-google" onClick={handle} disabled={busy}>
      <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
      <span>{busy ? "Opening Google…" : label}</span>
    </button>
  );
}
