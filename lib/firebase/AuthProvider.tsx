"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./client";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  configured: boolean;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  configured: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [configured]);

  const value = useMemo(
    () => ({ user, loading, configured }),
    [user, loading, configured]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}
