import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

const schema = z.object({
  email: z.email(),
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
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email } = parsed.data;
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    console.log("[newsletter] (no RESEND config)", { email });
    return NextResponse.json({ ok: true, mode: "logged" });
  }

  try {
    const resend = new Resend(apiKey);
    await resend.contacts.create({
      email,
      audienceId,
      unsubscribed: false,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[newsletter] subscribe failed", err);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}
