"use client";

import { useEffect, useState } from "react";

function computeStatus() {
  const now = new Date();
  const ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000); // IST = UTC+5:30
  const day = ist.getUTCDay();
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const open = day >= 1 && day <= 5 && mins >= 555 && mins <= 930; // 09:15 -> 15:30
  return { label: open ? "NSE OPEN" : "NSE CLOSED", open };
}

export function MarketStatus() {
  // render the same thing on server and first client paint, then correct it
  const [state, setState] = useState({ label: "NSE", open: false });

  useEffect(() => {
    setState(computeStatus());
    const id = setInterval(() => setState(computeStatus()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="status" aria-live="polite">
      <span className={`led${state.open ? " on" : ""}`} />
      {state.label}
    </span>
  );
}
