"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.email("Enter a valid email"),
  message: z.string().min(5, "Tell us a little more"),
});
type FormValues = z.infer<typeof schema>;

export function Contact() {
  const [state, setState] = useState<{ ok: true } | { ok: false; err: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setState(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Something went wrong");
      }
      setState({ ok: true });
      reset();
    } catch (err) {
      setState({ ok: false, err: err instanceof Error ? err.message : "Something went wrong" });
    }
  };

  return (
    <section id="contact" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="label">Contact</span>
            <h2 className="sec-title unfurl">Ask us anything.</h2>
          </div>
          <p className="sec-desc">
            Questions about the methodology, the data, API access, or the paid tier — or a wider
            universe and features on request. We read and reply to every message.
          </p>
        </div>

        <div className="contact">
          <div>
            <p style={{ color: "var(--text-2)", fontSize: "var(--text-sm)", maxWidth: "48ch" }}>
              If you want to evaluate this for a desk, bring one portfolio and a window length you
              trust. We will run the graph on it live and show you which of your positions are the
              same bet.
            </p>
            <dl className="readout" style={{ marginTop: "var(--space-5)" }}>
              <div className="readout-cell">
                <dt className="label">Based</dt>
                <dd className="readout-val">Mumbai, Maharashtra, India</dd>
              </div>
            </dl>

            {/* Direct routes, for people who'd rather not use a form. Icons only — no address
                on display. */}
            <div className="contact-social" style={{ marginTop: "var(--space-5)" }}>
              <a
                className="icon-btn"
                href="mailto:aakashk@skyliferesearch.com?cc=sagark@skyliferesearch.com"
                aria-label="Email Skylife Research"
                title="Email us"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <path d="m3 6 9 7 9-7" />
                </svg>
              </a>
              <a
                className="icon-btn"
                href="https://www.linkedin.com/company/skylife-research/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Skylife Research on LinkedIn"
                title="LinkedIn"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4.98 3.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM.24 8.02h4.48V24H.24V8.02zM8.02 8.02h4.29v2.18h.06c.6-1.13 2.06-2.32 4.24-2.32 4.53 0 5.37 2.98 5.37 6.86V24h-4.48v-6.36c0-1.52-.03-3.47-2.12-3.47-2.12 0-2.44 1.65-2.44 3.36V24H8.02V8.02z" />
                </svg>
              </a>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <label className="field">
              <span className="label">Name</span>
              <input type="text" autoComplete="name" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <span className="form-err">{errors.name.message}</span>}
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
              {errors.email && <span className="form-err">{errors.email.message}</span>}
            </label>
            <label className="field">
              <span className="label">Message</span>
              <textarea rows={4} {...register("message")} aria-invalid={!!errors.message} />
              {errors.message && <span className="form-err">{errors.message.message}</span>}
            </label>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send message"}
            </button>
            {state?.ok && <p className="form-ok" style={{ marginTop: "var(--space-3)" }}>Received. We&apos;ll reply within 24 hours.</p>}
            {state && !state.ok && <p className="form-err" style={{ marginTop: "var(--space-3)" }}>{state.err}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
