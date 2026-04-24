"use client";

import { useEffect, useState } from "react";

function stamp() {
  const now = new Date();
  const ist = new Date(
    now.getTime() + (now.getTimezoneOffset() + 330) * 60000
  );
  const y = ist.getUTCFullYear();
  const mo = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `RUN ${y}.${mo}.${d} — 08:00 IST`;
}

export function RunStamp() {
  const [s, setS] = useState("RUN — — IST");
  useEffect(() => setS(stamp()), []);
  return <span>{s}</span>;
}
