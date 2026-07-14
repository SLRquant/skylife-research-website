"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import {
  getFirebaseAuth,
  isFirebaseConfigured,
  signInWithGoogle,
} from "@/lib/firebase/client";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Navbar } from "@/components/Navbar";
import { Plate } from "@/components/Plate";
import { GoogleButton } from "@/components/GoogleButton";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(6, "Min 6 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function SignUpPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: FormValues) => {
    setErr(null);
    if (!isFirebaseConfigured()) {
      setErr(
        "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* env vars in Vercel."
      );
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      await createUserWithEmailAndPassword(auth, v.email, v.password);
      router.replace("/dashboard");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-up failed");
    }
  };

  return (
    <>
      <Plate />
      <Navbar />
      <main className="auth-wrap">
        <div className="auth-card">
          <h1>Create account</h1>
          <p className="sub">Seven-day trial. No credit card.</p>

          <GoogleButton
            label="Sign up with Google"
            onClick={async () => {
              await signInWithGoogle();
              router.replace("/dashboard");
            }}
            onError={setErr}
          />
          <div className="auth-divider"><span>or</span></div>

          <form
            
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <label className="field">
              <span className="label">Email</span>
              <input
                type="email"
                autoComplete="email"
                {...register("email")}
              />
            </label>
            {errors.email && (
              <span className="form-err">{errors.email.message}</span>
            )}
            <label className="field">
              <span className="label">Password</span>
              <input
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
            </label>
            {errors.password && (
              <span className="form-err">{errors.password.message}</span>
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating…" : "Create account"}
            </button>
            {err && <div className="form-err">{err}</div>}
          </form>
          <p className="auth-foot">
            Already have an account? <Link href="/auth/sign-in">Sign in</Link>
          </p>
        </div>
      </main>
    </>
  );
}
