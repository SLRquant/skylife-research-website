/**
 * An always-open legend. A static block, not a <details> disclosure — the definitions stay
 * visible at all times.
 *
 * Rationale: a reader who meets `Q 0.441` or `Betweenness` and can't decode it won't trust the
 * tool. Hiding the key behind a click assumes they already know they need it; a first-time visitor
 * doesn't. So it is always on screen, styled quietly enough that a returning user's eye skips past
 * it.
 */
import type { ReactNode } from "react";

export function InfoBox({
  title = "What these numbers mean",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="infobox" aria-label={title}>
      <div className="infobox-head">
        <span className="infobox-mark" aria-hidden="true">
          i
        </span>
        <span className="label">{title}</span>
      </div>
      <div className="infobox-body">{children}</div>
    </section>
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
