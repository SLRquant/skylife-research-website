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
  const [state, setState] = useState<
    { ok: true } | { ok: false; err: string } | null
  >(null);

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
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Something went wrong");
      }
      setState({ ok: true });
      reset();
    } catch (err) {
      setState({
        ok: false,
        err: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  return (
    <section id="contact" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="sec-eyebrow">◎ Get in touch</div>
            <h2 className="sec-title">
              Two ways to <em>reach us.</em>
            </h2>
          </div>
          <p className="sec-desc">
            Pick the path that fits — whether you&apos;re evaluating for
            yourself or for a desk.
          </p>
        </div>
        <div className="contact">
          <div className="c-card hi">
            <div className="c-tag">◆ INSTITUTIONAL</div>
            <h3 className="c-title">
              Book a 20-min <em>walkthrough.</em>
            </h3>
            <p className="c-desc">
              Live network, live Q&amp;A. Bring one portfolio and we&apos;ll
              show you the hidden concentration risk in under fifteen minutes.
            </p>
            <a className="btn btn-primary" href="#">
              Open calendar →
            </a>
          </div>
          <div className="c-card">
            <div className="c-tag">◦ INDIVIDUAL</div>
            <h3 className="c-title">
              Ask us <em>anything.</em>
            </h3>
            <p className="c-desc">
              Questions on methodology, pricing, or just want to geek out about
              graph algorithms? We read every message and respond within 24
              hours.
            </p>
            <form
              className="contact-form"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <label>
                <span>Name</span>
                <input
                  type="text"
                  autoComplete="name"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                />
              </label>
              {errors.name && (
                <span className="form-err">{errors.name.message}</span>
              )}
              <label>
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
              </label>
              {errors.email && (
                <span className="form-err">{errors.email.message}</span>
              )}
              <label>
                <span>Message</span>
                <textarea
                  rows={3}
                  {...register("message")}
                  aria-invalid={!!errors.message}
                />
              </label>
              {errors.message && (
                <span className="form-err">{errors.message.message}</span>
              )}
              <button
                className="btn btn-ghost"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending…" : "Send message"}
              </button>
              {state?.ok && (
                <div className="form-note">
                  Got it — we&apos;ll get back to you within 24 hours.
                </div>
              )}
              {state && !state.ok && (
                <div className="form-err">{state.err}</div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
