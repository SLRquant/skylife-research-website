"use client";

import { useEffect } from "react";

export function ToolCursorGlow() {
  useEffect(() => {
    const tools = Array.from(document.querySelectorAll<HTMLElement>(".tool"));
    const handler = (t: HTMLElement) => (e: MouseEvent) => {
      const r = t.getBoundingClientRect();
      t.style.setProperty("--mx", `${e.clientX - r.left}px`);
      t.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    const bound: Array<[HTMLElement, (e: MouseEvent) => void]> = [];
    tools.forEach((t) => {
      const h = handler(t);
      t.addEventListener("mousemove", h);
      bound.push([t, h]);
    });
    return () => bound.forEach(([t, h]) => t.removeEventListener("mousemove", h));
  }, []);
  return null;
}
