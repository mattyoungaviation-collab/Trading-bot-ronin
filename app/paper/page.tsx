"use client";

import { useEffect, useState } from "react";

type PaperTrade = {
  id: number;
  tokenId: number;
  side: string;
  entryPrice: number;
  qty: number;
  status: string;
  pnl: number;
  createdAt: string;
  token: { symbol: string; name: string; poolType: string; pairAddress: string | null } | null;
};

type PaperData = {
  generatedAt: string;
  settings: { botMode: string; emergencyStop: boolean; maxTradeSizeUsd: number } | null;
  paperTrades: PaperTrade[];
  summary: { totalTrades: number; openTrades: number; closedTrades: number; realizedPnl: number };
};

export default function PaperPage() {
  const [data, setData] = useState<PaperData | null>(null);
  const [status, setStatus] = useState("Loading paper trades...");
  const [loading, setLoading] = useState(false);

  async function loadPaper() {
    try {
      const response = await fetch("/api/paper", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Paper load failed.");
      setData(json);
      setStatus("Paper trades loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Paper load failed.");
    }
  }

  async function createPaperTrades() {
    setLoading(true);
    setStatus("Creating paper trade simulations...");
    try {
      const response = await fetch("/api/paper", { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Paper simulation failed.");
      setStatus(`Created ${json.created.length} paper trade(s). Rejected ${json.rejected.length}.`);
      await loadPaper();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Paper simulation failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPaper();
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Paper Trading</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Simulated trades only. No wallet, no private key, no swaps. Requires bot mode PAPER and Emergency Stop OFF.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/decisions" style={linkStyle}>Decisions</a>
          <a href="/settings" style={linkStyle}>Settings</a>
          <button onClick={createPaperTrades} disabled={loading} style={buttonStyle}>{loading ? "Simulating..." : "Create Paper Trades"}</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last checked: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      {data ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Card title="Bot Mode" value={data.settings?.botMode || "UNKNOWN"} detail={data.settings?.emergencyStop ? "Emergency Stop ON" : "Emergency Stop OFF"} danger={data.settings?.botMode !== "PAPER" || !!data.settings?.emergencyStop} />
            <Card title="Max Paper Size" value={`$${data.settings?.maxTradeSizeUsd ?? "?"}`} detail="Used as fake position size" />
            <Card title="Open Paper Trades" value={String(data.summary.openTrades)} detail="Simulated open positions" />
            <Card title="Realized PnL" value={`$${data.summary.realizedPnl.toFixed(2)}`} detail="Fake PnL only" />
          </section>

          <section style={{ display: "grid", gap: 14 }}>
            {data.paperTrades.length === 0 ? <p>No paper trades yet.</p> : null}
            {data.paperTrades.map((trade) => (
              <article key={trade.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, background: trade.status === "OPEN" ? "#f0fff4" : "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{trade.side} · {trade.token?.symbol || `Token ${trade.tokenId}`}</h2>
                    <p style={{ margin: "8px 0", color: "#555" }}>{trade.token?.name || "Unknown token"} / {trade.token?.poolType || "Unknown pool"}</p>
                    <p style={{ margin: "8px 0" }}><strong>Status:</strong> {trade.status}</p>
                    <p style={{ margin: "8px 0" }}><strong>Entry Price:</strong> {trade.entryPrice}</p>
                    <p style={{ margin: "8px 0" }}><strong>Qty:</strong> {trade.qty}</p>
                    <p style={{ margin: "8px 0" }}><strong>PnL:</strong> ${trade.pnl.toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0 }}><strong>Created</strong></p>
                    <p>{new Date(trade.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}

function Card({ title, value, detail, danger = false }: { title: string; value: string; detail: string; danger?: boolean }) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, background: danger ? "#fff7ed" : "#f0fff4" }}>
      <p style={{ margin: 0, color: "#555" }}>{title}</p>
      <h2 style={{ margin: "8px 0" }}>{value}</h2>
      <p style={{ margin: 0 }}>{detail}</p>
    </section>
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
