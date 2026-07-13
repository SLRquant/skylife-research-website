"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePulse } from "@/lib/usePulse";
import { CountUp } from "@/components/CountUp";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Next's <Link> wrapped so it can take motion props (framer-motion v12 API). */
const MotionLink = motion.create(Link);

const card = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE, delay: i * 0.07 },
  }),
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Platform() {
  const { pulse } = usePulse();

  return (
    <section id="platform" className="section">
      <div className="wrap">
        <motion.div
          className="sec-head"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div>
            <div className="sec-eyebrow mono">◇ THE TOOLS</div>
            <h2 className="sec-title">
              Not a report. <em>A machine you run.</em>
            </h2>
          </div>
          <p className="sec-desc">
            Every number on this page came out of the same engine you get access to. Set your own
            window, universe, and metrics — then look.
          </p>
        </motion.div>

        <div className="bento">
          {/* PRIMARY — the real product */}
          <MotionLink
            href="/dashboard/graph-stats"
            className="bento-card bento-lg"
            custom={0}
            variants={card}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            whileHover={{ y: -4 }}
          >
            <div className="bento-top">
              <span className="bento-tag mono">01 / FLAGSHIP</span>
              <span className="bento-live mono">
                <span className="hero-dot live" /> LIVE
              </span>
            </div>

            <div className="bento-ico">
              <Icon d="M3 3v18h18M7 15l4-4 3 3 5-6" />
            </div>

            <h3>Graph Stats</h3>
            <p>
              Rebuild the correlation graph for every session in your window and track each
              stock&apos;s centrality through time. Five metrics, four graph methods, any symbol
              set. Export the whole series.
            </p>

            <div className="bento-metrics">
              <div>
                <span className="mono dim">STOCKS</span>
                <strong><CountUp value={pulse?.stocks} /></strong>
              </div>
              <div>
                <span className="mono dim">CLUSTERS</span>
                <strong><CountUp value={pulse?.communities} /></strong>
              </div>
              <div>
                <span className="mono dim">MODULARITY</span>
                <strong className="accent">
                  <CountUp value={pulse?.modularity} decimals={3} />
                </strong>
              </div>
            </div>

            <span className="bento-cta mono">
              OPEN TOOL <span className="arr">→</span>
            </span>
          </MotionLink>

          {/* SECONDARY — real, public */}
          <MotionLink
            href="/network-graph"
            className="bento-card"
            custom={1}
            variants={card}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            whileHover={{ y: -4 }}
          >
            <div className="bento-top">
              <span className="bento-tag mono">02 / VISUAL</span>
            </div>
            <div className="bento-ico">
              <Icon d="M6 6h.01M18 6h.01M12 18h.01M17 13h.01M7 7l10 10M8 7l9-1M7 8l5 9" />
            </div>
            <h3>Network Graph</h3>
            <p>
              Today&apos;s clusters as a force-directed map. Click any ticker to trace its edges.
            </p>
            <span className="bento-cta mono">
              OPEN TOOL <span className="arr">→</span>
            </span>
          </MotionLink>

          {/* HONEST — not built yet. Don't advertise a door that doesn't open. */}
          <motion.div
            className="bento-card bento-soon"
            custom={2}
            variants={card}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            <div className="bento-top">
              <span className="bento-tag mono">03 / PORTFOLIO</span>
              <span className="bento-soon-tag mono">IN BUILD</span>
            </div>
            <div className="bento-ico">
              <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
            </div>
            <h3>Portfolio Overlap</h3>
            <p>
              Upload your book, see how much of it is the same bet wearing different tickers.
            </p>
            <span className="bento-cta mono dim">SHIPPING SOON</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
