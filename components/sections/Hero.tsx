"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { HeroCanvas } from "@/components/HeroCanvas";
import { CountUp } from "@/components/CountUp";
import { usePulse } from "@/lib/usePulse";

const rise = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// stagger children ~60ms apart; ease-out so they settle rather than snap
const group = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const { pulse } = usePulse();

  const leader = pulse?.leaders?.[0];
  const asOf = pulse?.asOf
    ? new Date(pulse.asOf).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    : null;

  return (
    <section className="hero">
      <HeroCanvas />
      <div className="hero-veil" aria-hidden="true" />

      <div className="wrap hero-inner">
        <motion.div variants={group} initial="hidden" animate="show">
          <motion.div
            variants={rise}
            transition={{ duration: 0.6, ease: EASE }}
            className="hero-pill"
          >
            <span className={`hero-dot${pulse?.live ? " live" : ""}`} />
            <span className="mono">
              {pulse?.live ? "LIVE" : "CONNECTING"}
            </span>
            <span className="hero-pill-sep" />
            <span className="mono dim">
              {pulse ? `${pulse.universe} · graph rebuilt ${asOf ?? "—"}` : "loading market graph…"}
            </span>
          </motion.div>

          <motion.h1
            variants={rise}
            transition={{ duration: 0.7, ease: EASE }}
            className="hero-h"
          >
            The market isn&apos;t a list.
            <br />
            <span className="hero-h-accent">It&apos;s a network.</span>
          </motion.h1>

          <motion.p
            variants={rise}
            transition={{ duration: 0.6, ease: EASE }}
            className="hero-sub"
          >
            We rebuild the NIFTY-50 correlation graph every session and measure where each stock
            sits inside it — who is becoming a hub, who is drifting to the edge. Run it yourself,
            on your own parameters.
          </motion.p>

          <motion.div
            variants={rise}
            transition={{ duration: 0.6, ease: EASE }}
            className="hero-ctas"
          >
            <Link className="btn btn-primary btn-lg btn-glow" href="/dashboard/graph-stats">
              Run the graph <span className="arr">→</span>
            </Link>
            <Link className="btn btn-ghost btn-lg" href="/network-graph">
              See today&apos;s clusters <span className="arr">→</span>
            </Link>
          </motion.div>

          {/* Real numbers, straight from the engine — not marketing copy. */}
          <motion.dl
            variants={rise}
            transition={{ duration: 0.6, ease: EASE }}
            className="hero-stats"
          >
            <div>
              <dt className="mono">STOCKS</dt>
              <dd>
                <CountUp value={pulse?.stocks} />
              </dd>
            </div>
            <div>
              <dt className="mono">CLUSTERS</dt>
              <dd>
                <CountUp value={pulse?.communities} />
              </dd>
            </div>
            <div>
              <dt className="mono">MODULARITY</dt>
              <dd className="accent">
                <CountUp value={pulse?.modularity} decimals={3} />
              </dd>
            </div>
            <div>
              <dt className="mono">MOST CENTRAL</dt>
              <dd className="sym">{leader?.symbol ?? "—"}</dd>
            </div>
          </motion.dl>
        </motion.div>
      </div>

      <div className="hero-fade" aria-hidden="true" />
    </section>
  );
}
