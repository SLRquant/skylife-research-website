"use client";

import { useEffect, useState } from "react";

/** Renders the three small animated values in the hero terminal. */
export function TerminalTicker() {
  const [m, setM] = useState(0.452);
  const [a, setA] = useState(6.2);

  useEffect(() => {
    const id = setInterval(() => {
      setM((prev) =>
        Math.max(0.41, Math.min(0.49, prev + (Math.random() - 0.5) * 0.006))
      );
      setA((prev) =>
        Math.max(4.5, Math.min(7.8, prev + (Math.random() - 0.5) * 0.15))
      );
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="row">
        <span>louvain.modularity</span>
        <span className="g">{m.toFixed(3)}</span>
      </div>
      <div className="row">
        <span>communities_detected</span>
        <span className="g">3</span>
      </div>
      <div className="row">
        <span>nodes_analyzed</span>
        <span className="c">500</span>
      </div>
    </>
  );
}

export function AlphaRow() {
  const [a, setA] = useState(6.2);
  useEffect(() => {
    const id = setInterval(() => {
      setA((prev) =>
        Math.max(4.5, Math.min(7.8, prev + (Math.random() - 0.5) * 0.15))
      );
    }, 2400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="row">
      <span>rolling_alpha_30d</span>
      <span className="g">{`${a >= 0 ? "+" : ""}${a.toFixed(1)}%`}</span>
    </div>
  );
}
