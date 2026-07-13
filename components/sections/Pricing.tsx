import Link from "next/link";

function Check() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="sec-eyebrow">⟢ Plans</div>
            <h2 className="sec-title">
              One product, <em>three ways in.</em>
            </h2>
          </div>
          <p className="sec-desc">
            Start solo. Upgrade when your book grows. Add custom delivery when
            your desk needs it.
          </p>
        </div>
        <div className="pricing">
          <article className="plan">
            <div className="plan-name">◦ Starter</div>
            <div className="plan-price">
              ₹999<small> / month</small>
            </div>
            <p className="plan-desc">
              For the active retail trader running their own book.
            </p>
            <ul>
              <li>
                <Check />
                Daily cluster momentum report (email)
              </li>
              <li>
                <Check />
                Top 10 cluster-leader stocks
              </li>
              <li>
                <Check />
                NIFTY-50 coverage
              </li>
              <li>
                <Check />
                Weekly methodology note
              </li>
            </ul>
            <Link className="btn btn-ghost" href="#contact">
              Start 7-day trial
            </Link>
          </article>
          <article className="plan featured">
            <div className="plan-badge">Most popular</div>
            <div className="plan-name">◉ Professional</div>
            <div className="plan-price">
              ₹2,999<small> / month</small>
            </div>
            <p className="plan-desc">
              For RIAs and family offices managing 10–50 client portfolios.
            </p>
            <ul>
              <li>
                <Check />
                Daily cluster momentum report
              </li>
              <li>
                <Check />
                Top 10 cluster-leader stocks
              </li>
              <li>
                <Check />
                Portfolio risk graph (web dashboard)
              </li>
              <li>
                <Check />
                Co-integrated pairs report
              </li>
              <li>
                <Check />
                Cluster-break alerts (intraday)
              </li>
            </ul>
            <Link className="btn btn-primary" href="#contact">
              Start 7-day trial
            </Link>
          </article>
          <article className="plan">
            <div className="plan-name">◆ Enterprise</div>
            <div className="plan-price">Custom</div>
            <p className="plan-desc">
              For prop desks and funds integrating signals into an execution
              stack.
            </p>
            <ul>
              <li>
                <Check />
                Everything in Professional
              </li>
              <li>
                <Check />
                Network graph API (REST + websockets)
              </li>
              <li>
                <Check />
                Custom universe beyond NIFTY-50
              </li>
              <li>
                <Check />
                SLA, dedicated support, onboarding
              </li>
            </ul>
            <Link className="btn btn-ghost" href="#contact">
              Request the data sheet
            </Link>
          </article>
        </div>
        <div className="disclaimer">
          <span className="warn-ico">⚠</span>
          <span>
            Skylife Research provides quantitative research and data feeds, not
            investment advice. Trading in financial markets involves risk. Past
            performance of graph-based models is not indicative of future
            results.
          </span>
        </div>
      </div>
    </section>
  );
}
