import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

const schema = z.object({
  name: z.string().min(1),
  email: z.email(),
  message: z.string().min(5),
});

export async function POST(req: Request) {
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
  const to = process.env.CONTACT_INBOX ?? "founders@skyliferesearch.com";
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
