import { Metadata } from "next";
import Link from "next/link";
import { researchArticles } from "@/lib/data/research-articles";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/sections/Footer";

export const metadata: Metadata = {
  title: "Research — Skylife Research",
  description:
    "Data-driven equity research on structural themes in Indian markets. Weekly investment theses on healthcare, infrastructure, defence, consumer retail, AI and more.",
  keywords: [
    "india equity research",
    "india stock analysis",
    "india investment thesis",
    "skylife research reports",
    "indian stock market research",
    "quantitative research india",
    "NSE BSE stock analysis",
  ],
  openGraph: {
    title: "Research — Skylife Research",
    description:
      "Data-driven equity research on structural themes in Indian markets.",
    url: "https://skyliferesearch.com/research",
    type: "website",
  },
  alternates: {
    canonical: "https://skyliferesearch.com/research",
  },
};

export default function ResearchPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Skylife Research — Equity Research",
    description:
      "Data-driven equity research on structural themes in Indian markets.",
    url: "https://skyliferesearch.com/research",
    publisher: {
      "@type": "Organization",
      name: "Skylife Research",
      url: "https://skyliferesearch.com",
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: researchArticles.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `https://skyliferesearch.com/research/${article.slug}`,
        name: article.seoTitle,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Navbar />

      <main className="research-page">
        <div className="wrap">
          {/* Header */}
          <header className="research-header">
            <span className="label">Research</span>
            <h1 className="research-title">
              Data-Driven Investment Theses
            </h1>
            <p className="research-desc">
              Weekly research on structural themes in Indian markets. We read
              the data everyone has access to and find the trades nobody is
              talking about.
            </p>
          </header>

          {/* Articles */}
          <div className="research-list">
            {researchArticles.map((article) => (
              <Link
                key={article.slug}
                href={`/research/${article.slug}`}
                className="research-card"
              >
                <div className="research-card-meta">
                  <span className="label">{article.category}</span>
                  <span className="label">
                    {new Date(article.publishDate).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </span>
                  <span className="label">{article.readTime}</span>
                </div>
                <h2 className="research-card-title">{article.headline}</h2>
                <p className="research-card-desc">
                  {article.metaDescription}
                </p>
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="research-cta">
            <p className="research-cta-text">
              We publish one deep-dive every week — reading the theme
              everyone&apos;s talking about through where the money actually
              goes.
            </p>
            <Link href="/#contact" className="btn btn-primary">
              Subscribe to Research
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
