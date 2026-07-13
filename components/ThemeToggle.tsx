"use client";

import { useEffect, useState } from "react";

type Theme = "paper" | "ink";

/**
 * The theme toggle is a CELEBRATED control, not a setting buried in a menu.
 * This is the only quant platform that prints, so we say so in the header.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("paper");

  useEffect(() => {
    // the boot script in layout.tsx already resolved this before first paint; just read it back
    const t = (document.documentElement.getAttribute("data-theme") as Theme) || "paper";
    setTheme(t);
  }, []);

  const flip = () => {
    const next: Theme = theme === "paper" ? "ink" : "paper";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("slr-theme", next);
    } catch {
      /* private mode — the choice just won't persist */
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={flip}
      aria-label={`Switch to ${theme === "paper" ? "ink" : "paper"} stock`}
      title={`Switch to ${theme === "paper" ? "ink" : "paper"}`}
    >
      <span className="theme-glyph" aria-hidden="true">
        ◐
      </span>
      <span className={`theme-opt${theme === "ink" ? " on" : ""}`}>INK</span>
      <span className="theme-sep" aria-hidden="true">
        /
      </span>
      <span className={`theme-opt${theme === "paper" ? " on" : ""}`}>PAPER</span>
    </button>
  );
}
