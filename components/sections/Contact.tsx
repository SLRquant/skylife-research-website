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
        <div className="section-head">
          <div className="label">§ 6 — Correspondence</div>
          <div>
            <h2>
              Write to the <em>authors.</em>
            </h2>
            <p className="section-lede">
              Questions on methodology, access, or the window-sensitivity result in Fig. 1. We read
              every message.
            </p>
          </div>
        </div>

        <div className="contact-grid">
          <div>
            <p>
              If you are evaluating this for a desk, the fastest path is to run the engine on your
              own universe and your own window and see whether the structure it reports matches
              what you already believe about your book. That takes about fifteen seconds and costs
              nothing.
            </p>
            <p className="dim">
              We are not a registered investment adviser and we do not manage money. We publish
              measurements.
            </p>
          </div>

          <form className="contact-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <label className={`field${errors.name ? " has-err" : ""}`}>
              <span className="label">Name</span>
              <input type="text" autoComplete="name" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <span className="err">{errors.name.message}</span>}
            </label>

            <label className={`field${errors.email ? " has-err" : ""}`}>
              <span className="label">Email</span>
              <input
                type="email"
                autoComplete="email"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && <span className="err">{errors.email.message}</span>}
            </label>

            <label className={`field${errors.message ? " has-err" : ""}`}>
              <span className="label">Message</span>
              <textarea rows={4} {...register("message")} aria-invalid={!!errors.message} />
              {errors.message && <span className="err">{errors.message.message}</span>}
            </label>

            <div>
              <button className="btn btn-solid" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send →"}
              </button>
            </div>

            {state?.ok && <div className="form-ok">Received. We reply within 24 hours.</div>}
            {state && !state.ok && <div className="err">{state.err}</div>}
          </form>
        </div>
      </div>
    </section>
  );
}
