"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";

const schema = z.object({ email: z.email("Enter a valid email") });
type FormValues = z.infer<typeof schema>;

/** The colophon. Where a paper says who set it and on what. */
export function Footer() {
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      /* the API returns 200 even without a key configured */
    }
    setDone(true);
    reset();
    setTimeout(() => setDone(false), 3500);
  };

  return (
    <footer className="colophon">
      <div className="wrap">
        <div className="colophon-grid">
          <div>
            <h5>Skylife Research</h5>
            <p className="colophon-note">
              Graph-theoretic market-structure research on the Indian equity market. We publish
              measurements, not advice, and we report the negative results too.
            </p>

            <form className="contact-form" onSubmit={handleSubmit(onSubmit)} noValidate style={{ marginTop: "var(--space-3)" }}>
              <label className={`field${errors.email ? " has-err" : ""}`}>
                <span className="label">Notes, Monday 08:00 IST</span>
                <input
                  type="email"
                  placeholder="you@desk.com"
                  aria-label="Email"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                {errors.email && <span className="err">{errors.email.message}</span>}
              </label>
              <div>
                <button className="btn" type="submit" disabled={isSubmitting}>
                  {done ? "Subscribed" : isSubmitting ? "…" : "Subscribe →"}
                </button>
              </div>
            </form>
          </div>

          <div>
            <h5>Instruments</h5>
            <Link href="/dashboard/graph-stats">Graph Stats</Link>
            <Link href="/network-graph">Network Graph</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>

          <div>
            <h5>The paper</h5>
            <Link href="/#figure-1">Fig. 1 — Structure</Link>
            <Link href="/#methods">§2 Methods</Link>
            <Link href="/#access">§4 Access</Link>
            <Link href="/#discussion">§5 Discussion</Link>
            <Link href="/#contact">§6 Correspondence</Link>
          </div>
        </div>

        <div className="colophon-foot">
          <span>© 2026 SKYLIFE RESEARCH · MUMBAI</span>
          <span>SET IN INSTRUMENT SERIF, SOURCE SERIF &amp; JETBRAINS MONO</span>
        </div>
      </div>
    </footer>
  );
}
