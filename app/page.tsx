import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/sections/Hero";
import { LiveStrip } from "@/components/sections/LiveStrip";
import { Figure1 } from "@/components/sections/Figure1";
import { Platform } from "@/components/sections/Platform";
import { Methodology } from "@/components/sections/Methodology";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ } from "@/components/sections/FAQ";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/sections/Footer";

/**
 * The page is a PAPER: title, byline, abstract, numbered figures with real captions, methods,
 * access, discussion, correspondence, colophon.
 *
 * There is exactly ONE reveal system here: none. Content is present in the HTML and visible on
 * first paint. The old page stacked ScrollReveal's `.reveal { opacity: 0 }` on top of
 * framer-motion's independent `opacity: 0` animation of the same sections' children — two
 * opacity-0 layers with different triggers, so content faded in twice, and any render that never
 * scrolled (an OG image, a PDF, a crawler) was ~4,000px of solid black. Deleted. (DEFECT 4)
 */
export default function HomePage() {
  return (
    <>
      {/* The wobble filter for hairline rules. Defined ONCE, applied only to 1px-tall elements —
          feTurbulence re-evaluates Perlin noise over the element's bbox every frame, so a
          full-viewport filter would cost 10–30ms/frame. On a 1px rule it is free. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="slr-wobble" x="0" y="-200%" width="100%" height="500%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.9" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <Navbar />

      <main id="top">
        <Hero />
        <LiveStrip />

        <div className="wrap">
          <Figure1 />
        </div>

        <Methodology />
        <Platform />
        <Pricing />
        <FAQ />
        <Contact />
      </main>

      <Footer />
    </>
  );
}
