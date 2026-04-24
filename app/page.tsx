import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/sections/Hero";
import { LiveStrip } from "@/components/sections/LiveStrip";
import { Platform } from "@/components/sections/Platform";
import { Methodology } from "@/components/sections/Methodology";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ } from "@/components/sections/FAQ";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/sections/Footer";
import { ScrollReveal } from "@/components/ScrollReveal";
import { ToolCursorGlow } from "@/components/ToolCursorGlow";

export default function HomePage() {
  return (
    <>
      <div className="grid-bg" aria-hidden="true" />
      <div className="glow" aria-hidden="true" />
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
      <ScrollReveal />
      <ToolCursorGlow />
    </>
  );
}
