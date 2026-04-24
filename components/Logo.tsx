import Link from "next/link";

export function Logo({ href = "#top" }: { href?: string }) {
  return (
    <Link className="logo" href={href} aria-label="Skylife Research home">
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            d="M6 6L18 6M6 6L12 18M18 6L12 18"
            stroke="#00e1ff"
            strokeWidth="1"
            opacity=".55"
            fill="none"
          />
          <circle cx="6" cy="6" r="2" fill="#00e1ff" />
          <circle cx="18" cy="6" r="2" fill="#35f0b5" />
          <circle cx="12" cy="18" r="2" fill="#00e1ff" />
        </svg>
      </span>
      <span className="logo-text">
        SKYLIFE <span className="dim">RESEARCH</span>
      </span>
    </Link>
  );
}
