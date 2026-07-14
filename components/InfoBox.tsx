/**
 * A collapsed-by-default legend. Native <details>, so it costs no JS, is keyboard-operable, and
 * is searchable by the browser's find-in-page even while closed in modern engines.
 *
 * It is collapsed on purpose. The page's job is to show the market's structure; a permanent wall
 * of definitions would compete with the thing it is explaining. But a reader who meets `Q 0.441`
 * or `44u` and has no idea what they are looking at is not going to trust the tool — so the
 * answer has to be one click away, never a search.
 */
"use client";

import type { ReactNode } from "react";

export function InfoBox({
  title = "What these numbers mean",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <details className="infobox">
      <summary>
        <span className="infobox-mark" aria-hidden="true">
          i
        </span>
        <span className="label">{title}</span>
        <span className="infobox-chev" aria-hidden="true" />
      </summary>
      <div className="infobox-body">{children}</div>
    </details>
  );
}

/** One term and its definition. `term` is rendered exactly as it appears on screen. */
export function Def({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="infobox-def">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function DefList({ children }: { children: ReactNode }) {
  return <dl className="infobox-list">{children}</dl>;
}
