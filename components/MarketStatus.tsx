"use client";

import { useEffect, useState } from "react";

function computeStatus() {
  const now = new Date();
  // IST = UTC + 5:30
  const istMs = now.getTime() + (now.getTimezoneOffset() + 330) * 60000;
  const ist = new Date(istMs);
  const day = ist.getUTCDay();
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const mins = h * 60 + m;
  const weekday = day >= 1 && day <= 5;
  const open = weekday && mins >= 555 && mins <= 930; // 09:15 -> 15:30
  return { label: `NSE ${open ? "OPEN" : "CLOSED"}`, open };
}

export function MarketStatus() {
  const [state, setState] = useState({ label: "NSE", open: false });

  useEffect(() => {
    setState(computeStatus());
    const id = setInterval(() => setState(computeStatus()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="status-pill"
      aria-live="polite"
      style={{
        ["--dot-color" as string]: state.open
          ? "var(--accent-2)"
          : "var(--mute-2)",
      }}
    >
      <span
        className="dot"
        style={{
          background: state.open ? "var(--accent-2)" : "var(--mute-2)",
          boxShadow: state.open ? "0 0 10px var(--accent-2)" : "none",
        }}
      />
      <span>{state.label}</span>
    </div>
  );
}
