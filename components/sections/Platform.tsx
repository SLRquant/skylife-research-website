import Link from "next/link";

type Tool = {
  num: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
};

const TOOLS: Tool[] = [
  {
    num: "01 / PORTFOLIO",
    title: "Portfolio Analyzer",
    desc: "Upload your book. See concentration, cluster overlap, and hidden correlated risk in thirty seconds.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    num: "02 / VISUAL",
    title: "Network Graph",
    desc: "Today's NIFTY500 clusters as a force-directed graph. Zoom, filter by sector, click any ticker to trace its edges.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <circle cx="18" cy="14" r="1.5" />
        <path d="M7 7l10 10M8 7l10 -1M7 8l5 9" />
      </svg>
    ),
  },
  {
    num: "03 / SIGNAL",
    title: "Momentum Stocks",
    desc: "The stocks leading each cluster, ranked by eigenvector centrality and 30-day return. Exportable daily.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 17l5-5 4 4 8-8M17 8h4v4" />
      </svg>
    ),
  },
];

export function Platform() {
  return (
    <section id="platform" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="sec-eyebrow">⎔ Platform</div>
            <h2 className="sec-title">
              The tools, <em>in plain sight.</em>
            </h2>
          </div>
          <p className="sec-desc">
            Three production-grade instruments, built on the same graph. Use
            one, use all three.
          </p>
        </div>
        <div className="tools">
          {TOOLS.map((t) => (
            <Link className="tool" href="#" key={t.num}>
              <div>
                <div className="tool-num">{t.num}</div>
                <div className="tool-ico">{t.icon}</div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </div>
              <span className="tool-link">
                OPEN TOOL <span className="arr">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
