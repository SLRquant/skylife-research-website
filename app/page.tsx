import { Navbar } from "@/components/Navbar";
import { Plate } from "@/components/Plate";
import { Hero } from "@/components/sections/Hero";
import { LiveStrip } from "@/components/sections/LiveStrip";
import { Platform } from "@/components/sections/Platform";
import { Methodology } from "@/components/sections/Methodology";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ } from "@/components/sections/FAQ";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/sections/Footer";

/**
 * ONE reveal system: none. `ScrollReveal` (which set opacity:0 on every .section) and
 * framer-motion's independent opacity:0 on those same sections' children were fighting, and a
 * non-scrolled render — an OG image, a PDF, a crawler — came out as ~4,000px of pure black.
 * Content is now simply present. The motion budget is spent on the graph, where it means
 * something.
 */
export default function HomePage() {
  return (
    <>
      <Plate />
      <Navbar />
      <main id="top">
        <Hero />
        <LiveStrip />
        <Platform />
        <Methodology />
        <Pricing />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
