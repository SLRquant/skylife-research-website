import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  researchArticles,
  getArticleBySlug,
  getAllSlugs,
} from "@/lib/data/research-articles";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/sections/Footer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return { title: "Article Not Found — Skylife Research" };
  }

  return {
    title: `${article.seoTitle} — Skylife Research`,
    description: article.metaDescription,
    keywords: article.keywords,
    openGraph: {
      title: article.seoTitle,
      description: article.metaDescription,
      url: `https://skyliferesearch.com/research/${article.slug}`,
      type: "article",
      publishedTime: article.publishDate,
      authors: ["Skylife Research"],
      section: article.category,
      tags: article.keywords,
    },
    twitter: {
      card: "summary_large_image",
      title: article.seoTitle,
      description: article.metaDescription,
    },
    alternates: {
      canonical: `https://skyliferesearch.com/research/${article.slug}`,
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const currentIndex = researchArticles.findIndex(
    (a) => a.slug === article.slug
  );
  const prevArticle =
    currentIndex < researchArticles.length - 1
      ? researchArticles[currentIndex + 1]
      : null;
  const nextArticle =
    currentIndex > 0 ? researchArticles[currentIndex - 1] : null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.seoTitle,
    description: article.metaDescription,
    datePublished: article.publishDate,
    author: {
      "@type": "Organization",
      name: "Skylife Research",
      url: "https://skyliferesearch.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Skylife Research",
      url: "https://skyliferesearch.com",
      logo: {
        "@type": "ImageObject",
        url: "https://skyliferesearch.com/favicon.svg",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://skyliferesearch.com/research/${article.slug}`,
    },
    articleSection: article.category,
    keywords: article.keywords.join(", "),
  };

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://skyliferesearch.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Research",
        item: "https://skyliferesearch.com/research",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.headline,
        item: `https://skyliferesearch.com/research/${article.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <Navbar />

      <main className="article-page">
        <article className="wrap article-wrap">
          {/* Breadcrumb */}
          <nav className="article-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="article-breadcrumb-sep">/</span>
            <Link href="/research">Research</Link>
            <span className="article-breadcrumb-sep">/</span>
            <span className="article-breadcrumb-current">{article.headline}</span>
          </nav>

          {/* Header */}
          <header className="article-header">
            <div className="article-meta">
              <span className="label">{article.category}</span>
              <span className="label">
                {new Date(article.publishDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="label">{article.readTime} read</span>
            </div>

            <h1 className="article-title">{article.headline}</h1>
            <p className="article-lede">{article.metaDescription}</p>
            <div className="article-rule" />
          </header>

          {/* Content */}
          <div className="article-body">
            {article.sections.map((section, sIdx) => (
              <section key={sIdx}>
                {section.heading && (
                  <h2 className="article-h2">{section.heading}</h2>
                )}
                {section.paragraphs.map((paragraph, pIdx) => (
                  <p key={pIdx} className="article-p">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>

          {/* Disclaimer */}
          <aside className="article-disclaimer">
            <p>{article.disclaimer}</p>
          </aside>

          {/* Prev / Next */}
          <nav className="article-nav">
            {prevArticle ? (
              <Link
                href={`/research/${prevArticle.slug}`}
                className="article-nav-link"
              >
                <span className="label">Previous</span>
                <span className="article-nav-title">
                  {prevArticle.headline}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {nextArticle ? (
              <Link
                href={`/research/${nextArticle.slug}`}
                className="article-nav-link article-nav-link--next"
              >
                <span className="label">Next</span>
                <span className="article-nav-title">
                  {nextArticle.headline}
                </span>
              </Link>
            ) : (
              <span />
            )}
          </nav>

          {/* Back */}
          <div className="article-back">
            <Link href="/research" className="label">
              ← Back to all research
            </Link>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
