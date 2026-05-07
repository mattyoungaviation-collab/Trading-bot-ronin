"use client";

import { useState } from "react";

type QuoteResult = {
  ok: boolean;
  message: string;
  token: {
    id: number;
    name: string;
    symbol: string;
    contractAddress: string;
    pairAddress: string | null;
    poolType: string;
    baseToken: string;
    baseTokenAddress: string | null;
    feeTier: number | null;
  };
  quote?: {
    id: number;
    amountIn: string;
    amountOut: string;
    priceImpactPct: number;
    roundTripImpactPct: number | null;
    liquidityUsd: number | null;
    quoteSource: string | null;
    confidence: number;
    createdAt: string;
  };
  metrics: null | {
    priceBasePerToken: number;
    tokenReserve: number;
    baseReserve: number;
    amountInBase: number;
    amountOutToken: number;
    buyImpact: number;
    sellImpact: number;
    roundTripImpact: number;
    estimatedSellBackBase: number;
    liquidityApproxBase: number;
    confidence: number;
  };
};

type QuotesResponse = {
  generatedAt: string;
  settings: { maxTradeSizeUsd: number; maxBuyImpactPct: number; maxSellImpactPct: number; maxRoundTripImpactPct: number } | null;
  results: QuoteResult[];
};

function fmt(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "?";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function QuotesPage() {
  const [data, setData] = useState<QuotesResponse | null>(null);
  const [status, setStatus] = useState("Run a quote scan to monitor active tokens.");
  const [loading, setLoading] = useState(false);

  async function runQuoteScan() {
    setLoading(true);
    setStatus("Running quote scan...");
    try {
      const response = await fetch("/api/quotes", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Quote scan failed.");
      setData(json);
      setStatus("Quote scan complete.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Quote scan failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Live Pool Quotes</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Database driven monitoring for active tokens. V2 reads pair reserves. V3 is safely blocked until quoter wiring is added.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/tokens" style={linkStyle}>Tokens</a>
          <a href="/decisions" style={linkStyle}>Decisions</a>
          <button onClick={runQuoteScan} disabled={loading} style={buttonStyle}>{loading ? "Scanning..." : "Run Quote Scan"}</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last scan: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      {data ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Card title="Max Trade Size" value={`$${fmt(data.settings?.maxTradeSizeUsd, 2)}`} detail="Quote input size" />
            <Card title="Buy Impact Limit" value={`${fmt(data.settings?.maxBuyImpactPct, 2)}%`} detail="Settings limit" />
            <Card title="Sell Impact Limit" value={`${fmt(data.settings?.maxSellImpactPct, 2)}%`} detail="Settings limit" />
            <Card title="Round Trip Limit" value={`${fmt(data.settings?.maxRoundTripImpactPct, 2)}%`} detail="Settings limit" />
          </section>

          <section style={{ display: "grid", gap: 14 }}>
            {data.results.length === 0 ? <p>No active tokens. Add and activate tokens on /tokens.</p> : null}
            {data.results.map((result) => (
              <article key={result.token.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, background: result.ok ? "#f0fff4" : "#fff7ed" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{result.ok ? "QUOTED" : "NOT QUOTED"} · {result.token.symbol}</h2>
                    <p style={{ margin: "8px 0", color: "#555" }}>{result.token.name} / {result.token.poolType} / Base {result.token.baseToken}</p>
                    <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}><strong>Token:</strong> {result.token.contractAddress}</p>
                    <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}><strong>Base:</strong> {result.token.baseTokenAddress || "Missing"}</p>
                    <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}><strong>Pool:</strong> {result.token.pairAddress || "Missing"}</p>
                    <p style={{ margin: "8px 0" }}><strong>Message:</strong> {result.message}</p>
                  </div>
                  {result.metrics ? (
                    <div style={{ minWidth: 300 }}>
                      <Mini label="Price base/token" value={fmt(result.metrics.priceBasePerToken, 8)} />
                      <Mini label="Token Reserve" value={fmt(result.metrics.tokenReserve, 4)} />
                      <Mini label="Base Reserve" value={fmt(result.metrics.baseReserve, 4)} />
                      <Mini label="Buy Impact" value={`${fmt(result.metrics.buyImpact, 4)}%`} />
                      <Mini label="Sell Impact" value={`${fmt(result.metrics.sellImpact, 4)}%`} />
                      <Mini label="Round Trip Impact" value={`${fmt(result.metrics.roundTripImpact, 4)}%`} />
                      <Mini label="Estimated Sell Back" value={fmt(result.metrics.estimatedSellBackBase, 4)} />
                      <Mini label="Confidence" value={fmt(result.metrics.confidence, 2)} />
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}

function Card({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, background: "#f0fff4" }}>
      <p style={{ margin: 0, color: "#555" }}>{title}</p>
      <h2 style={{ margin: "8px 0" }}>{value}</h2>
      <p style={{ margin: 0 }}>{detail}</p>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10, marginBottom: 8 }}>
      <p style={{ margin: 0, color: "#555" }}>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  cursor: "pointer",
  fontWeight: 700,
};

const linkStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  color: "#111",
  textDecoration: "none",
  fontWeight: 700,
};
