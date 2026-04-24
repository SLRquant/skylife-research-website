"use client";

import { useEffect } from "react";

/** Adds `.reveal` + IntersectionObserver `.in` to key sections. Degrades gracefully. */
export function ScrollReveal() {
  useEffect(() => {
    document.documentElement.classList.add("js-ready");
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".section, .live-strip-wrap, .hero, .newsletter"
      )
    );
    els.forEach((el) => el.classList.add("reveal"));

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
      );
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("in");
        else io.observe(el);
      });
      return () => io.disconnect();
    } else {
      els.forEach((el) => el.classList.add("in"));
    }
  }, []);

  return null;
}
