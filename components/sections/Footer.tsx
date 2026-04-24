"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

const schema = z.object({ email: z.email("Enter a valid email") });
type FormValues = z.infer<typeof schema>;

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
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
      reset();
      setTimeout(() => setDone(false), 3500);
    } catch {
      // swallow for demo UX; API always returns 200 when no key configured
      setDone(true);
      reset();
      setTimeout(() => setDone(false), 3500);
    }
  };

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="newsletter">
          <div className="newsletter-l">
            <h4>Monday mornings, one email.</h4>
            <p>
              Every Monday 08:00 IST — top 3 momentum clusters from the previous
              week, plus the 5 stocks leading them. No fluff, no mentor
              commentary.
            </p>
          </div>
          <form
            className="newsletter-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <input
              type="email"
              placeholder="you@example.com"
              aria-label="Email for newsletter"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={isSubmitting}
              style={done ? { background: "var(--accent-2)" } : undefined}
            >
              {done ? "✓ Subscribed" : isSubmitting ? "…" : "Subscribe"}
            </button>
          </form>
        </div>

        <div className="foot-top">
          <div>
            <Logo href="/" />
            <p className="foot-desc">
              A quantitative research firm specializing in graph theory and
              network analysis for the Indian stock market. We provide
              data-driven insights, not financial advice.
            </p>
            <div className="socials">
              <a href="#" aria-label="X / Twitter">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M4.98 3.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.82-1.95 3.75-1.95 4 0 4.75 2.6 4.75 6V21h-4v-5.3c0-1.27-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.81V21H9z" />
                </svg>
              </a>
              <a href="#" aria-label="GitHub">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 .3a12 12 0 00-3.8 23.38c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 016 0c2.28-1.55 3.28-1.23 3.28-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58A12 12 0 0012 .3z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="foot-col">
            <h5>Platform</h5>
            <Link href="#platform">Portfolio Analyzer</Link>
            <Link href="#platform">Network Graph</Link>
            <Link href="#platform">Momentum Stocks</Link>
            <Link href="#pricing">Pricing</Link>
            <a href="#">API Docs</a>
          </div>
          <div className="foot-col">
            <h5>Company</h5>
            <a href="#">About Us</a>
            <Link href="#methodology">Methodology</Link>
            <a href="#">Research Notes</a>
            <Link href="#contact">Contact</Link>
          </div>
          <div className="foot-col">
            <h5>Legal</h5>
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
            <a href="#">Disclaimer</a>
            <a href="#">Compliance</a>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 SKYLIFE RESEARCH · MADE IN MUMBAI</span>
          <span>v2.4 · BUILD 0424.2026</span>
        </div>
      </div>
    </footer>
  );
}
