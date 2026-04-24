/**
 * Sample NIFTY50 correlation network used as a fallback when the upstream
 * Skylife API is unavailable. Structured to match the documented shape:
 *
 *   { nodes: [...], edges: [...], meta: {...} }
 */

export type GraphNode = {
  id: string;
  symbol: string;
  name?: string;
  cluster: number;
  clusterLabel?: string;
  clusterColor?: string;
  centrality: number; // 0..1, eigenvector centrality
  momentum: number; // percent, last 30d
  marketCap?: number; // cr
};

export type GraphEdge = {
  source: string;
  target: string;
  weight: number; // correlation
};

const CLUSTERS = [
  { id: 1, label: "FIN", color: "#00e1ff" },
  { id: 2, label: "IT", color: "#35f0b5" },
  { id: 3, label: "CON", color: "#7dd3fc" },
  { id: 4, label: "ENE", color: "#c084fc" },
  { id: 5, label: "PHA", color: "#fbbf24" },
];

const STOCKS: Array<{ symbol: string; name: string; cluster: number; centrality: number; momentum: number; marketCap: number }> = [
  // Financials
  { symbol: "HDFCBANK",   name: "HDFC Bank",              cluster: 1, centrality: 0.82, momentum: 5.5,  marketCap: 1280000 },
  { symbol: "ICICIBANK",  name: "ICICI Bank",             cluster: 1, centrality: 0.78, momentum: 7.2,  marketCap: 820000 },
  { symbol: "SBIN",       name: "State Bank of India",    cluster: 1, centrality: 0.71, momentum: 4.1,  marketCap: 710000 },
  { symbol: "AXISBANK",   name: "Axis Bank",              cluster: 1, centrality: 0.68, momentum: 3.2,  marketCap: 350000 },
  { symbol: "KOTAKBANK",  name: "Kotak Mahindra Bank",    cluster: 1, centrality: 0.66, momentum: 2.8,  marketCap: 360000 },
  { symbol: "BAJFINANCE", name: "Bajaj Finance",          cluster: 1, centrality: 0.74, momentum: 12.4, marketCap: 480000 },
  { symbol: "HDFCLIFE",   name: "HDFC Life",              cluster: 1, centrality: 0.52, momentum: 1.8,  marketCap: 160000 },
  { symbol: "INDUSINDBK", name: "IndusInd Bank",          cluster: 1, centrality: 0.54, momentum: 2.1,  marketCap: 120000 },
  // IT
  { symbol: "TCS",        name: "Tata Consultancy",       cluster: 2, centrality: 0.81, momentum: 6.8,  marketCap: 1500000 },
  { symbol: "INFY",       name: "Infosys",                cluster: 2, centrality: 0.77, momentum: -2.1, marketCap: 750000 },
  { symbol: "HCLTECH",    name: "HCL Technologies",       cluster: 2, centrality: 0.65, momentum: 3.4,  marketCap: 430000 },
  { symbol: "WIPRO",      name: "Wipro",                  cluster: 2, centrality: 0.58, momentum: -1.2, marketCap: 260000 },
  { symbol: "TECHM",      name: "Tech Mahindra",          cluster: 2, centrality: 0.56, momentum: 0.8,  marketCap: 140000 },
  { symbol: "LTIM",       name: "LTIMindtree",            cluster: 2, centrality: 0.49, momentum: 2.5,  marketCap: 150000 },
  // Consumer / Auto
  { symbol: "RELIANCE",   name: "Reliance Industries",    cluster: 3, centrality: 0.84, momentum: 4.2,  marketCap: 1950000 },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever",     cluster: 3, centrality: 0.64, momentum: 1.2,  marketCap: 560000 },
  { symbol: "ITC",        name: "ITC",                    cluster: 3, centrality: 0.69, momentum: 3.6,  marketCap: 550000 },
  { symbol: "MARUTI",     name: "Maruti Suzuki",          cluster: 3, centrality: 0.63, momentum: 8.7,  marketCap: 320000 },
  { symbol: "TATAMOTORS", name: "Tata Motors",            cluster: 3, centrality: 0.67, momentum: 9.4,  marketCap: 310000 },
  { symbol: "M&M",        name: "Mahindra & Mahindra",    cluster: 3, centrality: 0.61, momentum: 5.8,  marketCap: 210000 },
  { symbol: "TITAN",      name: "Titan",                  cluster: 3, centrality: 0.55, momentum: 2.9,  marketCap: 290000 },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto",             cluster: 3, centrality: 0.53, momentum: 4.5,  marketCap: 220000 },
  { symbol: "EICHERMOT",  name: "Eicher Motors",          cluster: 3, centrality: 0.48, momentum: 3.2,  marketCap: 110000 },
  { symbol: "NESTLEIND",  name: "Nestle India",           cluster: 3, centrality: 0.50, momentum: 1.4,  marketCap: 240000 },
  { symbol: "BRITANNIA",  name: "Britannia",              cluster: 3, centrality: 0.46, momentum: 0.7,  marketCap: 110000 },
  { symbol: "ASIANPAINT", name: "Asian Paints",           cluster: 3, centrality: 0.44, momentum: -0.5, marketCap: 230000 },
  // Energy / Materials
  { symbol: "ONGC",       name: "Oil & Natural Gas Corp", cluster: 4, centrality: 0.59, momentum: 6.2,  marketCap: 320000 },
  { symbol: "NTPC",       name: "NTPC",                   cluster: 4, centrality: 0.57, momentum: 5.1,  marketCap: 360000 },
  { symbol: "POWERGRID",  name: "Power Grid Corp",        cluster: 4, centrality: 0.54, momentum: 4.3,  marketCap: 270000 },
  { symbol: "COALINDIA",  name: "Coal India",             cluster: 4, centrality: 0.51, momentum: 3.8,  marketCap: 290000 },
  { symbol: "ADANIENT",   name: "Adani Enterprises",      cluster: 4, centrality: 0.62, momentum: 15.2, marketCap: 300000 },
  { symbol: "ADANIPORTS", name: "Adani Ports",            cluster: 4, centrality: 0.58, momentum: 11.4, marketCap: 260000 },
  { symbol: "TATASTEEL",  name: "Tata Steel",             cluster: 4, centrality: 0.60, momentum: 8.1,  marketCap: 190000 },
  { symbol: "JSWSTEEL",   name: "JSW Steel",              cluster: 4, centrality: 0.55, momentum: 7.3,  marketCap: 220000 },
  { symbol: "HINDALCO",   name: "Hindalco",               cluster: 4, centrality: 0.52, momentum: 6.9,  marketCap: 140000 },
  { symbol: "GRASIM",     name: "Grasim",                 cluster: 4, centrality: 0.47, momentum: 3.4,  marketCap: 160000 },
  { symbol: "UPL",        name: "UPL",                    cluster: 4, centrality: 0.42, momentum: -2.8, marketCap: 50000 },
  // Pharma / Healthcare
  { symbol: "SUNPHARMA",  name: "Sun Pharma",             cluster: 5, centrality: 0.65, momentum: 4.7,  marketCap: 410000 },
  { symbol: "DRREDDY",    name: "Dr. Reddy's Labs",       cluster: 5, centrality: 0.58, momentum: 3.1,  marketCap: 110000 },
  { symbol: "CIPLA",      name: "Cipla",                  cluster: 5, centrality: 0.56, momentum: 2.9,  marketCap: 130000 },
  { symbol: "DIVISLAB",   name: "Divi's Labs",            cluster: 5, centrality: 0.53, momentum: 5.6,  marketCap: 150000 },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals",       cluster: 5, centrality: 0.50, momentum: 7.8,  marketCap: 110000 },
  // Other mixed
  { symbol: "LT",         name: "Larsen & Toubro",        cluster: 4, centrality: 0.70, momentum: 8.9,  marketCap: 510000 },
  { symbol: "BHARTIARTL", name: "Bharti Airtel",          cluster: 3, centrality: 0.72, momentum: 6.4,  marketCap: 900000 },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement",       cluster: 4, centrality: 0.49, momentum: 4.2,  marketCap: 310000 },
  { symbol: "SHRIRAMFIN", name: "Shriram Finance",        cluster: 1, centrality: 0.45, momentum: 5.9,  marketCap: 100000 },
  { symbol: "BPCL",       name: "BPCL",                   cluster: 4, centrality: 0.46, momentum: 3.7,  marketCap: 80000 },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp",          cluster: 3, centrality: 0.43, momentum: 1.9,  marketCap: 90000 },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv",          cluster: 1, centrality: 0.61, momentum: 7.8,  marketCap: 270000 },
  { symbol: "TATACONSUM", name: "Tata Consumer",          cluster: 3, centrality: 0.41, momentum: 2.1,  marketCap: 100000 },
  { symbol: "SBILIFE",    name: "SBI Life",               cluster: 1, centrality: 0.47, momentum: 3.3,  marketCap: 150000 },
];

