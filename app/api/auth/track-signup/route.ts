import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/firebase/admin";
import { appendRow } from "@/lib/google-sheets";

export async function POST(req: Request) {
  const caller = await verifyRequest(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Display name is non-sensitive — accept it from the client body for the CRM log.
  // The email and provider are from the verified token (trusted).
  let name = "";
  try {
    const body = await req.json();
    if (typeof body.name === "string") name = body.name;
  } catch {
    // No body or invalid JSON — that's fine, name stays empty.
  }

  // Fire-and-forget — don't block the response on the sheet write.
  appendRow("Sign-ups", [
    new Date().toISOString(),
    caller.email,
    name,
    caller.provider,
  ]);

  return NextResponse.json({ ok: true });
}
