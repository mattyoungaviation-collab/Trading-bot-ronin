"use client";

import { useEffect, useMemo, useState } from "react";

type PaperTrade = {
  id: number;
  tokenId: number;
  side: string;
  entryPrice: number;
  qty: number;
  status: string;
  pnl: number;
  createdAt: string;
  tokenQty?: number;
  currentPrice?: number;
  currentValue?: number;
  currentPnl?: number;
  currentPnlPct?: number;
  token: { symbol: string; name: string; poolType: string; pairAddress: string | null } | null;
  latestQuote?: { id: number; createdAt: string } | null;
};

type PaperData = {
  generatedAt: string;
  settings: { botMode: string; emergencyStop: boolean; maxTradeSizeUsd: number; takeProfitPct: number; stopLossPct: number } | null;
  paperTrades: PaperTrade[];
  summary: { totalTrades: number; openTrades: number; closedTrades: number; realizedPnl: number; unrealizedPnl: number };
};

function money(value: number | undefined | null) {
  const safe = Number(value || 0);
  return `$${safe.toFixed(2)}`;
}

function num(value: number | undefined | null, digits = 8) {
  const safe = Number(value || 0);
  return safe.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function PaperPage() {
  const [data, setData] = useState<PaperData | null>(null);
  const [status, setStatus] = useState("Loading paper trades...");
  const [loading, setLoading] = useState(false);

  const openTrades = useMemo(() => data?.paperTrades.filter((trade) => trade.status === "OPEN") || [], [data]);
  const closedTrades = useMemo(() => data?.paperTrades.filter((trade) => trade.status !== "OPEN") || [], [data]);

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
      const response = await fetch("/api/paper", { method: "POST", cache: "no-store" });
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

  async function closeTrade(tradeId: number) {
    setLoading(true);
    setStatus("Closing paper trade...");
    try {
      const response = await fetch("/api/paper", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", tradeId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Close failed.");
      setStatus("Paper trade closed manually.");
      await loadPaper();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Close failed.");
    } finally {
      setLoading(false);
    }
  }

  async function resetTrades() {
    const confirmed = window.confirm("Reset all paper trades? This deletes open and closed paper trade history.");
    if (!confirmed) return;

    setLoading(true);
    setStatus("Resetting paper trades...");
    try {
      const response = await fetch("/api/paper", { method: "DELETE", cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Reset failed.");
      setStatus(`Reset complete. Deleted ${json.deletedCount} paper trade(s).`);
      await loadPaper();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reset failed.");
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
          <h1 style={{ marginBottom: 8 }}>Paper Trading Manager</h1>
          <p style={{ marginTop: 0, color: "#555" }}>Simulated trades only. Tracks accepted decisions, quote based entries, unrealized PnL, manual closes, and reset history.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/quotes" style={linkStyle}>Quotes</a>
          <a href="/decisions" style={linkStyle}>Decisions</a>
          <a href="/settings" style={linkStyle}>Settings</a>
          <button onClick={loadPaper} disabled={loading} style={buttonStyle}>Refresh</button>
          <button onClick={createPaperTrades} disabled={loading} style={buttonStyle}>{loading ? "Working..." : "Create Paper Trades"}</button>
          <button onClick={resetTrades} disabled={loading} style={dangerButtonStyle}>Reset</button>
        </div>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 18, margin: "20px 0", background: "#f8fafc" }}>
        <strong>Status:</strong> {status}
        {data ? <p style={{ marginBottom: 0 }}>Last checked: {new Date(data.generatedAt).toLocaleString()}</p> : null}
      </section>

      {data ? (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Card title="Bot Mode" value={data.settings?.botMode || "UNKNOWN"} detail={data.settings?.emergencyStop ? "Emergency Stop ON" : "Emergency Stop OFF"} danger={data.settings?.botMode !== "PAPER" || !!data.settings?.emergencyStop} />
            <Card title="Open Trades" value={String(data.summary.openTrades)} detail="Simulated positions" />
            <Card title="Closed Trades" value={String(data.summary.closedTrades)} detail="Paper trade history" />
            <Card title="Unrealized PnL" value={money(data.summary.unrealizedPnl)} detail="Open fake PnL" danger={data.summary.unrealizedPnl < 0} />
            <Card title="Realized PnL" value={money(data.summary.realizedPnl)} detail="Closed fake PnL" danger={data.summary.realizedPnl < 0} />
            <Card title="TP / SL" value={`${data.settings?.takeProfitPct ?? "?"}% / ${data.settings?.stopLossPct ?? "?"}%`} detail="Auto close settings" />
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2>Open Paper Positions</h2>
            <div style={{ display: "grid", gap: 14 }}>
              {openTrades.length === 0 ? <p>No open paper trades.</p> : null}
              {openTrades.map((trade) => (
                <TradeCard key={trade.id} trade={trade} onClose={() => closeTrade(trade.id)} />
              ))}
            </div>
          </section>

          <section>
            <h2>Closed Paper History</h2>
            <div style={{ display: "grid", gap: 14 }}>
              {closedTrades.length === 0 ? <p>No closed paper trades.</p> : null}
              {closedTrades.map((trade) => (
                <TradeCard key={trade.id} trade={trade} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function TradeCard({ trade, onClose }: { trade: PaperTrade; onClose?: () => void }) {
  const pnl = trade.status === "OPEN" ? trade.currentPnl : trade.pnl;
  const pnlPct = trade.currentPnlPct || 0;

  return (
    <article style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, background: trade.status === "OPEN" ? "#f0fff4" : "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>{trade.side} · {trade.token?.symbol || `Token ${trade.tokenId}`}</h3>
          <p style={{ margin: "8px 0", color: "#555" }}>{trade.token?.name || "Unknown token"} / {trade.token?.poolType || "Unknown pool"}</p>
          <p style={{ margin: "8px 0" }}><strong>Status:</strong> {trade.status}</p>
          <p style={{ margin: "8px 0" }}><strong>Entry Price:</strong> {num(trade.entryPrice, 10)}</p>
          <p style={{ margin: "8px 0" }}><strong>Current Price:</strong> {num(trade.currentPrice, 10)}</p>
          <p style={{ margin: "8px 0" }}><strong>Position Size:</strong> {money(trade.qty)}</p>
          <p style={{ margin: "8px 0" }}><strong>Token Qty:</strong> {num(trade.tokenQty, 6)}</p>
          <p style={{ margin: "8px 0" }}><strong>Current Value:</strong> {money(trade.currentValue)}</p>
          <p style={{ margin: "8px 0" }}><strong>PnL:</strong> {money(pnl)} / {pnlPct.toFixed(2)}%</p>
        </div>
        <div>
          <p style={{ margin: 0 }}><strong>Created</strong></p>
          <p>{new Date(trade.createdAt).toLocaleString()}</p>
          {trade.latestQuote ? <p><strong>Latest Quote:</strong> {new Date(trade.latestQuote.createdAt).toLocaleString()}</p> : <p>No latest quote</p>}
          {onClose ? <button onClick={onClose} style={buttonStyle}>Close Manually</button> : null}
        </div>
      </div>
    </article>
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

const dangerButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #991b1b",
  color: "#991b1b",
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
