import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.email(),
  message: z.string().min(5).max(5000),
});

export async function POST(req: Request) {
  // Unauthenticated + sends email => a spam bot could drain the Resend quota. Cap it.
  const limit = rateLimit(`contact:${clientIp(req)}`, 3, 60 * 60_000); // 3/hour per IP
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many messages. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission" },
      { status: 400 }
    );
  }

  const { name, email, message } = parsed.data;
  const apiKey = process.env.RESEND_API_KEY;
  // Delivered to Aakash, with Sagar cc'd. Env vars override without a code change.
  const to = process.env.CONTACT_INBOX ?? "aakashk@skyliferesearch.com";
  const cc = process.env.CONTACT_CC ?? "sagark@skyliferesearch.com";
  const from =
    process.env.CONTACT_FROM ?? "Skylife Research <onboarding@resend.dev>";

  // If Resend isn't configured, still accept the submission (log it).
  if (!apiKey) {
    console.log("[contact] (no RESEND_API_KEY)", { name, email, message });
    return NextResponse.json({ ok: true, mode: "logged" });
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      cc,
      replyTo: email,
      subject: `New contact form: ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] send failed", err);
    return NextResponse.json(
      { error: "Failed to send" },
      { status: 500 }
    );
  }
}
