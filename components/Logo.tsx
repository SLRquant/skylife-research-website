import Link from "next/link";

/** Drawn on the grid: three nodes, three edges, square. No gradient, no glow. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link className="logo" href={href} aria-label="Skylife Research home">
      <svg className="logo-mark" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M3 3 L15 3 L9 15 Z" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
        <rect x="1" y="1" width="4" height="4" fill="#e8eaed" />
        <rect x="13" y="1" width="4" height="4" fill="#e8eaed" />
        {/* NOT amber. Amber means "a live measured value"; a logo is not one. */}
        <rect x="7" y="13" width="4" height="4" fill="#a8adb8" />
      </svg>
      <span className="logo-text">
        Skylife <span>Research</span>
      </span>
    </Link>
  );
}
