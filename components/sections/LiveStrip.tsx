export function LiveStrip() {
  return (
    <section className="live-strip-wrap">
      <div className="wrap">
        <div className="live-strip">
          <div className="live-cell">
            <div className="live-label">Coverage universe</div>
            <div className="live-value">NIFTY500</div>
            <div className="live-delta">Large · Mid · Small</div>
          </div>
          <div className="live-cell">
            <div className="live-label">Clusters today</div>
            <div className="live-value">
              3 <span className="up-arrow">↑</span>
            </div>
            <div className="live-delta">Detected 08:00 IST</div>
          </div>
          <div className="live-cell">
            <div className="live-label">Modularity</div>
            <div className="live-value">0.452</div>
            <div className="live-delta">Optimized · Louvain</div>
          </div>
          <div className="live-cell">
            <div className="live-label">Signal cadence</div>
            <div className="live-value">Daily</div>
            <div className="live-delta">Pre-market · 30d window</div>
          </div>
        </div>
      </div>
    </section>
  );
}
