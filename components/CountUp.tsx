"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value` when scrolled into view.
 *
 * Motion here conveys meaning ("this number is being computed live"), not decoration. It runs
 * once, lasts ~900ms, and is skipped entirely under prefers-reduced-motion — where the final
 * value is shown immediately rather than animated.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 900,
  className,
}: {
  value: number | null | undefined;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (value == null) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(value);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const start = () => {
      if (done.current) return;
      done.current = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min((t - t0) / duration, 1);
        // ease-out — fast then settling, so the number "lands"
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(value * eased);
        if (p < 1) requestAnimationFrame(tick);
        else setShown(value);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && start()),
      { threshold: 0.3 }
    );
    io.observe(el);
    // already visible on mount (above the fold)
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) start();

    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {shown == null ? "—" : shown.toFixed(decimals)}
    </span>
  );
}
