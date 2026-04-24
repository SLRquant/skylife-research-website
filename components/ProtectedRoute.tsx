"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // If Firebase is not configured, allow through (demo mode).
    if (!configured) return;
    if (!user) router.replace("/auth/sign-in");
  }, [user, loading, configured, router]);

  if (loading) {
    return (
      <div className="dash-wrap">
        <div className="wrap">
          <div className="dash-card">
            <div className="mono dim" style={{ fontSize: 12 }}>
              ◦ Loading…
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (configured && !user) return null;

  return <>{children}</>;
}
