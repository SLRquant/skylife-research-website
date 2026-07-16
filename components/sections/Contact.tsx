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

            {/* Direct routes, for people who'd rather not use a form. */}
            <div
              style={{
                marginTop: "var(--space-5)",
                display: "grid",
                gap: "var(--space-2)",
                fontSize: "var(--text-sm)",
              }}
            >
              <div>
                <span className="label">Email</span>{" "}
                <a
                  className="mono"
                  href="mailto:aakashk@skyliferesearch.com?cc=sagark@skyliferesearch.com"
                >
                  aakashk@skyliferesearch.com
                </a>
              </div>
              <div>
                <span className="label">LinkedIn</span>{" "}
                <a
                  className="mono"
                  href="https://www.linkedin.com/company/skylife-research/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Skylife Research ↗
                </a>
              </div>
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
