"use client";

import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { user, configured } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    router.replace("/");
  };

  return (
    <>
      <div className="grid-bg" aria-hidden="true" />
      <div className="glow" aria-hidden="true" />
      <Navbar />
      <ProtectedRoute>
        <main className="dash-wrap">
          <div className="wrap">
            <div className="dash-card">
              <div className="mono dim" style={{ fontSize: 11, letterSpacing: ".2em" }}>
                ◉ DASHBOARD
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  letterSpacing: "-.03em",
                  fontSize: 32,
                  margin: "12px 0 10px",
                }}
              >
                Welcome back{user?.email ? `, ${user.email}` : ""}.
              </h1>
              <p className="dim" style={{ maxWidth: 560, marginBottom: 24 }}>
                This is a stub dashboard. Wire up your clusters feed, portfolio
                analyzer, and momentum signals here — each gets its own route
                under <span className="mono">/dashboard/*</span>.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="btn btn-primary" disabled>
                  Open network graph →
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={handleSignOut}
                  disabled={!configured}
                >
                  Sign out
                </button>
              </div>
              {!configured && (
                <p
                  className="form-note"
                  style={{ marginTop: 20, color: "var(--warn)" }}
                >
                  Firebase env vars not set — sign-out disabled in demo mode.
                </p>
              )}
            </div>
          </div>
        </main>
      </ProtectedRoute>
    </>
  );
}