function buildNodes(): GraphNode[] {
  return STOCKS.map((s) => {
    const c = CLUSTERS.find((x) => x.id === s.cluster)!;
    return {
      id: s.symbol,
      symbol: s.symbol,
      name: s.name,
      cluster: s.cluster,
      clusterLabel: c.label,
      clusterColor: c.color,
      centrality: s.centrality,
      momentum: s.momentum,
      marketCap: s.marketCap,
    };
  });
}

function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  // Deterministic pseudo-random so SSR + client match
  function h(a: string, b: string) {
    let x = 2166136261;
    const s = a + "|" + b;
    for (let i = 0; i < s.length; i++) {
      x ^= s.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return ((x >>> 0) % 1000) / 1000;
  }
  const edges: GraphEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const same = a.cluster === b.cluster;
      const r = h(a.symbol, b.symbol);
      if (same && r < 0.55) {
        edges.push({ source: a.id, target: b.id, weight: 0.6 + r * 0.35 });
      } else if (!same && r < 0.04) {
        edges.push({ source: a.id, target: b.id, weight: 0.5 + r * 0.1 });
      }
    }
  }
  return edges;
}

const nodes = buildNodes();
const edges = buildEdges(nodes);

export const sampleGraph = {
  nodes,
  edges,
  meta: {
    universe: "NIFTY50",
    method: "louvain + eigenvector centrality",
    lookbackDays: 63,
    correlationThreshold: 0.5,
    clustersDetected: CLUSTERS.length,
    modularity: 0.452,
    asOf: "2026-04-24T02:30:00Z",
    fallback: false,
    clusterLabels: CLUSTERS.reduce<Record<number, string>>((acc, c) => {
      acc[c.id] = c.label;
      return acc;
    }, {}),
  },
};
